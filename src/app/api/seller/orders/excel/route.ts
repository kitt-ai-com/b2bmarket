export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { generateExcel, parseExcel, type ColumnDef } from "@/lib/excel";

const ORDER_DOWNLOAD_COLUMNS: ColumnDef[] = [
  { header: "주문번호", key: "orderNumber", width: 18 },
  { header: "상품", key: "productSummary", width: 25 },
  { header: "상태", key: "status", width: 10 },
  { header: "수령자", key: "recipientName", width: 12 },
  { header: "전화", key: "recipientPhone", width: 15 },
  { header: "주소", key: "recipientAddr", width: 30 },
  { header: "우편번호", key: "postalCode", width: 10 },
  { header: "금액", key: "totalAmount", width: 12 },
  { header: "택배사", key: "courier", width: 10 },
  { header: "송장번호", key: "trackingNumber", width: 18 },
  { header: "주문일", key: "createdAt", width: 12 },
  { header: "메모", key: "notes", width: 20 },
];

const ORDER_UPLOAD_COLUMNS: ColumnDef[] = [
  { header: "수령자", key: "recipientName", width: 12 },
  { header: "전화", key: "recipientPhone", width: 15 },
  { header: "주소", key: "recipientAddr", width: 30 },
  { header: "우편번호", key: "postalCode", width: 10 },
  { header: "상품코드", key: "productCode", width: 15 },
  { header: "수량", key: "quantity", width: 8 },
  { header: "메모", key: "notes", width: 20 },
];

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "";
  const template = searchParams.get("template") || "";

  // 업로드 템플릿 요청
  if (template === "upload") {
    const { generateTemplate } = await import("@/lib/excel");
    const buf = generateTemplate(ORDER_UPLOAD_COLUMNS, "주문업로드템플릿");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="order_upload_template.xlsx"`,
      },
    });
  }

  const where: any = { sellerId: ctx.userId, ...tenantFilter(ctx) };
  if (status) where.status = status;

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: {
        include: { product: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    productSummary:
      o.items.map((i) => `${i.product.name} x${i.quantity}`).join(", "),
    status: o.status,
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    recipientAddr: o.recipientAddr,
    postalCode: o.postalCode || "",
    totalAmount: Number(o.totalAmount),
    courier: o.courier || "",
    trackingNumber: o.trackingNumber || "",
    createdAt: new Date(o.createdAt).toLocaleDateString("ko-KR"),
    notes: o.notes || "",
  }));

  const buffer = generateExcel(ORDER_DOWNLOAD_COLUMNS, rows, "내주문목록");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="my_orders_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

function generateOrderNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `ORD-${yy}${mm}${dd}-${rand}`;
}

export async function POST(request: NextRequest) {
  const { error: postError, ctx: postCtx } = await getTenantContext();
  if (postError) return postError;
  if (postCtx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json(
        { error: { code: "NO_FILE", message: "파일을 선택해주세요" } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseExcel(buffer, ORDER_UPLOAD_COLUMNS);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: { code: "EMPTY_FILE", message: "데이터가 없습니다" } },
        { status: 400 }
      );
    }

    const sellerId = postCtx.userId;

    // 셀러 프로필 조회 (등급가격)
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: sellerId },
      select: { gradeId: true },
    });

    // 예치금 조회
    let deposit = await prisma.deposit.findUnique({ where: { sellerId } });
    if (!deposit) {
      deposit = await prisma.deposit.create({ data: { sellerId, balance: 0 } });
    }
    let currentBalance = Number(deposit.balance);

    // 수령자 기준으로 그룹핑
    const orderGroups: Map<string, typeof rows> = new Map();
    for (const row of rows) {
      const key = `${row.recipientName}|${row.recipientPhone}|${row.recipientAddr}`;
      const group = orderGroups.get(key) || [];
      group.push(row);
      orderGroups.set(key, group);
    }

    let created = 0;
    const errors: string[] = [];

    for (const [, groupRows] of orderGroups) {
      const first = groupRows[0];
      if (!first.recipientName || !first.recipientPhone || !first.recipientAddr) {
        errors.push(`수령자 정보가 누락되었습니다`);
        continue;
      }

      // 상품 조회 + 가격 계산
      const items: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
      let totalAmount = 0;
      let totalShippingFee = 0;
      let hasError = false;

      for (const row of groupRows) {
        if (!row.productCode || !row.quantity) {
          errors.push(`상품코드 또는 수량이 누락되었습니다: ${row.productCode || "(없음)"}`);
          hasError = true;
          break;
        }

        const product = await prisma.product.findUnique({
          where: { code: row.productCode },
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

        if (!product || product.status !== "ACTIVE") {
          errors.push(`상품을 찾을 수 없거나 판매중이 아닙니다: ${row.productCode}`);
          hasError = true;
          break;
        }

        const qty = parseInt(row.quantity) || 1;
        if (product.stock < qty) {
          errors.push(`재고 부족: ${product.name} (재고: ${product.stock}, 요청: ${qty})`);
          hasError = true;
          break;
        }

        // 가격: sellerPrice > gradePrice > basePrice
        const sellerPrice = product.sellerPrices[0]?.price;
        const gradePrice =
          product.gradePrices && (product.gradePrices as any[]).length > 0
            ? (product.gradePrices as any[])[0]?.price
            : null;
        const unitPrice = Number(sellerPrice || gradePrice || product.basePrice);

        items.push({
          productId: product.id,
          quantity: qty,
          unitPrice,
          totalPrice: unitPrice * qty,
        });
        totalAmount += unitPrice * qty;
        totalShippingFee += Number(product.shippingFee);
      }

      if (hasError) continue;

      // 예치금 확인
      const grandTotal = totalAmount + totalShippingFee;
      if (currentBalance < grandTotal) {
        errors.push(`예치금 부족 (필요: ${grandTotal.toLocaleString()}원, 잔액: ${currentBalance.toLocaleString()}원)`);
        continue;
      }

      // 트랜잭션: 주문 생성 + 예치금 차감 + 재고 차감
      await prisma.$transaction(async (tx) => {
        // 재고 차감
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        // 예치금 차감
        const newBalance = currentBalance - grandTotal;
        await tx.deposit.update({
          where: { sellerId },
          data: { balance: newBalance },
        });

        // 주문 생성
        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            sellerId,
            tenantId: postCtx.tenantId,
            recipientName: first.recipientName,
            recipientPhone: first.recipientPhone,
            recipientAddr: first.recipientAddr,
            postalCode: first.postalCode || null,
            notes: first.notes || null,
            totalAmount,
            totalShippingFee,
            items: { create: items },
          },
        });

        // 예치금 거래내역
        await tx.depositTransaction.create({
          data: {
            depositId: deposit!.id,
            type: "DEDUCT",
            amount: grandTotal,
            balanceAfter: newBalance,
            description: `주문 ${order.orderNumber} (엑셀 업로드)`,
          },
        });

        currentBalance = newBalance;
      });

      created++;
    }

    return NextResponse.json({
      data: { created, errors },
    });
  } catch (err) {
    console.error("[seller/orders/excel POST]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "파일 처리 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
