export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import crypto from "crypto";

/**
 * GET /api/admin/invites
 * 해당 테넌트의 초대 링크/코드 목록 조회
 */
export async function GET() {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  if (ctx.role !== "ADMIN" && ctx.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: { message: "관리자 권한이 필요합니다" } },
      { status: 403 }
    );
  }

  try {
    const invites = await prisma.inviteLink.findMany({
      where: {
        ...tenantFilter(ctx),
      },
      include: {
        tenant: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: invites });
  } catch (err) {
    console.error("GET /api/admin/invites error:", err);
    return NextResponse.json(
      { error: { message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/invites
 * 초대 링크/코드 생성
 */
export async function POST(request: Request) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  if (ctx.role !== "ADMIN" && ctx.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: { message: "관리자 권한이 필요합니다" } },
      { status: 403 }
    );
  }

  if (!ctx.tenantId) {
    return NextResponse.json(
      { error: { message: "테넌트 정보가 필요합니다" } },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { type, expiresAt, maxUses } = body;

    // type 유효성 검사
    if (!type || !["LINK", "CODE"].includes(type)) {
      return NextResponse.json(
        { error: { message: "type은 LINK 또는 CODE여야 합니다" } },
        { status: 400 }
      );
    }

    // 랜덤 코드 생성: 8자리 영문+숫자 (소문자로 저장)
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toLowerCase();

    const invite = await prisma.inviteLink.create({
      data: {
        tenantId: ctx.tenantId,
        code,
        type,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxUses: maxUses ?? 0,
        createdById: ctx.userId,
      },
      include: {
        tenant: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ data: invite }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/invites error:", err);
    return NextResponse.json(
      { error: { message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
