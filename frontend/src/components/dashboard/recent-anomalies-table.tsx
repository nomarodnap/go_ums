"use client";

import {
  Droplet,
  Eye,
  Flag,
  Mail,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Sparkles,
  Wifi,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AnomalyExplainDialog } from "@/components/ai/anomaly-explain-dialog";
import { BillQuickViewDrawer } from "@/components/bills/bill-quick-view-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type RecentAnomaly = {
  id: string;
  billCode?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentShortName?: string | null;
  utilityType: string;
  billingMonth: number;
  billingYear: number;
  provider?: string | null;
  serviceNumber?: string | null;
  invoiceNumber?: string | null;
  usageAmount?: number | string | null;
  invoiceAmount: number | string | null;
  paidAmount?: number | string | null;
  paymentStatus?: string | null;
  invoiceStatus?: string | null;
  paymentDocNumber?: string | null;
  docType?: string | null;
  attachmentReceipt?: string | null;
  attachmentInvoice?: string | null;
  isPendingBillOnly?: boolean | null;
  depositUnitName?: string | null;
  isReviewed?: boolean | null;
  auditStatus?: string | null;
  isManualAnomaly?: boolean | null;
  manualAnomalyReason?: string | null;
  manualAnomalyDetail?: string | null;
  isLateReceive?: boolean | null;
  isIncompleteReceiveDate?: boolean | null;
  isLatePayment?: boolean | null;
  isOverdueMoreThan2Months?: boolean | null;
  isDisbursementOver2Months?: boolean | null;
  isWrongMonth?: boolean | null;
  isPhoneOverLimit?: boolean | null;
  isPhoneUsageOverLimit?: boolean | null;
  isWrongBudget?: boolean | null;
  isDuplicate?: boolean | null;
  isAnomalyExpense?: boolean | null;
};

