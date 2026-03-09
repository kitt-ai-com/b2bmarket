export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { generateExcel, parseExcel, type ColumnDef } from "@/lib/excel";

const PRODUCT_COLUMNS: ColumnDef[] = [
  { header: "상품코드", key: "code", width: 15 },
  { header: "상품명", key: "name", width: 25 },
  { header: "설명", key: "description", width: 30 },
  { header: "기본가", key: "basePrice", width: 12 },
  { header: "원가", key: "costPrice", width: 12 },
  { header: "단위", key: "unit", width: 8 },
  { header: "재고", key: "stock", width: 8 },
  { header: "최소재고", key: "minStock", width: 8 },
  { header: "상태", key: "status", width: 12 },
  { header: "출처", key: "source", width: 10 },
  { header: "배송비", key: "shippingFee", width: 10 },
  { header: "카테고리", key: "categoryName", width: 15 },
];

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "";
  const categoryId = searchParams.get("categoryId") || "";
  const source = searchParams.get("source") || "";
  const search = searchParams.get("search") || "";

  const template = searchParams.get("template") || "";

  if (template === "upload") {
    const { generateTemplate } = await import("@/lib/excel");
    const buf = generateTemplate(PRODUCT_COLUMNS, "상품업로드템플릿");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="product_upload_template.xlsx"`,
      },
    });
  }

  const where: any = { ...tenantFilter(ctx) };
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (source) where.source = source;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = products.map((p) => ({
    code: p.code,
    name: p.name,
    description: p.description || "",
    basePrice: Number(p.basePrice),
    costPrice: p.costPrice ? Number(p.costPrice) : "",
    unit: p.unit,
    stock: p.stock,
    minStock: p.minStock,
    status: p.status,
    source: p.source,
    shippingFee: Number(p.shippingFee),
    categoryName: p.category?.name || "",
  }));

  const buffer = generateExcel(PRODUCT_COLUMNS, rows, "상품목록");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="products_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
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
    const rows = parseExcel(buffer, PRODUCT_COLUMNS);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: { code: "EMPTY_FILE", message: "데이터가 없습니다" } },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.code || !row.name) {
        errors.push(`상품코드 또는 상품명이 누락되었습니다: ${row.code || "(없음)"}`);
        continue;
      }

      const data: any = {
        name: row.name,
        description: row.description || null,
        basePrice: parseFloat(row.basePrice) || 0,
        costPrice: row.costPrice ? parseFloat(row.costPrice) : null,
        unit: row.unit || "EA",
        stock: parseInt(row.stock) || 0,
        minStock: parseInt(row.minStock) || 10,
        status: ["ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"].includes(row.status) ? row.status : "ACTIVE",
        source: ["SELF", "SUPPLIER"].includes(row.source) ? row.source : "SELF",
        shippingFee: parseFloat(row.shippingFee) || 0,
      };

      // 카테고리 매칭
      if (row.categoryName) {
        const category = await prisma.category.findFirst({
          where: { name: row.categoryName },
        });
        if (category) data.categoryId = category.id;
      }

      const existing = await prisma.product.findFirst({
        where: { code: row.code, ...tenantFilter(ctx) },
      });

      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.product.create({ data: { ...data, code: row.code, tenantId: ctx.tenantId } });
        created++;
      }
    }

    return NextResponse.json({
      data: { created, updated, errors },
    });
  } catch (err) {
    console.error("[products/excel POST]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "파일 처리 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
