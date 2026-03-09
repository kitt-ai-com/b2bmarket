export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, tenantFilter } from "@/lib/tenant";

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  if (ctx.role === "SELLER") return NextResponse.json({ error: { message: "권한이 없습니다" } }, { status: 403 });

  try {
    const body = await request.json();
    const { ids, action, value } = body as {
      ids: string[];
      action: string;
      value: any;
    };

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "상품을 선택해주세요" } },
        { status: 400 }
      );
    }

    const tenantWhere = tenantFilter(ctx);
    let updated = 0;

    switch (action) {
      case "status": {
        const validStatuses = ["ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"];
        if (!validStatuses.includes(value)) {
          return NextResponse.json(
            { error: { code: "VALIDATION_ERROR", message: "유효하지 않은 상태입니다" } },
            { status: 400 }
          );
        }
        const result = await prisma.product.updateMany({
          where: { id: { in: ids }, ...tenantWhere },
          data: { status: value },
        });
        updated = result.count;
        break;
      }

      case "category": {
        const result = await prisma.product.updateMany({
          where: { id: { in: ids }, ...tenantWhere },
          data: { categoryId: value || null },
        });
        updated = result.count;
        break;
      }

      case "source": {
        const validSources = ["SELF", "SUPPLIER"];
        if (!validSources.includes(value)) {
          return NextResponse.json(
            { error: { code: "VALIDATION_ERROR", message: "유효하지 않은 출처입니다" } },
            { status: 400 }
          );
        }
        const result = await prisma.product.updateMany({
          where: { id: { in: ids }, ...tenantWhere },
          data: { source: value },
        });
        updated = result.count;
        break;
      }

      case "basePrice": {
        const { mode, amount } = value as { mode: "set" | "percent"; amount: number };
        if (mode === "set") {
          if (amount < 0) {
            return NextResponse.json(
              { error: { code: "VALIDATION_ERROR", message: "가격은 0 이상이어야 합니다" } },
              { status: 400 }
            );
          }
          const result = await prisma.product.updateMany({
            where: { id: { in: ids }, ...tenantWhere },
            data: { basePrice: amount },
          });
          updated = result.count;
        } else if (mode === "percent") {
          // 퍼센트 변경은 개별 처리 필요
          const products = await prisma.product.findMany({
            where: { id: { in: ids }, ...tenantWhere },
            select: { id: true, basePrice: true },
          });
          const multiplier = 1 + amount / 100;
          await prisma.$transaction(
            products.map((p) =>
              prisma.product.update({
                where: { id: p.id },
                data: { basePrice: Math.round(Number(p.basePrice) * multiplier) },
              })
            )
          );
          updated = products.length;
        }
        break;
      }

      case "costPrice": {
        const { mode, amount } = value as { mode: "set" | "percent"; amount: number };
        if (mode === "set") {
          const result = await prisma.product.updateMany({
            where: { id: { in: ids }, ...tenantWhere },
            data: { costPrice: amount >= 0 ? amount : null },
          });
          updated = result.count;
        } else if (mode === "percent") {
          const products = await prisma.product.findMany({
            where: { id: { in: ids }, costPrice: { not: null }, ...tenantWhere },
            select: { id: true, costPrice: true },
          });
          const multiplier = 1 + amount / 100;
          await prisma.$transaction(
            products.map((p) =>
              prisma.product.update({
                where: { id: p.id },
                data: { costPrice: Math.round(Number(p.costPrice) * multiplier) },
              })
            )
          );
          updated = products.length;
        }
        break;
      }

      case "stock": {
        const { mode, amount } = value as { mode: "set" | "add"; amount: number };
        if (mode === "set") {
          const result = await prisma.product.updateMany({
            where: { id: { in: ids }, ...tenantWhere },
            data: { stock: Math.max(0, amount) },
          });
          updated = result.count;
        } else if (mode === "add") {
          const products = await prisma.product.findMany({
            where: { id: { in: ids }, ...tenantWhere },
            select: { id: true, stock: true },
          });
          await prisma.$transaction(
            products.map((p) =>
              prisma.product.update({
                where: { id: p.id },
                data: { stock: Math.max(0, p.stock + amount) },
              })
            )
          );
          updated = products.length;
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "유효하지 않은 작업입니다" } },
          { status: 400 }
        );
    }

    return NextResponse.json({ data: { updated } });
  } catch (err) {
    console.error("[admin/products/bulk PATCH]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
