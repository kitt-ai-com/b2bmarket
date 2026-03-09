export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

// 내 알림 조회 (모든 역할 공용)
export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 50);

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: ctx.userId },
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({
      where: { userId: ctx.userId, isRead: false },
    }),
  ]);

  return NextResponse.json({ data: notifications, unreadCount });
}

// 알림 읽음 처리
export async function PATCH(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  const body = await request.json();
  const { ids, all } = body;

  if (all) {
    await prisma.notification.updateMany({
      where: { userId: ctx.userId, isRead: false },
      data: { isRead: true },
    });
  } else if (ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: ctx.userId },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ data: { success: true } });
}
