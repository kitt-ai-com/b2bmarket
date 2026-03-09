export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { tenants: true } },
    },
  });

  return NextResponse.json({ data: plans });
}

export async function POST(req: Request) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const {
      name,
      displayName,
      price,
      maxSellers,
      maxMonthlyOrders,
      maxProducts,
      maxDailyAiChats,
      hasExcel,
      hasFullStats,
      trialDays,
      sortOrder,
    } = body;

    if (!name || !displayName) {
      return NextResponse.json(
        { error: { message: "name과 displayName은 필수입니다" } },
        { status: 400 }
      );
    }

    // 중복 체크
    const existing = await prisma.plan.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: { message: "이미 존재하는 요금제 이름입니다" } },
        { status: 409 }
      );
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        displayName,
        price: price ?? 0,
        maxSellers: maxSellers ?? 5,
        maxMonthlyOrders: maxMonthlyOrders ?? 100,
        maxProducts: maxProducts ?? 50,
        maxDailyAiChats: maxDailyAiChats ?? 5,
        hasExcel: hasExcel ?? false,
        hasFullStats: hasFullStats ?? false,
        trialDays: trialDays ?? 0,
        sortOrder: sortOrder ?? 0,
      },
      include: {
        _count: { select: { tenants: true } },
      },
    });

    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (err) {
    console.error("Plan create error:", err);
    return NextResponse.json(
      { error: { message: "요금제 생성 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
