"use client";

import { useState } from "react";
import { useListAudits } from "@/lib/api/generated/audits/audits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function AuditsPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: auditsResponse, isLoading } = useListAudits({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const audits = auditsResponse?.status === 200 && Array.isArray(auditsResponse.data) ? auditsResponse.data : [];

  const formatCurrency = (val: number | null | undefined) => {
    if (!val) return "฿0.00";
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
    }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">รายงานผลการตรวจสอบภายใน (Internal Audits)</h1>
          <p className="text-muted-foreground mt-1">
            ระบบตรวจสอบความผิดปกติและตรวจจับข้อสังเกตอัตโนมัติ 10 กฎเกณฑ์ตามระเบียบกรมประมง
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(val) => { if (val) setStatusFilter(val); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="สถานะการแก้ไข" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="PENDING_CORRECTION">รอการแก้ไข</SelectItem>
            <SelectItem value="CORRECTED">ตรวจสอบ/แก้ไขแล้ว</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">กำลังโหลดข้อมูลการตรวจสอบ...</span>
          </div>
        ) : audits.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
            <h3 className="text-lg font-semibold">ไม่พบรายการที่ติดข้อสังเกต</h3>
            <p className="text-sm text-muted-foreground mt-1">
              การเบิกจ่ายค่าสาธารณูปโภคทั้งหมดเป็นไปตามระเบียบที่กำหนด
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>รหัสบิล</TableHead>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead className="text-right">ยอดเงิน</TableHead>
                <TableHead>ข้อสังเกตที่พบ</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.map((a) => {
                const issues: string[] = [];
                if (a.isLateReceive) issues.push("รับบิลล่าช้า > 30 วัน");
                if (a.isLatePayment) issues.push("ชำระล่าช้า > 30 วัน");
                if (a.isOverdueMoreThan2Months) issues.push("ค้างจ่ายเกิน 2 เดือน");
                if (a.isDisbursementOver2Months) issues.push("เบิกจ่ายเกิน 2 เดือน");
                if (a.isWrongMonth) issues.push("งวดบิลไม่ตรงกับใบแจ้งหนี้");
                if (a.isPhoneOverLimit) issues.push("ค่าโทรศัพท์เกินสิทธิ์");
                if (a.isDuplicate) issues.push("บิลซ้ำซ้อน");
                if (a.isAnomalyExpense) issues.push("ยอดค่าใช้จ่ายผิดปกติ (±20%)");
                if (a.isManualAnomaly) issues.push(`ผู้ตรวจสอบระบุ: ${a.manualAnomalyReason || ""}`);

                return (
                  <TableRow key={a.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono font-medium text-xs">
                      {a.billCode || "-"}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{a.departmentName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{a.utilityType}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatCurrency(a.invoiceAmount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {issues.length > 0 ? (
                          issues.map((iss, i) => (
                            <Badge key={i} variant="destructive" className="text-[11px] font-normal">
                              {iss}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">ไม่มีข้อสังเกต</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={a.status === "CORRECTED" ? "outline" : "destructive"}
                        className="text-xs"
                      >
                        {a.status === "CORRECTED" ? "แก้ไขแล้ว" : "รอแก้ไข"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
