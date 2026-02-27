export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 대화 이력 조회
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);
  const cursor = searchParams.get("cursor") || undefined;

  const messages = await prisma.chatMessage.findMany({
    where: { userId: session.user.id },
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  await prisma.chatMessage.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ data: { success: true } });
}
