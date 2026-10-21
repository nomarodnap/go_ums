"use client";

import { useGetBudgetReport } from "@/lib/api/generated/reports/reports";
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
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function BudgetReportPage() {
  const { data: reportRes, isLoading } = useGetBudgetReport();
  const reportData =
    reportRes?.status === 200 && Array.isArray(reportRes.data)
      ? reportRes.data
      : [];

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 p-1.5 shadow-xs border border-black/[0.06] dark:border-white/[0.08]">
            <Image
              src="/logo.png"
              alt="ตราสัญลักษณ์กรมประมง"
              width={48}
              height={48}
              style={{ width: "auto", height: "auto" }}
              className="size-9 object-contain"
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
        {isLoading ? (
          <LoadingEffect message="กำลังรวบรวมข้อมูลงบประมาณ..." />
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>ปีงบประมาณ</TableHead>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead className="text-right">งบประมาณจัดสรร</TableHead>
                <TableHead className="text-right">เบิกจ่ายไปแล้ว</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center h-32 text-muted-foreground text-sm"
                  >
                    ไม่มีข้อมูลการตั้งงบประมาณ
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map((row, idx) => {
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
        )}
      </div>
    </div>
  );
}
