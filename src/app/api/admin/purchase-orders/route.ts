export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { purchaseOrderCreateSchema } from "@/lib/validations/purchase-order";

function generatePONumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `PO-${yy}${mm}${dd}-${rand}`;
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "";
  const supplierId = searchParams.get("supplierId") || "";
  const search = searchParams.get("search") || "";

  const where: any = {};
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (search) {
    where.OR = [
      { poNumber: { contains: search, mode: "insensitive" } },
      { supplier: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { name: true } },
        items: true,
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return NextResponse.json({
    data: orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = purchaseOrderCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { supplierId, notes, items } = parsed.data;
    const totalAmount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: generatePONumber(),
        supplierId,
        notes: notes || null,
        totalAmount,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
      include: {
        supplier: { select: { name: true } },
        items: true,
      },
    });

    return NextResponse.json({ data: po }, { status: 201 });
  } catch (err) {
    console.error("[purchase-orders POST]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
