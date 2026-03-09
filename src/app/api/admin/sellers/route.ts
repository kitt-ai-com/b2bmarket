export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import type { UserStatus } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") as UserStatus | null;
  const gradeId = searchParams.get("gradeId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: any = { role: "SELLER", ...tenantFilter(ctx) };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { sellerProfile: { businessName: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (gradeId) {
    where.sellerProfile = { ...where.sellerProfile, gradeId };
  }

  const [sellers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true,
        sellerProfile: {
          select: {
            id: true,
            businessName: true,
            businessNumber: true,
            bizLicenseUrl: true,
            customFeeRate: true,
            grade: {
              select: {
                id: true,
                name: true,
                level: true,
                feeRate: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    data: sellers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
