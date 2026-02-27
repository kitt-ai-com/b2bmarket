export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";

  // ACTIVE 셀러 목록 조회 (예치금 잔액 포함)
  const where: any = { role: "SELLER", status: "ACTIVE" };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { sellerProfile: { businessName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [sellers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        sellerProfile: {
          select: {
            businessName: true,
            grade: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // 각 셀러의 예치금 잔액 조회
  const sellerIds = sellers.map((s) => s.id);
  const deposits = await prisma.deposit.findMany({
    where: { sellerId: { in: sellerIds } },
    select: { sellerId: true, balance: true },
  });

  const depositMap = new Map(deposits.map((d) => [d.sellerId, d.balance]));

  const data = sellers.map((seller) => ({
    id: seller.id,
    name: seller.name,
    email: seller.email,
    businessName: seller.sellerProfile?.businessName || "-",
    gradeName: seller.sellerProfile?.grade?.name || "-",
    balance: depositMap.get(seller.id) || 0,
  }));

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
