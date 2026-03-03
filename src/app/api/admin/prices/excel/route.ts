export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { generateExcel, parseExcel, type ColumnDef } from "@/lib/excel";

const PRICE_COLUMNS: ColumnDef[] = [
  { header: "상품코드", key: "code", width: 15 },
  { header: "상품명", key: "name", width: 25 },
  { header: "현재 기본가", key: "currentPrice", width: 15 },
  { header: "새 기본가", key: "newPrice", width: 15 },
];

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId") || "";
  const template = searchParams.get("template") || "";

  if (template === "upload") {
    const { generateTemplate } = await import("@/lib/excel");
    const buf = generateTemplate(PRICE_COLUMNS, "가격변경템플릿");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="price_template.xlsx"`,
      },
    });
  }

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;

  const products = await prisma.product.findMany({
    where,
    orderBy: { code: "asc" },
    select: { code: true, name: true, basePrice: true },
  });

  const rows = products.map((p) => ({
    code: p.code,
    name: p.name,
    currentPrice: Number(p.basePrice),
    newPrice: "",
  }));

  const buffer = generateExcel(PRICE_COLUMNS, rows, "가격목록");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="prices_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

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
    const rows = parseExcel(buffer, PRICE_COLUMNS);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: { code: "EMPTY_FILE", message: "데이터가 없습니다" } },
        { status: 400 }
      );
    }

    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.code) {
        errors.push("상품코드가 누락된 행이 있습니다");
        continue;
      }
      const newPrice = parseFloat(row.newPrice);
      if (isNaN(newPrice) || newPrice < 0) {
        if (!row.newPrice || row.newPrice.trim() === "") continue; // 빈 칸은 스킵
        errors.push(`${row.code}: 유효하지 않은 가격 (${row.newPrice})`);
        continue;
      }

      try {
        await prisma.product.update({
          where: { code: row.code },
          data: { basePrice: newPrice },
        });
        updated++;
      } catch (e: any) {
        if (e.code === "P2025") {
          errors.push(`${row.code}: 존재하지 않는 상품`);
        } else {
          errors.push(`${row.code}: 업데이트 실패`);
        }
      }
    }

    return NextResponse.json({ data: { updated, errors } });
  } catch (err) {
    console.error("[admin/prices/excel POST]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "파일 처리 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
