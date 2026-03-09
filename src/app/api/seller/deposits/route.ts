export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const page = Number(request.nextUrl.searchParams.get("page") || "1");
  const limit = Number(request.nextUrl.searchParams.get("limit") || "20");

  const deposit = await prisma.deposit.findUnique({
    where: { sellerId: ctx.userId },
  });

  if (!deposit) {
    return NextResponse.json({
      data: { balance: 0, transactions: [] },
      pagination: { page: 1, limit, total: 0, totalPages: 0 },
    });
  }

  const [transactions, total] = await Promise.all([
    prisma.depositTransaction.findMany({
      where: { depositId: deposit.id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.depositTransaction.count({ where: { depositId: deposit.id } }),
  ]);

  return NextResponse.json({
    data: { balance: deposit.balance, transactions },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
