export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  const sellerId = session.user.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrders,
    shippingOrders,
    monthlySalesResult,
    deposit,
    pendingClaims,
    recentOrders,
    recentNotices,
  ] = await Promise.all([
    prisma.order.count({ where: { sellerId } }),
    prisma.order.count({ where: { sellerId, status: "SHIPPING" } }),
    prisma.order.aggregate({
      where: {
        sellerId,
        createdAt: { gte: monthStart },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      },
      _sum: { totalAmount: true },
    }),
    prisma.deposit.findUnique({ where: { sellerId }, select: { balance: true } }),
    prisma.claim.count({
      where: { order: { sellerId }, status: "REQUESTED" },
    }),
    prisma.order.findMany({
      where: { sellerId },
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
