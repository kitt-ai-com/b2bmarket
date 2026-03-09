export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "공급사를 찾을 수 없습니다" } },
      { status: 404 }
    );
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.contactName !== undefined && { contactName: body.contactName || null }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.kakaoId !== undefined && { kakaoId: body.kakaoId || null }),
      ...(body.address !== undefined && { address: body.address || null }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
    },
  });

  return NextResponse.json({ data: updated });
}
