export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error, session } = await requireSeller();
  if (error) return error;

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
