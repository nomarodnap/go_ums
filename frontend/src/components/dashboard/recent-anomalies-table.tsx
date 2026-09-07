"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowUpRight, Zap, Droplet, Phone, Wifi, Mail } from "lucide-react";

export type RecentAnomaly = {
  id: string;
  departmentName: string | null;
  utilityType: string;
  billingMonth: number;
  billingYear: number;
  invoiceAmount: string | null;
  isManualAnomaly?: boolean | null;
  manualAnomalyReason?: string | null;
  isLateReceive?: boolean | null;
  isLatePayment?: boolean | null;
  isOverdueMoreThan2Months?: boolean | null;
  isDisbursementOver2Months?: boolean | null;
};

const THAI_MONTHS = [
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

export function RecentAnomaliesTable({
  anomalies,
}: {
  anomalies: RecentAnomaly[];
}) {
  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        ไม่พบรายการผิดปกติในช่วงนี้
      </div>
    );
  }

  const formatCurrency = (amount: string | null | undefined) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  };

  const getUtilityIcon = (type: string) => {
    switch (type) {
      case "ค่าไฟฟ้า":
        return <Zap className="size-3.5 text-amber-500" />;
      case "ค่าน้ำประปา":
      case "ค่าประปา&น้ำบาดาล":
        return <Droplet className="size-3.5 text-blue-500" />;
      case "ค่าโทรศัพท์":
        return <Phone className="size-3.5 text-emerald-500" />;
      case "ค่าบริการสื่อสารและโทรคมนาคม":
      case "ค่าสื่อสาร&โทรคมนาคม":
        return <Wifi className="size-3.5 text-purple-500" />;
      default:
        return <Mail className="size-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="overflow-hidden rounded-xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>หน่วยงาน</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>รอบบิล</TableHead>
            <TableHead className="text-right">ยอดชำระ</TableHead>
            <TableHead>ปัญหาที่พบ</TableHead>
            <TableHead className="w-[45px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anomalies.map((anomaly) => {
            const issues = [];
            if (anomaly.isManualAnomaly)
              issues.push(anomaly.manualAnomalyReason || "ผิดปกติ (ระบุเอง)");
            if (anomaly.isLateReceive) issues.push("ลงรับบิลล่าช้า");
            if (anomaly.isLatePayment) issues.push("จ่ายล่าช้า");
            if (anomaly.isOverdueMoreThan2Months) issues.push("ค้างชำระเกิน 2 เดือน");

            return (
              <TableRow key={anomaly.id} className="group">
                <TableCell
                  className="font-medium max-w-[200px] truncate text-foreground"
                  title={anomaly.departmentName || ""}
                >
                  {anomaly.departmentName || "ไม่ระบุ"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs text-foreground/90 font-medium">
                    {getUtilityIcon(anomaly.utilityType)}
                    <span>{anomaly.utilityType}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {THAI_MONTHS[anomaly.billingMonth - 1] || "—"}{" "}
                  {anomaly.billingYear ? anomaly.billingYear + 543 : ""}
                </TableCell>
                <TableCell className="text-right font-semibold text-xs text-foreground">
                  {formatCurrency(anomaly.invoiceAmount)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {issues.length > 0 ? (
                      issues.map((issue, idx) => (
                        <Badge
                          key={idx}
                          variant="destructive"
                          className="text-[10px] h-5 px-2 font-normal"
                        >
                          {issue}
                        </Badge>
                      ))
                    ) : (
                      <Badge
                        variant="destructive"
                        className="text-[10px] h-5 px-2 font-normal"
                      >
                        ผิดปกติ
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Link
                    href="/bills"
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    <ArrowUpRight className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
