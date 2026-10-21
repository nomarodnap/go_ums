"use client";

import { useState } from "react";
import {
  useListAudits,
  useResolveAudit,
  useRecheckAllAudits,
  getListAuditsQueryKey,
} from "@/lib/api/generated/audits/audits";
import { useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, RefreshCw, CheckCheck, AlertCircle } from "lucide-react";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { toast } from "sonner";
import type { AuditDTO } from "@/lib/api/generated/model";

export default function AuditsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAudit, setSelectedAudit] = useState<AuditDTO | null>(null);
  const [remarks, setRemarks] = useState("");
  const [isResolveOpen, setIsResolveOpen] = useState(false);

  const { data: auditsResponse, isLoading } = useListAudits({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const audits = auditsResponse?.status === 200 && Array.isArray(auditsResponse.data) ? auditsResponse.data : [];

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">รายงานผลการตรวจสอบภายใน (Internal Audits)</h1>
          <p className="text-muted-foreground mt-1">
            ระบบตรวจสอบความผิดปกติและตรวจจับข้อสังเกตอัตโนมัติ 10 กฎเกณฑ์ตามระเบียบกรมประมง
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => recheckMutation.mutate()}
            disabled={recheckMutation.isPending}
            className="rounded-xl border-black/[0.08] dark:border-white/[0.12] text-xs h-9"
          >
            <RefreshCw className={`mr-2 size-3.5 ${recheckMutation.isPending ? "animate-spin" : ""}`} />
            {recheckMutation.isPending ? "กำลังตรวจสอบ..." : "ตรวจสอบซ้ำทั้งหมด"}
          </Button>

          <Select value={statusFilter} onValueChange={(val) => { if (val) setStatusFilter(val); }}>
            <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl">
              <SelectValue placeholder="สถานะการแก้ไข" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="PENDING_CORRECTION">รอการแก้ไข</SelectItem>
              <SelectItem value="CORRECTED">ตรวจสอบ/แก้ไขแล้ว</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingEffect message="กำลังโหลดข้อมูลการตรวจสอบ..." />
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
                <TableHead className="text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.map((a) => {
                const issues: string[] = [];
                if (a.isLateReceive) issues.push("รับบิลล่าช้า > 30 วัน");
                if (a.isLatePayment) issues.push("ชำระล่าช้า > 15 วัน");
                if (a.isOverdueMoreThan2Months) issues.push("ค้างจ่ายเกิน 2 เดือน");
                if (a.isDisbursementOver2Months) issues.push("เบิกจ่ายเกิน 2 เดือน");
                if (a.isWrongMonth) issues.push("งวดบิลไม่ตรงกับใบแจ้งหนี้");
                if (a.isPhoneOverLimit) issues.push("ค่าโทรศัพท์เกินสิทธิ์");
                if (a.isDuplicate) issues.push("บิลซ้ำซ้อน");
                if (a.isAnomalyExpense) issues.push("ยอดค่าใช้จ่ายผิดปกติ (±30%)");
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
                    <TableCell className="text-right">
                      {a.status === "PENDING_CORRECTION" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenResolve(a)}
                          className="h-8 text-xs rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/30"
                        >
                          <CheckCheck className="size-3.5 mr-1" />
                          บันทึกแก้ไข
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {a.remarks || "เรียบร้อย"}
                        </span>
                      )}
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
              รหัสบิล: <span className="font-mono font-medium text-foreground">{selectedAudit?.billCode || "-"}</span> ({selectedAudit?.departmentName})
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
    </div>
  );
}
