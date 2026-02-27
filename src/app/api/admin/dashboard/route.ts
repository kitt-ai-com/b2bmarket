export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

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
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: monthStart },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      },
      _sum: { totalAmount: true },
    }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "SELLER", status: "ACTIVE" } }),
    prisma.claim.count({ where: { status: "REQUESTED" } }),
    prisma.inquiry.count({ where: { status: "OPEN" } }),
    prisma.order.findMany({
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
      where: { status: "REQUESTED" },
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
