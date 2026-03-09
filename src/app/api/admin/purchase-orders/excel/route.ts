export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";
import { generateExcel, parseExcel, type ColumnDef } from "@/lib/excel";

const PO_COLUMNS: ColumnDef[] = [
  { header: "발주번호", key: "poNumber", width: 18 },
  { header: "공급사", key: "supplierName", width: 15 },
  { header: "상태", key: "status", width: 10 },
  { header: "상품명", key: "productName", width: 25 },
  { header: "수량", key: "quantity", width: 8 },
  { header: "단가", key: "unitPrice", width: 12 },
  { header: "소계", key: "subtotal", width: 12 },
  { header: "총액", key: "totalAmount", width: 12 },
  { header: "발주일", key: "createdAt", width: 12 },
  { header: "메모", key: "notes", width: 20 },
];

const UPLOAD_COLUMNS: ColumnDef[] = [
  { header: "공급사명", key: "supplierName", width: 15 },
  { header: "상품코드", key: "productCode", width: 15 },
  { header: "상품명", key: "productName", width: 25 },
  { header: "수량", key: "quantity", width: 8 },
  { header: "단가", key: "unitPrice", width: 12 },
  { header: "메모", key: "notes", width: 20 },
];

export async function GET(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "";
  const supplierId = searchParams.get("supplierId") || "";
  const template = searchParams.get("template") || "";

  if (template === "upload") {
    const { generateTemplate } = await import("@/lib/excel");
    const buf = generateTemplate(UPLOAD_COLUMNS, "발주업로드템플릿");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="po_upload_template.xlsx"`,
      },
    });
  }

  const where: any = { ...tenantFilter(ctx) };
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;

  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: Record<string, unknown>[] = [];
  for (const po of pos) {
    for (const item of po.items) {
      rows.push({
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        status: po.status,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.unitPrice) * item.quantity,
        totalAmount: po.totalAmount ? Number(po.totalAmount) : "",
        createdAt: new Date(po.createdAt).toLocaleDateString("ko-KR"),
        notes: po.notes || "",
      });
    }
  }

  const buffer = generateExcel(PO_COLUMNS, rows, "발주목록");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="purchase_orders_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

function generatePONumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `PO-${yy}${mm}${dd}-${rand}`;
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json(
        { error: { code: "NO_FILE", message: "파일을 선택해주세요" } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseExcel(buffer, UPLOAD_COLUMNS);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: { code: "EMPTY_FILE", message: "데이터가 없습니다" } },
        { status: 400 }
      );
    }

    // 공급사별로 그룹핑
    const groups: Map<string, typeof rows> = new Map();
    for (const row of rows) {
      const key = row.supplierName;
      const group = groups.get(key) || [];
      group.push(row);
      groups.set(key, group);
    }

    let created = 0;
    const errors: string[] = [];

    for (const [supplierName, groupRows] of groups) {
      if (!supplierName) {
        errors.push("공급사명이 누락된 행이 있습니다");
        continue;
      }

      const supplier = await prisma.supplier.findFirst({
        where: { name: supplierName },
      });
      if (!supplier) {
        errors.push(`공급사를 찾을 수 없습니다: ${supplierName}`);
        continue;
      }

      const items: { productId: string; productName: string; quantity: number; unitPrice: number }[] = [];
      let totalAmount = 0;
      let hasError = false;

      for (const row of groupRows) {
        const qty = parseInt(row.quantity) || 1;
        const price = parseFloat(row.unitPrice) || 0;

        let productId = "";
        if (row.productCode) {
          const product = await prisma.product.findUnique({
            where: { code: row.productCode },
            select: { id: true, name: true },
          });
          if (product) {
            productId = product.id;
          }
        }

        items.push({
          productId: productId || "",
          productName: row.productName || row.productCode || "",
          quantity: qty,
          unitPrice: price,
        });
        totalAmount += price * qty;
      }

      if (hasError) continue;

      await prisma.purchaseOrder.create({
        data: {
          poNumber: generatePONumber(),
          supplierId: supplier.id,
          totalAmount,
          notes: groupRows[0].notes || null,
          tenantId: ctx.tenantId,
          items: { create: items },
        },
      });
      created++;
    }

    return NextResponse.json({
      data: { created, errors },
    });
  } catch (err) {
    console.error("[purchase-orders/excel POST]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "파일 처리 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
