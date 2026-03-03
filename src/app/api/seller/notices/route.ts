export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error, session } = await requireSeller();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");

  const [notices, total] = await Promise.all([
    prisma.notice.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notice.count(),
  ]);

  return NextResponse.json({
    data: notices,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
