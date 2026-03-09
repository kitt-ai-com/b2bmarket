export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "";

  const where: any = { ...tenantFilter(ctx) };
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
