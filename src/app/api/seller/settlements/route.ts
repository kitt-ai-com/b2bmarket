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
  const status = searchParams.get("status") || "";

  const where: any = { sellerId: session.user.id };
  if (status) where.status = status;

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.settlement.count({ where }),
  ]);

  const data = settlements.map((s) => ({
    ...s,
    totalSales: s.totalSales.toString(),
    totalFee: s.totalFee.toString(),
    claimDeduct: s.claimDeduct.toString(),
    netAmount: s.netAmount.toString(),
    feeRate: s.feeRate.toString(),
  }));

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
