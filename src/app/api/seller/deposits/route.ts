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

  const page = Number(request.nextUrl.searchParams.get("page") || "1");
  const limit = Number(request.nextUrl.searchParams.get("limit") || "20");

  const deposit = await prisma.deposit.findUnique({
    where: { sellerId: session.user.id },
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
