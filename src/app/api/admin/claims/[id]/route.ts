export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { claimUpdateSchema } from "@/lib/validations/claim";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = claimUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "클레임을 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const data: any = {
    status: parsed.data.status,
    ...(parsed.data.adminNote !== undefined && { adminNote: parsed.data.adminNote }),
    ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
    ...(parsed.data.newTrackingNo !== undefined && { newTrackingNo: parsed.data.newTrackingNo }),
  };

  if (parsed.data.status === "COMPLETED") {
    data.processedAt = new Date();
  }

  const updated = await prisma.claim.update({ where: { id }, data });

  return NextResponse.json({ data: updated });
}
