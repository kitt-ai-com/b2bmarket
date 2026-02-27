export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const limit = Number(searchParams.get("limit") || "100");

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
    ];
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      email: true,
      kakaoId: true,
      address: true,
      notes: true,
    },
  });

  return NextResponse.json({ data: suppliers });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "공급사명을 입력해주세요" } },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: body.name,
      contactName: body.contactName || null,
      phone: body.phone || null,
      email: body.email || null,
      kakaoId: body.kakaoId || null,
      address: body.address || null,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ data: supplier }, { status: 201 });
}
