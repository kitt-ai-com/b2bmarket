export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

/**
 * PATCH /api/admin/invites/[id]
 * 초대 링크/코드 활성/비활성 토글
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  if (ctx.role !== "ADMIN" && ctx.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: { message: "관리자 권한이 필요합니다" } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const invite = await prisma.inviteLink.findFirst({
      where: { id, ...tenantFilter(ctx) },
    });

    if (!invite) {
      return NextResponse.json(
        { error: { message: "초대를 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updated = await prisma.inviteLink.update({
      where: { id },
      data: { isActive: body.isActive },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PATCH /api/admin/invites/[id] error:", err);
    return NextResponse.json(
      { error: { message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
