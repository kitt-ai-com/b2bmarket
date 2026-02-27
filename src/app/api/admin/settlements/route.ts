export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { settlementGenerateSchema } from "@/lib/validations/settlement";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "";
  const search = searchParams.get("search") || "";

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    const sellers = await prisma.user.findMany({
      where: { name: { contains: search, mode: "insensitive" }, role: "SELLER" },
      select: { id: true },
    });
    where.sellerId = { in: sellers.map((s) => s.id) };
  }

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.settlement.count({ where }),
  ]);

  // sellerId로 셀러 이름 조회
  const sellerIds = [...new Set(settlements.map((s) => s.sellerId))];
  const sellers = await prisma.user.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, name: true },
  });
  const sellerMap = Object.fromEntries(sellers.map((s) => [s.id, s.name]));

  const data = settlements.map((s) => ({
    ...s,
    totalSales: s.totalSales.toString(),
    totalFee: s.totalFee.toString(),
    claimDeduct: s.claimDeduct.toString(),
    netAmount: s.netAmount.toString(),
    feeRate: s.feeRate.toString(),
    sellerName: sellerMap[s.sellerId] || "-",
  }));

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = settlementGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { sellerId, periodStart, periodEnd } = parsed.data;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  end.setHours(23, 59, 59, 999);

  // 셀러 확인 및 수수료율 조회
  const seller = await prisma.user.findFirst({
    where: { id: sellerId, role: "SELLER" },
    include: { sellerProfile: { include: { grade: true } } },
  });
  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "셀러를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const feeRate = seller.sellerProfile?.customFeeRate
    ?? seller.sellerProfile?.grade.feeRate
    ?? 10;

  // 해당 기간 주문 매출 합계
  const salesAgg = await prisma.order.aggregate({
    where: {
      sellerId,
      createdAt: { gte: start, lte: end },
      status: { in: ["DELIVERED", "SHIPPING", "PREPARING"] },
    },
    _sum: { totalAmount: true },
  });
  const totalSales = Number(salesAgg._sum.totalAmount || 0);

  // 해당 기간 클레임 환불 합계
  const claimAgg = await prisma.claim.aggregate({
    where: {
      order: { sellerId },
      status: "COMPLETED",
      type: { in: ["REFUND", "RETURN"] },
      processedAt: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  const claimDeduct = Number(claimAgg._sum.amount || 0);

  const totalFee = Math.round(totalSales * Number(feeRate) / 100);
  const netAmount = totalSales - totalFee - claimDeduct;

  const settlement = await prisma.settlement.create({
    data: {
      sellerId,
      periodStart: start,
      periodEnd: end,
      totalSales,
      totalFee,
      claimDeduct,
      netAmount,
      feeRate: Number(feeRate),
    },
  });

  return NextResponse.json({ data: settlement }, { status: 201 });
}
