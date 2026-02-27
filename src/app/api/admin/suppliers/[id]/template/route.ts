export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

// 발주 양식 템플릿 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const template = await prisma.excelTemplate.findUnique({
    where: { supplierId: id },
  });

  return NextResponse.json({ data: template });
}

// 발주 양식 템플릿 등록/수정
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  if (!body.name?.trim() || !body.columns?.length) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "양식 이름과 컬럼 정보를 입력해주세요" } },
      { status: 400 }
    );
  }

  // 공급사 확인
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "공급사를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const template = await prisma.excelTemplate.upsert({
    where: { supplierId: id },
    create: {
      supplierId: id,
      name: body.name,
      columns: body.columns,
      fileUrl: body.fileUrl || null,
    },
    update: {
      name: body.name,
      columns: body.columns,
      ...(body.fileUrl !== undefined && { fileUrl: body.fileUrl }),
    },
  });

  return NextResponse.json({ data: template });
}
