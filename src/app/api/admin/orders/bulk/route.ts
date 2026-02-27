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

    // 배송중으로 일괄 변경 시 송장번호 미입력 건 검증
    if (status === "SHIPPING") {
      const ordersWithoutTracking = await prisma.order.findMany({
        where: {
          id: { in: ids },
          OR: [
            { trackingNumber: null },
            { trackingNumber: "" },
          ],
        },
        select: { orderNumber: true },
      });

      if (ordersWithoutTracking.length > 0) {
        const numbers = ordersWithoutTracking.map((o) => o.orderNumber).join(", ");
        return NextResponse.json(
          {
            error: {
              code: "MISSING_TRACKING",
              message: `송장번호가 미입력된 주문이 있습니다: ${numbers}`,
            },
          },
          { status: 400 }
        );
      }
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
