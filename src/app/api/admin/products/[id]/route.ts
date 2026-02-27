export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { productUpdateSchema } from "@/lib/validations/product";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      gradePrices: {
        include: { grade: { select: { id: true, name: true, level: true } } },
        orderBy: { grade: { level: "desc" } },
      },
      sellerPrices: true,
    },
  });

  if (!product) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "상품을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: product });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = productUpdateSchema.parse(body);

    const { gradePrices, ...productData } = validated;

    const product = await prisma.$transaction(async (tx) => {
      if (gradePrices) {
        await tx.productPrice.deleteMany({ where: { productId: id } });
        if (gradePrices.length > 0) {
          await tx.productPrice.createMany({
            data: gradePrices.map((gp) => ({
              productId: id,
              gradeId: gp.gradeId,
              price: gp.price,
            })),
          });
        }
      }

      return tx.product.update({
        where: { id },
        data: productData,
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          gradePrices: {
            include: { grade: { select: { id: true, name: true, level: true } } },
          },
        },
      });
    });

    return NextResponse.json({ data: product });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: err.errors } },
        { status: 400 }
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "상품을 찾을 수 없습니다" } },
        { status: 404 }
      );
    }
    console.error("Product update error:", err);
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

  const hasOrders = await prisma.orderItem.count({ where: { productId: id } });
  if (hasOrders > 0) {
    return NextResponse.json(
      { error: { code: "HAS_ORDERS", message: "주문 이력이 있는 상품은 삭제할 수 없습니다. 상태를 '단종'으로 변경해주세요." } },
      { status: 400 }
    );
  }

  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "상품을 찾을 수 없습니다" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
