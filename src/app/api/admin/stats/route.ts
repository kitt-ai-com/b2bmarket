export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const months = Number(searchParams.get("months") || "6");

  const now = new Date();

  // 월별 매출 (최근 N개월)
  const monthlySales: { month: string; sales: number; orders: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const [agg, count] = await Promise.all([
      prisma.order.aggregate({
        where: {
          ...tenantFilter(ctx),
          createdAt: { gte: start, lt: end },
          status: { notIn: ["CANCELLED", "RETURNED"] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({
        where: {
          ...tenantFilter(ctx),
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

  // 주문 상태별 건수
  const statusCounts = await prisma.order.groupBy({
    by: ["status"],
    where: { ...tenantFilter(ctx) },
    _count: { _all: true },
  });

  // 상위 상품 (주문 수량 기준)
  const topProducts = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { ...tenantFilter(ctx) } },
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

  // 셀러별 매출 상위
  const topSellers = await prisma.order.groupBy({
    by: ["sellerId"],
    where: { ...tenantFilter(ctx), status: { notIn: ["CANCELLED", "RETURNED"] } },
    _sum: { totalAmount: true },
    _count: { _all: true },
    orderBy: { _sum: { totalAmount: "desc" } },
    take: 10,
  });

  const sellerIds = topSellers.map((s) => s.sellerId);
  const sellers = await prisma.user.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, name: true },
  });
  const sellerMap = Object.fromEntries(sellers.map((s) => [s.id, s]));

  const topSellersResult = topSellers.map((s) => ({
    sellerId: s.sellerId,
    name: sellerMap[s.sellerId]?.name || "-",
    totalSales: Number(s._sum.totalAmount || 0),
    orderCount: s._count._all,
  }));

  // 전월 대비 비교
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [thisMonthAgg, lastMonthAgg, thisMonthOrders, lastMonthOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { ...tenantFilter(ctx), createdAt: { gte: thisMonthStart }, status: { notIn: ["CANCELLED", "RETURNED"] } },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...tenantFilter(ctx), createdAt: { gte: lastMonthStart, lt: thisMonthStart }, status: { notIn: ["CANCELLED", "RETURNED"] } },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: { ...tenantFilter(ctx), createdAt: { gte: thisMonthStart }, status: { notIn: ["CANCELLED", "RETURNED"] } },
    }),
    prisma.order.count({
      where: { ...tenantFilter(ctx), createdAt: { gte: lastMonthStart, lt: thisMonthStart }, status: { notIn: ["CANCELLED", "RETURNED"] } },
    }),
  ]);

  const comparison = {
    thisMonthSales: Number(thisMonthAgg._sum.totalAmount || 0),
    lastMonthSales: Number(lastMonthAgg._sum.totalAmount || 0),
    thisMonthOrders,
    lastMonthOrders,
    salesGrowth: Number(lastMonthAgg._sum.totalAmount || 0) > 0
      ? ((Number(thisMonthAgg._sum.totalAmount || 0) - Number(lastMonthAgg._sum.totalAmount || 0)) / Number(lastMonthAgg._sum.totalAmount || 0) * 100).toFixed(1)
      : null,
    ordersGrowth: lastMonthOrders > 0
      ? (((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100).toFixed(1)
      : null,
  };

  return NextResponse.json({
    data: {
      monthlySales,
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      topProducts: topProductsResult,
      topSellers: topSellersResult,
      comparison,
    },
  });
}
