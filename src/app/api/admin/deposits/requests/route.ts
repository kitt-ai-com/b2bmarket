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

  const where: any = {};
  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.depositRequest.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        seller: {
          select: {
            name: true,
            email: true,
            sellerProfile: { select: { businessName: true } },
          },
        },
      },
    }),
    prisma.depositRequest.count({ where }),
  ]);

  return NextResponse.json({
    data: requests,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
