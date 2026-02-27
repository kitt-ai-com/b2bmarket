export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, sellerId: session.user.id },
    include: {
      items: {
        include: {
          product: {
            select: { name: true, code: true, imageUrl: true, unit: true },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "주문을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: order });
}
