"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Archive,
  RotateCcw,
  Trash2,
  History,
  Search,
  AlertTriangle,
  RefreshCw,
  Clock,
  User as UserIcon,
  FileText,
  Eye,
  Building2,
  Receipt,
  Banknote,
  ExternalLink,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  restoreArchivedBill,
  permanentlyDeleteArchivedBill,
  type ArchivedBillItem,
  type BillDeletionLogItem,
} from "@/server/actions/bills";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const THAI_MONTHS = [
  "",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

interface ArchivedBillsClientProps {
  archivedBills: ArchivedBillItem[];
  deletionLogs: BillDeletionLogItem[];
  canManage: boolean;
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
}

export function ArchivedBillsClient({
  archivedBills,
  deletionLogs,
  canManage,
  onRefresh,
  isRefreshing = false,
}: ArchivedBillsClientProps) {
  const [activeTab, setActiveTab] = useState<"archived" | "logs">("archived");
  const [searchTerm, setSearchTerm] = useState("");
  const [logActionFilter, setLogActionFilter] = useState<string>("ALL");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [billToView, setBillToView] = useState<ArchivedBillItem | null>(null);
  const [billToPurge, setBillToPurge] = useState<ArchivedBillItem | null>(null);
  const [purgeReason, setPurgeReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredArchived = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return archivedBills;
    return archivedBills.filter(
      (b) =>
        b.billCode.toLowerCase().includes(q) ||
        (b.serviceNumber || "").toLowerCase().includes(q) ||
        (b.departmentName || "").toLowerCase().includes(q) ||
        (b.utilityType || "").toLowerCase().includes(q) ||
        (b.archivedByName || "").toLowerCase().includes(q) ||
        (b.archiveReason || "").toLowerCase().includes(q),
    );
  }, [archivedBills, searchTerm]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return deletionLogs.filter((l) => {
      const matchAction =
        logActionFilter === "ALL" || l.action === logActionFilter;
      const matchSearch =
        !q ||
        l.billCode.toLowerCase().includes(q) ||
        (l.serviceNumber || "").toLowerCase().includes(q) ||
        (l.departmentName || "").toLowerCase().includes(q) ||
        (l.performedByName || "").toLowerCase().includes(q) ||
        (l.reason || "").toLowerCase().includes(q);
      return matchAction && matchSearch;
    });
  }, [deletionLogs, logActionFilter, searchTerm]);

  const handleRestore = (bill: ArchivedBillItem) => {
    setRestoreError(null);
    startTransition(async () => {
      const res = await restoreArchivedBill(bill.id);
      if (res.success) {
        toast.success(`กู้คืนรายการบิล ${bill.billCode} กลับเข้าสู่ระบบเรียบร้อยแล้ว`);
        await onRefresh();
      } else {
        const msg =
          res.error || "ไม่สามารถกู้คืนได้ เนื่องจากมีบิลซ้ำซ้อนในระบบปัจจุบัน";
        setRestoreError(msg);
        toast.error(msg);
      }
    });
  };

  const handleConfirmPurge = () => {
    if (!billToPurge) return;
    const target = billToPurge;
    startTransition(async () => {
      const res = await permanentlyDeleteArchivedBill(target.id, purgeReason);
      if (res.success) {
        toast.success(`ลบรายการบิล ${target.billCode} ถาวรเรียบร้อยแล้ว (บันทึก Log แล้ว)`);
        setBillToPurge(null);
        setPurgeReason("");
        await onRefresh();
      } else {
        toast.error(res.error || "ไม่สามารถลบรายการถาวรได้");
      }
    });
  };

  const formatPeriod = (month?: number, year?: number) => {
    if (!month || !year) return "-";
    const beYear = year < 2400 ? year + 543 : year;
    return `${THAI_MONTHS[month] || month} ${beYear}`;
  };

  const formatDateValue = (raw: unknown) => {
    if (typeof raw !== "string" || !raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
    return format(d, "dd/MM/yyyy");
  };

  const getStr = (data: Record<string, unknown> | undefined, key: string): string | null => {
    const val = data?.[key];
    return typeof val === "string" && val.trim() !== "" ? val.trim() : null;
  };

  const getNum = (data: Record<string, unknown> | undefined, key: string): number | null => {
    const val = data?.[key];
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    if (typeof val === "string" && val.trim() !== "") {
      const n = Number(val);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  };

  const formatMoney = (amount?: number) => {
    if (amount === undefined || amount === null) return "-";
    return amount.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ARCHIVED":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px] font-semibold">
            ย้ายไปเก็บถาวร
          </Badge>
        );
      case "RESTORED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
            กู้คืนเข้าสู่ระบบ
          </Badge>
        );
      case "PERMANENTLY_DELETED":
        return (
          <Badge variant="destructive" className="text-[11px] font-semibold">
            ลบถาวร
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[11px]">
            {action}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card/85 dark:bg-card/70 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            <Archive className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                บิลที่เก็บถาวร (Archived)
              </h1>
              <Badge variant="secondary" className="rounded-full text-xs font-semibold">
                {archivedBills.length} รายการ
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              รายการบิลที่ถูกย้ายมาเก็บถาวร สามารถตรวจสอบและกู้คืน (พร้อมเช็กซ้ำอัตโนมัติ) หรือลบถาวรพร้อมบันทึกประวัติได้
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onRefresh()}
          disabled={isRefreshing || isPending}
          className="rounded-xl text-xs h-9"
        >
          <RefreshCw className={cn("mr-1.5 size-3.5", isRefreshing && "animate-spin")} />
          รีเฟรชข้อมูล
        </Button>
      </div>

      {/* Restore Duplicate Conflict Alert */}
      {restoreError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-semibold">ไม่สามารถกู้คืนรายการบิลได้ (พบข้อมูลซ้ำซ้อน)</p>
              <p className="leading-relaxed">{restoreError}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRestoreError(null)}
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
          >
            ปิด
          </Button>
        </div>
      )}

      {/* Tabs + Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] self-start">
          <Button
            variant={activeTab === "archived" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("archived")}
            className={cn(
              "text-xs h-8 rounded-lg px-3.5 font-medium",
              activeTab === "archived" && "bg-background shadow-xs font-semibold",
            )}
          >
            <Archive className="mr-1.5 size-3.5" />
            บิลในคลังเก็บถาวร ({archivedBills.length})
          </Button>
          <Button
            variant={activeTab === "logs" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("logs")}
            className={cn(
              "text-xs h-8 rounded-lg px-3.5 font-medium",
              activeTab === "logs" && "bg-background shadow-xs font-semibold",
            )}
          >
            <History className="mr-1.5 size-3.5" />
            ประวัติการลบ / กู้คืน ({deletionLogs.length})
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {activeTab === "logs" && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08]">
              {[
                { key: "ALL", label: "ทั้งหมด" },
                { key: "ARCHIVED", label: "ย้ายเก็บ" },
                { key: "RESTORED", label: "กู้คืน" },
                { key: "PERMANENTLY_DELETED", label: "ลบถาวร" },
              ].map((opt) => (
                <Button
                  key={opt.key}
                  variant={logActionFilter === opt.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setLogActionFilter(opt.key)}
                  className={cn(
                    "text-[11px] h-7 rounded-lg px-2.5",
                    logActionFilter === opt.key && "bg-background shadow-xs font-semibold",
                  )}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหารหัสบิล, หมายเลข, หน่วยงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-card/60"
            />
          </div>
        </div>
      </div>

      {/* Tab 1: Archived Bills Table */}
      {activeTab === "archived" ? (
        filteredArchived.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-2 border-black/[0.08] dark:border-white/[0.12] bg-transparent">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="size-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3 text-muted-foreground">
                <Archive className="size-6 opacity-40" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                ไม่มีรายการบิลในคลังเก็บถาวร
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                เมื่อมีการลบรายการบิลจากหน้ารายการค่าใช้จ่าย บิลจะถูกย้ายมาเก็บไว้ที่นี่ก่อนเพื่อป้องกันการลบผิดพลาด
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">รหัสบิล</TableHead>
                    <TableHead className="text-xs">หน่วยงาน</TableHead>
                    <TableHead className="text-xs">ประเภท / หมายเลขบริการ</TableHead>
                    <TableHead className="text-xs">รอบเดือน/ปี</TableHead>
                    <TableHead className="text-xs text-right">ยอดเงิน (บาท)</TableHead>
                    <TableHead className="text-xs">ผู้ย้าย / เหตุผล</TableHead>
                    <TableHead className="text-xs text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArchived.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="text-xs font-mono font-semibold whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FileText className="size-3.5 text-muted-foreground" />
                          {bill.billCode}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {bill.departmentName || bill.departmentId}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{bill.utilityType}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {bill.serviceNumber || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatPeriod(bill.billingMonth, bill.billingYear)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono font-medium whitespace-nowrap">
                        {formatMoney(bill.invoiceAmount)}
                      </TableCell>
                      <TableCell className="text-xs max-w-[220px]">
                        <div className="flex items-center gap-1 text-foreground font-medium">
                          <UserIcon className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {bill.archivedByName || bill.archivedBy}
                          </span>
                        </div>
                        {bill.archiveReason && (
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            เหตุผล: {bill.archiveReason}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="size-2.5" />
                          {format(
                            new Date(bill.archivedAt),
                            "d MMM yyyy HH:mm น.",
                            { locale: th },
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBillToView(bill)}
                            className="h-7.5 px-2.5 text-xs rounded-lg cursor-pointer"
                          >
                            <Eye className="mr-1 size-3" />
                            ดูรายละเอียด
                          </Button>
                          {canManage && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestore(bill)}
                                disabled={isPending}
                                className="h-7.5 px-2.5 text-xs rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                              >
                                <RotateCcw className="mr-1 size-3" />
                                กู้คืน
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setBillToPurge(bill);
                                  setPurgeReason("");
                                }}
                                disabled={isPending}
                                className="h-7.5 px-2.5 text-xs rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              >
                                <Trash2 className="mr-1 size-3" />
                                ลบถาวร
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )
      ) : /* Tab 2: Deletion Audit Logs */
      filteredLogs.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-black/[0.08] dark:border-white/[0.12] bg-transparent">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="size-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3 text-muted-foreground">
              <History className="size-6 opacity-40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              ยังไม่มีประวัติการลบหรือกู้คืนบิล
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              ทุกการย้ายไปเก็บถาวร การกู้คืน และการลบถาวรจะถูกบันทึกไว้อย่างถาวรที่นี่
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">วัน-เวลา</TableHead>
                  <TableHead className="text-xs">การดำเนินการ</TableHead>
                  <TableHead className="text-xs">รหัสบิล</TableHead>
                  <TableHead className="text-xs">หน่วยงาน</TableHead>
                  <TableHead className="text-xs">หมายเลข / รอบเดือน</TableHead>
                  <TableHead className="text-xs text-right">ยอดเงิน (บาท)</TableHead>
                  <TableHead className="text-xs">ผู้ดำเนินการ / เหตุผล</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), "d MMM yyyy HH:mm น.", {
                        locale: th,
                      })}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="text-xs font-mono font-semibold whitespace-nowrap">
                      {log.billCode}
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">
                      {log.departmentName || log.departmentId || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono text-[11px]">
                        {log.serviceNumber || "-"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatPeriod(log.billingMonth, log.billingYear)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono whitespace-nowrap">
                      {formatMoney(log.invoiceAmount)}
                    </TableCell>
                    <TableCell className="text-xs max-w-[240px]">
                      <div className="font-medium truncate">
                        {log.performedByName || log.performedBy}
                      </div>
                      {log.reason && (
                        <div className="text-[11px] text-muted-foreground break-words mt-0.5">
                          {log.reason}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Bill Detail & Attachments Modal */}
      <Dialog
        open={billToView !== null}
        onOpenChange={(open) => {
          if (!open) setBillToView(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              รายละเอียดรายการบิลที่เก็บถาวร
            </DialogTitle>
            <DialogDescription>
              ข้อมูลบิล{" "}
              <span className="font-mono font-semibold text-foreground">
                {billToView?.billCode}
              </span>{" "}
              ประจำเดือน{" "}
              {billToView &&
                formatPeriod(billToView.billingMonth, billToView.billingYear)}
            </DialogDescription>
          </DialogHeader>

          {billToView &&
            (() => {
              const d = billToView.billData;
              const invoiceStatus = getStr(d, "invoice_status");
              const invoiceNumber =
                getStr(d, "invoice_number") || billToView.invoiceNumber;
              const invoiceDate = d?.invoice_date;
              const receivedDate = d?.received_date;
              const sentToDisbursingDate = d?.sent_to_disbursing_date;
              const disbursingReceivedDate = d?.disbursing_received_date;
              const usageAmount = getNum(d, "usage_amount");
              const estimatedAmount = getNum(d, "estimated_amount");
              const locationType = getStr(d, "location_type");
              const isPendingBillOnly = Boolean(d?.is_pending_bill_only);
              const depositUnitId =
                getStr(d, "deposit_unit_id") || billToView.depositUnitId;
              const paidAmount = getNum(d, "paid_amount");
              const paymentDate = d?.payment_date;
              const paymentDocNumber = getStr(d, "payment_doc_number");
              const docType = getStr(d, "doc_type");
              const accountCode = getStr(d, "account_code");
              const budgetCode = getStr(d, "budget_code");
              const fundSource = getStr(d, "fund_source");
              const receiptNumber = getStr(d, "receipt_number");
              const receiptDate = d?.receipt_date;
              const receiptPaymentDate = d?.receipt_payment_date;

              const attachments = [
                {
                  key: "attachment_invoice",
                  label: "เอกสารใบแจ้งหนี้",
                  url: getStr(d, "attachment_invoice"),
                  colorClass: "text-blue-600 dark:text-blue-400",
                },
                {
                  key: "attachment_receipt",
                  label: "ใบเสร็จรับเงิน",
                  url: getStr(d, "attachment_receipt"),
                  colorClass: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  key: "attachment_payment_doc",
                  label: "เอกสารเบิกจ่าย",
                  url: getStr(d, "attachment_payment_doc"),
                  colorClass: "text-indigo-600 dark:text-indigo-400",
                },
                {
                  key: "attachment_direct_payment",
                  label: "รายงานจ่ายตรง",
                  url: getStr(d, "attachment_direct_payment"),
                  colorClass: "text-orange-600 dark:text-orange-400",
                },
                {
                  key: "attachment_ktb_report",
                  label: "รายงาน KTB",
                  url: getStr(d, "attachment_ktb_report"),
                  colorClass: "text-amber-600 dark:text-amber-400",
                },
              ];
              const attachedCount = attachments.filter((a) => a.url).length;

              let breakdownEntries: [string, unknown][] = [];
              const rawBreakdown = d?.service_breakdown;
              if (rawBreakdown) {
                try {
                  const parsed =
                    typeof rawBreakdown === "string"
                      ? JSON.parse(rawBreakdown)
                      : rawBreakdown;
                  if (parsed && typeof parsed === "object") {
                    breakdownEntries = Object.entries(
                      parsed as Record<string, unknown>,
                    );
                  }
                } catch {
                  breakdownEntries = [];
                }
              }

              const deptTypeLabel =
                billToView.departmentType === "central"
                  ? "ส่วนกลาง"
                  : billToView.departmentType === "regional_central"
                    ? "ส่วนภูมิภาค (ส่วนกลาง)"
                    : billToView.departmentType === "regional"
                      ? "ส่วนภูมิภาค"
                      : billToView.departmentType || "-";

              return (
                <div className="space-y-5 mt-2">
                  {/* Archive Info Banner */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Archive className="size-3.5" />
                        ย้ายมาเก็บถาวรโดย{" "}
                        {billToView.archivedByName || billToView.archivedBy}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        {format(
                          new Date(billToView.archivedAt),
                          "d MMM yyyy HH:mm น.",
                          { locale: th },
                        )}
                      </span>
                    </div>
                    {billToView.archiveReason && (
                      <p className="text-muted-foreground">
                        เหตุผล: {billToView.archiveReason}
                      </p>
                    )}
                  </div>

                  {/* Group 4 (top highlight): เอกสารแนบ */}
                  <div className="space-y-3 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-base tracking-tight">
                          เอกสารแนบ
                        </h3>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {attachedCount} ไฟล์
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {attachments.map((att) => (
                        <div key={att.key} className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            {att.label}
                          </p>
                          {att.url ? (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-xs font-medium transition-colors",
                                att.colorClass,
                              )}
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span>ดูไฟล์เอกสาร</span>
                              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                            </a>
                          ) : (
                            <p className="bg-muted/50 p-2 rounded-md text-xs text-muted-foreground">
                              -
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Group 1: ข้อมูลทั่วไป */}
                  <div className="space-y-3 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-2.5">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-base tracking-tight">
                        ข้อมูลทั่วไป
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          รหัสรายงาน
                        </p>
                        <p className="bg-primary/10 text-primary p-2 rounded-md font-semibold font-mono text-xs">
                          {billToView.billCode || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          หน่วยงาน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {billToView.departmentName || billToView.departmentId}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          อักษรย่อ
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {billToView.departmentShortName || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          รหัสศูนย์ต้นทุน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs font-mono">
                          {billToView.departmentCostCenter || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          ระดับหน่วยงาน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {deptTypeLabel}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          ประเภทหน่วยงาน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {isPendingBillOnly ? "หน่วยฝากเบิก" : "หน่วยเบิกจ่าย"}
                        </p>
                      </div>
                      {isPendingBillOnly && (
                        <div className="grid gap-1 md:col-span-2">
                          <p className="text-muted-foreground text-xs font-medium">
                            ฝากเบิกกับหน่วยงาน
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs">
                            {depositUnitId || "-"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Group 2: ใบแจ้งหนี้ค่าสาธารณูปโภค */}
                  <div className="space-y-3 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-2.5">
                      <Receipt className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-base tracking-tight">
                        ใบแจ้งหนี้ค่าสาธารณูปโภค
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          ประเภทสาธารณูปโภค
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs font-medium">
                          {billToView.utilityType || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          หมายเลขผู้ใช้ / รหัสเครื่องวัด
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {billToView.serviceNumber ? (
                            billToView.serviceNumber
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((sn) => (
                                <Badge
                                  key={sn}
                                  variant="secondary"
                                  className="px-2.5 py-0.5 text-xs font-mono"
                                >
                                  {sn}
                                </Badge>
                              ))
                          ) : (
                            <p className="bg-muted/50 p-2 rounded-md text-xs w-full">
                              -
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          ผู้ให้บริการ
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {billToView.provider || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          รอบบิลประจำเดือน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {formatPeriod(
                            billToView.billingMonth,
                            billToView.billingYear,
                          )}
                        </p>
                      </div>
                      {locationType && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            ที่ตั้ง
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs">
                            {locationType}
                          </p>
                        </div>
                      )}
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          สถานะใบแจ้งหนี้
                        </p>
                        <div className="pt-0.5">
                          <Badge
                            variant={
                              invoiceStatus === "NOT_RECEIVED"
                                ? "outline"
                                : "default"
                            }
                            className="text-xs"
                          >
                            {invoiceStatus === "NOT_RECEIVED"
                              ? "ยังไม่ได้รับใบแจ้งหนี้"
                              : "ได้รับใบแจ้งหนี้แล้ว"}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          เลขที่ใบแจ้งหนี้ (Invoice)
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs font-mono">
                          {invoiceNumber || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          รวมเป็นจำนวนเงิน (บาท)
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-primary font-semibold text-sm font-mono">
                          {formatMoney(billToView.invoiceAmount)}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          ปริมาณการใช้
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs font-mono">
                          {usageAmount !== null
                            ? usageAmount.toLocaleString("th-TH")
                            : "-"}
                        </p>
                      </div>
                      {estimatedAmount !== null && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            ค่าใช้จ่ายโดยประมาณการ (บาท)
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs font-mono">
                            {formatMoney(estimatedAmount)}
                          </p>
                        </div>
                      )}
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          วันที่ใบแจ้งหนี้
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {formatDateValue(invoiceDate)}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          วันที่ลงรับใบแจ้งหนี้
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {formatDateValue(receivedDate)}
                        </p>
                      </div>
                      {Boolean(sentToDisbursingDate) && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            วันที่หน่วยฝากเบิกส่งเอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs">
                            {formatDateValue(sentToDisbursingDate)}
                          </p>
                        </div>
                      )}
                      {Boolean(disbursingReceivedDate) && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            วันที่หน่วยเบิกจ่ายลงรับใบสำคัญ
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs">
                            {formatDateValue(disbursingReceivedDate)}
                          </p>
                        </div>
                      )}

                      {breakdownEntries.length > 0 && (
                        <div className="grid gap-2 md:col-span-2 rounded-lg border bg-muted/20 p-3 mt-1">
                          <div className="flex items-center justify-between border-b pb-1.5">
                            <p className="text-xs font-semibold text-foreground">
                              รายละเอียดจำนวนเงินแยกรายหมายเลข (Service
                              Breakdown)
                            </p>
                            <Badge variant="secondary" className="text-[10px]">
                              {breakdownEntries.length} หมายเลข
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {breakdownEntries.map(([num, amt]) => {
                              const n = Number(amt);
                              return (
                                <div
                                  key={num}
                                  className="bg-background p-2.5 rounded-md border text-xs flex items-center justify-between gap-2"
                                >
                                  <span className="font-mono font-semibold truncate">
                                    {num}
                                  </span>
                                  <span className="text-primary font-semibold font-mono whitespace-nowrap">
                                    {!Number.isNaN(n)
                                      ? `฿${formatMoney(n)}`
                                      : "-"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Group 3: การเบิกจ่ายและใบเสร็จรับเงิน */}
                  <div className="space-y-3 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-2.5">
                      <Banknote className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-base tracking-tight">
                        การเบิกจ่ายและใบเสร็จรับเงิน
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="grid gap-1 md:col-span-2">
                        <p className="text-muted-foreground text-xs font-medium">
                          สถานะการเบิกจ่าย
                        </p>
                        <Badge
                          variant={
                            billToView.paymentStatus === "PAID"
                              ? "default"
                              : "secondary"
                          }
                          className={cn(
                            "w-fit text-xs",
                            billToView.paymentStatus === "PAID" &&
                              "bg-emerald-600 hover:bg-emerald-700",
                          )}
                        >
                          {billToView.paymentStatus === "PAID"
                            ? "เบิกจ่ายแล้ว"
                            : "ยังไม่ได้เบิกจ่าย"}
                        </Badge>
                      </div>

                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          จำนวนเงินที่เบิกจ่าย (บาท)
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-emerald-600 dark:text-emerald-400 font-semibold text-sm font-mono">
                          {paidAmount !== null ? formatMoney(paidAmount) : "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          วันที่เอกสารเบิกจ่าย
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {formatDateValue(paymentDate)}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          เลขเอกสารเบิกจ่าย
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs font-mono">
                          {paymentDocNumber || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          ประเภทเอกสาร
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs">
                          {docType || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          รหัสงบประมาณ
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs font-mono">
                          {budgetCode || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          รหัสแยกประเภท
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-xs font-mono">
                          {accountCode || "-"}
                        </p>
                      </div>
                      {fundSource && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            แหล่งของเงิน
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs">
                            {fundSource}
                          </p>
                        </div>
                      )}
                      {receiptNumber && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            เลขที่ใบเสร็จรับเงิน
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs font-mono">
                            {receiptNumber}
                          </p>
                        </div>
                      )}
                      {Boolean(receiptDate) && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            วันที่ใบเสร็จรับเงิน
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs">
                            {formatDateValue(receiptDate)}
                          </p>
                        </div>
                      )}
                      {Boolean(receiptPaymentDate) && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            วันที่ชำระตามใบเสร็จ
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-xs">
                            {formatDateValue(receiptPaymentDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog
        open={billToPurge !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setBillToPurge(null);
            setPurgeReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ยืนยันการลบรายการบิลถาวร?
            </AlertDialogTitle>
            <AlertDialogDescription>
              รายการบิล{" "}
              <span className="font-mono font-semibold text-foreground">
                {billToPurge?.billCode}
              </span>{" "}
              และไฟล์แนบที่เกี่ยวข้องจะถูกลบออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้อีก
              (ระบบจะยังคงเก็บประวัติการลบไว้ในแท็บประวัติการลบ)
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 py-1">
            <Label htmlFor="permanent-delete-reason" className="text-xs font-semibold">
              เหตุผลการลบถาวร (ไม่บังคับ)
            </Label>
            <Textarea
              id="permanent-delete-reason"
              value={purgeReason}
              onChange={(e) => setPurgeReason(e.target.value)}
              placeholder="ระบุเหตุผลการลบถาวร เพื่อบันทึกในประวัติตรวจสอบ..."
              rows={2}
              className="text-xs rounded-xl resize-none"
              disabled={isPending}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmPurge();
              }}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isPending ? "กำลังลบถาวร..." : "ยืนยันลบถาวร"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
