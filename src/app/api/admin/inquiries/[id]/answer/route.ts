export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { answer } = body;

  if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "답변 내용을 입력해주세요" } },
      { status: 400 }
    );
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "문의를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const updated = await prisma.inquiry.update({
    where: { id },
    data: {
      answer: answer.trim(),
      status: "ANSWERED",
      answeredAt: new Date(),
    },
  });

  return NextResponse.json({ data: updated });
}
