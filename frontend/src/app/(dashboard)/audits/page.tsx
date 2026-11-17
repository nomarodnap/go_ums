"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  Flag,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnomalyExplainDialog } from "@/components/ai/anomaly-explain-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { Label } from "@/components/ui/label";
import { LoadingEffect } from "@/components/ui/loading-effect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableHeader, useTableSort } from "@/components/ui/sortable-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getListAuditsQueryKey,
  useListAudits,
  useRecheckAllAudits,
  useResolveAudit,
} from "@/lib/api/generated/audits/audits";
import type { AuditDTO } from "@/lib/api/generated/model";
import { exportToExcel } from "@/lib/excel-export";

export default function AuditsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAudit, setSelectedAudit] = useState<AuditDTO | null>(null);
  const [remarks, setRemarks] = useState("");
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [explainAudit, setExplainAudit] = useState<AuditDTO | null>(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);

  const { data: auditsResponse, isLoading } = useListAudits({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const audits =
    auditsResponse?.status === 200 && Array.isArray(auditsResponse.data) ? auditsResponse.data : [];

  const getIssueCount = (a: AuditDTO) => {
    let count = 0;
    if (a.isLateReceive) count++;
    if (a.isLatePayment) count++;
    if (a.isOverdueMoreThan2Months) count++;
    if (a.isDisbursementOver2Months) count++;
    if (a.isWrongMonth) count++;
    if (a.isPhoneOverLimit) count++;
    if (a.isDuplicate) count++;
    if (a.isAnomalyExpense) count++;
    if (a.isManualAnomaly) count++;
    return count;
  };

  const { sortKey, sortOrder, handleSort, sortedData } = useTableSort(audits, {
    comparators: {
      billCode: (a, b) =>
        (a.billCode || "").localeCompare(b.billCode || "", "th", { numeric: true }),
      departmentName: (a, b) =>
        (a.departmentName || "").localeCompare(b.departmentName || "", "th"),
      utilityType: (a, b) => (a.utilityType || "").localeCompare(b.utilityType || "", "th"),
      amount: (a, b) => (a.invoiceAmount || 0) - (b.invoiceAmount || 0),
      issues: (a, b) => getIssueCount(a) - getIssueCount(b),
      status: (a, b) => (a.status || "").localeCompare(b.status || "", "th"),
    },
  });

  const getIssueList = (a: AuditDTO): string[] => {
    const list: string[] = [];
    if (a.isLateReceive) list.push("ลงรับใบแจ้งหนี้ล่าช้า");
    if (a.isLatePayment) list.push("เบิกจ่ายล่าช้า");
    if (a.isOverdueMoreThan2Months) list.push("ค้างชำระเกิน 2 เดือน");
    if (a.isDisbursementOver2Months) list.push("เบิกจ่ายเกิน 2 เดือน");
    if (a.isWrongMonth) list.push("เบิกจ่ายผิดเดือน");
    if (a.isPhoneOverLimit) list.push("เบิกค่าโทรศัพท์เกินเกณฑ์");
    if (a.isDuplicate) list.push("เบิกจ่ายซ้ำซ้อน");
    if (a.isAnomalyExpense) list.push("ค่าใช้จ่ายสูงผิดปกติ");
    if (a.isManualAnomaly) {
      list.push(`ระบุข้อผิดปกติ: ${a.manualAnomalyReason || "ระบุด้วยตนเอง"}`);
    }
    return list;
  };

  const handleExportExcel = () => {
    exportToExcel({
      filename: `รายงานผลการตรวจสอบภายใน_${statusFilter}`,
      sheetName: "การตรวจสอบ",
      data: sortedData,
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1, width: 8 },
        { header: "รหัสรายงาน", key: "billCode", width: 18 },
        { header: "หน่วยงาน", key: "departmentName", width: 28 },
        { header: "ประเภทสาธารณูปโภค", key: "utilityType", width: 20 },
        {
          header: "รอบบิล",
          transform: (a) =>
            a.billingMonth && a.billingYear ? `${a.billingMonth}/${a.billingYear + 543}` : "-",
          width: 14,
        },
        {
          header: "ยอดเงิน (บาท)",
          transform: (a) => (a.invoiceAmount ? Number(a.invoiceAmount) : 0),
          width: 18,
        },
        {
          header: "สถานะการตรวจสอบ",
          transform: (a) =>
            a.status === "CORRECTED"
              ? "ตรวจสอบ/แก้ไขแล้ว"
              : a.status === "PENDING_RECHECK"
                ? "รอตรวจสอบใหม่"
                : "รอการแก้ไข",
          width: 22,
        },
        {
          header: "จำนวนข้อสังเกต",
          transform: (a) => getIssueCount(a),
          width: 16,
        },
        {
          header: "รายการข้อสังเกตความผิดปกติ",
          transform: (a) => {
            const list = getIssueList(a);
            return list.length > 0 ? list.join(", ") : "ไม่พบข้อสังเกต";
          },
          width: 45,
        },
        { header: "หมายเหตุการแก้ไข", transform: (a) => a.remarks || "-", width: 28 },
        {
          header: "ตรวจจับเมื่อ",
          transform: (a) => (a.createdAt ? a.createdAt.slice(0, 10) : "-"),
          width: 16,
        },
      ],
    });
  };

  const resolveMutation = useResolveAudit({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
        toast.success("บันทึกการแก้ไขเรียบร้อยแล้ว");
        setIsResolveOpen(false);
        setRemarks("");
        setSelectedAudit(null);
      },
      onError: (err: any) => {
        toast.error(err?.message || "ไม่สามารถบันทึกการแก้ไขได้");
      },
    },
  });

  const recheckMutation = useRecheckAllAudits({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
        const count = res?.status === 200 ? res.data?.count : 0;
        toast.success(`ตรวจสอบข้อมูลเสร็จสิ้น (${count} รายการ)`);
      },
      onError: (err: any) => {
        toast.error(err?.message || "เกิดข้อผิดพลาดในการตรวจสอบ");
      },
    },
  });

  const formatCurrency = (val: number | null | undefined) => {
    if (!val) return "฿0.00";
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
    }).format(val);
  };

  const handleOpenResolve = (audit: AuditDTO) => {
    setSelectedAudit(audit);
    setRemarks(audit.remarks || "");
    setIsResolveOpen(true);
  };

  const handleConfirmResolve = () => {
    if (!selectedAudit) return;
    resolveMutation.mutate({
      auditId: selectedAudit.id,
      data: {
        remarks: remarks || "ดำเนินการแก้ไขเรียบร้อย",
      },
    });
  };

  if (isLoading) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดข้อมูลการตรวจสอบภายใน..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            รายงานผลการตรวจสอบภายใน (Internal Audits)
          </h1>
          <p className="text-muted-foreground mt-1">
            ระบบตรวจสอบความผิดปกติและตรวจจับข้อสังเกตอัตโนมัติ 10 กฎเกณฑ์ตามระเบียบกรมประมง
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <ExportExcelButton onExport={handleExportExcel} disabled={sortedData.length === 0} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => recheckMutation.mutate()}
            disabled={recheckMutation.isPending}
            className="rounded-xl border-black/[0.08] dark:border-white/[0.12] text-xs h-9"
          >
            <RefreshCw
              className={`mr-2 size-3.5 ${recheckMutation.isPending ? "animate-spin" : ""}`}
            />
            {recheckMutation.isPending ? "กำลังตรวจสอบ..." : "ตรวจสอบซ้ำทั้งหมด"}
          </Button>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              if (val) setStatusFilter(val);
            }}
          >
            <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl">
              <SelectValue placeholder="สถานะการแก้ไข" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="PENDING_CORRECTION">รอการแก้ไข</SelectItem>
              <SelectItem value="PENDING_RECHECK">รอตรวจสอบใหม่</SelectItem>
              <SelectItem value="CORRECTED">ตรวจสอบ/แก้ไขแล้ว</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
        {audits.length === 0 ? (
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
                <SortableHeader
                  sortKey="billCode"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  รหัสบิล
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
                  sortKey="utilityType"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  ประเภท
                </SortableHeader>
                <SortableHeader
                  align="right"
                  sortKey="amount"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  ยอดเงิน
                </SortableHeader>
                <SortableHeader
                  sortKey="issues"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  ข้อสังเกตที่พบ
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
                <TableHead className="text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((a) => {
                const issues: string[] = [];
                if (a.isLateReceive) issues.push("รับบิลล่าช้า > 30 วัน");
                if (a.isLatePayment) issues.push("ชำระล่าช้า > 15 วัน");
                if (a.isOverdueMoreThan2Months) issues.push("ค้างจ่ายเกิน 2 เดือน");
                if (a.isDisbursementOver2Months) issues.push("เบิกจ่ายเกิน 2 เดือน");
                if (a.isWrongMonth) issues.push("งวดบิลไม่ตรงกับใบแจ้งหนี้");
                if (a.isPhoneOverLimit) issues.push("ค่าโทรศัพท์เกินสิทธิ์");
                if (a.isDuplicate) issues.push("บิลซ้ำซ้อน");
                if (a.isAnomalyExpense) issues.push("ยอดค่าใช้จ่ายผิดปกติ (Z-score / IQR)");
                if (a.isManualAnomaly) issues.push(`ผู้ตรวจสอบระบุ: ${a.manualAnomalyReason || ""}`);

                return (
                  <TableRow key={a.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono font-medium text-xs">
                      {a.billCode || "-"}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{a.departmentName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {a.utilityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatCurrency(a.invoiceAmount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {issues.length > 0 ? (
                          issues.map((iss, i) => {
                            if (iss.startsWith("ผู้ตรวจสอบระบุ:") && a.manualAnomalyDetail) {
                              return (
                                <TooltipProvider key={i}>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Badge
                                          variant="destructive"
                                          className="text-[11px] font-normal cursor-help"
                                        />
                                      }
                                    >
                                      {iss}
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-xs p-3 text-left">
                                      <p className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                        <Flag className="size-3.5 shrink-0" />
                                        {iss}
                                      </p>
                                      <p className="text-foreground whitespace-pre-line mt-1.5 leading-relaxed text-xs">
                                        {a.manualAnomalyDetail}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return (
                              <Badge
                                key={i}
                                variant="destructive"
                                className="text-[11px] font-normal"
                              >
                                {iss}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">ไม่มีข้อสังเกต</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {a.status === "PENDING_RECHECK" ? (
                        <Badge className="text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium">
                          รอตรวจสอบใหม่
                        </Badge>
                      ) : (
                        <Badge
                          variant={a.status === "CORRECTED" ? "outline" : "destructive"}
                          className="text-xs"
                        >
                          {a.status === "CORRECTED" ? "แก้ไขแล้ว" : "รอแก้ไข"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setExplainAudit(a);
                            setIsExplainOpen(true);
                          }}
                          aria-label={`AI วิเคราะห์สาเหตุ ${a.billCode || a.utilityType || a.id}`}
                          className="h-8 px-2.5 text-xs rounded-lg text-primary hover:text-primary hover:bg-primary/10 gap-1 cursor-pointer"
                        >
                          <Sparkles className="size-3.5" aria-hidden="true" />
                          <span>AI วิเคราะห์</span>
                        </Button>
                        {a.status === "PENDING_CORRECTION" || a.status === "PENDING_RECHECK" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenResolve(a)}
                            className="h-8 text-xs rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/30"
                          >
                            <CheckCheck className="size-3.5 mr-1" aria-hidden="true" />
                            บันทึกแก้ไข
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {a.remarks || "เรียบร้อย"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Resolve Dialog */}
      <Dialog open={isResolveOpen} onOpenChange={setIsResolveOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <span>บันทึกการแก้ไขข้อสังเกต</span>
            </DialogTitle>
            <DialogDescription>
              รหัสบิล:{" "}
              <span className="font-mono font-medium text-foreground">
                {selectedAudit?.billCode || "-"}
              </span>{" "}
              ({selectedAudit?.departmentName})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="remarks" className="text-xs font-semibold">
                บันทึกการดำเนินการแก้ไข / หมายเหตุ
              </Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="ระบุการดำเนินการแก้ไขที่ได้ทำไป เช่น เอกสารครบถ้วนแล้ว หรือคืนเงินเรียบร้อย..."
                className="rounded-xl min-h-[90px] text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsResolveOpen(false)}
              className="rounded-xl text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirmResolve}
              disabled={resolveMutation.isPending}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {resolveMutation.isPending ? "กำลังบันทึก..." : "ยืนยันการแก้ไข (Mark as Corrected)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnomalyExplainDialog
        billId={explainAudit?.utilityBillId ?? null}
        billCode={explainAudit?.billCode}
        departmentName={explainAudit?.departmentName}
        open={isExplainOpen}
        onOpenChange={setIsExplainOpen}
      />
    </div>
  );
}
