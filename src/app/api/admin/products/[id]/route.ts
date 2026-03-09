export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { productUpdateSchema } from "@/lib/validations/product";
import { createNotification } from "@/lib/notification";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, ...tenantFilter(ctx) },
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
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = productUpdateSchema.parse(body);

    const { gradePrices, ...productData } = validated;

    // 테넌트 소유 확인 + 가격 변경 감지를 위해 기존 상품 조회
    const existingProduct = await prisma.product.findFirst({
      where: { id, ...tenantFilter(ctx) },
      select: { name: true, code: true, basePrice: true },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "상품을 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

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

    // 가격 변경 시 셀러에게 알림
    if (existingProduct && productData.basePrice != null && Number(productData.basePrice) !== Number(existingProduct.basePrice)) {
      const sellers = await prisma.user.findMany({
        where: { role: "SELLER", status: "ACTIVE" },
        select: { id: true },
      });
      if (sellers.length > 0) {
        await Promise.all(sellers.map((s) =>
          createNotification({
            userId: s.id,
            type: "PRICE_CHANGED",
            title: `가격 변경: ${existingProduct.name}`,
            message: `"${existingProduct.name}" (${existingProduct.code})의 가격이 ₩${Number(existingProduct.basePrice).toLocaleString()}에서 ₩${Number(productData.basePrice).toLocaleString()}로 변경되었습니다.`,
            data: { productId: id },
          })
        ));
      }
    }

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
    const detail = process.env.NODE_ENV === "development" ? String(err.message || err) : undefined;
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: detail || "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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
