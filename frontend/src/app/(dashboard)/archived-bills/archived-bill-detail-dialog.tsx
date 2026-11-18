"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Building2,
  Receipt,
  CalendarClock,
  Banknote,
  Clock,
  CheckCircle2,
  Zap,
  Droplet,
  Phone,
  Wifi,
  Mail,
  Archive,
} from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  getBillLogs,
  type ArchivedBillItem,
  type BillDeletionLogItem,
} from "@/server/actions/bills";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const THAI_MONTHS_SHORT = [
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

interface ArchivedBillDetailDialogProps {
  bill: ArchivedBillItem | null;
  deletionLogs: BillDeletionLogItem[];
  onClose: () => void;
}

function getUtilityIcon(type: string) {
  switch (type) {
    case "ค่าไฟฟ้า":
      return <Zap className="h-4 w-4 text-yellow-500" />;
    case "ค่าประปา&น้ำบาดาล":
      return <Droplet className="h-4 w-4 text-blue-500" />;
    case "ค่าโทรศัพท์":
      return <Phone className="h-4 w-4 text-green-500" />;
    case "ค่าสื่อสาร&โทรคมนาคม":
      return <Wifi className="h-4 w-4 text-purple-500" />;
    case "ค่าบริการไปรษณีย์":
      return <Mail className="h-4 w-4 text-orange-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatBeYear(year?: number) {
  if (!year) return "";
  return year < 2400 ? year + 543 : year;
}

function formatDateValue(raw: unknown) {
  if (typeof raw !== "string" || !raw) return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "-";
  return format(d, "dd/MM/yyyy");
}

function getStr(
  data: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const val = data?.[key];
  return typeof val === "string" && val.trim() !== "" ? val.trim() : null;
}

function getNum(
  data: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const val = data?.[key];
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

interface BillActivityLog {
  id: string;
  action: string;
  details?: string | null;
  createdAt: string;
  userName?: string | null;
  departmentName?: string | null;
}

export function ArchivedBillDetailDialog({
  bill,
  deletionLogs,
  onClose,
}: ArchivedBillDetailDialogProps) {
  const [billLogs, setBillLogs] = useState<BillActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    let active = true;
    if (bill?.id) {
      setIsLoadingLogs(true);
      getBillLogs(bill.id)
        .then((logs) => {
          if (!active) return;
          setBillLogs(Array.isArray(logs) ? (logs as BillActivityLog[]) : []);
        })
        .catch(() => {
          if (!active) return;
          setBillLogs([]);
        })
        .finally(() => {
          if (active) setIsLoadingLogs(false);
        });
    } else {
      setBillLogs([]);
      setIsLoadingLogs(false);
    }
    return () => {
      active = false;
    };
  }, [bill?.id]);

  const d = bill?.billData;
  const invoiceStatus = getStr(d, "invoice_status") || "RECEIVED";
  const invoiceNumber = getStr(d, "invoice_number") || bill?.invoiceNumber;
  const invoiceDate = d?.invoice_date;
  const receivedDate = d?.received_date;
  const sentToDisbursingDate = d?.sent_to_disbursing_date;
  const disbursingReceivedDate = d?.disbursing_received_date;
  const usageAmount = getNum(d, "usage_amount");
  const estimatedAmount = getNum(d, "estimated_amount");
  const locationType = getStr(d, "location_type");
  const isPendingBillOnly = Boolean(d?.is_pending_bill_only);
  const depositUnitId = getStr(d, "deposit_unit_id") || bill?.depositUnitId;
  const paidAmount = getNum(d, "paid_amount");
  const paymentDate = d?.payment_date;
  const paymentDocNumber = getStr(d, "payment_doc_number");
  const docType = getStr(d, "doc_type");
  const accountCode = getStr(d, "account_code");
  const budgetCode = getStr(d, "budget_code");

  const attachmentInvoice = getStr(d, "attachment_invoice");
  const attachmentReceipt = getStr(d, "attachment_receipt");
  const attachmentPaymentDoc = getStr(d, "attachment_payment_doc");
  const attachmentDirectPayment = getStr(d, "attachment_direct_payment");
  const attachmentKtbReport = getStr(d, "attachment_ktb_report");

  const auditStatus = getStr(d, "audit_status");
  const isReviewed = Boolean(d?.is_reviewed);
  const reviewedBy = getStr(d, "reviewed_by");
  const reviewedAt = getStr(d, "reviewed_at");
  const manualAnomalyReason = getStr(d, "manual_anomaly_reason");
  const manualAnomalyDetail = getStr(d, "manual_anomaly_detail");

  const hasPaymentDetails =
    bill?.paymentStatus === "PAID" ||
    Boolean(
      attachmentReceipt ||
        attachmentDirectPayment ||
        attachmentKtbReport ||
        attachmentPaymentDoc,
    );

  let breakdownEntries: [string, unknown][] = [];
  const rawBreakdown = d?.service_breakdown;
  if (rawBreakdown) {
    try {
      const parsed =
        typeof rawBreakdown === "string"
          ? JSON.parse(rawBreakdown)
          : rawBreakdown;
      if (parsed && typeof parsed === "object") {
        breakdownEntries = Object.entries(parsed as Record<string, unknown>);
      }
    } catch {
      breakdownEntries = [];
    }
  }

  const fallbackDeletionLogs: BillActivityLog[] = bill
    ? deletionLogs
        .filter((l) => l.billId === bill.id)
        .map((l) => ({
          id: l.id,
          action: l.action,
          details: l.reason || null,
          createdAt: l.createdAt,
          userName: l.performedByName || l.performedBy,
          departmentName: l.departmentName || null,
        }))
    : [];

  const displayLogs = billLogs.length > 0 ? billLogs : fallbackDeletionLogs;

  return (
    <Dialog
      open={bill !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            รายละเอียดรายการค่าใช้จ่าย
          </DialogTitle>
          <DialogDescription>
            ข้อมูลบิลประจำเดือน{" "}
            {bill && (THAI_MONTHS_SHORT[bill.billingMonth] || bill.billingMonth)}{" "}
            {bill && formatBeYear(bill.billingYear)}
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
                        {bill.departmentName || bill.departmentId || "-"}
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
                        {isPendingBillOnly ? "หน่วยฝากเบิก" : "หน่วยเบิกจ่าย"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        ฝากเบิกกับหน่วยงาน
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {isPendingBillOnly
                          ? bill.depositUnitName || depositUnitId || "-"
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
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((sn) => (
                              <Badge
                                key={sn}
                                variant="secondary"
                                className="px-3 py-1 text-sm bg-muted text-foreground"
                              >
                                {sn}
                              </Badge>
                            ))
                        ) : (
                          <p className="bg-muted/50 p-2 rounded-md w-full">-</p>
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
                          {locationType || "-"}
                        </p>
                      </div>
                    )}
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        รอบบิลประจำเดือน
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md">
                        {bill.billingMonth && bill.billingYear
                          ? `${THAI_MONTHS_SHORT[bill.billingMonth] || bill.billingMonth} ${formatBeYear(bill.billingYear)}`
                          : "-"}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        ค่าใช้จ่ายโดยประมาณการ
                      </p>
                      <p className="bg-muted/50 p-2 rounded-md text-muted-foreground italic">
                        {estimatedAmount !== null
                          ? estimatedAmount.toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "(คำนวณอัตโนมัติในฟอร์ม)"}
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
                          invoiceStatus === "RECEIVED" ? "default" : "outline"
                        }
                        className="mt-1 w-fit"
                      >
                        {invoiceStatus === "RECEIVED"
                          ? "ได้รับใบแจ้งหนี้แล้ว"
                          : "ยังไม่ได้รับใบแจ้งหนี้"}
                      </Badge>
                    </div>

                    {(invoiceStatus === "RECEIVED" ||
                      Boolean(attachmentInvoice)) && (
                      <>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่ใบแจ้งหนี้
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {formatDateValue(invoiceDate)}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่ลงรับใบแจ้งหนี้
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {formatDateValue(receivedDate)}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่หน่วยฝากเบิกส่งเอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {formatDateValue(sentToDisbursingDate)}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่หน่วยเบิกจ่ายลงรับใบสำคัญ
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {formatDateValue(disbursingReceivedDate)}
                          </p>
                        </div>

                        {breakdownEntries.length > 0 && (
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
                                  {breakdownEntries.length} หมายเลข
                                </Badge>
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                              {breakdownEntries.map(([num, amt]) => {
                                const numVal = parseFloat(String(amt));
                                return (
                                  <div
                                    key={num}
                                    className="bg-background p-2.5 rounded-md border text-xs flex flex-col justify-between shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="text-muted-foreground font-medium truncate">
                                        หมายเลข:{" "}
                                        <span className="text-foreground font-semibold">
                                          {num}
                                        </span>
                                      </span>
                                    </div>
                                    <div className="mt-1">
                                      <div className="flex items-baseline justify-between">
                                        <span className="text-[11px] text-muted-foreground">
                                          ยอดตามบิล:
                                        </span>
                                        <span className="text-primary font-semibold text-sm">
                                          {!Number.isNaN(numVal)
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
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            รวมเป็นจำนวนเงิน (บาท)
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-primary font-semibold text-lg">
                            {bill.invoiceAmount
                              ? Number(bill.invoiceAmount).toLocaleString(
                                  "th-TH",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            ปริมาณการใช้
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {usageAmount !== null
                              ? usageAmount.toLocaleString("th-TH")
                              : "-"}
                          </p>
                        </div>
                        <div className="grid gap-1 md:col-span-2">
                          <p className="text-muted-foreground text-sm font-medium">
                            เลขที่ใบแจ้งหนี้ (Invoice)
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {invoiceNumber || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1 md:col-span-2">
                          <p className="text-muted-foreground text-sm font-medium">
                            เอกสารใบแจ้งหนี้
                          </p>
                          {attachmentInvoice ? (
                            <a
                              href={attachmentInvoice}
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
                            ? "default"
                            : "secondary"
                        }
                        className={`mt-1 w-fit ${bill.paymentStatus === "PAID" ? "bg-green-600 hover:bg-green-700" : ""}`}
                      >
                        {bill.paymentStatus === "PAID"
                          ? "เบิกจ่ายแล้ว"
                          : "ยังไม่ได้เบิกจ่าย"}
                      </Badge>
                    </div>

                    {hasPaymentDetails && (
                      <>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            วันที่เอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {formatDateValue(paymentDate)}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            รหัสงบประมาณ
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {budgetCode || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            เลขเอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {paymentDocNumber || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            ประเภทเอกสาร
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {docType || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            รหัสแยกประเภท
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {accountCode || "-"}
                          </p>
                        </div>
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            จำนวนเงินที่เบิกจ่าย (บาท)
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md text-green-600 font-semibold text-lg">
                            {paidAmount !== null
                              ? paidAmount.toLocaleString("th-TH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "-"}
                          </p>
                        </div>

                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            ใบเสร็จรับเงิน
                          </p>
                          {attachmentReceipt ? (
                            <a
                              href={attachmentReceipt}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-green-600"
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
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            รายงานจ่ายตรง / รายงาน KTB
                          </p>
                          {attachmentDirectPayment || attachmentKtbReport ? (
                            <div className="flex flex-wrap gap-2">
                              {attachmentDirectPayment && (
                                <a
                                  href={attachmentDirectPayment}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-orange-600"
                                >
                                  <FileText className="h-4 w-4" />
                                  <span className="text-sm font-medium">
                                    {attachmentKtbReport
                                      ? "ดูรายงานจ่ายตรง"
                                      : "ดูไฟล์เอกสาร"}
                                  </span>
                                </a>
                              )}
                              {attachmentKtbReport && (
                                <a
                                  href={attachmentKtbReport}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-orange-600"
                                >
                                  <FileText className="h-4 w-4" />
                                  <span className="text-sm font-medium">
                                    {attachmentDirectPayment
                                      ? "ดูรายงาน KTB"
                                      : "ดูไฟล์เอกสาร"}
                                  </span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="bg-muted/50 p-2 rounded-md text-muted-foreground">
                              -
                            </p>
                          )}
                        </div>
                        {attachmentPaymentDoc && (
                          <div className="grid gap-1 md:col-span-2">
                            <p className="text-muted-foreground text-sm font-medium">
                              เอกสารเบิกจ่าย
                            </p>
                            <a
                              href={attachmentPaymentDoc}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-indigo-600"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                ดูไฟล์เอกสาร
                              </span>
                            </a>
                          </div>
                        )}
                      </>
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
                      {auditStatus === "PENDING_RECHECK" ? (
                        <div className="flex flex-col gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 w-fit text-sm font-medium"
                          >
                            รอตรวจสอบใหม่
                          </Badge>
                          {manualAnomalyDetail && (
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                              {manualAnomalyDetail}
                            </p>
                          )}
                        </div>
                      ) : auditStatus === "PENDING_CORRECTION" ? (
                        <div className="flex flex-col gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-700 w-fit text-sm"
                          >
                            พบข้อสังเกต (รอแก้ไข)
                          </Badge>
                          {(manualAnomalyReason || manualAnomalyDetail) && (
                            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-amber-900 mt-1 text-sm">
                              {manualAnomalyReason && (
                                <p className="font-medium">
                                  {manualAnomalyReason}
                                </p>
                              )}
                              {manualAnomalyDetail && (
                                <p className="text-xs mt-1 whitespace-pre-line">
                                  {manualAnomalyDetail}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start mt-1">
                          <Badge
                            variant={
                              !auditStatus || auditStatus === "CORRECTED"
                                ? "secondary"
                                : "outline"
                            }
                            className={`w-fit text-sm ${
                              !auditStatus
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {!auditStatus ? "ปกติ" : "แก้ไขแล้ว"}
                          </Badge>
                        </div>
                      )}
                      {isReviewed && (
                        <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                          ตรวจสอบแล้ว
                          {reviewedBy ? ` โดย ${reviewedBy}` : ""}
                          {reviewedAt &&
                            ` เมื่อ ${format(
                              new Date(reviewedAt),
                              "dd MMM yy HH:mm",
                              { locale: th },
                            )}`}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-1">
                      <p className="text-muted-foreground text-sm font-medium">
                        สถานะคลังเก็บถาวร (Archived)
                      </p>
                      <div className="flex flex-col gap-1 mt-1">
                        <Badge
                          variant="outline"
                          className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 w-fit text-sm"
                        >
                          <Archive className="h-3.5 w-3.5 mr-1" />
                          ย้ายไปเก็บถาวรแล้ว
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          โดย {bill.archivedByName || bill.archivedBy} เมื่อ{" "}
                          {format(
                            new Date(bill.archivedAt),
                            "d MMM yyyy HH:mm น.",
                            { locale: th },
                          )}
                        </p>
                        {bill.archiveReason && (
                          <p className="text-xs text-muted-foreground">
                            เหตุผล: {bill.archiveReason}
                          </p>
                        )}
                      </div>
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
                ) : displayLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Clock className="h-8 w-8 mb-2 opacity-20" />
                    <p>ไม่มีประวัติการทำรายการ</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-muted ml-3 space-y-6">
                    {displayLogs.map((log) => (
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
                              {log.action === "PERMANENTLY_DELETED" &&
                                "ลบรายการถาวร"}
                              {![
                                "CREATED",
                                "UPDATED",
                                "AUDITED",
                                "ARCHIVED",
                                "RESTORED",
                                "PERMANENTLY_DELETED",
                              ].includes(log.action) && log.action}
                            </p>
                            {log.details && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {log.details}
                              </p>
                            )}
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
                              <p className="opacity-80">{log.departmentName}</p>
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
          <Button variant="outline" onClick={onClose}>
            ปิดหน้าต่าง
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
