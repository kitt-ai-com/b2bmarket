export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { createNotification } from "@/lib/notification";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { trackingNumber, courier } = body as { trackingNumber?: string; courier?: string };

  const order = await prisma.order.findFirst({ where: { id, ...tenantFilter(ctx) } });
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

  // 셀러에게 송장 등록 알림
  if (trackingNumber) {
    await createNotification({
      userId: order.sellerId,
      type: "TRACKING_UPDATED",
      title: `송장번호 등록: ${order.orderNumber}`,
      message: `주문 ${order.orderNumber}에 송장번호 ${trackingNumber}이(가) 등록되었습니다.${courier ? ` (택배사: ${courier})` : ""}`,
      data: { orderId: id, orderNumber: order.orderNumber },
    });
  }

  return NextResponse.json({ data: updated });
}
