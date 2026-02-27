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
  const type = searchParams.get("type") || "";
  const search = searchParams.get("search") || "";

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { order: { orderNumber: { contains: search, mode: "insensitive" } } },
      { order: { recipientName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
            recipientName: true,
            totalAmount: true,
            seller: { select: { name: true } },
          },
        },
      },
    }),
    prisma.claim.count({ where }),
  ]);

  return NextResponse.json({
    data: claims,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
