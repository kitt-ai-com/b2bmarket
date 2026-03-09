export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { id } = await params;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [tenant, monthlyOrders, aiUsage] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        plan: true,
        _count: {
          select: {
            users: true,
            products: true,
            orders: true,
          },
        },
      },
    }),
    prisma.order.count({
      where: { tenantId: id, createdAt: { gte: monthStart } },
    }),
    prisma.usageTracker.findMany({
      where: { tenantId: id, month },
      select: { dailyAiChats: true },
    }),
  ]);

  if (!tenant) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const totalAiChats = aiUsage.reduce((sum, u) => sum + u.dailyAiChats, 0);

  return NextResponse.json({
    data: {
      ...tenant,
      usage: {
        monthlyOrders,
        totalAiChats,
      },
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { planId, status } = body;

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const updateData: Record<string, unknown> = {};

  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "존재하지 않는 요금제입니다" } },
        { status: 400 }
      );
    }
    updateData.planId = planId;
  }

  if (status && ["ACTIVE", "SUSPENDED"].includes(status)) {
    updateData.status = status;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "변경할 항목이 없습니다" } },
      { status: 400 }
    );
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      plan: true,
    },
  });

  return NextResponse.json({ data: updated });
}
