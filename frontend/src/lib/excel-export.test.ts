import { describe, it, expect, vi } from "vitest";
import { exportToExcel } from "./excel-export";
import * as XLSX from "xlsx";

vi.mock("xlsx", () => {
  const aoa_to_sheet = vi.fn().mockReturnValue({});
  const book_new = vi.fn().mockReturnValue({});
  const book_append_sheet = vi.fn();
  const writeFile = vi.fn();

  return {
    utils: {
      aoa_to_sheet,
      book_new,
      book_append_sheet,
    },
    writeFile,
  };
});

describe("exportToExcel Utility", () => {
  it("throws error if data array is empty", () => {
    expect(() =>
      exportToExcel({
        filename: "test",
        columns: [{ header: "Name", key: "name" }],
        data: [],
      }),
    ).toThrow("ไม่มีข้อมูลสำหรับส่งออก");
  });

  it("exports data with proper headers and values", () => {
    const mockData = [
      { id: "1", name: "หน่วยงาน A", amount: 1500 },
      { id: "2", name: "หน่วยงาน B", amount: 2500 },
    ];

    exportToExcel({
      filename: "test_report",
      sheetName: "รายงาน",
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1 },
        { header: "ชื่อหน่วยงาน", key: "name" },
        { header: "ยอดเงิน", transform: (row) => `${row.amount} บาท` },
      ],
      data: mockData,
    });

    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledWith([
      ["ลำดับ", "ชื่อหน่วยงาน", "ยอดเงิน"],
      [1, "หน่วยงาน A", "1500 บาท"],
      [2, "หน่วยงาน B", "2500 บาท"],
    ]);

    expect(XLSX.utils.book_new).toHaveBeenCalled();
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalled();
    expect(XLSX.writeFile).toHaveBeenCalled();
  });
});

