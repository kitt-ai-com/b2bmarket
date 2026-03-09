export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

export async function GET() {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    todayOrders,
    monthlySalesResult,
    totalProducts,
    activeSellers,
    pendingClaims,
    pendingInquiries,
    recentOrders,
    recentClaims,
  ] = await Promise.all([
    prisma.order.count({ where: { ...tenantFilter(ctx), createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({
      where: {
        ...tenantFilter(ctx),
        createdAt: { gte: monthStart },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      },
      _sum: { totalAmount: true },
    }),
    prisma.product.count({ where: { ...tenantFilter(ctx), status: "ACTIVE" } }),
    prisma.user.count({ where: { ...tenantFilter(ctx), role: "SELLER", status: "ACTIVE" } }),
    prisma.claim.count({ where: { ...tenantFilter(ctx), status: "REQUESTED" } }),
    prisma.inquiry.count({ where: { ...tenantFilter(ctx), status: "OPEN" } }),
    prisma.order.findMany({
      where: { ...tenantFilter(ctx) },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        recipientName: true,
        createdAt: true,
        seller: { select: { name: true } },
      },
    }),
    prisma.claim.findMany({
      take: 5,
      where: { ...tenantFilter(ctx), status: "REQUESTED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        reason: true,
        createdAt: true,
        order: { select: { orderNumber: true, seller: { select: { name: true } } } },
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      todayOrders,
      monthlySales: monthlySalesResult._sum.totalAmount?.toString() || "0",
      totalProducts,
      activeSellers,
      pendingClaims,
      pendingInquiries,
      recentOrders,
      recentClaims,
    },
  });
}
