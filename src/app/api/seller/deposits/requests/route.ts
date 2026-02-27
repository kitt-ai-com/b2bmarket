export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { depositRequestSchema } from "@/lib/validations/deposit";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  try {
    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "20");

    const where = { sellerId: session.user.id };

    const [requests, total] = await Promise.all([
      prisma.depositRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.depositRequest.count({ where }),
    ]);

    return NextResponse.json({
      data: requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[seller/deposits/requests GET]", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = depositRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const depositRequest = await prisma.depositRequest.create({
      data: {
        sellerId: session.user.id,
        amount: parsed.data.amount,
        depositorName: parsed.data.depositorName,
      },
    });

    return NextResponse.json({ data: depositRequest }, { status: 201 });
  } catch (err) {
    console.error("[seller/deposits/requests POST]", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
