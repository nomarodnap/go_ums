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
  MoreHorizontal,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArchivedBillDetailDialog } from "./archived-bill-detail-dialog";
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
    const trimmedReason = purgeReason.trim();
    if (!trimmedReason) {
      toast.error("กรุณาระบุเหตุผลการลบถาวร");
      return;
    }
    const target = billToPurge;
    startTransition(async () => {
      const res = await permanentlyDeleteArchivedBill(target.id, trimmedReason);
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
                    <TableHead className="text-xs text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArchived.map((bill) => (
                    <TableRow key={bill.id} className="group">
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
                      <TableCell
                        className="text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 cursor-pointer"
                              />
                            }
                          >
                            <span className="sr-only">เปิดเมนู</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>การจัดการ</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => setBillToView(bill)}
                              >
                                <Eye className="mr-2 h-4 w-4" /> ดูรายละเอียด
                              </DropdownMenuItem>
                              {canManage && (
                                <>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-emerald-700 dark:text-emerald-400 focus:text-emerald-700 dark:focus:text-emerald-400"
                                    disabled={isPending}
                                    onClick={() => handleRestore(bill)}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" /> กู้คืน
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                    disabled={isPending}
                                    onClick={() => {
                                      setBillToPurge(bill);
                                      setPurgeReason("");
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> ลบถาวร
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* Bill Detail Modal (matching /bills detail view) */}
      <ArchivedBillDetailDialog
        bill={billToView}
        deletionLogs={deletionLogs}
        onClose={() => setBillToView(null)}
      />

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
              เหตุผลการลบถาวร <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="permanent-delete-reason"
              value={purgeReason}
              onChange={(e) => setPurgeReason(e.target.value)}
              placeholder="กรุณาระบุเหตุผลการลบถาวร เพื่อบันทึกในประวัติตรวจสอบ..."
              rows={2}
              className="text-xs rounded-xl resize-none"
              required
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
              disabled={isPending || !purgeReason.trim()}
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
