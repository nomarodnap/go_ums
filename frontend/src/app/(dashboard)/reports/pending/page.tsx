"use client";

import { useGetPendingReport } from "@/lib/api/generated/reports/reports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { SortableHeader, useTableSort } from "@/components/ui/sortable-header";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { exportToExcel } from "@/lib/excel-export";
import Image from "next/image";
import Link from "next/link";

export default function PendingReportPage() {
  const { data: reportRes, isLoading } = useGetPendingReport();
  const reportData =
    reportRes?.status === 200 && Array.isArray(reportRes.data)
      ? reportRes.data
      : [];

  const { sortKey, sortOrder, handleSort, sortedData } = useTableSort(reportData, {
    comparators: {
      departmentName: (a, b) => (a.departmentName || "").localeCompare(b.departmentName || "", "th"),
      utilityType: (a, b) => (a.utilityType || "").localeCompare(b.utilityType || "", "th"),
      billCount: (a, b) => (a.billCount || 0) - (b.billCount || 0),
      totalAmount: (a, b) => (Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0),
    },
  });

  const handleExportExcel = () => {
    exportToExcel({
      filename: `รายงานยอดค้างชำระ_ประมาณการ`,
      sheetName: "ยอดค้างชำระ",
      data: sortedData,
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1, width: 8 },
        { header: "หน่วยงาน", transform: (r) => r.departmentName || "-", width: 35 },
        { header: "ประเภทสาธารณูปโภค", key: "utilityType", width: 22 },
        {
          header: "จำนวนบิลที่ค้าง (รายการ)",
          transform: (r) => Number(r.billCount || 0),
          width: 22,
        },
        {
          header: "ยอดประมาณการรวม (บาท)",
          transform: (r) => Number(r.totalAmount || 0),
          width: 24,
        },
      ],
    });
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (isLoading) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังรวบรวมข้อมูลยอดค้างชำระ (ประมาณการ)..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 p-0.5 shadow-xs border border-black/[0.08] dark:border-white/[0.1] overflow-hidden">
            <Image
              src="/logo.png"
              alt="ตราสัญลักษณ์กรมประมง"
              width={48}
              height={48}
              className="size-full object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/reports"
                className="text-xs text-muted-foreground hover:text-foreground print:hidden flex items-center gap-1"
              >
                <ArrowLeft className="size-3" /> ย้อนกลับ
              </Link>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              รายงานยอดค้างชำระ (ประมาณการ)
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              สรุปยอดที่กันเงินไว้สำหรับบิลที่ยังไม่มาถึง แยกตามหน่วยงาน
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <ExportExcelButton
            onExport={handleExportExcel}
            disabled={sortedData.length === 0}
          />
          <Button
            variant="outline"
            onClick={handlePrint}
            className="rounded-xl border-black/[0.08] dark:border-white/[0.12] text-xs h-9"
          >
            <Printer className="mr-2 size-4" /> พิมพ์รายงาน
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden print:border-none print:shadow-none print:bg-transparent">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <SortableHeader
                sortKey="departmentName"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                หน่วยงาน
              </SortableHeader>
              <SortableHeader
                sortKey="utilityType"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                ประเภทสาธารณูปโภค
              </SortableHeader>
              <SortableHeader
                align="right"
                sortKey="billCount"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                จำนวนรายการ
              </SortableHeader>
              <SortableHeader
                align="right"
                sortKey="totalAmount"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                ยอดค้างชำระ (ประมาณการ)
              </SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center h-32 text-muted-foreground text-sm"
                >
                  ไม่มีรายการค้างชำระ
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-medium text-sm">
                    {row.departmentName}
                  </TableCell>
                  <TableCell className="text-sm">{row.utilityType}</TableCell>
                  <TableCell className="text-right text-sm">
                    {row.billCount}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm text-amber-600 dark:text-amber-400">
                    {row.totalAmount !== undefined && row.totalAmount !== null
                      ? Number(row.totalAmount).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "0.00"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
