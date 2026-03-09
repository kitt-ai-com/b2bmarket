export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { generateExcel, parseExcel, type ColumnDef } from "@/lib/excel";

const ORDER_COLUMNS: ColumnDef[] = [
  { header: "주문번호", key: "orderNumber", width: 18 },
  { header: "셀러", key: "sellerName", width: 15 },
  { header: "업체명", key: "businessName", width: 15 },
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

const UPLOAD_COLUMNS: ColumnDef[] = [
  { header: "셀러이메일", key: "sellerEmail", width: 20 },
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
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "";
  const sellerId = searchParams.get("sellerId") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const template = searchParams.get("template") || "";

  // 템플릿 요청
  if (template === "upload") {
    const { generateTemplate } = await import("@/lib/excel");
    const buf = generateTemplate(UPLOAD_COLUMNS, "주문업로드템플릿");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="order_upload_template.xlsx"`,
      },
    });
  }

  const where: any = { ...tenantFilter(ctx) };
  if (status) where.status = status;
  if (sellerId) where.sellerId = sellerId;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      seller: {
        select: {
          name: true,
          sellerProfile: { select: { businessName: true } },
        },
      },
      items: {
        include: { product: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    sellerName: o.seller.name,
    businessName: o.seller.sellerProfile?.businessName || "",
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

  const buffer = generateExcel(ORDER_COLUMNS, rows, "주문목록");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders_${new Date().toISOString().slice(0, 10)}.xlsx"`,
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
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

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
    const rows = parseExcel(buffer, UPLOAD_COLUMNS);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: { code: "EMPTY_FILE", message: "데이터가 없습니다" } },
        { status: 400 }
      );
    }

    // 행을 셀러이메일+수령자 기준으로 그룹핑 (같은 주문으로 묶기)
    const orderGroups: Map<string, typeof rows> = new Map();
    for (const row of rows) {
      const key = `${row.sellerEmail}|${row.recipientName}|${row.recipientPhone}|${row.recipientAddr}`;
      const group = orderGroups.get(key) || [];
      group.push(row);
      orderGroups.set(key, group);
    }

    let created = 0;
    const errors: string[] = [];

    for (const [, groupRows] of orderGroups) {
      const first = groupRows[0];
      if (!first.sellerEmail || !first.recipientName || !first.recipientPhone || !first.recipientAddr) {
        errors.push(`필수 정보가 누락되었습니다: ${first.sellerEmail || "(셀러없음)"}`);
        continue;
      }

      // 셀러 조회
      const seller = await prisma.user.findUnique({
        where: { email: first.sellerEmail },
        select: { id: true },
      });
      if (!seller) {
        errors.push(`셀러를 찾을 수 없습니다: ${first.sellerEmail}`);
        continue;
      }

      // 상품 조회
      const items: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
      let totalAmount = 0;
      let hasError = false;

      for (const row of groupRows) {
        if (!row.productCode || !row.quantity) {
          errors.push(`상품코드 또는 수량이 누락되었습니다: ${row.productCode || "(없음)"}`);
          hasError = true;
          break;
        }
        const product = await prisma.product.findUnique({
          where: { code: row.productCode },
          select: { id: true, basePrice: true },
        });
        if (!product) {
          errors.push(`상품을 찾을 수 없습니다: ${row.productCode}`);
          hasError = true;
          break;
        }
        const qty = parseInt(row.quantity) || 1;
        const unitPrice = Number(product.basePrice);
        items.push({
          productId: product.id,
          quantity: qty,
          unitPrice,
          totalPrice: unitPrice * qty,
        });
        totalAmount += unitPrice * qty;
      }

      if (hasError) continue;

      await prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          sellerId: seller.id,
          recipientName: first.recipientName,
          recipientPhone: first.recipientPhone,
          recipientAddr: first.recipientAddr,
          postalCode: first.postalCode || null,
          notes: first.notes || null,
          totalAmount,
          tenantId: ctx.tenantId,
          items: { create: items },
        },
      });
      created++;
    }

    return NextResponse.json({
      data: { created, errors },
    });
  } catch (err) {
    console.error("[orders/excel POST]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "파일 처리 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
