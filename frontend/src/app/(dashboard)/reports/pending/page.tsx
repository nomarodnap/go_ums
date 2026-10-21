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
import Image from "next/image";
import Link from "next/link";

export default function PendingReportPage() {
  const { data: reportRes, isLoading } = useGetPendingReport();
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
              รายงานยอดค้างชำระ (ประมาณการ)
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              สรุปยอดที่กันเงินไว้สำหรับบิลที่ยังไม่มาถึง แยกตามหน่วยงาน
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
          <LoadingEffect message="กำลังรวบรวมข้อมูลยอดค้างชำระ..." />
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead>ประเภทสาธารณูปโภค</TableHead>
                <TableHead className="text-right">จำนวนรายการ</TableHead>
                <TableHead className="text-right">ยอดค้างชำระ (ประมาณการ)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center h-32 text-muted-foreground text-sm"
                  >
                    ไม่มีรายการค้างชำระ
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map((row, idx) => (
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
        )}
      </div>
    </div>
  );
}
