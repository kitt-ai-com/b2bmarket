export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/lib/auth-guard";
import { claimCreateSchema } from "@/lib/validations/claim";

export async function GET(request: NextRequest) {
  const { error, session } = await requireSeller();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "";

  const where: any = { order: { sellerId: session.user.id } };
  if (status) where.status = status;

  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { orderNumber: true, recipientName: true } },
      },
    }),
    prisma.claim.count({ where }),
  ]);

  return NextResponse.json({
    data: claims,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireSeller();
  if (error) return error;

  const body = await request.json();
  const parsed = claimCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  // 주문이 본인 것인지 확인
  const order = await prisma.order.findFirst({
    where: { id: parsed.data.orderId, sellerId: session.user.id },
  });
  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "주문을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const claim = await prisma.claim.create({
    data: {
      orderId: parsed.data.orderId,
      type: parsed.data.type,
      reason: parsed.data.reason,
      amount: parsed.data.amount,
    },
  });

  return NextResponse.json({ data: claim }, { status: 201 });
}
