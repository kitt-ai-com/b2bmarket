export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { generateExcel, type ColumnDef } from "@/lib/excel";

const PRODUCT_COLUMNS: ColumnDef[] = [
  { header: "상품코드", key: "code", width: 15 },
  { header: "상품명", key: "name", width: 25 },
  { header: "설명", key: "description", width: 30 },
  { header: "단가", key: "price", width: 12 },
  { header: "단위", key: "unit", width: 8 },
  { header: "재고", key: "stock", width: 8 },
  { header: "판매상태", key: "status", width: 10 },
  { header: "배송비", key: "shippingFee", width: 10 },
  { header: "카테고리", key: "categoryName", width: 15 },
];

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId") || "";

  const where: any = { status: "ACTIVE", ...tenantFilter(ctx) };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: ctx.userId },
    select: { gradeId: true },
  });

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      category: { select: { name: true } },
      gradePrices: sellerProfile
        ? { where: { gradeId: sellerProfile.gradeId }, select: { price: true } }
        : false,
      sellerPrices: {
        where: { sellerId: ctx.userId },
        select: { price: true },
      },
    },
  });

  const rows = products.map((p) => {
    const sellerPrice = p.sellerPrices[0]?.price;
    const gradePrice =
      p.gradePrices && (p.gradePrices as any[]).length > 0
        ? (p.gradePrices as any[])[0]?.price
        : null;
    const effectivePrice = Number(sellerPrice || gradePrice || p.basePrice);

    return {
      code: p.code,
      name: p.name,
      description: p.description || "",
      price: effectivePrice,
      unit: p.unit,
      stock: p.stock,
      status: p.status,
      shippingFee: Number(p.shippingFee),
      categoryName: p.category?.name || "",
    };
  });

  const buffer = generateExcel(PRODUCT_COLUMNS, rows, "상품목록");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="products_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
