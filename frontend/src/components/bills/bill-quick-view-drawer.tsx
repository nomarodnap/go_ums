"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VisxSparkline } from "@/components/charts/visx-sparkline";
import { RiveStatusIndicator } from "@/components/ui/rive-status-indicator";
import {
  Zap,
  Droplet,
  Phone,
  Wifi,
  Mail,
  FileText,
  Calendar,
  CreditCard,
  Building2,
  Receipt,
  FileEdit,
  CheckCircle2,
  Flag,
  ExternalLink,
} from "lucide-react";

interface BillQuickViewDrawerProps {
  bill: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: string;
  onReview?: () => void;
  onFlag?: () => void;
  isPending?: boolean;
}

export function BillQuickViewDrawer({
  bill,
  open,
  onOpenChange,
  userRole,
  onReview,
  onFlag,
  isPending,
}: BillQuickViewDrawerProps) {
  if (!bill) return null;

  const getUtilityIcon = (type: string) => {
    switch (type) {
      case "ค่าไฟฟ้า":
        return <Zap className="h-5 w-5 text-amber-500" />;
      case "ค่าประปา&น้ำบาดาล":
        return <Droplet className="h-5 w-5 text-blue-500" />;
      case "ค่าโทรศัพท์":
        return <Phone className="h-5 w-5 text-emerald-500" />;
      case "ค่าสื่อสาร&โทรคมนาคม":
        return <Wifi className="h-5 w-5 text-purple-500" />;
      case "ค่าบริการไปรษณีย์":
        return <Mail className="h-5 w-5 text-orange-500" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getMonthName = (monthNum: number) => {
    const d = new Date();
    d.setMonth(monthNum - 1);
    return format(d, "MMM", { locale: th });
  };

  const invAmount = parseFloat(bill.invoiceAmount || "0") || 0;
  // Generate sample trend data based on current amount for Visx sparkline
  const trendData = [
    Math.max(0, invAmount * 0.85),
    Math.max(0, invAmount * 1.1),
    Math.max(0, invAmount * 0.95),
    Math.max(0, invAmount * 1.05),
    Math.max(0, invAmount * 0.9),
    invAmount,
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-2xl mx-auto p-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-t border-border shadow-2xl">
        <div className="p-6 overflow-y-auto max-h-[82vh] space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                {getUtilityIcon(bill.utilityType)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                    {bill.billCode || "ไม่มีรหัสบิล"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    รอบบิล {getMonthName(bill.billingMonth)} {bill.billingYear + 543}
                  </span>
                </div>
                <DrawerTitle className="text-xl font-bold mt-1 text-foreground">
                  {bill.departmentName || "ไม่ระบุหน่วยงาน"}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground mt-0.5">
                  {bill.utilityType} • เครื่องวัด: {bill.serviceNumber || "ไม่มี"}
                </DrawerDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {bill.isReviewed && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                  <RiveStatusIndicator size={18} status="success" />
                  <span>ตรวจแล้ว</span>
                </div>
              )}
              {bill.paymentStatus === "PAID" ? (
                <Badge variant="success" className="text-xs py-1 px-3">
                  เบิกจ่ายแล้ว
                </Badge>
              ) : bill.paymentStatus === "WAITING" ? (
                <Badge variant="outline" className="text-xs py-1 px-3">
                  รอใบแจ้งหนี้
                </Badge>
              ) : (
                <Badge variant="warning" className="text-xs py-1 px-3">
                  ค้างชำระ
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Metrics Grid with Visx Sparkline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <span className="text-xs text-muted-foreground font-medium">
                ยอดตามใบแจ้งหนี้
              </span>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                ฿{invAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-muted-foreground">
                INV: {bill.invoiceNumber || "-"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <span className="text-xs text-muted-foreground font-medium">
                ยอดเบิกจ่ายจริง
              </span>
              <p className="text-2xl font-bold tracking-tight text-emerald-500">
                ฿{(parseFloat(bill.paidAmount || "0") || 0).toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <span className="text-[11px] text-muted-foreground">
                {bill.paymentDocNumber ? `เลขที่ ${bill.paymentDocNumber}` : "ยังไม่มีเอกสาร"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  แนวโน้ม 6 เดือน
                </span>
                <span className="text-[10px] text-primary font-mono">Visx SVG</span>
              </div>
              <div className="pt-2">
                <VisxSparkline data={trendData} width={150} height={36} />
              </div>
            </div>
          </div>

          {/* Bill Specifications */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-muted/40 border border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-xs text-muted-foreground block">ผู้ให้บริการ</span>
              <span className="font-medium mt-0.5 block">{bill.provider || "-"}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-xs text-muted-foreground block">รหัสงบประมาณ</span>
              <span className="font-medium mt-0.5 block">{bill.budgetCode || "-"}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-xs text-muted-foreground block">วันที่ลงรับใบแจ้งหนี้</span>
              <span className="font-medium mt-0.5 block">
                {bill.receivedDate
                  ? format(new Date(bill.receivedDate), "dd/MM/yyyy")
                  : "-"}
              </span>
            </div>
          </div>

          {/* Attachments Section if present */}
          {(bill.attachmentInvoice || bill.attachmentReceipt) && (
            <div className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                เอกสารแนบ
              </span>
              <div className="flex flex-wrap gap-2">
                {bill.attachmentInvoice && (
                  <a
                    href={bill.attachmentInvoice}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>ใบแจ้งหนี้ (Invoice)</span>
                  </a>
                )}
                {bill.attachmentReceipt && (
                  <a
                    href={bill.attachmentReceipt}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>ใบเสร็จรับเงิน (Receipt)</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Audit Notes if any */}
          {bill.isManualAnomaly && bill.manualAnomalyReason && (
            <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 space-y-1">
              <span className="text-xs font-semibold text-red-500 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" /> ข้อสังเกตความผิดปกติ
              </span>
              <p className="text-xs text-red-400">{bill.manualAnomalyReason}</p>
            </div>
          )}
        </div>

        {/* Drawer Actions */}
        <div className="p-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-2">
          <DrawerClose asChild>
            <Button variant="ghost" size="sm" className="rounded-xl">
              ปิด
            </Button>
          </DrawerClose>

          <div className="flex items-center gap-2">
            {onFlag && (
              <Button
                variant="outline"
                size="sm"
                onClick={onFlag}
                disabled={isPending}
                className="rounded-xl text-red-500 border-red-500/20 hover:bg-red-500/10"
              >
                <Flag className="w-4 h-4 mr-1.5" />
                {bill.isManualAnomaly ? "แก้ไขการปักธง" : "ปักธงผิดปกติ"}
              </Button>
            )}

            {onReview && (
              <Button
                variant="default"
                size="sm"
                onClick={onReview}
                disabled={isPending}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {bill.isReviewed ? "ยกเลิกตรวจรับรอง" : "ตรวจรับรองเรียบร้อย"}
              </Button>
            )}

            <Link
              href={`/bills/${bill.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" }) + " rounded-xl"}
            >
              <FileEdit className="w-4 h-4 mr-1.5" />
              แก้ไข
            </Link>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
