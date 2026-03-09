export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getTenantContext } from "@/lib/tenant";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".webp"];
const MAX_ROWS = 200; // 엑셀 최대 행 수 제한

export async function POST(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;
  // ctx available for future tenant-scoped upload logic
  void ctx;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: { message: "파일을 선택해주세요" } },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: { message: "파일 크기는 5MB 이하만 가능합니다" } },
      { status: 400 }
    );
  }

  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: { message: `지원하지 않는 파일 형식입니다. (${ALLOWED_EXTENSIONS.join(", ")})` } },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Image files → base64 for Gemini vision
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    const base64 = buffer.toString("base64");
    const mimeType = file.type || `image/${ext.slice(1)}`;
    return NextResponse.json({
      data: {
        type: "image",
        fileName: file.name,
        mimeType,
        base64,
      },
    });
  }

  // Excel/CSV → parse to text
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: { name: string; text: string; rowCount: number }[] = [];

    for (const sheetName of workbook.SheetNames.slice(0, 3)) {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const rowCount = json.length;
      const truncated = json.slice(0, MAX_ROWS);

      // Convert to markdown table for AI readability
      if (truncated.length > 0) {
        const headers = Object.keys(truncated[0]);
        const headerRow = `| ${headers.join(" | ")} |`;
        const separator = `| ${headers.map(() => "---").join(" | ")} |`;
        const dataRows = truncated.map(
          (row) => `| ${headers.map((h) => String(row[h] ?? "")).join(" | ")} |`
        );
        let text = [headerRow, separator, ...dataRows].join("\n");
        if (rowCount > MAX_ROWS) {
          text += `\n\n... (총 ${rowCount}행 중 ${MAX_ROWS}행만 표시)`;
        }
        sheets.push({ name: sheetName, text, rowCount });
      }
    }

    if (sheets.length === 0) {
      return NextResponse.json(
        { error: { message: "파일에 데이터가 없습니다" } },
        { status: 400 }
      );
    }

    const totalRows = sheets.reduce((sum, s) => sum + s.rowCount, 0);
    const fileContext = sheets
      .map((s) =>
        sheets.length > 1
          ? `[시트: ${s.name}]\n${s.text}`
          : s.text
      )
      .join("\n\n");

    return NextResponse.json({
      data: {
        type: "spreadsheet",
        fileName: file.name,
        sheetCount: sheets.length,
        totalRows,
        fileContext,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { message: "파일을 읽는 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
