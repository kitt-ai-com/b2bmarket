export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { sellerUpdateSchema } from "@/lib/validations/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;

  const seller = await prisma.user.findFirst({
    where: { id, role: "SELLER", ...tenantFilter(ctx) },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      sellerProfile: {
        select: {
          id: true,
          businessName: true,
          businessNumber: true,
          bizLicenseUrl: true,
          customFeeRate: true,
          createdAt: true,
          grade: {
            select: {
              id: true,
              name: true,
              level: true,
              feeRate: true,
            },
          },
        },
      },
      _count: {
        select: {
          orders: true,
          inquiries: true,
        },
      },
    },
  });

  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "셀러를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: seller });
}

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
    const validated = sellerUpdateSchema.parse(body);

    const seller = await prisma.user.findFirst({
      where: { id, role: "SELLER", ...tenantFilter(ctx) },
      include: { sellerProfile: true },
    });

    if (!seller) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "셀러를 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

    // 상태 변경
    if (validated.status) {
      await prisma.user.update({
        where: { id },
        data: { status: validated.status },
      });
    }

    // 등급 변경 또는 수수료 변경
    if (seller.sellerProfile && (validated.gradeId !== undefined || validated.customFeeRate !== undefined)) {
      const profileUpdate: any = {};
      if (validated.gradeId) profileUpdate.gradeId = validated.gradeId;
      if (validated.customFeeRate !== undefined) profileUpdate.customFeeRate = validated.customFeeRate;

      await prisma.sellerProfile.update({
        where: { id: seller.sellerProfile.id },
        data: profileUpdate,
      });
    }

    // 업데이트된 셀러 정보 조회
    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        sellerProfile: {
          select: {
            businessName: true,
            customFeeRate: true,
            grade: { select: { id: true, name: true, feeRate: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: err.errors } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
