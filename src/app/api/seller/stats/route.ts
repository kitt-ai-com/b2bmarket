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

  const sellerId = session.user.id;
  const searchParams = request.nextUrl.searchParams;
  const months = Number(searchParams.get("months") || "6");

  const now = new Date();

  // 월별 매출
  const monthlySales: { month: string; sales: number; orders: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const [agg, count] = await Promise.all([
      prisma.order.aggregate({
        where: {
          sellerId,
          createdAt: { gte: start, lt: end },
          status: { notIn: ["CANCELLED", "RETURNED"] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({
        where: {
          sellerId,
          createdAt: { gte: start, lt: end },
          status: { notIn: ["CANCELLED", "RETURNED"] },
        },
      }),
    ]);
    monthlySales.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      sales: Number(agg._sum.totalAmount || 0),
      orders: count,
    });
  }

  // 주문 상태별
  const statusCounts = await prisma.order.groupBy({
    by: ["status"],
    where: { sellerId },
    _count: { _all: true },
  });

  // 내 상위 상품
  const topProducts = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { sellerId } },
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });

  const productIds = topProducts.map((p) => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, code: true },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const topProductsResult = topProducts.map((p) => ({
    productId: p.productId,
    name: productMap[p.productId]?.name || "삭제된 상품",
    code: productMap[p.productId]?.code || "-",
    totalQuantity: p._sum.quantity || 0,
    totalSales: Number(p._sum.totalPrice || 0),
  }));

  return NextResponse.json({
    data: {
      monthlySales,
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      topProducts: topProductsResult,
    },
  });
}
