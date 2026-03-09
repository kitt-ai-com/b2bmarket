export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { orderModResponseSchema } from "@/lib/validations/order";
import { createNotification } from "@/lib/notification";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;

  const modRequest = await prisma.orderModificationRequest.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          items: {
            include: { product: { select: { name: true, code: true } } },
          },
          seller: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!modRequest) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "수정 요청을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: modRequest });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;
  const adminId = ctx.userId;

  const body = await request.json();
  const parsed = orderModResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요" } },
      { status: 400 }
    );
  }

  const { status, adminNote } = parsed.data;

  const modRequest = await prisma.orderModificationRequest.findUnique({
    where: { id },
    include: {
      order: {
        include: { items: true },
      },
    },
  });

  if (!modRequest) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "수정 요청을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  if (modRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: { code: "ALREADY_PROCESSED", message: "이미 처리된 요청입니다" } },
      { status: 400 }
    );
  }

  const order = modRequest.order;
  const changes = modRequest.changes as Record<string, unknown>;

  if (status === "REJECTED") {
    // 거절: 상태만 업데이트
    const updated = await prisma.orderModificationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        adminNote,
        processedBy: adminId,
        processedAt: new Date(),
      },
    });

    await createNotification({
      userId: modRequest.sellerId,
      type: "ORDER_MOD_RESPONDED",
      title: `수정 요청 거절: ${order.orderNumber}`,
      message: `주문 ${order.orderNumber}의 수정 요청이 거절되었습니다.${adminNote ? ` 사유: ${adminNote}` : ""}`,
      data: { orderId: order.id, modRequestId: id },
    });

    return NextResponse.json({ data: updated });
  }

  // 승인: 트랜잭션으로 변경사항 적용
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 수취인 정보 변경
      const recipientUpdate: Record<string, unknown> = {};
      if (changes.recipientName) recipientUpdate.recipientName = changes.recipientName;
      if (changes.recipientPhone) recipientUpdate.recipientPhone = changes.recipientPhone;
      if (changes.recipientAddr) recipientUpdate.recipientAddr = changes.recipientAddr;
      if (changes.postalCode !== undefined) recipientUpdate.postalCode = changes.postalCode;
      if (changes.notes !== undefined) recipientUpdate.notes = changes.notes;

      // 아이템 변경
      if (changes.items && Array.isArray(changes.items)) {
        const newItems = changes.items as { productId: string; quantity: number }[];
        const sellerId = modRequest.sellerId;

        // 기존 아이템 재고 복원
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        // 셀러 프로필 조회
        const sellerProfile = await tx.sellerProfile.findUnique({
          where: { userId: sellerId },
          select: { gradeId: true },
        });

        // 새 아이템 가격 계산
        const productIds = newItems.map((item) => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, status: "ACTIVE" },
          include: {
            gradePrices: sellerProfile
              ? { where: { gradeId: sellerProfile.gradeId }, select: { price: true } }
              : false,
            sellerPrices: {
              where: { sellerId },
              select: { price: true },
            },
          },
        });

        if (products.length !== productIds.length) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        let newTotalAmount = 0;
        let newTotalShippingFee = 0;
        const orderItems: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];

        for (const item of newItems) {
          const product = products.find((p) => p.id === item.productId)!;

          if (product.stock < item.quantity) {
            throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
          }

          const sellerPrice = product.sellerPrices[0]?.price;
          const gradePrice =
            product.gradePrices && (product.gradePrices as any[]).length > 0
              ? (product.gradePrices as any[])[0]?.price
              : null;
          const unitPrice = Number(sellerPrice || gradePrice || product.basePrice);
          const totalPrice = unitPrice * item.quantity;

          orderItems.push({ productId: item.productId, quantity: item.quantity, unitPrice, totalPrice });
          newTotalAmount += totalPrice;
          newTotalShippingFee += Number(product.shippingFee);
        }

        // 예치금 차액 정산
        const oldGrandTotal = Number(order.totalAmount) + Number(order.totalShippingFee);
        const newGrandTotal = newTotalAmount + newTotalShippingFee;
        const diff = newGrandTotal - oldGrandTotal;

        const deposit = await tx.deposit.findUnique({ where: { sellerId } });
        if (!deposit) throw new Error("INSUFFICIENT_BALANCE");

        const currentBalance = Number(deposit.balance);
        if (diff > 0 && currentBalance < diff) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        const newBalance = currentBalance - diff;
        await tx.deposit.update({
          where: { sellerId },
          data: { balance: newBalance },
        });

        if (diff !== 0) {
          await tx.depositTransaction.create({
            data: {
              depositId: deposit.id,
              type: diff > 0 ? "DEDUCT" : "REFUND",
              amount: Math.abs(diff),
              balanceAfter: newBalance,
              description: `주문 수정 승인 ${order.orderNumber}`,
            },
          });
        }

        // 새 아이템 재고 차감
        for (const item of newItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        // 기존 아이템 삭제 + 새 아이템 생성
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
        recipientUpdate.totalAmount = newTotalAmount;
        recipientUpdate.totalShippingFee = newTotalShippingFee;
        await tx.order.update({
          where: { id: order.id },
          data: {
            ...recipientUpdate,
            items: { create: orderItems },
          },
        });
      } else if (Object.keys(recipientUpdate).length > 0) {
        await tx.order.update({
          where: { id: order.id },
          data: recipientUpdate,
        });
      }

      // 수정 요청 상태 업데이트
      return tx.orderModificationRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          adminNote,
          processedBy: adminId,
          processedAt: new Date(),
        },
      });
    });

    await createNotification({
      userId: modRequest.sellerId,
      type: "ORDER_MOD_RESPONDED",
      title: `수정 요청 승인: ${order.orderNumber}`,
      message: `주문 ${order.orderNumber}의 수정 요청이 승인되어 변경사항이 적용되었습니다.`,
      data: { orderId: order.id, modRequestId: id },
    });

    return NextResponse.json({ data: result });
  } catch (err: any) {
    if (err.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "PRODUCT_NOT_FOUND", message: "존재하지 않거나 판매중지된 상품이 포함되어 있습니다" } },
        { status: 400 }
      );
    }
    if (err.message?.startsWith("INSUFFICIENT_STOCK:")) {
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_STOCK", message: `${err.message.split(":")[1]} 재고가 부족합니다` } },
        { status: 400 }
      );
    }
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_BALANCE", message: "셀러 예치금 잔액이 부족합니다" } },
        { status: 400 }
      );
    }
    console.error("Order modification approval error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
