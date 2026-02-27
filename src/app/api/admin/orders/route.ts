export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "";
  const search = searchParams.get("search") || "";

  const channel = searchParams.get("channel") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const amountMin = searchParams.get("amountMin") || "";
  const amountMax = searchParams.get("amountMax") || "";

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { recipientName: { contains: search, mode: "insensitive" } },
      { seller: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (channel) where.salesChannel = channel;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
  }
  if (amountMin || amountMax) {
    where.totalAmount = {};
    if (amountMin) where.totalAmount.gte = Number(amountMin);
    if (amountMax) where.totalAmount.lte = Number(amountMax);
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { name: true, email: true } },
        items: {
          include: { product: { select: { name: true, code: true } } },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    data: orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
