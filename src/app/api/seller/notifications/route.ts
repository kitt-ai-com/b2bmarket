export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const unreadOnly = searchParams.get("unread") === "true";

  const where: any = { userId: ctx.userId };
  if (unreadOnly) where.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: ctx.userId, isRead: false } }),
  ]);

  return NextResponse.json({
    data: notifications,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// 알림 읽음 처리
export async function PATCH(request: NextRequest) {
  const { error: patchError, ctx: patchCtx } = await getTenantContext();
  if (patchError) return patchError;
  if (patchCtx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const body = await request.json();
  const { ids, all } = body;

  if (all) {
    await prisma.notification.updateMany({
      where: { userId: patchCtx.userId, isRead: false },
      data: { isRead: true },
    });
  } else if (ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: patchCtx.userId },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ data: { success: true } });
}
