export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { trackingNumber, courier } = body as { trackingNumber?: string; courier?: string };

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "주문을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  if (order.status !== "PREPARING" && order.status !== "SHIPPING") {
    return NextResponse.json(
      { error: { code: "INVALID_STATUS", message: "배송준비 또는 배송중 상태에서만 송장번호를 수정할 수 있습니다" } },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber || null;
  if (courier !== undefined) updateData.courier = courier || null;

  const updated = await prisma.order.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      trackingNumber: true,
      courier: true,
      status: true,
    },
  });

  return NextResponse.json({ data: updated });
}
