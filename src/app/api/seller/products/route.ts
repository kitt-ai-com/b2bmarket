export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId") || "";

  const where: any = { status: "ACTIVE" };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;

  // 셀러의 등급 조회
  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { gradeId: true },
  });

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        gradePrices: sellerProfile
          ? {
              where: { gradeId: sellerProfile.gradeId },
              select: { price: true },
            }
          : false,
        sellerPrices: {
          where: { sellerId: session.user.id },
          select: { price: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  // 셀러별 가격 > 등급 가격 > 기본 가격 순으로 적용
  const productsWithPrice = products.map((product) => {
    const sellerPrice = product.sellerPrices[0]?.price;
    const gradePrice = product.gradePrices && product.gradePrices.length > 0
      ? (product.gradePrices as any[])[0]?.price
      : null;
    const effectivePrice = sellerPrice || gradePrice || product.basePrice;

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      unit: product.unit,
      stock: product.stock,
      imageUrl: product.imageUrl,
      images: product.images,
      category: product.category,
      price: effectivePrice,
      basePrice: product.basePrice,
    };
  });

  return NextResponse.json({
    data: productsWithPrice,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
