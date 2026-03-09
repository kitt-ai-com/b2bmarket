export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

export async function GET() {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const sellerId = ctx.userId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const tf = tenantFilter(ctx);

  const [
    totalOrders,
    shippingOrders,
    monthlySalesResult,
    deposit,
    pendingClaims,
    recentOrders,
    recentNotices,
  ] = await Promise.all([
    prisma.order.count({ where: { sellerId, ...tf } }),
    prisma.order.count({ where: { sellerId, ...tf, status: "SHIPPING" } }),
    prisma.order.aggregate({
      where: {
        sellerId,
        ...tf,
        createdAt: { gte: monthStart },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      },
      _sum: { totalAmount: true },
    }),
    prisma.deposit.findUnique({ where: { sellerId }, select: { balance: true } }),
    prisma.claim.count({
      where: { order: { sellerId, ...tf }, status: "REQUESTED" },
    }),
    prisma.order.findMany({
      where: { sellerId, ...tf },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        recipientName: true,
        createdAt: true,
      },
    }),
    prisma.notice.findMany({
      where: { ...tf },
      take: 3,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, isImportant: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      totalOrders,
      shippingOrders,
      monthlySales: monthlySalesResult._sum.totalAmount?.toString() || "0",
      depositBalance: deposit?.balance?.toString() || "0",
      pendingClaims,
      recentOrders,
      recentNotices,
    },
  });
}
