export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

const VALID_STATUSES = ["PENDING", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED", "RETURNED", "EXCHANGED"];

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { ids, status } = body as { ids: string[]; status: string };

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "주문을 선택해주세요" } },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "유효하지 않은 상태입니다" } },
        { status: 400 }
      );
    }

    const updateData: any = { status };

    if (status === "SHIPPING") {
      updateData.shippedAt = new Date();
    }
    if (status === "DELIVERED") {
      updateData.deliveredAt = new Date();
    }

    const result = await prisma.order.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    return NextResponse.json({ data: { updated: result.count } });
  } catch (err) {
    console.error("[admin/orders/bulk PATCH]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
