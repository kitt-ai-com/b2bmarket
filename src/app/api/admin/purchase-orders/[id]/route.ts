export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { purchaseOrderStatusSchema } from "@/lib/validations/purchase-order";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { name: true, contactName: true, phone: true, email: true } },
      items: true,
    },
  });

  if (!po) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "발주를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: po });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = purchaseOrderStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "유효하지 않은 상태입니다" } },
      { status: 400 }
    );
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "발주를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const updateData: any = { status: parsed.data.status };

  if (parsed.data.status === "SENT") {
    updateData.sentAt = new Date();
  }
  if (parsed.data.status === "RECEIVED") {
    updateData.receivedAt = new Date();
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: updateData,
    include: {
      supplier: { select: { name: true } },
      items: true,
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "발주를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  if (po.status !== "DRAFT") {
    return NextResponse.json(
      { error: { code: "INVALID_STATUS", message: "초안 상태의 발주만 삭제할 수 있습니다" } },
      { status: 400 }
    );
  }

  await prisma.purchaseOrder.delete({ where: { id } });

  return NextResponse.json({ data: { deleted: true } });
}
