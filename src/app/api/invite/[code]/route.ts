export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invite/[code]
 * 공개 API - 초대 코드 유효성 확인 (인증 불필요)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const invite = await prisma.inviteLink.findFirst({
      where: {
        code: code.toLowerCase(),
        isActive: true,
      },
      include: {
        tenant: { select: { name: true, status: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({
        valid: false,
        reason: "존재하지 않거나 비활성화된 초대 코드입니다",
      });
    }

    // 만료 확인
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return NextResponse.json({
        valid: false,
        reason: "만료된 초대 코드입니다",
      });
    }

    // 사용 횟수 확인 (maxUses=0이면 무제한)
    if (invite.maxUses > 0 && invite.currentUses >= invite.maxUses) {
      return NextResponse.json({
        valid: false,
        reason: "사용 횟수를 초과한 초대 코드입니다",
      });
    }

    // 테넌트 상태 확인
    if (invite.tenant.status !== "ACTIVE") {
      return NextResponse.json({
        valid: false,
        reason: "비활성 상태의 마켓입니다",
      });
    }

    return NextResponse.json({
      valid: true,
      tenantName: invite.tenant.name,
    });
  } catch (err) {
    console.error("GET /api/invite/[code] error:", err);
    return NextResponse.json(
      { valid: false, reason: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
