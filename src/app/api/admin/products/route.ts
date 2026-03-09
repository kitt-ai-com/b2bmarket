export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { productCreateSchema } from "@/lib/validations/product";
import { createNotification } from "@/lib/notification";

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const categoryId = searchParams.get("categoryId") || "";
  const source = searchParams.get("source") || "";

  const priceMin = searchParams.get("priceMin") || "";
  const priceMax = searchParams.get("priceMax") || "";
  const lowStock = searchParams.get("lowStock") === "true";
  const zeroStock = searchParams.get("zeroStock") === "true";

  const where: any = { ...tenantFilter(ctx) };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (source) where.source = source;
  if (priceMin || priceMax) {
    where.basePrice = {};
    if (priceMin) where.basePrice.gte = Number(priceMin);
    if (priceMax) where.basePrice.lte = Number(priceMax);
  }
  if (zeroStock) {
    where.stock = 0;
  } else if (lowStock) {
    // stock <= minStock 조건을 raw SQL 조건으로 처리
    where.AND = [
      ...(where.AND || []),
      { stock: { gt: 0 } },
    ];
  }

  let products: any[];
  let total: number;

  if (lowStock && !zeroStock) {
    // stock <= minStock: Prisma에서 자기 필드 비교가 안 되므로 전체 조회 후 필터
    const [allProducts, allTotal] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          gradePrices: {
            include: { grade: { select: { id: true, name: true, level: true } } },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);
    const filtered = allProducts.filter((p: any) => p.stock <= p.minStock);
    total = filtered.length;
    products = filtered.slice((page - 1) * limit, page * limit);
  } else {
    [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          gradePrices: {
            include: { grade: { select: { id: true, name: true, level: true } } },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);
  }

  return NextResponse.json({
    data: products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: Request) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  try {
    const body = await request.json();
    const validated = productCreateSchema.parse(body);

    const { gradePrices, ...productData } = validated;

    const product = await prisma.product.create({
      data: {
        ...productData,
        tenantId: ctx.tenantId,
        basePrice: productData.basePrice,
        costPrice: productData.costPrice,
        gradePrices: gradePrices?.length
          ? {
              create: gradePrices.map((gp) => ({
                gradeId: gp.gradeId,
                price: gp.price,
              })),
            }
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        gradePrices: {
          include: { grade: { select: { id: true, name: true, level: true } } },
        },
      },
    });

    // 전체 셀러에게 신규 상품 알림
    const sellers = await prisma.user.findMany({
      where: { role: "SELLER", status: "ACTIVE" },
      select: { id: true },
    });
    if (sellers.length > 0) {
      await Promise.all(sellers.map((s) =>
        createNotification({
          userId: s.id,
          type: "SYSTEM",
          title: `신규 상품: ${product.name}`,
          message: `새로운 상품 "${product.name}" (${(product as Record<string, unknown>).code || ""})이(가) 등록되었습니다.`,
          data: { productId: product.id },
        })
      ));
    }

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: err.errors } },
        { status: 400 }
      );
    }
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: { code: "DUPLICATE", message: "이미 존재하는 상품 코드입니다" } },
        { status: 409 }
      );
    }
    console.error("Product create error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
