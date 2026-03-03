export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/lib/auth-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireSeller();
  if (error) return error;

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
