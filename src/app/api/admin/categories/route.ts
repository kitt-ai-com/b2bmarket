export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { categoryCreateSchema } from "@/lib/validations/product";

export async function GET() {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const categories = await prisma.category.findMany({
    where: { ...tenantFilter(ctx) },
    orderBy: { name: "asc" },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { children: true, products: true } },
    },
  });

  return NextResponse.json({ data: categories });
}

export async function POST(request: Request) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  try {
    const body = await request.json();
    const validated = categoryCreateSchema.parse(body);

    const category = await prisma.category.create({
      data: {
        name: validated.name,
        parentId: validated.parentId || null,
        tenantId: ctx.tenantId,
      },
    });

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: err.errors } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
