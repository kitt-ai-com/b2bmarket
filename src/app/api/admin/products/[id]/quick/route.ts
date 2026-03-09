export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;

  // 테넌트 소유 확인
  const existing = await prisma.product.findFirst({
    where: { id, ...tenantFilter(ctx) },
  });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "상품을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const { field, value } = body as { field: string; value: any };

    const allowedFields: Record<string, (v: any) => any> = {
      status: (v) => {
        if (!["ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"].includes(v)) throw new Error("유효하지 않은 상태");
        return { status: v };
      },
      stock: (v) => {
        const num = Number(v);
        if (isNaN(num) || num < 0) throw new Error("유효하지 않은 재고");
        return { stock: num };
      },
      basePrice: (v) => {
        const num = Number(v);
        if (isNaN(num) || num < 0) throw new Error("유효하지 않은 가격");
        return { basePrice: num };
      },
      costPrice: (v) => {
        if (v === null || v === "") return { costPrice: null };
        const num = Number(v);
        if (isNaN(num) || num < 0) throw new Error("유효하지 않은 원가");
        return { costPrice: num };
      },
      source: (v) => {
        if (!["SELF", "SUPPLIER"].includes(v)) throw new Error("유효하지 않은 출처");
        return { source: v };
      },
      categoryId: (v) => ({ categoryId: v || null }),
    };

    if (!allowedFields[field]) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "수정할 수 없는 필드입니다" } },
        { status: 400 }
      );
    }

    const data = allowedFields[field](value);

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        gradePrices: {
          include: { grade: { select: { id: true, name: true, level: true } } },
        },
      },
    });

    return NextResponse.json({ data: product });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "상품을 찾을 수 없습니다" } },
        { status: 404 }
      );
    }
    console.error("[admin/products/quick PATCH]", err);
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: err.message || "서버 오류가 발생했습니다" } },
      { status: 400 }
    );
  }
}
