export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { action, adminNote } = body as { action: string; adminNote?: string };

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "action은 approve 또는 reject여야 합니다" } },
      { status: 400 }
    );
  }

  const depositRequest = await prisma.depositRequest.findUnique({ where: { id } });
  if (!depositRequest) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "충전 신청을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  if (depositRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: { code: "ALREADY_PROCESSED", message: "이미 처리된 신청입니다" } },
      { status: 400 }
    );
  }

  if (action === "reject") {
    const updated = await prisma.depositRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        adminNote: adminNote || null,
        processedAt: new Date(),
        processedBy: session!.user!.id,
      },
    });
    return NextResponse.json({ data: updated });
  }

  // 승인: 예치금 잔액 증가 + 거래내역 생성 + 신청 상태 변경
  const result = await prisma.$transaction(async (tx) => {
    let deposit = await tx.deposit.findUnique({
      where: { sellerId: depositRequest.sellerId },
    });

    if (!deposit) {
      deposit = await tx.deposit.create({
        data: { sellerId: depositRequest.sellerId, balance: 0 },
      });
    }

    const newBalance = Number(deposit.balance) + Number(depositRequest.amount);

    await tx.deposit.update({
      where: { sellerId: depositRequest.sellerId },
      data: { balance: newBalance },
    });

    await tx.depositTransaction.create({
      data: {
        depositId: deposit.id,
        type: "CHARGE",
        amount: depositRequest.amount,
        balanceAfter: newBalance,
        description: `충전 신청 승인 (입금자: ${depositRequest.depositorName})`,
        adminId: session!.user!.id,
      },
    });

    const updated = await tx.depositRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        adminNote: adminNote || null,
        processedAt: new Date(),
        processedBy: session!.user!.id,
      },
    });

    return updated;
  });

  return NextResponse.json({ data: result });
}
