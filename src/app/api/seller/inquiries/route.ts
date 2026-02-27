export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "";

  const where: any = { userId: session.user.id };
  if (status) where.status = status;

  const [inquiries, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.inquiry.count({ where }),
  ]);

  return NextResponse.json({
    data: inquiries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { title, content } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "제목과 내용을 입력해주세요" } },
      { status: 400 }
    );
  }

  const inquiry = await prisma.inquiry.create({
    data: {
      userId: session.user.id,
      title: title.trim(),
      content: content.trim(),
    },
  });

  return NextResponse.json({ data: inquiry }, { status: 201 });
}
