export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { orderCreateSchema } from "@/lib/validations/order";

// 주문번호 생성: ORD-YYMMDD-XXXX
function generateOrderNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `ORD-${yy}${mm}${dd}-${rand}`;
}

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "";
  const search = searchParams.get("search") || "";

  const where: any = { sellerId: ctx.userId, ...tenantFilter(ctx) };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { recipientName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: { product: { select: { name: true, code: true, imageUrl: true } } },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    data: orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const { error: postError, ctx: postCtx } = await getTenantContext();
  if (postError) return postError;
  if (postCtx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const body = await request.json();
  const parsed = orderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const validated = parsed.data;
  const sellerId = postCtx.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. 셀러 프로필 조회 (등급 가격용)
      const sellerProfile = await tx.sellerProfile.findUnique({
        where: { userId: sellerId },
        select: { gradeId: true },
      });

      // 2. 상품 조회 + 가격 계산
      const productIds = validated.items.map((item) => item.productId);
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

      // 3. 주문 아이템 + 총액 + 배송비 계산
      let totalAmount = 0;
      let totalShippingFee = 0;
      const orderItems: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];

      for (const item of validated.items) {
        const product = products.find((p) => p.id === item.productId)!;

        // 재고 확인
        if (product.stock < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        // 가격: sellerPrice > gradePrice > basePrice
        const sellerPrice = product.sellerPrices[0]?.price;
        const gradePrice =
          product.gradePrices && (product.gradePrices as any[]).length > 0
            ? (product.gradePrices as any[])[0]?.price
            : null;
        const unitPrice = Number(sellerPrice || gradePrice || product.basePrice);
        const totalPrice = unitPrice * item.quantity;

        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        });
        totalAmount += totalPrice;
        totalShippingFee += Number(product.shippingFee);
      }

      // 4. 예치금 확인 및 차감
      let deposit = await tx.deposit.findUnique({ where: { sellerId } });
      if (!deposit) {
        deposit = await tx.deposit.create({ data: { sellerId, balance: 0 } });
      }

      const currentBalance = Number(deposit.balance);
      const grandTotal = totalAmount + totalShippingFee;
      if (currentBalance < grandTotal) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const newBalance = currentBalance - grandTotal;

      await tx.deposit.update({
        where: { sellerId },
        data: { balance: newBalance },
      });

      // 5. 재고 차감
      for (const item of validated.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 6. 주문 생성
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          sellerId,
          tenantId: postCtx.tenantId,
          recipientName: validated.recipientName,
          recipientPhone: validated.recipientPhone,
          recipientAddr: validated.recipientAddr,
          postalCode: validated.postalCode || null,
          notes: validated.notes || null,
          totalAmount,
          totalShippingFee,
          items: {
            create: orderItems,
          },
        },
        include: { items: true },
      });

      // 7. 예치금 거래내역 생성
      await tx.depositTransaction.create({
        data: {
          depositId: deposit.id,
          type: "DEDUCT",
          amount: grandTotal,
          balanceAfter: newBalance,
          description: `주문 ${order.orderNumber}`,
        },
      });

      return order;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: any) {
    if (err.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "PRODUCT_NOT_FOUND", message: "존재하지 않거나 판매중지된 상품이 포함되어 있습니다" } },
        { status: 400 }
      );
    }
    if (err.message?.startsWith("INSUFFICIENT_STOCK:")) {
      const productName = err.message.split(":")[1];
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_STOCK", message: `${productName} 재고가 부족합니다` } },
        { status: 400 }
      );
    }
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_BALANCE", message: "예치금 잔액이 부족합니다" } },
        { status: 400 }
      );
    }
    throw err;
  }
}
