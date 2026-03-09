export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/lib/chat/tools";
import * as XLSX from "xlsx";
import { getTenantContext } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  const body = await request.json();
  const { tools } = body as { tools: { name: string; args: Record<string, unknown> }[] };

  if (!tools?.length) {
    return NextResponse.json({ error: { message: "내보낼 데이터가 없습니다" } }, { status: 400 });
  }

  const role = ctx.role;
  const userId = ctx.userId;
  const tenantId = ctx.tenantId || undefined;

  // Execute all tools and collect results
  const allData: Record<string, unknown>[] = [];
  for (const tool of tools) {
    const result = await executeTool(tool.name, tool.args, userId, role, tenantId);
    if (Array.isArray(result)) {
      allData.push(...result);
    }
  }

  if (allData.length === 0) {
    return NextResponse.json({ error: { message: "내보낼 데이터가 없습니다" } }, { status: 400 });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(allData);
  XLSX.utils.book_append_sheet(wb, ws, "Data");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
