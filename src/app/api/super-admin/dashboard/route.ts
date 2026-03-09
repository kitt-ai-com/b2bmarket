export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalTenants,
    activeTenants,
    monthlyPayments,
    totalSellers,
    totalOrders,
    recentTenants,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.payment.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.order.count(),
    prisma.tenant.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        plan: { select: { displayName: true } },
        owner: { select: { name: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      totalTenants,
      activeTenants,
      monthlyRevenue: monthlyPayments._sum.amount ?? 0,
      totalSellers,
      totalOrders,
      recentTenants,
    },
  });
}
