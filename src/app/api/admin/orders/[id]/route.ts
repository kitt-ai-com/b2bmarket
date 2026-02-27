export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { orderStatusUpdateSchema } from "@/lib/validations/order";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          name: true,
          email: true,
          sellerProfile: { select: { businessName: true } },
        },
      },
      items: {
        include: {
          product: { select: { name: true, code: true, imageUrl: true, unit: true } },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = orderStatusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const validated = parsed.data;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "주문을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const updateData: any = { status: validated.status };

  if (validated.status === "SHIPPING") {
    if (validated.courier) updateData.courier = validated.courier;
    if (validated.trackingNumber) updateData.trackingNumber = validated.trackingNumber;
    updateData.shippedAt = new Date();
  }

  if (validated.status === "DELIVERED") {
    updateData.deliveredAt = new Date();
  }

  const updated = await prisma.order.update({
    where: { id },
    data: updateData,
    include: {
      seller: { select: { name: true, email: true } },
      items: {
        include: { product: { select: { name: true, code: true } } },
      },
    },
  });

  return NextResponse.json({ data: updated });
}
