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
  const search = searchParams.get("search") || "";

  const where: any = {};
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  const [notices, total] = await Promise.all([
    prisma.notice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notice.count({ where }),
  ]);

  return NextResponse.json({
    data: notices,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { title, content, isImportant } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "제목과 내용을 입력해주세요" } },
      { status: 400 }
    );
  }

  const notice = await prisma.notice.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      isImportant: isImportant || false,
      authorId: session.user.id,
    },
  });

  return NextResponse.json({ data: notice }, { status: 201 });
}
