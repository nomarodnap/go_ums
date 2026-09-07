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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">การจัดสรรงบประมาณค่าสาธารณูปโภค</h1>
          <p className="text-muted-foreground mt-1">
            ข้อมูลการจัดสรรงบประมาณ การโอนเปลี่ยนแปลงงบประมาณ และยอดคงเหลือรายหน่วยงาน
          </p>
        </div>
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
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">กำลังโหลดข้อมูลการจัดสรรงบประมาณ...</span>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>รหัสงบประมาณ</TableHead>
                <TableHead>รายการงบประมาณ</TableHead>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead className="text-right">งบจัดสรร (บาท)</TableHead>
                <TableHead className="text-right">งบโอนเปลี่ยนแปลง (บาท)</TableHead>
                <TableHead className="text-right">งบรวมสุทธิ (บาท)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((b) => (
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
        )}
      </div>
    </div>
  );
}
