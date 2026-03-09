export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

// 대화 이력 조회
export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);
  const cursor = searchParams.get("cursor") || undefined;

  const messages = await prisma.chatMessage.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "asc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      role: true,
      content: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: messages,
    nextCursor: messages.length === limit ? messages[messages.length - 1]?.id : null,
  });
}

// 대화 기록 초기화
export async function DELETE() {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  await prisma.chatMessage.deleteMany({
    where: { userId: ctx.userId },
  });

  return NextResponse.json({ data: { success: true } });
}
