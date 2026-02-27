import * as XLSX from "xlsx";

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
}

/**
 * Generate an Excel file buffer from data rows.
 */
export function generateExcel(
  columns: ColumnDef[],
  rows: Record<string, unknown>[],
  sheetName = "Sheet1"
): Buffer {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (val === null || val === undefined) return "";
      return val;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Set column widths
  ws["!cols"] = columns.map((c) => ({ wch: c.width || 15 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/**
 * Parse an Excel file buffer and return rows as objects.
 */
export function parseExcel(
  buffer: Buffer,
  columns: ColumnDef[]
): Record<string, string>[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (raw.length < 2) return [];

  const headerRow = raw[0].map((h) => String(h).trim());
  const headerToKey: Record<string, string> = {};

  for (const col of columns) {
    const idx = headerRow.indexOf(col.header);
    if (idx !== -1) {
      headerToKey[String(idx)] = col.key;
    }
  }

  const result: Record<string, string>[] = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "")) continue;

    const obj: Record<string, string> = {};
    for (const [idxStr, key] of Object.entries(headerToKey)) {
      const val = row[Number(idxStr)];
      obj[key] = val !== null && val !== undefined ? String(val).trim() : "";
    }
    result.push(obj);
  }

  return result;
}

/**
 * Generate an empty template with just headers.
 */
export function generateTemplate(
  columns: ColumnDef[],
  sheetName = "Template"
): Buffer {
  return generateExcel(columns, [], sheetName);
}
