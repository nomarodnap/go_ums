"use client";

import { useGetBudgetReport } from "@/lib/api/generated/reports/reports";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { ForecastPanel } from "@/components/ai/forecast-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, AlertTriangle, ArrowLeft } from "lucide-react";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { SortableHeader, useTableSort } from "@/components/ui/sortable-header";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { exportToExcel } from "@/lib/excel-export";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function BudgetReportPage() {
  const { data: userData } = useGetCurrentUser();
  const user = userData?.status === 200 ? userData.data.user : null;
  const isAdmin = ["admin", "auditor", "strategy_finance", "central_staff"].includes(
    user?.role || "",
  );
  const { data: reportRes, isLoading } = useGetBudgetReport();
  const reportData =
    reportRes?.status === 200 && Array.isArray(reportRes.data)
      ? reportRes.data
      : [];

  const { sortKey, sortOrder, handleSort, sortedData } = useTableSort(reportData, {
    comparators: {
      fiscalYear: (a, b) => (a.fiscalYear || 0) - (b.fiscalYear || 0),
      departmentName: (a, b) => (a.departmentName || "").localeCompare(b.departmentName || "", "th"),
      allocatedAmount: (a, b) => Number(a.allocatedAmount || 0) - Number(b.allocatedAmount || 0),
      usedAmount: (a, b) => Number(a.usedAmount || 0) - Number(b.usedAmount || 0),
      remainingAmount: (a, b) => {
        const remA = Number(a.remainingAmount !== undefined ? a.remainingAmount : (Number(a.allocatedAmount || 0) - Number(a.usedAmount || 0)));
        const remB = Number(b.remainingAmount !== undefined ? b.remainingAmount : (Number(b.allocatedAmount || 0) - Number(b.usedAmount || 0)));
        return remA - remB;
      },
      status: (a, b) => {
        const remA = Number(a.remainingAmount !== undefined ? a.remainingAmount : (Number(a.allocatedAmount || 0) - Number(a.usedAmount || 0)));
        const remB = Number(b.remainingAmount !== undefined ? b.remainingAmount : (Number(b.allocatedAmount || 0) - Number(b.usedAmount || 0)));
        return remA - remB;
      },
    },
  });

  const handleExportExcel = () => {
    exportToExcel({
      filename: `รายงานการบริหารงบประมาณ`,
      sheetName: "บริหารงบประมาณ",
      data: sortedData,
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1, width: 8 },
        { header: "ปีงบประมาณ", transform: (r) => (r.fiscalYear ? r.fiscalYear + 543 : "-"), width: 15 },
        { header: "หน่วยงาน", transform: (r) => r.departmentName || "-", width: 35 },
        {
          header: "งบประมาณจัดสรร (บาท)",
          transform: (r) => Number(r.allocatedAmount || 0),
          width: 24,
        },
        {
          header: "งบประมาณใช้ไป (บาท)",
          transform: (r) => Number(r.usedAmount || 0),
          width: 24,
        },
        {
          header: "งบประมาณคงเหลือ (บาท)",
          transform: (r) =>
            Number(
              r.remainingAmount !== undefined
                ? r.remainingAmount
                : Number(r.allocatedAmount || 0) - Number(r.usedAmount || 0),
            ),
          width: 24,
        },
        {
          header: "สถานะ",
          transform: (r) => {
            const rem = Number(
              r.remainingAmount !== undefined
                ? r.remainingAmount
                : Number(r.allocatedAmount || 0) - Number(r.usedAmount || 0),
            );
            return rem < 0 ? "เกินงบประมาณ" : "ปกติ";
          },
          width: 18,
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
        message="กำลังรวบรวมข้อมูลรายงานการบริหารงบประมาณ..."
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
              รายงานการบริหารงบประมาณ
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              เปรียบเทียบงบประมาณจัดสรร งบใช้ไป และงบคงเหลือรายหน่วยงาน
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

      <div className="print:hidden">
        <ForecastPanel
          scope={isAdmin ? "all" : "department"}
          departmentId={!isAdmin ? user?.departmentId || undefined : undefined}
          defaultTab="budget"
          enabled={Boolean(user)}
          billsHref={isAdmin ? "/all-bills" : "/bills"}
        />
      </div>

      <div className="rounded-2xl border bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden print:border-none print:shadow-none print:bg-transparent">
        <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <SortableHeader
                  sortKey="fiscalYear"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  ปีงบประมาณ
                </SortableHeader>
                <SortableHeader
                  sortKey="departmentName"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  หน่วยงาน
                </SortableHeader>
                <SortableHeader
                  align="right"
                  sortKey="allocatedAmount"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  งบประมาณจัดสรร
                </SortableHeader>
                <SortableHeader
                  align="right"
                  sortKey="usedAmount"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  เบิกจ่ายไปแล้ว
                </SortableHeader>
                <SortableHeader
                  align="right"
                  sortKey="remainingAmount"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  คงเหลือ
                </SortableHeader>
                <SortableHeader
                  align="center"
                  sortKey="status"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  สถานะ
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center h-32 text-muted-foreground text-sm"
                  >
                    ไม่มีข้อมูลการตั้งงบประมาณ
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row, idx) => {
                  const allocated = Number(row.allocatedAmount || 0);
                  const used = Number(row.usedAmount || 0);
                  const remaining = Number(row.remainingAmount !== undefined ? row.remainingAmount : (allocated - used));
                  const isWarning = row.isWarning || remaining < allocated * 0.2;
                  const isOverBudget = remaining < 0;

                  return (
                    <TableRow
                      key={idx}
                      className={cn(
                        "hover:bg-muted/40 transition-colors",
                        isOverBudget
                          ? "bg-red-50/50 dark:bg-red-950/20"
                          : isWarning
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : ""
                      )}
                    >
                      <TableCell className="text-sm font-medium">{row.fiscalYear}</TableCell>
                      <TableCell className="font-medium text-sm">
                        {row.departmentName}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {allocated.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {used.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold text-sm",
                          isOverBudget
                            ? "text-red-600 dark:text-red-400"
                            : isWarning
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {remaining.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        {isOverBudget ? (
                          <span className="inline-flex items-center text-[11px] font-semibold text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="size-3 mr-1" /> เกินงบประมาณ
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/50 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="size-3 mr-1" /> งบใกล้หมด
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50 px-2.5 py-1 rounded-full">
                            ปกติ
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
      </div>
    </div>
  );
}
