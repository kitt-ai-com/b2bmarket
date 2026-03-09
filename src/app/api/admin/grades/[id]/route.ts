export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { gradeUpdateSchema } from "@/lib/validations/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = gradeUpdateSchema.parse(body);

    const grade = await prisma.sellerGrade.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json({ data: grade });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: err.errors } },
        { status: 400 }
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "등급을 찾을 수 없습니다" } },
        { status: 404 }
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;

  const sellersUsingGrade = await prisma.sellerProfile.count({
    where: { gradeId: id },
  });

  if (sellersUsingGrade > 0) {
    return NextResponse.json(
      { error: { code: "IN_USE", message: `${sellersUsingGrade}명의 셀러가 이 등급을 사용 중입니다. 먼저 등급을 변경해주세요.` } },
      { status: 409 }
    );
  }

  try {
    await prisma.sellerGrade.delete({ where: { id } });
    return NextResponse.json({ message: "등급이 삭제되었습니다" });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "등급을 찾을 수 없습니다" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
