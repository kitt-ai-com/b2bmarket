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
  const type = searchParams.get("type") || "";

  const where: any = {};
  if (type) where.type = type;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.notification.count({ where }),
  ]);

  return NextResponse.json({
    data: notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// 알림 생성 (관리자가 수동으로 전체 또는 특정 셀러에게)
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { userId, type, title, message } = body;

  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "제목과 내용을 입력해주세요" } },
      { status: 400 }
    );
  }

  // 특정 유저에게 또는 전체 셀러에게
  if (userId) {
    const notification = await prisma.notification.create({
      data: { userId, type: type || "SYSTEM", title, message },
    });
    return NextResponse.json({ data: notification }, { status: 201 });
  }

  // 전체 셀러에게 발송
  const sellers = await prisma.user.findMany({
    where: { role: "SELLER", status: "ACTIVE" },
    select: { id: true },
  });

  const notifications = await prisma.notification.createMany({
    data: sellers.map((s) => ({
      userId: s.id,
      type: type || "NOTICE",
      title,
      message,
    })),
  });

  return NextResponse.json({ data: { count: notifications.count } }, { status: 201 });
}
