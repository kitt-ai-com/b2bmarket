export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { orderModRequestSchema } from "@/lib/validations/order";
import { createNotification } from "@/lib/notification";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const { id } = await params;

  // 주문 소유 확인
  const order = await prisma.order.findFirst({
    where: { id, sellerId: ctx.userId, ...tenantFilter(ctx) },
    select: { id: true },
  });
  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "주문을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const requests = await prisma.orderModificationRequest.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: requests });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: postError, ctx: postCtx } = await getTenantContext();
  if (postError) return postError;
  if (postCtx.role !== "SELLER") return NextResponse.json({ error: { message: "셀러만 접근 가능합니다" } }, { status: 403 });

  const { id } = await params;
  const sellerId = postCtx.userId;

  const body = await request.json();
  const parsed = orderModRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const validated = parsed.data;

  // 주문 확인
  const order = await prisma.order.findFirst({
    where: { id, sellerId, ...tenantFilter(postCtx) },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "주문을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  if (order.status !== "PREPARING") {
    return NextResponse.json(
      { error: { code: "INVALID_STATUS", message: "배송준비 상태의 주문만 수정 요청할 수 있습니다" } },
      { status: 400 }
    );
  }

  // 이미 대기 중인 요청 확인
  const pendingRequest = await prisma.orderModificationRequest.findFirst({
    where: { orderId: id, status: "PENDING" },
  });
  if (pendingRequest) {
    return NextResponse.json(
      { error: { code: "ALREADY_PENDING", message: "이미 대기 중인 수정 요청이 있습니다" } },
      { status: 400 }
    );
  }

  const modRequest = await prisma.orderModificationRequest.create({
    data: {
      orderId: id,
      sellerId,
      changes: validated.changes,
      reason: validated.reason,
    },
  });

  // 관리자에게 알림
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: "ORDER_MOD_REQUESTED",
        title: `주문 수정 요청: ${order.orderNumber}`,
        message: `주문 ${order.orderNumber}에 대한 수정 요청이 접수되었습니다. 사유: ${validated.reason}`,
        data: { orderId: id, modRequestId: modRequest.id },
      })
    )
  );

  return NextResponse.json({ data: modRequest }, { status: 201 });
}
