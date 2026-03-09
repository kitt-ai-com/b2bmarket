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
  const limit = Number(searchParams.get("limit") || "30");
  const action = searchParams.get("action") || "";
  const userId = searchParams.get("userId") || "";

  const where: any = { ...tenantFilter(ctx) };
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, role: true } } },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    data: logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
