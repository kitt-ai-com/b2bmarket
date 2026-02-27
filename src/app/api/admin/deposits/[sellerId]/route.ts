export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { depositTransactionSchema } from "@/lib/validations/deposit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { sellerId } = await params;
  const page = Number(request.nextUrl.searchParams.get("page") || "1");
  const limit = Number(request.nextUrl.searchParams.get("limit") || "20");

  const deposit = await prisma.deposit.findUnique({
    where: { sellerId },
  });

  const where = deposit ? { depositId: deposit.id } : { depositId: "__none__" };

  const [transactions, total] = await Promise.all([
    prisma.depositTransaction.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.depositTransaction.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      balance: deposit?.balance || 0,
      transactions,
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { sellerId } = await params;

  try {
    const body = await request.json();
    const validated = depositTransactionSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // upsert: 예치금 레코드 없으면 생성
      let deposit = await tx.deposit.findUnique({ where: { sellerId } });

      if (!deposit) {
        deposit = await tx.deposit.create({
          data: { sellerId, balance: 0 },
        });
      }

      let newBalance: number;
      const currentBalance = Number(deposit.balance);

      if (validated.type === "CHARGE" || validated.type === "REFUND") {
        newBalance = currentBalance + validated.amount;
      } else {
        // DEDUCT
        if (currentBalance < validated.amount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        newBalance = currentBalance - validated.amount;
      }

      // 잔액 업데이트
      const updatedDeposit = await tx.deposit.update({
        where: { sellerId },
        data: { balance: newBalance },
      });

      // 거래내역 생성
      const transaction = await tx.depositTransaction.create({
        data: {
          depositId: deposit.id,
          type: validated.type,
          amount: validated.amount,
          balanceAfter: newBalance,
          description: validated.description || null,
          adminId: session!.user!.id,
        },
      });

      return { deposit: updatedDeposit, transaction };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: err.errors } },
        { status: 400 }
      );
    }
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_BALANCE", message: "예치금 잔액이 부족합니다" } },
        { status: 400 }
      );
    }
    console.error("Deposit transaction error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
