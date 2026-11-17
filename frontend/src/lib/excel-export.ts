import * as XLSX from "xlsx";

export interface ExcelColumn<T> {
  header: string;
  key?: keyof T | string;
  width?: number;
  transform?: (row: T, index: number) => string | number | boolean | null | undefined;
}

export interface ExportToExcelOptions<T> {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn<T>[];
  data: T[];
}

/**
 * Exports data to an .xlsx file and triggers browser download
 */
export function exportToExcel<T>({
  filename,
  sheetName = "ข้อมูล",
  columns,
  data,
}: ExportToExcelOptions<T>) {
  if (!data || data.length === 0) {
    throw new Error("ไม่มีข้อมูลสำหรับส่งออก");
  }

  // 1. Build 2D array: [ [Header1, Header2], [Val1, Val2], ... ]
  const headers = columns.map((c) => c.header);
  const rows = data.map((item, index) =>
    columns.map((col) => {
      if (col.transform) {
        const val = col.transform(item, index);
        return val ?? "";
      }
      if (col.key && typeof col.key === "string") {
        const val = (item as any)[col.key];
        return val ?? "";
      }
      return "";
    }),
  );

  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // 2. Set column widths (with sensible defaults for Thai text)
  worksheet["!cols"] = columns.map((col, colIdx) => {
    if (col.width) return { wch: col.width };

    // Auto-calculate width with heuristic for Thai/English characters
    let maxLen = col.header.length * 1.4;
    for (const row of rows) {
      const cellVal = String(row[colIdx] ?? "");
      const len = cellVal.length * 1.15;
      if (len > maxLen) {
        maxLen = Math.min(len, 60); // Cap max column width at 60
      }
    }
    return { wch: Math.max(Math.ceil(maxLen), 12) };
  });

  // 3. Create workbook and trigger download
  const workbook = XLSX.utils.book_new();
  const safeSheetName = (sheetName || "Sheet1").replace(/[:\\/?*\[\]]/g, "_").slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

  const timestamp = new Date().toISOString().slice(0, 10);
  const finalFilename = filename.includes(timestamp)
    ? filename
    : `${filename}_${timestamp}`;
  const completeFilename = finalFilename.endsWith(".xlsx")
    ? finalFilename
    : `${finalFilename}.xlsx`;

  XLSX.writeFile(workbook, completeFilename);
}

