export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await req.json();
    const {
      name,
      displayName,
      price,
      maxSellers,
      maxMonthlyOrders,
      maxProducts,
      maxDailyAiChats,
      hasExcel,
      hasFullStats,
      trialDays,
      isActive,
      sortOrder,
    } = body;

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { message: "요금제를 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

    // name 변경 시 중복 체크
    if (name && name !== existing.name) {
      const duplicate = await prisma.plan.findUnique({ where: { name } });
      if (duplicate) {
        return NextResponse.json(
          { error: { message: "이미 존재하는 요금제 이름입니다" } },
          { status: 409 }
        );
      }
    }

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(displayName !== undefined && { displayName }),
        ...(price !== undefined && { price }),
        ...(maxSellers !== undefined && { maxSellers }),
        ...(maxMonthlyOrders !== undefined && { maxMonthlyOrders }),
        ...(maxProducts !== undefined && { maxProducts }),
        ...(maxDailyAiChats !== undefined && { maxDailyAiChats }),
        ...(hasExcel !== undefined && { hasExcel }),
        ...(hasFullStats !== undefined && { hasFullStats }),
        ...(trialDays !== undefined && { trialDays }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
      include: {
        _count: { select: { tenants: true } },
      },
    });

    return NextResponse.json({ data: plan });
  } catch (err) {
    console.error("Plan update error:", err);
    return NextResponse.json(
      { error: { message: "요금제 수정 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { tenants: true } } },
    });

    if (!plan) {
      return NextResponse.json(
        { error: { message: "요금제를 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

    if (plan._count.tenants > 0) {
      return NextResponse.json(
        {
          error: {
            message: `이 요금제를 사용 중인 테넌트가 ${plan._count.tenants}개 있어 삭제할 수 없습니다`,
          },
        },
        { status: 409 }
      );
    }

    await prisma.plan.delete({ where: { id } });

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("Plan delete error:", err);
    return NextResponse.json(
      { error: { message: "요금제 삭제 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
