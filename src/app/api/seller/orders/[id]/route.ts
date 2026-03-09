export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { orderDirectEditSchema } from "@/lib/validations/order";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, sellerId: ctx.userId, ...tenantFilter(ctx) },
    include: {
      items: {
        include: {
          product: {
            select: { name: true, code: true, imageUrl: true, unit: true },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "주문을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: order });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: patchError, ctx: patchCtx } = await getTenantContext();
  if (patchError) return patchError;
  if (patchCtx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const { id } = await params;
  const sellerId = patchCtx.userId;

  const body = await request.json();
  const parsed = orderDirectEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const validated = parsed.data;

  try {
    const order = await prisma.order.findFirst({
      where: { id, sellerId, ...tenantFilter(patchCtx) },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "주문을 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

    if (order.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "INVALID_STATUS", message: "대기 상태의 주문만 직접 수정할 수 있습니다" } },
        { status: 400 }
      );
    }

    // 아이템 변경이 없는 경우: 수취인 정보만 업데이트
    if (!validated.items) {
      const { items: _, ...updateData } = validated;
      const updated = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          items: {
            include: { product: { select: { name: true, code: true, imageUrl: true, unit: true } } },
          },
        },
      });
      return NextResponse.json({ data: updated });
    }

    // 아이템 변경: 트랜잭션으로 재고/예치금 정산
    const result = await prisma.$transaction(async (tx) => {
      // 1. 기존 아이템 재고 복원
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // 2. 셀러 프로필 조회
      const sellerProfile = await tx.sellerProfile.findUnique({
        where: { userId: sellerId },
        select: { gradeId: true },
      });

      // 3. 새 아이템 가격 계산
      const productIds = validated.items!.map((item) => item.productId);
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
      const newOrderItems: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];

      for (const item of validated.items!) {
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

        newOrderItems.push({ productId: item.productId, quantity: item.quantity, unitPrice, totalPrice });
        newTotalAmount += totalPrice;
        newTotalShippingFee += Number(product.shippingFee);
      }

      // 4. 예치금 차액 정산
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
            description: `주문 수정 ${order.orderNumber}`,
          },
        });
      }

      // 5. 새 아이템 재고 차감
      for (const item of validated.items!) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 6. 기존 아이템 삭제 + 새 아이템 생성 + 주문 업데이트
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      const { items: _, ...recipientData } = validated;
      const updated = await tx.order.update({
        where: { id },
        data: {
          ...recipientData,
          totalAmount: newTotalAmount,
          totalShippingFee: newTotalShippingFee,
          items: { create: newOrderItems },
        },
        include: {
          items: {
            include: { product: { select: { name: true, code: true, imageUrl: true, unit: true } } },
          },
        },
      });

      return updated;
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
        { error: { code: "INSUFFICIENT_BALANCE", message: "예치금 잔액이 부족합니다" } },
        { status: 400 }
      );
    }
    console.error("Order edit error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
