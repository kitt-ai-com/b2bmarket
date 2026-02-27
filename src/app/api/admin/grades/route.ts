export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { gradeCreateSchema } from "@/lib/validations/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const grades = await prisma.sellerGrade.findMany({
    orderBy: { level: "desc" },
    include: { _count: { select: { sellers: true } } },
  });

  return NextResponse.json({ data: grades });
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const validated = gradeCreateSchema.parse(body);

    const grade = await prisma.sellerGrade.create({
      data: validated,
    });

    return NextResponse.json({ data: grade }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: err.errors } },
        { status: 400 }
      );
    }
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: { code: "DUPLICATE", message: "이미 존재하는 등급 이름 또는 레벨입니다" } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
