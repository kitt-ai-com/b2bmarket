export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status && ["ACTIVE", "SUSPENDED", "EXPIRED"].includes(status)) {
    where.status = status;
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, displayName: true } },
        _count: {
          select: {
            users: true,
            products: true,
            orders: true,
          },
        },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  return NextResponse.json({
    data: tenants,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
