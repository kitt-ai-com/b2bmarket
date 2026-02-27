export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { generateExcel, ColumnDef } from "@/lib/excel";

const columns: ColumnDef[] = [
  { header: "셀러", key: "sellerName", width: 15 },
  { header: "정산기간(시작)", key: "periodStart", width: 14 },
  { header: "정산기간(종료)", key: "periodEnd", width: 14 },
  { header: "총매출", key: "totalSales", width: 15 },
  { header: "수수료율(%)", key: "feeRate", width: 12 },
  { header: "수수료", key: "totalFee", width: 15 },
  { header: "클레임공제", key: "claimDeduct", width: 12 },
  { header: "지급액", key: "netAmount", width: 15 },
  { header: "상태", key: "status", width: 10 },
  { header: "지급일", key: "paidAt", width: 14 },
  { header: "메모", key: "notes", width: 20 },
];

const statusLabel: Record<string, string> = {
  PENDING: "대기",
  CONFIRMED: "확인",
  PAID: "지급완료",
};

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "";

  const where: any = {};
  if (status) where.status = status;

  const settlements = await prisma.settlement.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const sellerIds = [...new Set(settlements.map((s) => s.sellerId))];
  const sellers = await prisma.user.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, name: true },
  });
  const sellerMap = Object.fromEntries(sellers.map((s) => [s.id, s.name]));

  const fmtDate = (d: Date) => d.toLocaleDateString("ko-KR");

  const rows = settlements.map((s) => ({
    sellerName: sellerMap[s.sellerId] || "-",
    periodStart: fmtDate(s.periodStart),
    periodEnd: fmtDate(s.periodEnd),
    totalSales: Number(s.totalSales),
    feeRate: Number(s.feeRate),
    totalFee: Number(s.totalFee),
    claimDeduct: Number(s.claimDeduct),
    netAmount: Number(s.netAmount),
    status: statusLabel[s.status] || s.status,
    paidAt: s.paidAt ? fmtDate(s.paidAt) : "",
    notes: s.notes || "",
  }));

  const buffer = generateExcel(columns, rows, "정산내역");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="settlements_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
