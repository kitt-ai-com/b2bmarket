export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { categoryUpdateSchema } from "@/lib/validations/product";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = categoryUpdateSchema.parse(body);

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(validated.name !== undefined && { name: validated.name }),
        ...(validated.parentId !== undefined && { parentId: validated.parentId || null }),
      },
    });

    return NextResponse.json({ data: category });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "카테고리를 찾을 수 없습니다" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const hasProducts = await prisma.product.count({ where: { categoryId: id } });
  if (hasProducts > 0) {
    return NextResponse.json(
      { error: { code: "HAS_PRODUCTS", message: "해당 카테고리에 상품이 존재합니다. 상품을 먼저 이동해주세요." } },
      { status: 400 }
    );
  }

  const hasChildren = await prisma.category.count({ where: { parentId: id } });
  if (hasChildren > 0) {
    return NextResponse.json(
      { error: { code: "HAS_CHILDREN", message: "하위 카테고리가 존재합니다. 하위 카테고리를 먼저 삭제해주세요." } },
      { status: 400 }
    );
  }

  try {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "카테고리를 찾을 수 없습니다" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