const THAI_MONTHS = [
  "",
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const getMonthName = (m: number) => THAI_MONTHS[m] || "";

export function RecentAnomaliesTable({ anomalies }: { anomalies: RecentAnomaly[] }) {
  const [billForDrawer, setBillForDrawer] = useState<RecentAnomaly | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [billForExplain, setBillForExplain] = useState<RecentAnomaly | null>(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);

  const handleRowClick = (anomaly: RecentAnomaly) => {
    setBillForDrawer(anomaly);
    setIsDrawerOpen(true);
  };

  const handleOpenExplain = (anomaly: RecentAnomaly) => {
    setBillForExplain(anomaly);
    setIsExplainOpen(true);
  };

  const getUtilityIcon = (type: string) => {
    switch (type) {
      case "ค่าไฟฟ้า":
        return <Zap className="size-3.5 text-amber-500" />;
      case "ค่าประปา&น้ำบาดาล":
      case "ค่าน้ำประปา":
        return <Droplet className="size-3.5 text-blue-500" />;
      case "ค่าโทรศัพท์":
        return <Phone className="size-3.5 text-emerald-500" />;
      case "ค่าสื่อสาร&โทรคมนาคม":
      case "ค่าบริการสื่อสารและโทรคมนาคม":
        return <Wifi className="size-3.5 text-purple-500" />;
      case "ค่าบริการไปรษณีย์":
      case "ค่าไปรษณีย์":
        return <Mail className="size-3.5 text-orange-500" />;
      default:
        return <Mail className="size-3.5 text-slate-500" />;
    }
  };

  const getAuditIssueTexts = (bill: RecentAnomaly) => {
    const issues: string[] = [];
    if (bill.isLateReceive) issues.push("ลงรับใบแจ้งหนี้ล่าช้า");
    if (bill.isIncompleteReceiveDate) issues.push("วันที่รับใบแจ้งหนี้ไม่ครบถ้วน");
    if (bill.isLatePayment) issues.push("เบิกจ่ายล่าช้า");
    if (bill.isOverdueMoreThan2Months) issues.push("ค้างชำระเกิน 2 เดือน");
    if (bill.isDisbursementOver2Months) issues.push("เบิกจ่ายเกิน 2 เดือน");
    if (bill.isWrongMonth) issues.push("เบิกจ่ายผิดเดือน");
    if (bill.isPhoneUsageOverLimit) issues.push("ใช้ค่าโทรศัพท์เกินเกณฑ์");
    if (bill.isPhoneOverLimit) issues.push("เบิกค่าโทรศัพท์เกินเกณฑ์");
    if (bill.isWrongBudget) issues.push("เบิกจ่ายผิดงบประมาณ");
    if (bill.isDuplicate) issues.push("เบิกจ่ายซ้ำซ้อน");
    if (bill.isAnomalyExpense) issues.push("ค่าใช้จ่ายสูงผิดปกติ");
    if (bill.isManualAnomaly) issues.push(bill.manualAnomalyReason || "ระบุว่าผิดปกติ");
    return issues;
  };

  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        ไม่พบรายการผิดปกติในช่วงนี้
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">หน่วยงาน / ประเภท</TableHead>
              <TableHead>รหัสรายงาน / เครื่องวัด</TableHead>
              <TableHead>รอบบิล</TableHead>
              <TableHead className="text-right">ยอดชำระ / เบิกจ่าย</TableHead>
              <TableHead className="text-center">สถานะการเบิกจ่าย</TableHead>
              <TableHead className="text-center">สถานะตรวจสอบ</TableHead>
              <TableHead className="w-[80px] text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anomalies.map((bill) => {
              const issues = getAuditIssueTexts(bill);

              return (
                <TableRow
                  key={bill.id}
                  className="group transition-colors hover:bg-muted/40 cursor-pointer"
                  onClick={() => handleRowClick(bill)}
                >
                  {/* 1. หน่วยงาน / ประเภท */}
                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className="font-medium text-foreground truncate max-w-[220px]"
                        title={bill.departmentName || "ไม่ระบุหน่วยงาน"}
                      >
                        {bill.departmentName || "ไม่ระบุหน่วยงาน"}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1.5">
                          {getUtilityIcon(bill.utilityType)}
                          <span>{bill.utilityType}</span>
                        </div>
                        {bill.isPendingBillOnly && (
                          <span
                            className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/40 font-medium truncate max-w-[150px]"
                            title={`ฝากเบิก: ${bill.depositUnitName || "-"}`}
                          >
                            ฝากเบิก: {bill.depositUnitName || "-"}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* 2. รหัสรายงาน / เครื่องวัด */}
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      {bill.billCode && (
                        <span className="text-[11px] font-semibold text-primary mb-0.5 border border-primary/20 bg-primary/10 rounded-full px-2 py-0.5 w-fit">
                          {bill.billCode}
                        </span>
                      )}
                      {bill.serviceNumber ? (
                        <span className="text-sm font-medium text-foreground">
                          {bill.serviceNumber}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                      {bill.invoiceNumber && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            INV: {bill.invoiceNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* 3. รอบบิล */}
                  <TableCell>
                    <div className="flex flex-col space-y-0.5">
                      <span className="font-medium text-foreground text-sm">
                        {getMonthName(bill.billingMonth)}{" "}
                        {bill.billingYear ? bill.billingYear + 543 : "-"}
                      </span>
                    </div>
                  </TableCell>

                  {/* 4. ยอดชำระ / เบิกจ่าย */}
                  <TableCell className="text-right">
                    <div className="flex flex-col space-y-1 items-end">
                      <span className="font-semibold text-sm text-foreground">
                        {bill.invoiceAmount != null
                          ? Number(bill.invoiceAmount).toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "-"}
                      </span>
                      {bill.usageAmount != null && (
                        <span className="text-[11px] text-muted-foreground">
                          {Number(bill.usageAmount).toLocaleString("th-TH")} หน่วย
                        </span>
                      )}
                      {bill.paymentStatus === "PAID" && bill.paidAmount != null && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          จ่าย:{" "}
                          {Number(bill.paidAmount).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* 5. สถานะการเบิกจ่าย */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <Badge
                        variant={
                          bill.invoiceStatus === "NOT_RECEIVED"
                            ? "outline"
                            : bill.paymentStatus === "PAID"
                              ? bill.attachmentReceipt && bill.attachmentReceipt.trim() !== ""
                                ? "success"
                                : "default"
                              : "warning"
                        }
                        className={cn(
                          "text-[11px] font-medium",
                          bill.paymentStatus === "PAID" &&
                            (bill.attachmentReceipt && bill.attachmentReceipt.trim() !== ""
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"),
                        )}
                      >
                        {bill.invoiceStatus === "NOT_RECEIVED"
                          ? "ยังไม่ได้รับใบแจ้งหนี้"
                          : bill.paymentStatus === "PAID"
                            ? bill.attachmentReceipt && bill.attachmentReceipt.trim() !== ""
                              ? "ได้ใบเสร็จแล้ว"
                              : "เบิกจ่ายแล้ว"
                            : "ยังไม่ได้เบิกจ่าย"}
                      </Badge>
                      {(bill.invoiceStatus === "NOT_RECEIVED" ||
                        bill.paymentStatus === "PENDING") && (
                        <Badge variant="destructive" className="text-[10px] h-4.5 px-2 font-normal">
                          ค้างชำระ
                        </Badge>
                      )}
                      {bill.paymentStatus === "PAID" && bill.paymentDocNumber && (
                        <span className="text-[10px] text-muted-foreground mt-0.5 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                          {bill.docType ? `${bill.docType} ` : ""}
                          {bill.paymentDocNumber}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* 6. สถานะตรวจสอบ */}
                  <TableCell className="text-center align-top pt-4">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      {bill.auditStatus === "PENDING_RECHECK" ? (
                        <Badge className="whitespace-nowrap text-[11px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium">
                          รอตรวจสอบใหม่
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="whitespace-nowrap text-[11px]">
                          พบข้อสังเกต
                        </Badge>
                      )}
                      {issues.length > 0 && (
                        <div className="flex flex-col text-[10px] text-amber-800 dark:text-amber-300 items-start text-left bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-xl w-full max-w-[150px] leading-tight border border-amber-200/60 dark:border-amber-800/40">
                          {issues.map((issue, idx) => {
                            const isManualIssue =
                              bill.isManualAnomaly &&
                              issue === (bill.manualAnomalyReason || "ระบุว่าผิดปกติ");
                            if (isManualIssue && bill.manualAnomalyDetail) {
                              return (
                                <TooltipProvider key={idx}>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <span className="cursor-help underline decoration-dotted underline-offset-2" />
                                      }
                                    >
                                      • {issue}
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-xs p-3 text-left">
                                      <p className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                        <Flag className="size-3.5 shrink-0" />
                                        {issue}
                                      </p>
                                      <p className="text-foreground whitespace-pre-line mt-1.5 leading-relaxed text-xs">
                                        {bill.manualAnomalyDetail}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return <span key={idx}>• {issue}</span>;
                          })}
                        </div>
                      )}
                      {bill.isReviewed && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full"
                        >
                          ✓ ตรวจสอบแล้ว
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* 7. แถบปุ่มจัดการ */}
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenExplain(bill)}
                        aria-label={`AI วิเคราะห์สาเหตุ ${bill.billCode || bill.utilityType}`}
                        className="h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg gap-1 cursor-pointer"
                      >
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        <span className="hidden xl:inline">AI</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-80 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            />
                          }
                        >
                          <span className="sr-only">เปิดเมนู</span>
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>การจัดการ</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-primary focus:text-primary"
                              onClick={() => handleOpenExplain(bill)}
                            >
                              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" /> AI
                              วิเคราะห์สาเหตุ
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => handleRowClick(bill)}
                            >
                              <Eye className="mr-2 h-4 w-4" aria-hidden="true" /> ดูรายละเอียด
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              render={<Link href={`/bills/${bill.id}/edit`} />}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> อัพเดทข้อมูล
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {billForDrawer && (
        <BillQuickViewDrawer
          bill={billForDrawer}
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
        />
      )}

      {billForExplain && (
        <AnomalyExplainDialog
          billId={billForExplain.id}
          billCode={billForExplain.billCode}
          departmentName={billForExplain.departmentName}
          open={isExplainOpen}
          onOpenChange={setIsExplainOpen}
        />
      )}
    </>
  );
}
