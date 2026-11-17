"use client";

import { useState } from "react";
import { useListBudgets } from "@/lib/api/generated/budgets/budgets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2, Banknote } from "lucide-react";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { SortableHeader, useTableSort } from "@/components/ui/sortable-header";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { exportToExcel } from "@/lib/excel-export";

export default function BudgetsPage() {
  const [selectedYear, setSelectedYear] = useState(2024);

  const { data: budgetsResponse, isLoading } = useListBudgets({
    fiscalYear: selectedYear,
  });
  const budgets = budgetsResponse?.status === 200 && Array.isArray(budgetsResponse.data) ? budgetsResponse.data : [];

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "฿0.00";
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
    }).format(val);
  };

  const totalAllocated = budgets.reduce((acc, b) => acc + (b.allocatedAmount || 0), 0);
  const totalTransferred = budgets.reduce((acc, b) => acc + (b.transferredAmount || 0), 0);

  const { sortKey, sortOrder, handleSort, sortedData } = useTableSort(budgets, {
    comparators: {
      budgetCode: (a, b) => (a.budgetCode || "").localeCompare(b.budgetCode || "", "th", { numeric: true }),
      name: (a, b) => (a.name || "").localeCompare(b.name || "", "th"),
      departmentName: (a, b) => (a.departmentName || "").localeCompare(b.departmentName || "", "th"),
      allocatedAmount: (a, b) => (a.allocatedAmount || 0) - (b.allocatedAmount || 0),
      transferredAmount: (a, b) => (a.transferredAmount || 0) - (b.transferredAmount || 0),
      netAmount: (a, b) =>
        ((a.allocatedAmount || 0) + (a.transferredAmount || 0)) -
        ((b.allocatedAmount || 0) + (b.transferredAmount || 0)),
    },
  });

  const handleExportExcel = () => {
    exportToExcel({
      filename: `การจัดสรรงบประมาณ_${selectedYear + 543}`,
      sheetName: `งบประมาณ ${selectedYear + 543}`,
      data: sortedData,
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1, width: 8 },
        { header: "รหัสงบประมาณ", key: "budgetCode", width: 20 },
        { header: "รายการงบประมาณ", key: "name", width: 35 },
        { header: "หน่วยงาน", transform: (b) => b.departmentName || "-", width: 30 },
        { header: "ปีงบประมาณ", transform: (b) => (b.fiscalYear ? b.fiscalYear + 543 : selectedYear + 543), width: 15 },
        {
          header: "งบประมาณจัดสรร (บาท)",
          transform: (b) => Number(b.allocatedAmount || 0),
          width: 24,
        },
        {
          header: "โอนเปลี่ยนแปลง/ถัวจ่าย (บาท)",
          transform: (b) => Number(b.transferredAmount || 0),
          width: 24,
        },
        {
          header: "งบประมาณสุทธิ (บาท)",
          transform: (b) => Number(b.allocatedAmount || 0) + Number(b.transferredAmount || 0),
          width: 24,
        },
      ],
    });
  };

  if (isLoading) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดข้อมูลการจัดสรรงบประมาณ..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">การจัดสรรงบประมาณค่าสาธารณูปโภค</h1>
          <p className="text-muted-foreground mt-1">
            ข้อมูลการจัดสรรงบประมาณ การโอนเปลี่ยนแปลงงบประมาณ และยอดคงเหลือรายหน่วยงาน
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <ExportExcelButton
            onExport={handleExportExcel}
            disabled={sortedData.length === 0}
          />
          <Select
            value={selectedYear.toString()}
            onValueChange={(val) => {
              if (val) setSelectedYear(parseInt(val, 10));
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue>{`พ.ศ. ${selectedYear + 543}`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2023">พ.ศ. 2566</SelectItem>
              <SelectItem value="2024">พ.ศ. 2567</SelectItem>
              <SelectItem value="2025">พ.ศ. 2568</SelectItem>
              <SelectItem value="2026">พ.ศ. 2569</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              งบประมาณที่ได้รับจัดสรรรวม
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalAllocated)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ปีงบประมาณ พ.ศ. {selectedYear + 543}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              งบประมาณโอนเปลี่ยนแปลงรวม
            </CardTitle>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalTransferred)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ยอดโอนเปลี่ยนแปลง/ถัวจ่าย
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <SortableHeader
                sortKey="budgetCode"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                รหัสงบประมาณ
              </SortableHeader>
              <SortableHeader
                sortKey="name"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                รายการงบประมาณ
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
                งบจัดสรร (บาท)
              </SortableHeader>
              <SortableHeader
                align="right"
                sortKey="transferredAmount"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                งบโอนเปลี่ยนแปลง (บาท)
              </SortableHeader>
              <SortableHeader
                align="right"
                sortKey="netAmount"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                งบรวมสุทธิ (บาท)
              </SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((b) => (
              <TableRow key={b.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-mono font-medium text-xs">{b.budgetCode}</TableCell>
                <TableCell className="font-medium text-sm">{b.name}</TableCell>
                <TableCell className="text-sm">{b.departmentName || "-"}</TableCell>
                <TableCell className="text-right font-semibold text-sm">
                  {formatCurrency(b.allocatedAmount)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatCurrency(b.transferredAmount)}
                </TableCell>
                <TableCell className="text-right font-semibold text-sm text-primary">
                  {formatCurrency((b.allocatedAmount || 0) + (b.transferredAmount || 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
