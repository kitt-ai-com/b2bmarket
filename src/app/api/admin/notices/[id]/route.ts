export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { title, content, isImportant } = body;

  const notice = await prisma.notice.findUnique({ where: { id } });
  if (!notice) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "공지를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const updated = await prisma.notice.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content: content.trim() }),
      ...(isImportant !== undefined && { isImportant }),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const notice = await prisma.notice.findUnique({ where: { id } });
  if (!notice) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "공지를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  await prisma.notice.delete({ where: { id } });

  return NextResponse.json({ data: { success: true } });
}
