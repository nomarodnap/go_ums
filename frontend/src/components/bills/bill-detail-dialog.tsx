"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  FileText,
  Building2,
  Receipt,
  CalendarClock,
  Banknote,
  CheckCircle2,
  Clock,
  Flag,
  RefreshCw,
  Zap,
  Droplet,
  Phone,
  Wifi,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { getBillLogs } from "@/server/actions/bills";
import type { BillDTO } from "@/lib/api/generated/model";

export function getUtilityIcon(type?: string) {
  switch (type) {
    case "ค่าไฟฟ้า":
      return <Zap className="h-4 w-4 text-yellow-500" />;
    case "ค่าประปา&น้ำบาดาล":
      return <Droplet className="h-4 w-4 text-blue-500" />;
    case "ค่าโทรศัพท์":
      return <Phone className="h-4 w-4 text-green-500" />;
    case "ค่าสื่อสาร&โทรคมนาคม":
      return <Wifi className="h-4 w-4 text-purple-500" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export function getMonthName(monthNum?: number) {
  if (!monthNum) return "";
  const d = new Date();
  d.setMonth(monthNum - 1);
  return format(d, "MMM", { locale: th });
}

export function getAuditIssueTexts(bill: any): string[] {
  const issues: string[] = [];
  if (bill.isLateReceive) issues.push("ลงรับใบแจ้งหนี้ล่าช้า");
  if (bill.isIncompleteReceiveDate) issues.push("วันที่รับใบแจ้งหนี้ไม่ครบถ้วน");
  if (bill.isLatePayment) issues.push("เบิกจ่ายล่าช้า");
  if (bill.isOverdueMoreThan2Months) issues.push("ค้างชำระเกิน 2 เดือน");
  if (bill.isWrongMonth) issues.push("เบิกจ่ายผิดเดือน");
  if (bill.isPhoneUsageOverLimit) issues.push("ใช้ค่าโทรศัพท์เกินเกณฑ์");
  if (bill.isPhoneOverLimit) issues.push("เบิกค่าโทรศัพท์เกินเกณฑ์");
  if (bill.isWrongBudget) issues.push("เบิกจ่ายผิดงบประมาณ");
  if (bill.isDuplicate) issues.push("เบิกจ่ายซ้ำซ้อน");

  if (bill.auditIssues && Array.isArray(bill.auditIssues)) {
    for (const issue of bill.auditIssues) {
      if (!issues.includes(issue)) {
        issues.push(issue);
      }
    }
  }
  return issues;
}

export interface BillDetailDialogProps {
  bill: BillDTO | any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services?: any[];
  canReview?: boolean;
  canFlag?: boolean;
  onReview?: () => void;
  onUnreview?: () => void;
  onFlag?: (bill: any) => void;
  onUnflag?: () => void;
  isPending?: boolean;
  isLoading?: boolean;
}

export function BillDetailDialog({
  bill,
  open,
  onOpenChange,
  services = [],
  canReview = false,
  canFlag = false,
  onReview,
  onUnreview,
  onFlag,
  onUnflag,
  isPending = false,
  isLoading = false,
}: BillDetailDialogProps) {
  const [billLogs, setBillLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    if (open && bill?.id) {
      setIsLoadingLogs(true);
      getBillLogs(bill.id)
        .then((logs) => setBillLogs(logs || []))
        .catch((err) => {
          console.error("Failed to fetch bill logs", err);
          setBillLogs([]);
        })
        .finally(() => setIsLoadingLogs(false));
    } else if (!open) {
      setBillLogs([]);
    }
  }, [open, bill?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            รายละเอียดรายการค่าใช้จ่าย
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
          </DialogTitle>
          <DialogDescription>
            ข้อมูลบิลประจำเดือน{" "}
            {bill && getMonthName(bill.billingMonth)}{" "}
            {bill && bill.billingYear + 543}
          </DialogDescription>
        </DialogHeader>

        {bill && (
          <Tabs defaultValue="details" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">รายละเอียด</TabsTrigger>
              <TabsTrigger value="history">ประวัติการทำรายการ</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <div className="space-y-6">
                {/* Group 1: ข้อมูลทั่วไป */}
                <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg tracking-tight">
                      ข้อมูลทั่วไป
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        รหัสรายงาน
                      </p>
                      <p className="bg-primary/10 text-primary p-2 rounded-md font-semibold font-mono">
                        {bill.billCode || "-"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        หน่วยงาน
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.departmentName || "-"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        อักษรย่อ
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.departmentShortName || "-"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        รหัสศูนย์ต้นทุน
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.departmentCostCenter || "-"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        ระดับหน่วยงาน
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.departmentType === "central"
                          ? "ส่วนกลาง"
                          : bill.departmentType === "regional_central"
                            ? "ส่วนภูมิภาค (ส่วนกลาง)"
                            : bill.departmentType === "regional"
                              ? "ส่วนภูมิภาค"
                              : bill.departmentType || "-"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        ประเภทหน่วยงาน
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.isPendingBillOnly
                          ? "หน่วยฝากเบิก"
                          : "หน่วยเบิกจ่าย"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        ฝากเบิกกับหน่วยงาน
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.isPendingBillOnly
                          ? bill.depositUnitName ||
                            bill.depositUnitId ||
                            "-"
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Group 2: ใบแจ้งหนี้ค่าสาธารณูปโภค */}
                <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <Receipt className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg tracking-tight">
                      ใบแจ้งหนี้ค่าสาธารณูปโภค
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        ประเภทสาธารณูปโภค
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md flex items-center gap-1.5">
                        {getUtilityIcon(bill.utilityType)}
                        {bill.utilityType || "-"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        หมายเลขผู้ใช้ / รหัสเครื่องวัด
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bill.serviceNumber ? (
                          bill.serviceNumber
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean)
                            .map((sn: string) => (
                              <Badge
                                key={sn}
                                variant="secondary"
                                className="px-3 py-1 text-sm bg-muted text-foreground"
                              >
                                {sn}
                              </Badge>
                            ))
                        ) : (
                          <p className="bg-muted/50 p-2 rounded-md w-full">
                            -
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        ผู้ให้บริการ
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.provider || "-"}
                      </p>
                    </div>
                    {(bill.utilityType === "ค่าไฟฟ้า" ||
                      bill.utilityType === "ค่าประปา&น้ำบาดาล") && (
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          ที่ตั้ง
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {bill.locationType || "-"}
                        </p>
                      </div>
                    )}
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        รอบบิลประจำเดือน
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.billingMonth && bill.billingYear
                          ? `${getMonthName(bill.billingMonth)} ${bill.billingYear + 543}`
                          : "-"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        ค่าใช้จ่ายโดยประมาณการ
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md text-muted-foreground italic">
                        (คำนวณอัตโนมัติในฟอร์ม)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Group 3: การรับใบแจ้งหนี้ */}
                <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <CalendarClock className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg tracking-tight">
                      การรับใบแจ้งหนี้
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div className="grid gap-1 md:col-span-2">
                      <p className="text-muted-foreground text-sm font-medium">
                        สถานะใบแจ้งหนี้
                      </p>
                      <Badge
                        variant={
                          bill.invoiceStatus === "RECEIVED"
                            ? "default"
                            : "outline"
                        }
                        className="mt-1 w-fit"
                      >
                        {bill.invoiceStatus === "RECEIVED"
                          ? "ได้รับใบแจ้งหนี้แล้ว"
                          : "ยังไม่ได้รับใบแจ้งหนี้"}
                      </Badge>
                    </div>

                    {bill.invoiceStatus === "RECEIVED" && (
                      <>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่ใบแจ้งหนี้
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.invoiceDate
                              ? format(
                                  new Date(bill.invoiceDate),
                                  "dd/MM/yyyy",
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่ลงรับใบแจ้งหนี้
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.receivedDate
                              ? format(
                                  new Date(bill.receivedDate),
                                  "dd/MM/yyyy",
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่หน่วยฝากเบิกส่งเอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.sentToDisbursingDate
                              ? format(
                                  new Date(bill.sentToDisbursingDate),
                                  "dd/MM/yyyy",
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่หน่วยเบิกจ่ายลงรับใบสำคัญ
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.disbursingReceivedDate
                              ? format(
                                  new Date(bill.disbursingReceivedDate),
                                  "dd/MM/yyyy",
                                )
                              : "-"}
                          </p>
                        </div>

                        {/* Service Breakdown */}
                        {(() => {
                          if (!bill.serviceBreakdown) return null;
                          try {
                            const breakdown =
                              typeof bill.serviceBreakdown === "string"
                                ? JSON.parse(bill.serviceBreakdown)
                                : bill.serviceBreakdown;
                            if (!breakdown || typeof breakdown !== "object")
                              return null;
                            const entries = Object.entries(breakdown);
                            if (entries.length === 0) return null;

                            return (
                              <div className="grid gap-2 md:col-span-2 rounded-lg border bg-muted/20 p-3.5 mt-1">
                                <div className="flex items-center justify-between border-b pb-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <span>
                                      รายละเอียดจำนวนเงินแยกรายหมายเลข (Service
                                      Breakdown)
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] font-normal py-0 px-1.5"
                                    >
                                      {entries.length} หมายเลข
                                    </Badge>
                                  </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                                  {entries.map(([num, amt]) => {
                                    const numVal = parseFloat(String(amt));
                                    const svcInfo =
                                      services?.find(
                                        (s) =>
                                          s.serviceNumber === num &&
                                          (!bill.departmentId ||
                                            s.departmentId ===
                                              bill.departmentId),
                                      ) ||
                                      services?.find(
                                        (s) => s.serviceNumber === num,
                                      );

                                    const isItemOverLimit =
                                      bill.utilityType === "ค่าโทรศัพท์" &&
                                      svcInfo?.phoneReimbursementLimit &&
                                      !isNaN(numVal) &&
                                      numVal >
                                        svcInfo.phoneReimbursementLimit;

                                    return (
                                      <div
                                        key={num}
                                        className={`bg-background p-2.5 rounded-md border text-xs flex flex-col justify-between shadow-2xs ${isItemOverLimit ? "border-amber-500/60 bg-amber-50/20 dark:bg-amber-950/10" : ""}`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="text-muted-foreground font-medium truncate">
                                              หมายเลข:{" "}
                                              <span className="text-foreground font-semibold">
                                                {num}
                                              </span>
                                              {svcInfo?.phoneOwnerName && (
                                                <span className="text-muted-foreground ml-1 font-normal">
                                                  ({svcInfo.phoneOwnerName})
                                                </span>
                                              )}
                                            </span>
                                            {svcInfo?.phoneReimbursementLimit && (
                                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-normal shrink-0">
                                                สิทธิ: ฿
                                                {svcInfo.phoneReimbursementLimit.toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="mt-1">
                                          <div className="flex items-baseline justify-between">
                                            <span className="text-[11px] text-muted-foreground">
                                              ยอดตามบิล:
                                            </span>
                                            <span className="text-primary font-semibold text-sm">
                                              {!isNaN(numVal)
                                                ? `฿${numVal.toLocaleString(
                                                    "th-TH",
                                                    {
                                                      minimumFractionDigits: 2,
                                                      maximumFractionDigits: 2,
                                                    },
                                                  )}`
                                                : "-"}
                                            </span>
                                          </div>
                                          {isItemOverLimit && (
                                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 pt-1 border-t border-dashed border-amber-300 dark:border-amber-800">
                                              ⚠️ เกินสิทธิเบิกจ่ายประจำเดือน (฿
                                              {svcInfo.phoneReimbursementLimit?.toLocaleString()}
                                              )
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          } catch (e) {
                            return null;
                          }
                        })()}

                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            รวมเป็นจำนวนเงิน (บาท)
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-primary font-semibold text-lg">
                            {bill.invoiceAmount
                              ? Number(
                                  bill.invoiceAmount,
                                ).toLocaleString("th-TH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            ปริมาณการใช้
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.usageAmount
                              ? Number(bill.usageAmount).toLocaleString(
                                  "th-TH",
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="grid gap-1 md:col-span-2">
                          <p className="text-muted-foreground text-sm font-medium">
                            เลขที่ใบแจ้งหนี้ (Invoice)
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.invoiceNumber || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1 md:col-span-2">
                          <p className="text-muted-foreground text-sm font-medium">
                            เอกสารใบแจ้งหนี้
                          </p>
                          {bill.attachmentInvoice ? (
                            <a
                              href={bill.attachmentInvoice}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-blue-600"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                ดูไฟล์เอกสาร
                              </span>
                            </a>
                          ) : (
                            <p className="bg-muted/50 p-2 rounded-md text-muted-foreground">
                              -
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Group 4: การเบิกจ่ายค่าสาธารณูปโภค */}
                <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <Banknote className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg tracking-tight">
                      การเบิกจ่ายค่าสาธารณูปโภค
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div className="grid gap-1 md:col-span-2">
                      <p className="text-muted-foreground text-sm font-medium">
                        สถานะการเบิกจ่าย
                      </p>
                      <Badge
                        variant={
                          bill.paymentStatus === "PAID"
                            ? bill.attachmentReceipt
                              ? "default"
                              : "secondary"
                            : "secondary"
                        }
                        className={`mt-1 w-fit ${
                          bill.paymentStatus === "PAID"
                            ? bill.attachmentReceipt
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                            : ""
                        }`}
                      >
                        {bill.paymentStatus === "PAID"
                          ? bill.attachmentReceipt
                            ? "ได้ใบเสร็จแล้ว"
                            : "เบิกจ่ายแล้ว"
                          : "ยังไม่ได้เบิกจ่าย"}
                      </Badge>
                    </div>

                    {bill.paymentStatus === "PAID" && (
                      <>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่เอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.paymentDate
                              ? format(
                                  new Date(bill.paymentDate),
                                  "dd/MM/yyyy",
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            รหัสงบประมาณ
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.budgetCode || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            เลขเอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.paymentDocNumber || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            ประเภทเอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.docType || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            รหัสแยกประเภท
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {bill.accountCode || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            จำนวนเงินที่เบิกจ่าย (บาท)
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-green-600 font-semibold text-lg">
                            {bill.paidAmount
                              ? Number(bill.paidAmount).toLocaleString(
                                  "th-TH",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )
                              : "-"}
                          </p>
                        </div>

                        <div className="grid gap-1 md:col-span-2">
                          <p className="text-muted-foreground text-sm font-medium">
                            รายงานจ่ายตรง / รายงาน KTB
                          </p>
                          {bill.attachmentDirectPayment ||
                          bill.attachmentKtbReport ? (
                            <a
                              href={
                                bill.attachmentDirectPayment ||
                                bill.attachmentKtbReport ||
                                undefined
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-orange-600"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                ดูไฟล์เอกสาร
                              </span>
                            </a>
                          ) : (
                            <p className="bg-muted/50 p-2 rounded-md text-muted-foreground">
                              -
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Group 5: ใบเสร็จชำระเงิน */}
                <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <Receipt className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg tracking-tight">
                      ใบเสร็จชำระเงิน
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div className="grid gap-1 md:col-span-2">
                      <p className="text-muted-foreground text-sm font-medium">
                        สถานะใบเสร็จชำระเงิน
                      </p>
                      <Badge
                        variant={bill.attachmentReceipt ? "default" : "outline"}
                        className={`mt-1 w-fit ${bill.attachmentReceipt ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                      >
                        {bill.attachmentReceipt
                          ? "ได้ใบเสร็จชำระเงินแล้ว"
                          : "ยังไม่ได้ใบเสร็จชำระเงิน"}
                      </Badge>
                    </div>

                    {bill.attachmentReceipt && (
                      <div className="grid gap-1 md:col-span-2">
                        <p className="text-muted-foreground text-sm font-medium">
                          ไฟล์ใบเสร็จรับเงิน
                        </p>
                        <a
                          href={bill.attachmentReceipt}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-emerald-600 dark:text-emerald-400 font-medium text-sm"
                        >
                          <FileText className="h-4 w-4" />
                          <span>ดูไฟล์เอกสาร</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Group 5: สถานะปัจจุบันจากระบบ */}
                <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                  <h4 className="font-semibold text-lg tracking-tight flex items-center gap-2 border-b pb-3 text-primary">
                    <CalendarClock className="h-5 w-5" /> สถานะปัจจุบันจากระบบ
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        สถานะตรวจสอบ (กตน.)
                      </p>
                      {bill.auditStatus === "PENDING_CORRECTION" ? (
                        <div className="flex flex-col gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 w-fit text-sm"
                          >
                            {bill.isManualAnomaly
                              ? "ระบุว่าผิดปกติ (รอแก้ไข)"
                              : "พบข้อสังเกต (รอแก้ไข)"}
                          </Badge>
                          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 mt-1">
                            <p className="font-semibold text-sm mb-1.5 opacity-80">
                              สาเหตุที่พบ:
                            </p>
                            <ul className="list-disc pl-4 text-sm space-y-1">
                              {bill.isManualAnomaly && (bill.manualAnomalyReason || bill.manualAnomalyDetail) && (
                                <li className="font-medium text-rose-700 dark:text-rose-400">
                                  <span>{bill.manualAnomalyReason || "ระบุข้อผิดปกติด้วยตนเอง"}</span>
                                  {bill.manualAnomalyDetail && (
                                    <p className="text-xs font-normal text-muted-foreground whitespace-pre-line mt-0.5">
                                      {bill.manualAnomalyDetail}
                                    </p>
                                  )}
                                </li>
                              )}
                              {getAuditIssueTexts(bill).length > 0 ? (
                                getAuditIssueTexts(bill).map(
                                  (issue, idx) => <li key={idx}>{issue}</li>,
                                )
                              ) : !bill.manualAnomalyReason ? (
                                <li>ไม่ระบุสาเหตุ</li>
                              ) : null}
                            </ul>
                          </div>
                          {bill.isReviewed && (
                            <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                              ตรวจสอบแล้ว
                              {bill.reviewedBy
                                ? ` โดย ${bill.reviewedBy}`
                                : ""}
                              {bill.reviewedAt &&
                                ` เมื่อ ${format(
                                  new Date(bill.reviewedAt),
                                  "dd MMM yy HH:mm",
                                  { locale: th },
                                )}`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start mt-1">
                          <Badge
                            variant={
                              !bill.auditStatus ||
                              bill.auditStatus === "CORRECTED"
                                ? "secondary"
                                : "outline"
                            }
                            className={`w-fit text-sm ${
                              !bill.auditStatus
                                ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                            }`}
                          >
                            {!bill.auditStatus ? "ปกติ" : "แก้ไขแล้ว"}
                          </Badge>
                          {bill.isReviewed && (
                            <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                              ตรวจสอบแล้ว
                              {bill.reviewedBy
                                ? ` โดย ${bill.reviewedBy}`
                                : ""}
                              {bill.reviewedAt &&
                                ` เมื่อ ${format(
                                  new Date(bill.reviewedAt),
                                  "dd MMM yy HH:mm",
                                  { locale: th },
                                )}`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="space-y-4 rounded-xl border bg-card/50 p-6 shadow-sm min-h-[400px]">
                <h3 className="font-semibold text-lg tracking-tight flex items-center gap-2 border-b pb-3 mb-4">
                  <Clock className="h-5 w-5 text-primary" /> ประวัติการทำรายการ
                </h3>

                {isLoadingLogs ? (
                  <div className="flex justify-center items-center h-32">
                    <p className="text-muted-foreground animate-pulse">
                      กำลังโหลดข้อมูล...
                    </p>
                  </div>
                ) : billLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Clock className="h-8 w-8 mb-2 opacity-20" />
                    <p>ไม่มีประวัติการทำรายการ</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-muted ml-3 space-y-6">
                    {billLogs.map((log) => (
                      <div key={log.id} className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background bg-primary"></div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                          <div>
                            <p className="font-medium text-sm">
                              {log.action === "CREATED" && "สร้างรายการบิล"}
                              {log.action === "UPDATED" && "แก้ไขข้อมูลบิล"}
                              {log.action === "AUDITED" && "ตรวจสอบ/ประเมินบิล"}
                              {log.action === "ARCHIVED" && "ย้ายไปเก็บถาวร"}
                              {log.action === "RESTORED" && "กู้คืนเข้าสู่ระบบ"}
                              {!["CREATED", "UPDATED", "AUDITED", "ARCHIVED", "RESTORED"].includes(
                                log.action,
                              ) && log.action}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {log.details}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap text-right">
                            <p>
                              {format(
                                new Date(log.createdAt),
                                "dd/MM/yyyy HH:mm",
                              )}
                            </p>
                            <p className="mt-1 font-medium">
                              {log.userName || "ไม่ทราบชื่อผู้ใช้"}
                            </p>
                            {log.departmentName && (
                              <p className="opacity-80">
                                {log.departmentName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex gap-2 justify-end pt-4 border-t mt-6">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            ปิดหน้าต่าง
          </Button>

          {bill &&
            canReview &&
            (bill.isReviewed ? (
              <Button
                variant="outline"
                onClick={onUnreview}
                disabled={isPending}
                className="border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              >
                ยกเลิกการตรวจรับรอง
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={onReview}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> ตรวจสอบแล้ว
              </Button>
            ))}

          {bill &&
            canFlag &&
            (bill.isManualAnomaly ? (
              <Button
                variant="outline"
                onClick={onUnflag}
                disabled={isPending}
                className="border-muted-foreground/30 text-muted-foreground hover:bg-muted"
              >
                <Flag className="mr-2 h-4 w-4" /> ยกเลิกการปักธง
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => onFlag && onFlag(bill)}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Flag className="mr-2 h-4 w-4" /> ระบุว่าผิดปกติ
              </Button>
            ))}
          {bill && (
            <Link
              href={`/bills/${bill.id}/edit`}
              className={buttonVariants({ variant: "default" })}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> อัพเดทข้อมูลบิลนี้
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

