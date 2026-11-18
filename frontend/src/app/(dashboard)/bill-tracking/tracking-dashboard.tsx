"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Search,
  Calendar,
  AlertCircle,
  FileQuestion,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flag,
  ShieldCheck,
  ShieldAlert,
  CheckCheck,
  X,
  Loader2,
  Layers,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Trash2,
  Zap,
  Droplet,
  Phone,
  Wifi,
  Mail,
  FileText,
} from "lucide-react";
import type {
  BillTrackingItemDTO,
  BillTrackingSummaryDTO,
  BillDTO,
} from "@/lib/api/generated/model";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import {
  getBill,
  getGetBillTrackingQueryKey,
} from "@/lib/api/generated/bills/bills";

import { deleteBill, markBillAsReviewed } from "@/server/actions/bills";
import { flagManualAnomaly, unflagManualAnomaly } from "@/server/actions/audits";
import { useListDepartmentServices } from "@/lib/api/generated/departments/departments";
import { BillDetailDialog } from "@/components/bills/bill-detail-dialog";
import { canReviewBills, canFlagAnomaly } from "@/lib/permissions";
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SortableHeader, useTableSort } from "@/components/ui/sortable-header";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { exportToExcel } from "@/lib/excel-export";

const THAI_MONTHS = [
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

const STATUS_CONFIG = {
  UNRECORDED: {
    label: "ยังไม่ได้บันทึก",
    color: "#f43f5e",
    variant: "destructive" as const,
  },
  NOT_RECEIVED: {
    label: "ยังไม่ได้รับใบแจ้งหนี้",
    color: "#f97316",
    variant: "warning" as const,
  },
  PENDING_PAYMENT: {
    label: "ยังไม่ได้เบิกจ่าย",
    color: "#eab308",
    variant: "secondary" as const,
  },
  PAID: {
    label: "เบิกจ่ายแล้ว",
    color: "#10b981",
    variant: "success" as const,
  },
  UNKNOWN: {
    label: "ไม่ทราบสถานะ",
    color: "#6b7280",
    variant: "outline" as const,
  },
};

const AUDIT_COLORS = {
  NORMAL: "#10b981",
  ANOMALY: "#f59e0b",
  MANUAL: "#f43f5e",
  CORRECTED: "#3b82f6",
};

const UTILITY_OPTIONS = [
  "ค่าไฟฟ้า",
  "ค่าประปา&น้ำบาดาล",
  "ค่าโทรศัพท์",
  "ค่าสื่อสาร&โทรคมนาคม",
  "ค่าบริการไปรษณีย์",
];

const UTILITY_FILTER_LABELS: Record<string, string> = {
  "ทุกประเภท": "ประเภท: ทั้งหมด",
  "ค่าไฟฟ้า": "ค่าไฟฟ้า",
  "ค่าประปา&น้ำบาดาล": "ค่าประปา&น้ำบาดาล",
  "ค่าโทรศัพท์": "ค่าโทรศัพท์",
  "ค่าสื่อสาร&โทรคมนาคม": "ค่าสื่อสาร&โทรคมนาคม",
  "ค่าบริการไปรษณีย์": "ค่าบริการไปรษณีย์",
};

const PAYMENT_FILTER_LABELS: Record<string, string> = {
  "ทุกสถานะ": "สถานะเบิกจ่าย: ทั้งหมด",
  UNRECORDED: "ยังไม่ได้บันทึก",
  NOT_RECEIVED: "ยังไม่ได้รับใบแจ้งหนี้",
  PENDING_PAYMENT: "ยังไม่ได้เบิกจ่าย",
  PAID: "เบิกจ่ายแล้ว",
  RECEIPT_RECEIVED: "ได้ใบเสร็จแล้ว",
};

const REVIEW_FILTER_LABELS: Record<string, string> = {
  "ทั้งหมด": "การตรวจรับรอง: ทั้งหมด",
  REVIEWED: "ตรวจสอบแล้ว",
  UNREVIEWED: "ยังไม่ได้ตรวจสอบ",
};

const AUDIT_FILTER_LABELS: Record<string, string> = {
  "ทั้งหมด": "ข้อสังเกต: ทั้งหมด",
  NORMAL: "ปกติ (ไม่พบข้อสังเกต)",
  ANOMALY_ISSUES: "พบข้อสังเกต",
  MANUAL_ANOMALY: "ระบุว่าผิดปกติ",
  PENDING_RECHECK: "รอตรวจสอบใหม่",
  CORRECTED: "แก้ไขแล้ว",
};

type DepartmentStat = {
  name: string;
  count: number;
  percentage: number;
};

type DepartmentBreakdown = {
  top: DepartmentStat[];
  othersCount: number;
  othersPercentage: number;
  total: number;
};

function getDepartmentBreakdown(
  filteredList: BillTrackingItemDTO[],
  limit = 5
): DepartmentBreakdown {
  const total = filteredList.length;
  if (total === 0) {
    return { top: [], othersCount: 0, othersPercentage: 0, total: 0 };
  }

  const map = new Map<string, number>();
  for (const item of filteredList) {
    const dept = item.departmentName?.trim() || "ไม่ระบุหน่วยงาน";
    map.set(dept, (map.get(dept) || 0) + 1);
  }

  const sorted = Array.from(map.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));

  const top = sorted.slice(0, limit);
  const topCountSum = top.reduce((acc, curr) => acc + curr.count, 0);
  const othersCount = total - topCountSum;
  const othersPercentage =
    othersCount > 0 ? Math.round((othersCount / total) * 1000) / 10 : 0;

  return { top, othersCount, othersPercentage, total };
}

function DepartmentBreakdownTooltip({
  title,
  unitLabel = "รายการ",
  breakdown,
  barColor,
  icon,
}: {
  title: string;
  unitLabel?: string;
  breakdown: DepartmentBreakdown;
  barColor: string;
  icon?: React.ReactNode;
}) {
  const { top, othersCount, othersPercentage, total } = breakdown;

  return (
    <div className="w-72 sm:w-80 space-y-2 py-0.5 text-left font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="text-xs font-semibold text-foreground truncate">
            {title}
          </span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground shrink-0 tabular-nums">
          ทั้งหมด <strong className="text-foreground font-semibold">{total.toLocaleString("th-TH")}</strong> {unitLabel}
        </span>
      </div>

      {/* Content */}
      {total === 0 ? (
        <div className="py-2.5 text-center text-xs text-muted-foreground">
          ไม่พบ{unitLabel}ในสถานะนี้
        </div>
      ) : (
        <div className="space-y-2 pt-0.5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            สัดส่วนตามหน่วยงาน (สูงสุด 5 อันดับแรก)
          </div>
          <div className="space-y-1.5">
            {top.map((dept, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span
                    className="truncate text-foreground/90 font-medium max-w-[170px] sm:max-w-[190px]"
                    title={dept.name}
                  >
                    {idx + 1}. {dept.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                    <span className="font-semibold text-foreground">{dept.count.toLocaleString("th-TH")}</span>{" "}
                    <span className="text-[10px]">({dept.percentage.toFixed(1)}%)</span>
                  </span>
                </div>
                {/* Mini progress bar */}
                <div className="h-1.5 w-full rounded-full bg-secondary/80 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", barColor)}
                    style={{ width: `${Math.min(100, Math.max(dept.percentage, 2))}%` }}
                  />
                </div>
              </div>
            ))}

            {othersCount > 0 && (
              <div className="space-y-0.5 pt-0.5">
                <div className="flex items-center justify-between text-xs gap-2 text-muted-foreground">
                  <span className="truncate italic max-w-[170px] sm:max-w-[190px]">
                    หน่วยงานอื่นๆ ({othersPercentage.toFixed(1)}%)
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums">
                    <span className="font-semibold">{othersCount.toLocaleString("th-TH")}</span>{" "}
                    <span className="text-[10px]">{unitLabel}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-muted-foreground/35 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(othersPercentage, 2))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TrackingDashboard({
  items = [],
  summary,
  month,
  year,
  onMonthChange,
  onYearChange,
  isLoading = false,
}: {
  items: BillTrackingItemDTO[];
  summary?: BillTrackingSummaryDTO;
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  isLoading?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [utilityFilter, setUtilityFilter] = useState<string>("ทุกประเภท");
  const [statusFilter, setStatusFilter] = useState<string>("ทุกสถานะ");
  const [reviewFilter, setReviewFilter] = useState<string>("ทั้งหมด");
  const [auditFilter, setAuditFilter] = useState<string>("ทั้งหมด");
  const [chartScope, setChartScope] = useState<"payment" | "audit">("payment");

  // Manage drawer, flag dialog, and delete dialog
  const [selectedBill, setSelectedBill] = useState<BillDTO | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [billToFlag, setBillToFlag] = useState<any | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagDetail, setFlagDetail] = useState("");
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: meRes } = useGetCurrentUser();
  const me = meRes?.status === 200 ? meRes.data.user : null;

  const { data: servicesRes } = useListDepartmentServices();
  const services = useMemo(
    () => (Array.isArray(servicesRes?.data) ? servicesRes.data : []),
    [servicesRes]
  );

  const canReview =
    canReviewBills({ role: me?.role, permissions: me?.permissions }, "/all-bills") ||
    canReviewBills({ role: me?.role, permissions: me?.permissions }, "/bills");

  const canFlag =
    canFlagAnomaly({ role: me?.role, permissions: me?.permissions }, "/all-bills") ||
    canFlagAnomaly({ role: me?.role, permissions: me?.permissions }, "/bills");

  const getUtilityIcon = (type: string) => {
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
  };

  const getMonthName = (monthNum: number) => {
    const d = new Date();
    d.setMonth(monthNum - 1);
    return format(d, "MMM", { locale: th });
  };

  const handleViewBill = async (billId: string, fallbackItem?: BillTrackingItemDTO) => {
    if (fallbackItem) {
      const fb = fallbackItem as any;
      setSelectedBill({
        id: billId,
        billCode: fb.billCode,
        departmentId: fb.departmentId,
        departmentName: fb.departmentName,
        departmentShortName: fb.departmentShortName,
        utilityType: fb.utilityType,
        serviceNumber: fb.serviceNumber,
        provider: fb.provider,
        invoiceAmount: fb.amount,
        paidAmount: fb.paidAmount,
        invoiceNumber: fb.invoiceNumber,
        paymentDocNumber: fb.paymentDocNumber,
        depositUnitName: fb.depositUnitName,
        isReviewed: fb.isReviewed,
        reviewedBy: fb.reviewedBy,
        reviewedAt: fb.reviewedAt,
        auditStatus: fb.auditStatus,
        isManualAnomaly: fb.isManualAnomaly,
        manualAnomalyReason: fb.manualAnomalyReason,
        manualAnomalyDetail: fb.manualAnomalyDetail,
        isLateReceive: fb.isLateReceive,
        isIncompleteReceiveDate: fb.isIncompleteReceiveDate,
        isLatePayment: fb.isLatePayment,
        isOverdueMoreThan2Months: fb.isOverdueMoreThan2Months,
        isWrongMonth: fb.isWrongMonth,
        isPhoneUsageOverLimit: fb.isPhoneUsageOverLimit,
        isPhoneOverLimit: fb.isPhoneOverLimit,
        isWrongBudget: fb.isWrongBudget,
        isDuplicate: fb.isDuplicate,
        auditIssues: fb.auditIssues,
        paymentStatus:
          fb.status === "PAID"
            ? "PAID"
            : fb.status === "NOT_RECEIVED"
            ? "WAITING"
            : "PENDING",
        billingMonth: month,
        billingYear: year,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPendingBillOnly: false,
        invoiceStatus:
          fb.status === "NOT_RECEIVED" ? "NOT_RECEIVED" : "RECEIVED",
      } as BillDTO);
      setIsViewDialogOpen(true);
    }
    setIsLoadingBill(true);
    try {
      const res = await getBill(billId);
      if (res?.data) {
        setSelectedBill(res.data);
        setIsViewDialogOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch full bill details", err);
      if (!fallbackItem) {
        toast.error("ไม่สามารถดึงข้อมูลรายละเอียดบิลได้");
      }
    } finally {
      setIsLoadingBill(false);
    }
  };

  const handleReviewBill = () => {
    if (!selectedBill) return;
    startTransition(async () => {
      const nextState = !selectedBill.isReviewed;
      const res = await markBillAsReviewed(selectedBill.id, nextState);
      if (res.success) {
        toast.success(
          nextState
            ? "บันทึกการตรวจสอบเรียบร้อยแล้ว"
            : "ยกเลิกการตรวจรับรองเรียบร้อยแล้ว"
        );
        setSelectedBill((prev) =>
          prev
            ? {
                ...prev,
                isReviewed: nextState,
                reviewedBy: nextState ? me?.name || me?.email || "ผู้ตรวจ" : undefined,
                reviewedAt: nextState ? new Date().toISOString() : undefined,
              }
            : null
        );
        queryClient.invalidateQueries({
          queryKey: getGetBillTrackingQueryKey({ month, year }),
        });
        router.refresh();
      } else {
        toast.error(res.error || "ไม่สามารถทำรายการได้");
      }
    });
  };

  const handleFlagManual = () => {
    if (!canFlag || !billToFlag || !flagReason.trim()) return;
    startTransition(async () => {
      const result = await flagManualAnomaly(billToFlag.id, flagReason, flagDetail);
      if (result.success) {
        toast.success("บันทึกความผิดปกติเรียบร้อยแล้ว");
        setBillToFlag(null);
        setFlagReason("");
        setFlagDetail("");
        setSelectedBill((prev) =>
          prev
            ? {
                ...prev,
                isManualAnomaly: true,
                manualAnomalyReason: flagReason,
                manualAnomalyDetail: flagDetail,
                auditStatus: "PENDING_CORRECTION",
              }
            : null
        );
        queryClient.invalidateQueries({
          queryKey: getGetBillTrackingQueryKey({ month, year }),
        });
        router.refresh();
      } else {
        toast.error(result.error || "ไม่สามารถบันทึกได้");
      }
    });
  };

  const handleUnflagManual = () => {
    if (!canFlag || !selectedBill) return;
    startTransition(async () => {
      const result = await unflagManualAnomaly(selectedBill.id);
      if (result.success) {
        toast.success("ยกเลิกการปักธงเรียบร้อยแล้ว");
        setSelectedBill((prev) =>
          prev
            ? {
                ...prev,
                isManualAnomaly: false,
                manualAnomalyReason: undefined,
                auditStatus: undefined,
              }
            : null
        );
        queryClient.invalidateQueries({
          queryKey: getGetBillTrackingQueryKey({ month, year }),
        });
        router.refresh();
      } else {
        toast.error(result.error || "ไม่สามารถยกเลิกได้");
      }
    });
  };

  const handleDeleteBill = () => {
    if (!billToDelete) return;
    if (!deleteReason.trim()) {
      toast.error("กรุณาระบุเหตุผลการลบรายการบิล");
      return;
    }
    startTransition(async () => {
      const res = await deleteBill(billToDelete, deleteReason.trim());
      if (res.success) {
        toast.success("ย้ายรายการบิลไปยังหน้า บิลที่เก็บถาวร (Archived) เรียบร้อยแล้ว");
        setBillToDelete(null);
        setDeleteReason("");
        queryClient.invalidateQueries({
          queryKey: getGetBillTrackingQueryKey({ month, year }),
        });
        router.refresh();
      } else {
        toast.error(res.error || "ไม่สามารถย้ายรายการไปเก็บถาวรได้");
      }
    });
  };

  const currentYearBE = new Date().getFullYear() + 543;
  const yearsBE = Array.from({ length: 5 }, (_, i) => currentYearBE - 2 + i);

  // Fallback summary computation if not passed
  const stats = useMemo(() => {
    const pendingItems = items.filter((d) => d.status === "PENDING_PAYMENT");
    const paidItems = items.filter((d) => d.status === "PAID");
    const pendingAmount = pendingItems.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const paidAmount = paidItems.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    if (summary) {
      return {
        ...summary,
        pendingAmount: summary.pendingAmount !== undefined ? summary.pendingAmount : pendingAmount,
        paidAmount: summary.paidAmount !== undefined ? summary.paidAmount : paidAmount,
      };
    }
    const billed = items.filter((d) => d.billId);
    return {
      total: items.length,
      unrecorded: items.filter((d) => d.status === "UNRECORDED").length,
      notReceived: items.filter((d) => d.status === "NOT_RECEIVED").length,
      pending: pendingItems.length,
      paid: paidItems.length,
      pendingAmount,
      paidAmount,
      reviewed: billed.filter((d) => d.isReviewed).length,
      unreviewed: billed.filter((d) => !d.isReviewed).length,
      normal: billed.filter((d) => !d.auditStatus || d.auditStatus === "NORMAL").length,
      anomalyIssues: billed.filter((d) => d.auditStatus === "PENDING_CORRECTION" && !d.isManualAnomaly).length,
      manualAnomaly: billed.filter((d) => d.auditStatus === "PENDING_CORRECTION" && d.isManualAnomaly).length,
      corrected: billed.filter((d) => d.auditStatus === "CORRECTED").length,
    };
  }, [items, summary]);

  const departmentBreakdowns = useMemo(() => {
    const unrecordedItems = items.filter((d) => d.status === "UNRECORDED");
    const notReceivedItems = items.filter((d) => d.status === "NOT_RECEIVED");
    const pendingItems = items.filter((d) => d.status === "PENDING_PAYMENT");
    const paidItems = items.filter((d) => d.status === "PAID");
    const billed = items.filter((d) => d.billId);

    const reviewedItems = billed.filter((d) => d.isReviewed);
    const unreviewedItems = billed.filter((d) => !d.isReviewed);
    const normalItems = billed.filter(
      (d) => !d.auditStatus || d.auditStatus === "NORMAL"
    );
    const anomalyIssuesItems = billed.filter(
      (d) => d.auditStatus === "PENDING_CORRECTION" && !d.isManualAnomaly
    );
    const manualAnomalyItems = billed.filter(
      (d) => d.auditStatus === "PENDING_CORRECTION" && d.isManualAnomaly
    );
    const correctedItems = billed.filter((d) => d.auditStatus === "CORRECTED");

    return {
      unrecorded: getDepartmentBreakdown(unrecordedItems),
      notReceived: getDepartmentBreakdown(notReceivedItems),
      pending: getDepartmentBreakdown(pendingItems),
      paid: getDepartmentBreakdown(paidItems),
      reviewed: getDepartmentBreakdown(reviewedItems),
      unreviewed: getDepartmentBreakdown(unreviewedItems),
      normal: getDepartmentBreakdown(normalItems),
      anomalyIssues: getDepartmentBreakdown(anomalyIssuesItems),
      manualAnomaly: getDepartmentBreakdown(manualAnomalyItems),
      corrected: getDepartmentBreakdown(correctedItems),
    };
  }, [items]);

  const totalBilled = Math.max(0, (stats.total || 0) - (stats.unrecorded || 0));
  const reviewedPct = totalBilled > 0 ? Math.round(((stats.reviewed || 0) / totalBilled) * 100) : 0;

  // Pie chart data: Payment status
  const paymentPieData = useMemo(
    () =>
      [
        {
          name: STATUS_CONFIG.UNRECORDED.label,
          value: stats.unrecorded,
          color: STATUS_CONFIG.UNRECORDED.color,
        },
        {
          name: STATUS_CONFIG.NOT_RECEIVED.label,
          value: stats.notReceived,
          color: STATUS_CONFIG.NOT_RECEIVED.color,
        },
        {
          name: STATUS_CONFIG.PENDING_PAYMENT.label,
          value: stats.pending,
          color: STATUS_CONFIG.PENDING_PAYMENT.color,
        },
        {
          name: STATUS_CONFIG.PAID.label,
          value: stats.paid,
          color: STATUS_CONFIG.PAID.color,
        },
      ].filter((d) => d.value > 0),
    [stats],
  );

  // Pie chart data: Audit & Review status
  const auditPieData = useMemo(
    () =>
      [
        {
          name: "ปกติ",
          value: stats.normal || 0,
          color: AUDIT_COLORS.NORMAL,
        },
        {
          name: "พบข้อสังเกต",
          value: stats.anomalyIssues || 0,
          color: AUDIT_COLORS.ANOMALY,
        },
        {
          name: "ระบุว่าผิดปกติ",
          value: stats.manualAnomaly || 0,
          color: AUDIT_COLORS.MANUAL,
        },
        {
          name: "แก้ไขแล้ว",
          value: stats.corrected || 0,
          color: AUDIT_COLORS.CORRECTED,
        },
      ].filter((d) => d.value > 0),
    [stats],
  );

  // Bar chart data: Payment status by utility type
  const paymentBarData = useMemo(() => {
    const utilityTypes = Array.from(new Set(items.map((d) => d.utilityType)));
    return utilityTypes.map((type) => {
      const bills = items.filter((d) => d.utilityType === type);
      return {
        name: type,
        ยังไม่ได้บันทึก: bills.filter((d) => d.status === "UNRECORDED").length,
        ยังไม่ได้รับใบแจ้งหนี้: bills.filter((d) => d.status === "NOT_RECEIVED").length,
        ยังไม่ได้เบิกจ่าย: bills.filter((d) => d.status === "PENDING_PAYMENT").length,
        เบิกจ่ายแล้ว: bills.filter((d) => d.status === "PAID").length,
      };
    });
  }, [items]);

  // Bar chart data: Audit status by utility type
  const auditBarData = useMemo(() => {
    const utilityTypes = Array.from(new Set(items.map((d) => d.utilityType)));
    return utilityTypes.map((type) => {
      const bills = items.filter((d) => d.utilityType === type && d.billId);
      return {
        name: type,
        ปกติ: bills.filter((d) => !d.auditStatus || d.auditStatus === "NORMAL").length,
        พบข้อสังเกต: bills.filter((d) => d.auditStatus === "PENDING_CORRECTION" && !d.isManualAnomaly).length,
        ระบุว่าผิดปกติ: bills.filter((d) => d.auditStatus === "PENDING_CORRECTION" && d.isManualAnomaly).length,
        แก้ไขแล้ว: bills.filter((d) => d.auditStatus === "CORRECTED").length,
      };
    });
  }, [items]);

  const availableUtilityTypes = useMemo(() => {
    const types = new Set<string>(UTILITY_OPTIONS);
    items.forEach((item) => {
      if (item.utilityType) types.add(item.utilityType);
    });
    return Array.from(types);
  }, [items]);

  // Filtered data
  const filteredData = useMemo(() => {
    return items.filter((item) => {
      // 0. Utility type filter
      const matchUtility =
        utilityFilter === "ทุกประเภท" ||
        item.utilityType === utilityFilter ||
        (utilityFilter === "ค่าประปา" && item.utilityType.includes("ประปา"));

      // 1. Payment status filter
      let matchStatus = true;
      if (statusFilter === "PAID") {
        const hasReceipt = Boolean(item.attachmentReceipt && item.attachmentReceipt.trim() !== "");
        matchStatus = item.status === "PAID" && !hasReceipt;
      } else if (statusFilter === "RECEIPT_RECEIVED") {
        const hasReceipt = Boolean(item.attachmentReceipt && item.attachmentReceipt.trim() !== "");
        matchStatus = item.status === "PAID" && hasReceipt;
      } else if (statusFilter !== "ทุกสถานะ") {
        matchStatus = item.status === statusFilter;
      }

      // 2. Review filter
      let matchReview = true;
      if (reviewFilter === "REVIEWED") {
        matchReview = !!item.billId && !!item.isReviewed;
      } else if (reviewFilter === "UNREVIEWED") {
        matchReview = !!item.billId && !item.isReviewed;
      }

      // 3. Audit filter
      let matchAudit = true;
      if (auditFilter === "NORMAL") {
        matchAudit = !!item.billId && (!item.auditStatus || item.auditStatus === "NORMAL");
      } else if (auditFilter === "ANOMALY_ISSUES") {
        matchAudit = !!item.billId && item.auditStatus === "PENDING_CORRECTION" && !item.isManualAnomaly;
      } else if (auditFilter === "MANUAL_ANOMALY") {
        matchAudit = !!item.billId && item.auditStatus === "PENDING_CORRECTION" && !!item.isManualAnomaly;
      } else if (auditFilter === "PENDING_RECHECK") {
        matchAudit = !!item.billId && item.auditStatus === "PENDING_RECHECK";
      } else if (auditFilter === "CORRECTED") {
        matchAudit = !!item.billId && item.auditStatus === "CORRECTED";
      }

      // 4. Search text
      const search = searchTerm.trim().toLowerCase();
      const matchSearch =
        search === "" ||
        item.departmentName.toLowerCase().includes(search) ||
        item.serviceNumber.toLowerCase().includes(search) ||
        item.utilityType.toLowerCase().includes(search) ||
        item.provider.toLowerCase().includes(search);

      return matchUtility && matchStatus && matchReview && matchAudit && matchSearch;
    });
  }, [items, utilityFilter, statusFilter, reviewFilter, auditFilter, searchTerm]);

  const { sortKey, sortOrder, handleSort, sortedData } = useTableSort(filteredData, {
    comparators: {
      department: (a, b) => {
        const nameA = `${a.departmentName || ""} ${a.utilityType || ""}`;
        const nameB = `${b.departmentName || ""} ${b.utilityType || ""}`;
        return nameA.localeCompare(nameB, "th");
      },
      billCode: (a, b) => {
        const codeA = `${a.billCode || ""} ${a.serviceNumber || ""}`;
        const codeB = `${b.billCode || ""} ${b.serviceNumber || ""}`;
        return codeA.localeCompare(codeB, "th", { numeric: true });
      },
      billingPeriod: (a, b) => {
        const codeA = a.billCode || "";
        const codeB = b.billCode || "";
        return codeA.localeCompare(codeB, "th", { numeric: true });
      },
      amount: (a, b) => {
        const valA = a.amount || a.paidAmount || 0;
        const valB = b.amount || b.paidAmount || 0;
        return valA - valB;
      },
      paymentStatus: (a, b) => {
        const getPriority = (item: any) => {
          if (item.status === "UNRECORDED") return 0;
          if (item.status === "NOT_RECEIVED") return 1;
          if (item.status === "PAID") {
            return (item.attachmentReceipt && item.attachmentReceipt.trim() !== "") ? 4 : 3;
          }
          return 2;
        };
        return getPriority(a) - getPriority(b);
      },
      auditStatus: (a, b) => {
        const issuesA = (a.auditIssues || []).length;
        const issuesB = (b.auditIssues || []).length;
        if (issuesA !== issuesB) return issuesA - issuesB;
        return (a.isReviewed ? 1 : 0) - (b.isReviewed ? 1 : 0);
      },
    },
  });

  const handleExportExcel = () => {
    const monthName = THAI_MONTHS[month - 1];
    const yearBE = year + 543;
    exportToExcel({
      filename: `ติดตามใบแจ้งหนี้_${monthName}_${yearBE}`,
      sheetName: `รอบ ${monthName} ${yearBE}`,
      data: sortedData,
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1, width: 8 },
        { header: "หน่วยงาน", transform: (d) => d.departmentName || "-", width: 28 },
        { header: "หน่วยเบิกจ่าย", transform: (d) => d.depositUnitName || "-", width: 26 },
        { header: "ประเภทสาธารณูปโภค", key: "utilityType", width: 20 },
        { header: "ผู้ให้บริการ", key: "provider", width: 18 },
        { header: "หมายเลขผู้ใช้/เครื่องวัด", key: "serviceNumber", width: 22 },
        { header: "รหัสรายงาน", transform: (d) => d.billCode || "-", width: 18 },
        { header: "เลขที่ใบแจ้งหนี้", transform: (d) => d.invoiceNumber || "-", width: 18 },
        { header: "รอบบิล", transform: () => `${monthName} ${yearBE}`, width: 16 },
        {
          header: "ยอดตามใบแจ้งหนี้ (บาท)",
          transform: (d) => (d.amount > 0 ? Number(d.amount) : "-"),
          width: 22,
        },
        {
          header: "ยอดเบิกจ่ายจริง (บาท)",
          transform: (d) => (d.paidAmount && d.paidAmount > 0 ? Number(d.paidAmount) : "-"),
          width: 22,
        },
        {
          header: "สถานะการเบิกจ่าย",
          transform: (d) => {
            if (d.status === "UNRECORDED") return "ยังไม่ได้บันทึก";
            if (d.status === "NOT_RECEIVED") return "ยังไม่ได้รับใบแจ้งหนี้";
            if (d.status === "PAID") {
              return d.attachmentReceipt && d.attachmentReceipt.trim() !== ""
                ? "ได้ใบเสร็จแล้ว"
                : "เบิกจ่ายแล้ว";
            }
            return "ยังไม่ได้เบิกจ่าย";
          },
          width: 20,
        },
        { header: "เลขที่เอกสารเบิกจ่าย", transform: (d) => d.paymentDocNumber || "-", width: 20 },
        {
          header: "สถานะการตรวจสอบ",
          transform: (d) =>
            d.auditStatus === "NORMAL"
              ? "ปกติ"
              : d.auditStatus === "PENDING_CORRECTION"
                ? "รอการแก้ไข"
                : d.auditStatus === "CORRECTED"
                  ? "แก้ไขแล้ว"
                  : d.auditStatus || "-",
          width: 18,
        },
        {
          header: "ข้อสังเกตความผิดปกติ",
          transform: (d) =>
            d.auditIssues && d.auditIssues.length > 0 ? d.auditIssues.join(", ") : "-",
          width: 32,
        },
        {
          header: "การตรวจรับรอง",
          transform: (d) => (d.isReviewed ? "ตรวจสอบแล้ว" : "ยังไม่ได้ตรวจสอบ"),
          width: 16,
        },
        { header: "ผู้ตรวจรับรอง", transform: (d) => d.reviewedBy || "-", width: 20 },
        {
          header: "วันที่ตรวจรับรอง",
          transform: (d) =>
            d.reviewedAt
              ? format(new Date(d.reviewedAt), "dd/MM/yyyy HH:mm", { locale: th })
              : "-",
          width: 20,
        },
      ],
    });
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    utilityFilter !== "ทุกประเภท" ||
    statusFilter !== "ทุกสถานะ" ||
    reviewFilter !== "ทั้งหมด" ||
    auditFilter !== "ทั้งหมด";

  const handleClearFilters = () => {
    setSearchTerm("");
    setUtilityFilter("ทุกประเภท");
    setStatusFilter("ทุกสถานะ");
    setReviewFilter("ทั้งหมด");
    setAuditFilter("ทั้งหมด");
  };

  return (
    <TooltipProvider delay={100}>
      <div className="space-y-6">
        {/* Month/Year Filter Card */}
        <div className="p-4 rounded-2xl bg-card/85 dark:bg-card/70 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Calendar className="size-4 text-primary" />
            <span>เลือกรอบบิลที่ต้องการติดตาม:</span>
            {isLoading && <Loader2 className="size-4 animate-spin text-primary ml-2" />}
          </div>
          <div className="flex items-center gap-2.5">
            <Select
              value={month.toString()}
              onValueChange={(val) => val && onMonthChange(parseInt(val, 10))}
            >
              <SelectTrigger className="w-[160px] h-9.5 rounded-xl text-xs">
                <SelectValue placeholder="เลือกเดือน">
                  {THAI_MONTHS[month - 1]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {THAI_MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={(year + 543).toString()}
              onValueChange={(val) => val && onYearChange(parseInt(val, 10) - 543)}
            >
              <SelectTrigger className="w-[110px] h-9.5 rounded-xl text-xs">
                <SelectValue placeholder="เลือกปี">
                  {year + 543}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {yearsBE.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Section 1: KPI Payment Progress */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              สถานะการบันทึกและเบิกจ่าย (Disbursement & Invoice Tracking)
            </h3>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.06 },
              },
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* 1. ยังไม่ได้บันทึก */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs h-full">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                          ยังไม่ได้บันทึก
                        </span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                          <AlertCircle className="size-4.5" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400 flex items-baseline">
                          <NumberFlow value={stats.unrecorded} />
                          <span className="text-sm font-normal text-muted-foreground ml-1.5">
                            รายการ
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          บริการที่คาดหวังแต่ยังไม่พบการบันทึกบิล
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="ยังไม่ได้บันทึก"
                    unitLabel="รายการ"
                    breakdown={departmentBreakdowns.unrecorded}
                    barColor="bg-rose-500"
                    icon={<AlertCircle className="size-3.5 text-rose-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>

            {/* 2. ยังไม่ได้รับใบแจ้งหนี้ */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs h-full">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                          ยังไม่ได้รับใบแจ้งหนี้
                        </span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                          <FileQuestion className="size-4.5" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 flex items-baseline">
                          <NumberFlow value={stats.notReceived} />
                          <span className="text-sm font-normal text-muted-foreground ml-1.5">
                            รายการ
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          บันทึกค้างจ่ายไว้ รอรับใบแจ้งหนี้/ใบเสร็จ
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="ยังไม่ได้รับใบแจ้งหนี้"
                    unitLabel="รายการ"
                    breakdown={departmentBreakdowns.notReceived}
                    barColor="bg-amber-500"
                    icon={<FileQuestion className="size-3.5 text-amber-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>

            {/* 3. ยังไม่ได้เบิกจ่าย */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs h-full">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                          ยังไม่ได้เบิกจ่าย
                        </span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                          <Clock className="size-4.5" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400 flex items-baseline">
                          <NumberFlow value={stats.pending} />
                          <span className="text-sm font-normal text-muted-foreground ml-1.5">
                            รายการ
                          </span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-baseline justify-between text-xs">
                          <span className="text-muted-foreground font-medium">รวมเป็นจำนวนเงิน:</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono flex items-baseline">
                            <NumberFlow
                              value={stats.pendingAmount || 0}
                              format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                            />
                            <span className="font-normal text-muted-foreground ml-1 text-[11px]">บาท</span>
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/80 mt-1.5">
                          ได้รับใบแจ้งหนี้แล้ว รอส่งเบิกจ่าย
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="ยังไม่ได้เบิกจ่าย"
                    unitLabel="รายการ"
                    breakdown={departmentBreakdowns.pending}
                    barColor="bg-blue-500"
                    icon={<Clock className="size-3.5 text-blue-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>

            {/* 4. เบิกจ่ายแล้ว */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs h-full">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                          เบิกจ่ายแล้ว
                        </span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                          <CheckCircle2 className="size-4.5" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 flex items-baseline">
                          <NumberFlow value={stats.paid} />
                          <span className="text-sm font-normal text-muted-foreground ml-1.5">
                            รายการ
                          </span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-baseline justify-between text-xs">
                          <span className="text-muted-foreground font-medium">รวมเป็นจำนวนเงิน:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono flex items-baseline">
                            <NumberFlow
                              value={stats.paidAmount || 0}
                              format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                            />
                            <span className="font-normal text-muted-foreground ml-1 text-[11px]">บาท</span>
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/80 mt-1.5">
                          ชำระเงินและมีเอกสารเบิกจ่ายครบถ้วน
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="เบิกจ่ายแล้ว"
                    unitLabel="รายการ"
                    breakdown={departmentBreakdowns.paid}
                    barColor="bg-emerald-500"
                    icon={<CheckCircle2 className="size-3.5 text-emerald-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>
          </motion.div>
        </div>

        {/* Section 2: KPI Audit & Review Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                สถานะการตรวจสอบและความถูกต้อง (Audit & Review Status)
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              บิลที่บันทึกแล้วทั้งหมด: <strong className="text-foreground">{totalBilled}</strong> รายการ
            </span>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05 },
              },
            }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5"
          >
            {/* 1. ตรวจสอบแล้ว */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
              }}
              className="h-full"
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-950/[0.1] shadow-xs h-full">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          ตรวจสอบแล้ว
                        </span>
                        <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 flex items-baseline">
                          <NumberFlow value={stats.reviewed || 0} />
                          <span className="text-xs font-normal text-emerald-600/80 ml-1">บิล</span>
                        </div>
                        <p className="text-[10px] text-emerald-600/90 dark:text-emerald-400/80 mt-0.5">
                          {reviewedPct}% ของบิลในระบบ
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="ตรวจสอบแล้ว"
                    unitLabel="บิล"
                    breakdown={departmentBreakdowns.reviewed}
                    barColor="bg-emerald-500"
                    icon={<ShieldCheck className="size-3.5 text-emerald-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>

            {/* 2. ยังไม่ได้ตรวจสอบ */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
              }}
              className="h-full"
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-slate-300/40 dark:border-slate-700/40 bg-slate-500/[0.03] dark:bg-slate-900/[0.2] shadow-xs h-full">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          ยังไม่ได้ตรวจสอบ
                        </span>
                        <Clock className="size-4 text-slate-500" />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-baseline">
                          <NumberFlow value={stats.unreviewed || 0} />
                          <span className="text-xs font-normal text-muted-foreground ml-1">บิล</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          รอการตรวจรับรอง
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="ยังไม่ได้ตรวจสอบ"
                    unitLabel="บิล"
                    breakdown={departmentBreakdowns.unreviewed}
                    barColor="bg-slate-500"
                    icon={<Clock className="size-3.5 text-slate-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>

            {/* 3. ปกติ */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
              }}
              className="h-full"
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 shadow-xs h-full">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground">
                          ปกติ
                        </span>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-foreground flex items-baseline">
                          <NumberFlow value={stats.normal || 0} />
                          <span className="text-xs font-normal text-muted-foreground ml-1">บิล</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          ไม่พบข้อสังเกต
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="ปกติ (ไม่พบข้อสังเกต)"
                    unitLabel="บิล"
                    breakdown={departmentBreakdowns.normal}
                    barColor="bg-emerald-500"
                    icon={<CheckCircle2 className="size-3.5 text-emerald-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>

            {/* 4. พบข้อสังเกต */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
              }}
              className="h-full"
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-amber-500/20 bg-amber-500/[0.03] dark:bg-amber-950/[0.1] shadow-xs h-full">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          พบข้อสังเกต
                        </span>
                        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-400 flex items-baseline">
                          <NumberFlow value={stats.anomalyIssues || 0} />
                          <span className="text-xs font-normal text-amber-600/80 ml-1">บิล</span>
                        </div>
                        <p className="text-[10px] text-amber-600/90 dark:text-amber-400/80 mt-0.5">
                          ตรวจพบโดยระบบ
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="พบข้อสังเกต"
                    unitLabel="บิล"
                    breakdown={departmentBreakdowns.anomalyIssues}
                    barColor="bg-amber-500"
                    icon={<AlertTriangle className="size-3.5 text-amber-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>

            {/* 5. ระบุว่าผิดปกติ */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
              }}
              className="h-full"
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-rose-500/20 bg-rose-500/[0.03] dark:bg-rose-950/[0.1] shadow-xs h-full">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                          ระบุว่าผิดปกติ
                        </span>
                        <Flag className="size-4 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-rose-700 dark:text-rose-400 flex items-baseline">
                          <NumberFlow value={stats.manualAnomaly || 0} />
                          <span className="text-xs font-normal text-rose-600/80 ml-1">บิล</span>
                        </div>
                        <p className="text-[10px] text-rose-600/90 dark:text-rose-400/80 mt-0.5">
                          ปักธงโดยผู้ตรวจ
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="ระบุว่าผิดปกติ"
                    unitLabel="บิล"
                    breakdown={departmentBreakdowns.manualAnomaly}
                    barColor="bg-rose-500"
                    icon={<Flag className="size-3.5 text-rose-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>

            {/* 6. แก้ไขแล้ว */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
              }}
              className="h-full"
            >
              <Tooltip>
                <TooltipTrigger render={<div className="h-full cursor-default" />}>
                  <Card className="apple-card-hover border-blue-500/20 bg-blue-500/[0.03] dark:bg-blue-950/[0.1] shadow-xs h-full">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                          แก้ไขแล้ว
                        </span>
                        <CheckCheck className="size-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400 flex items-baseline">
                          <NumberFlow value={stats.corrected || 0} />
                          <span className="text-xs font-normal text-blue-600/80 ml-1">บิล</span>
                        </div>
                        <p className="text-[10px] text-blue-600/90 dark:text-blue-400/80 mt-0.5">
                          แก้ไขเรียบร้อยแล้ว
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} align="center" className="p-3.5 block max-w-sm">
                  <DepartmentBreakdownTooltip
                    title="แก้ไขแล้ว"
                    unitLabel="บิล"
                    breakdown={departmentBreakdowns.corrected}
                    barColor="bg-blue-500"
                    icon={<CheckCheck className="size-3.5 text-blue-500" />}
                  />
                </TooltipContent>
              </Tooltip>
            </motion.div>
          </motion.div>
        </div>

        {/* Analytics Charts with Mode Switcher */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                  {chartScope === "payment" ? "สัดส่วนการเบิกจ่าย" : "สัดส่วนข้อผิดปกติ / การตรวจ"}
                </CardTitle>
                <CardDescription>
                  {chartScope === "payment" ? "ภาพรวมของสถานะบิลทั้งหมด" : "สัดส่วนความถูกต้องและข้อสังเกต"}
                </CardDescription>
              </div>
              <div className="inline-flex rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-0.5 border border-black/[0.04] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setChartScope("payment")}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer",
                    chartScope === "payment"
                      ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  การเบิกจ่าย
                </button>
                <button
                  type="button"
                  onClick={() => setChartScope("audit")}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer",
                    chartScope === "audit"
                      ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  การตรวจสอบ
                </button>
              </div>
            </CardHeader>
            <CardContent className="h-[280px]">
              {(chartScope === "payment" ? paymentPieData.length : auditPieData.length) === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  ไม่มีข้อมูลในรอบบิลนี้
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={chartScope === "payment" ? paymentPieData : auditPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="transparent"
                    >
                      {(chartScope === "payment" ? paymentPieData : auditPieData).map(
                        (entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        )
                      )}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value) => [`${value} รายการ`, "จำนวน"]}
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderRadius: "12px",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                {chartScope === "payment" ? "สถานะเบิกจ่ายแยกตามประเภท" : "สถานะการตรวจสอบแยกตามประเภท"}
              </CardTitle>
              <CardDescription>การแจกแจงตามประเภทสาธารณูปโภค</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {items.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  ไม่มีข้อมูลในรอบบิลนี้
                </div>
              ) : chartScope === "payment" ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={paymentBarData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis dataKey="name" className="text-[11px]" />
                    <YAxis allowDecimals={false} className="text-[11px]" />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderRadius: "12px",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="ยังไม่ได้บันทึก"
                      stackId="a"
                      fill={STATUS_CONFIG.UNRECORDED.color}
                    />
                    <Bar
                      dataKey="ยังไม่ได้รับใบแจ้งหนี้"
                      stackId="a"
                      fill={STATUS_CONFIG.NOT_RECEIVED.color}
                    />
                    <Bar
                      dataKey="ยังไม่ได้เบิกจ่าย"
                      stackId="a"
                      fill={STATUS_CONFIG.PENDING_PAYMENT.color}
                    />
                    <Bar
                      dataKey="เบิกจ่ายแล้ว"
                      stackId="a"
                      fill={STATUS_CONFIG.PAID.color}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={auditBarData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis dataKey="name" className="text-[11px]" />
                    <YAxis allowDecimals={false} className="text-[11px]" />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderRadius: "12px",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="ปกติ" stackId="b" fill={AUDIT_COLORS.NORMAL} />
                    <Bar dataKey="พบข้อสังเกต" stackId="b" fill={AUDIT_COLORS.ANOMALY} />
                    <Bar dataKey="ระบุว่าผิดปกติ" stackId="b" fill={AUDIT_COLORS.MANUAL} />
                    <Bar
                      dataKey="แก้ไขแล้ว"
                      stackId="b"
                      fill={AUDIT_COLORS.CORRECTED}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details Table Card */}
        <Card className="border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                    รายละเอียดรายการติดตาม ({filteredData.length} รายการ)
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    ตรวจสอบความคืบหน้ารายหน่วยงาน พร้อมสถานะการตรวจรับรองและข้อสังเกต
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <ExportExcelButton
                    onExport={handleExportExcel}
                    disabled={sortedData.length === 0}
                  />
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="mr-1.5 size-3.5" /> ล้างตัวกรองทั้งหมด
                    </Button>
                  )}
                </div>
              </div>

              {/* Multi-filter row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="ค้นหาหน่วยงาน, หมายเลข..."
                    className="pl-9 h-9.5 rounded-xl bg-background/60 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Utility Type filter */}
                <Select
                  value={utilityFilter}
                  onValueChange={(v) => v && setUtilityFilter(v)}
                >
                  <SelectTrigger className="h-9.5 rounded-xl text-xs bg-background/60">
                    <SelectValue placeholder="ประเภท: ทั้งหมด">
                      {UTILITY_FILTER_LABELS[utilityFilter] || utilityFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ทุกประเภท">ประเภท: ทั้งหมด</SelectItem>
                    {availableUtilityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-1.5">
                          {getUtilityIcon(type)}
                          <span>{type}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Payment filter */}
                <Select
                  value={statusFilter}
                  onValueChange={(v) => v && setStatusFilter(v)}
                >
                  <SelectTrigger className="h-9.5 rounded-xl text-xs bg-background/60">
                    <SelectValue placeholder="สถานะเบิกจ่าย: ทั้งหมด">
                      {PAYMENT_FILTER_LABELS[statusFilter] || "สถานะเบิกจ่าย: ทั้งหมด"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ทุกสถานะ">สถานะเบิกจ่าย: ทั้งหมด</SelectItem>
                    <SelectItem value="UNRECORDED">ยังไม่ได้บันทึก</SelectItem>
                    <SelectItem value="NOT_RECEIVED">ยังไม่ได้รับใบแจ้งหนี้</SelectItem>
                    <SelectItem value="PENDING_PAYMENT">ยังไม่ได้เบิกจ่าย</SelectItem>
                    <SelectItem value="PAID">เบิกจ่ายแล้ว</SelectItem>
                    <SelectItem value="RECEIPT_RECEIVED">ได้ใบเสร็จแล้ว</SelectItem>
                  </SelectContent>
                </Select>

                {/* Review filter */}
                <Select
                  value={reviewFilter}
                  onValueChange={(v) => v && setReviewFilter(v)}
                >
                  <SelectTrigger className="h-9.5 rounded-xl text-xs bg-background/60">
                    <SelectValue placeholder="การตรวจรับรอง: ทั้งหมด">
                      {REVIEW_FILTER_LABELS[reviewFilter] || "การตรวจรับรอง: ทั้งหมด"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ทั้งหมด">การตรวจรับรอง: ทั้งหมด</SelectItem>
                    <SelectItem value="REVIEWED">ตรวจสอบแล้ว</SelectItem>
                    <SelectItem value="UNREVIEWED">ยังไม่ได้ตรวจสอบ</SelectItem>
                  </SelectContent>
                </Select>

                {/* Audit filter */}
                <Select
                  value={auditFilter}
                  onValueChange={(v) => v && setAuditFilter(v)}
                >
                  <SelectTrigger className="h-9.5 rounded-xl text-xs bg-background/60">
                    <SelectValue placeholder="ข้อสังเกต: ทั้งหมด">
                      {AUDIT_FILTER_LABELS[auditFilter] || "ข้อสังเกต: ทั้งหมด"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ทั้งหมด">ข้อสังเกต: ทั้งหมด</SelectItem>
                    <SelectItem value="NORMAL">ปกติ (ไม่พบข้อสังเกต)</SelectItem>
                    <SelectItem value="ANOMALY_ISSUES">พบข้อสังเกต</SelectItem>
                    <SelectItem value="MANUAL_ANOMALY">ระบุว่าผิดปกติ</SelectItem>
                    <SelectItem value="PENDING_RECHECK">รอตรวจสอบใหม่</SelectItem>
                    <SelectItem value="CORRECTED">แก้ไขแล้ว</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader
                      className="w-[220px]"
                      sortKey="department"
                      currentSortKey={sortKey}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    >
                      หน่วยงาน / ประเภท
                    </SortableHeader>
                    <SortableHeader
                      sortKey="billCode"
                      currentSortKey={sortKey}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    >
                      รหัสรายงาน / เครื่องวัด
                    </SortableHeader>
                    <SortableHeader
                      sortKey="billingPeriod"
                      currentSortKey={sortKey}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    >
                      รอบบิล
                    </SortableHeader>
                    <SortableHeader
                      align="right"
                      sortKey="amount"
                      currentSortKey={sortKey}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    >
                      ยอดชำระ / เบิกจ่าย
                    </SortableHeader>
                    <SortableHeader
                      align="center"
                      sortKey="paymentStatus"
                      currentSortKey={sortKey}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    >
                      สถานะการเบิกจ่าย
                    </SortableHeader>
                    <SortableHeader
                      align="center"
                      sortKey="auditStatus"
                      currentSortKey={sortKey}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    >
                      สถานะตรวจสอบ
                    </SortableHeader>
                    <TableHead className="w-[80px] text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center h-36 text-muted-foreground text-sm"
                      >
                        <div className="flex flex-col items-center justify-center gap-2 py-4">
                          <p>ไม่มีข้อมูลค่าใช้จ่ายที่ตรงกับเงื่อนไข</p>
                          {hasActiveFilters && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleClearFilters}
                              className="h-8 rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer border-border/80"
                            >
                              <X className="size-3" />
                              ล้างตัวกรองทั้งหมด
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedData.map((item) => {
                      const isBilled = !!item.billId;

                      return (
                        <TableRow
                          key={item.id}
                          className="group transition-colors hover:bg-muted/40"
                        >
                          {/* 1. หน่วยงาน / ประเภท */}
                          <TableCell>
                            <div className="flex flex-col">
                              <span
                                className="font-medium text-foreground truncate max-w-[230px]"
                                title={item.departmentName || "ไม่ระบุหน่วยงาน"}
                              >
                                {item.departmentName || "ไม่ระบุหน่วยงาน"}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                <div className="flex items-center gap-1.5">
                                  {getUtilityIcon(item.utilityType)}
                                  <span>{item.utilityType}</span>
                                </div>
                                {item.depositUnitName && (
                                  <span
                                    className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/40 font-medium truncate max-w-[150px]"
                                    title={`ฝากเบิก: ${item.depositUnitName}`}
                                  >
                                    ฝากเบิก: {item.depositUnitName}
                                  </span>
                                )}
                                {!item.depositUnitName && item.provider && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ({item.provider})
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* 2. รหัสรายงาน / เครื่องวัด */}
                          <TableCell>
                            <div className="flex flex-col space-y-1">
                              {item.billCode && (
                                <span className="text-[11px] font-semibold text-primary mb-0.5 border border-primary/20 bg-primary/10 rounded-full px-2 py-0.5 w-fit">
                                  {item.billCode}
                                </span>
                              )}
                              {item.serviceNumber ? (
                                <span className="text-sm font-medium text-foreground">
                                  {item.serviceNumber}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                              {item.invoiceNumber && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">
                                    INV: {item.invoiceNumber}
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* 3. รอบบิล */}
                          <TableCell>
                            <div className="flex flex-col space-y-0.5">
                              <span className="font-medium text-foreground text-sm">
                                {getMonthName(month)} {year + 543}
                              </span>
                            </div>
                          </TableCell>

                          {/* 4. ยอดชำระ / เบิกจ่าย */}
                          <TableCell className="text-right">
                            <div className="flex flex-col space-y-1 items-end">
                              <span className="font-semibold text-sm text-foreground">
                                {item.amount > 0
                                  ? Number(item.amount).toLocaleString("th-TH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  : "-"}
                              </span>
                              {item.status === "PAID" && item.paidAmount && item.paidAmount > 0 && (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  จ่าย:{" "}
                                  {Number(item.paidAmount).toLocaleString("th-TH", {
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
                                  item.status === "UNRECORDED"
                                    ? "destructive"
                                    : item.status === "NOT_RECEIVED"
                                    ? "outline"
                                    : item.status === "PAID"
                                    ? (item.attachmentReceipt && item.attachmentReceipt.trim() !== "")
                                      ? "success"
                                      : "default"
                                    : "warning"
                                }
                                className={cn(
                                  "text-[11px] font-medium",
                                  item.status === "PAID" &&
                                    ((item.attachmentReceipt && item.attachmentReceipt.trim() !== "")
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                      : "bg-blue-600 hover:bg-blue-700 text-white")
                                )}
                              >
                                {item.status === "UNRECORDED"
                                  ? "ยังไม่ได้บันทึก"
                                  : item.status === "NOT_RECEIVED"
                                  ? "ยังไม่ได้รับใบแจ้งหนี้"
                                  : item.status === "PAID"
                                  ? (item.attachmentReceipt && item.attachmentReceipt.trim() !== "")
                                    ? "ได้ใบเสร็จแล้ว"
                                    : "เบิกจ่ายแล้ว"
                                  : "ยังไม่ได้เบิกจ่าย"}
                              </Badge>
                              {(item.status === "UNRECORDED" ||
                                item.status === "NOT_RECEIVED" ||
                                item.status === "PENDING_PAYMENT") && (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] h-4.5 px-2 font-normal"
                                >
                                  ค้างชำระ
                                </Badge>
                              )}
                              {item.status === "PAID" && item.paymentDocNumber && (
                                <span className="text-[10px] text-muted-foreground mt-0.5 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                                  {item.paymentDocNumber}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 6. สถานะตรวจสอบ */}
                          <TableCell className="text-center align-top pt-3">
                            {isBilled ? (
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                {item.auditStatus === "PENDING_CORRECTION" ? (
                                  item.isManualAnomaly ? (
                                    <Tooltip>
                                      <TooltipTrigger render={<span />}>
                                        <Badge
                                          variant="destructive"
                                          className="whitespace-nowrap text-[11px] gap-1 cursor-default inline-flex items-center"
                                        >
                                          <Flag className="size-3" />
                                          ระบุว่าผิดปกติ
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs p-3 text-left">
                                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1.5">
                                          <Flag className="size-3.5" />
                                          ผู้ตรวจระบุความผิดปกติ:
                                        </p>
                                        <p className="text-xs font-medium text-foreground">{item.manualAnomalyReason || "ระบุข้อผิดปกติด้วยตนเอง"}</p>
                                        {item.manualAnomalyDetail && (
                                          <p className="text-xs text-foreground/90 whitespace-pre-line mt-1.5 leading-relaxed">
                                            {item.manualAnomalyDetail}
                                          </p>
                                        )}
                                        {item.auditIssues && item.auditIssues.filter((iss) => !iss.startsWith("ระบุข้อผิดปกติ:")).length > 0 && (
                                          <div className="mt-2.5 pt-2 border-t border-border">
                                            <p className="text-[11px] font-medium text-muted-foreground mb-1">ข้อสังเกตเพิ่มเติม:</p>
                                            <ul className="text-xs space-y-0.5">
                                              {item.auditIssues.filter((iss) => !iss.startsWith("ระบุข้อผิดปกติ:")).map((issue, idx) => (
                                                <li key={idx} className="flex items-start gap-1">
                                                  <span className="text-rose-500">•</span>
                                                  <span className="text-foreground">{issue}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger render={<span />}>
                                        <Badge
                                          variant="warning"
                                          className="whitespace-nowrap text-[11px] gap-1 cursor-default inline-flex items-center"
                                        >
                                          <AlertTriangle className="size-3" />
                                          พบข้อสังเกต
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs p-3 text-left">
                                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                                          <AlertTriangle className="size-3.5" />
                                          ข้อสังเกตที่ระบบตรวจพบ:
                                        </p>
                                        {item.auditIssues && item.auditIssues.length > 0 ? (
                                          <ul className="text-xs space-y-1">
                                            {item.auditIssues.map((issue, idx) => (
                                              <li key={idx} className="flex items-start gap-1.5">
                                                <span className="text-amber-500 font-bold">•</span>
                                                <span>{issue}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-xs text-muted-foreground">
                                            พบข้อสังเกตในระบบตรวจสอบการเบิกจ่าย
                                          </p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                ) : item.auditStatus === "PENDING_RECHECK" ? (
                                  <Badge
                                    className="whitespace-nowrap text-[11px] gap-1 inline-flex items-center bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                  >
                                    <Clock className="size-3" />
                                    รอตรวจสอบใหม่
                                  </Badge>
                                ) : item.auditStatus === "CORRECTED" ? (
                                  <Badge
                                    variant="secondary"
                                    className="whitespace-nowrap text-[11px] gap-1 inline-flex items-center"
                                  >
                                    <CheckCheck className="size-3" />
                                    แก้ไขแล้ว
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="success"
                                    className="whitespace-nowrap text-[11px] gap-1 inline-flex items-center"
                                  >
                                    <CheckCircle2 className="size-3" />
                                    ปกติ
                                  </Badge>
                                )}

                                {item.isReviewed && (
                                  <Tooltip>
                                    <TooltipTrigger render={<span />}>
                                      <Badge
                                        variant="outline"
                                        className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full cursor-default"
                                      >
                                        ✓ ตรวจสอบแล้ว
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs space-y-0.5">
                                        <p className="font-semibold text-emerald-600">ตรวจรับรองความถูกต้องแล้ว</p>
                                        {item.reviewedBy && <p>โดย: {item.reviewedBy}</p>}
                                        {item.reviewedAt && (
                                          <p>
                                            เมื่อ:{" "}
                                            {format(new Date(item.reviewedAt), "dd MMM yy HH:mm", {
                                              locale: th,
                                            })}
                                          </p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">-</span>
                            )}
                          </TableCell>

                          {/* 7. จัดการ */}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {isBilled && item.billId ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
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
                                      onClick={() => handleViewBill(item.billId!, item)}
                                    >
                                      <Eye className="mr-2 h-4 w-4" /> ดูรายละเอียด
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      render={<Link href={`/bills/${item.billId}/edit`} />}
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" /> อัพเดทข้อมูล
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="cursor-pointer text-destructive focus:text-destructive"
                                      onClick={() => setBillToDelete(item.billId!)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> ลบรายการ
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!billToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setBillToDelete(null);
            setDeleteReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ย้ายรายการบิลไปเก็บถาวร (Archived)?</AlertDialogTitle>
            <AlertDialogDescription>
              รายการบิลนี้จะถูกย้ายไปยังหน้า &quot;บิลที่เก็บถาวร (Archived)&quot; ก่อน
              พร้อมบันทึกประวัติการลบ โดยสามารถกู้คืนหรือกดลบถาวรได้จากหน้านั้น
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-1">
            <label
              htmlFor="tracking-archive-reason"
              className="text-xs font-medium text-foreground"
            >
              เหตุผลการลบ <span className="text-destructive">*</span>
            </label>
            <Input
              id="tracking-archive-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="กรุณาระบุเหตุผลการลบ เช่น บันทึกข้อมูลผิดเดือน / บันทึกซ้ำ..."
              className="text-xs"
              required
              disabled={isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteBill();
              }}
              disabled={isPending || !deleteReason.trim()}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
            >
              {isPending ? "กำลังย้าย..." : "ย้ายไปเก็บถาวร"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Anomaly Flag Dialog */}
      <Dialog
        open={!!billToFlag}
        onOpenChange={(open) => {
          if (!open) {
            setBillToFlag(null);
            setFlagReason("");
            setFlagDetail("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Flag className="h-5 w-5" /> ระบุความผิดปกติของบิลด้วยตนเอง
            </DialogTitle>
            <DialogDescription>
              ระบุข้อสังเกตและคำแนะนำในการแก้ไข เพื่อให้ผู้เกี่ยวข้องดำเนินการตรวจสอบหรือแก้ไขต่อไป
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                หัวข้อ / ข้อสังเกตหลัก <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="เช่น เอกสารไม่ครบถ้วน, ยอดเงินไม่ถูกต้อง..."
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                รายละเอียดเพิ่มเติม / คำแนะนำในการแก้ไข
              </Label>
              <Textarea
                rows={4}
                placeholder="ระบุรายละเอียดเพิ่มเติม หรือแนวทางที่ต้องการให้แก้ไข..."
                value={flagDetail}
                onChange={(e) => setFlagDetail(e.target.value)}
                disabled={isPending}
                className="resize-none text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBillToFlag(null);
                setFlagReason("");
                setFlagDetail("");
              }}
              disabled={isPending}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleFlagManual}
              disabled={isPending || !flagReason.trim()}
              className="bg-destructive hover:bg-destructive/90 text-white cursor-pointer"
            >
              {isPending ? "กำลังบันทึก..." : "ยืนยันการปักธง"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Bill Detail Centered Dialog */}
      <BillDetailDialog
        bill={selectedBill}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        services={services}
        canReview={canReview}
        canFlag={canFlag}
        onReview={handleReviewBill}
        onUnreview={handleReviewBill}
        onFlag={(b) => {
          setBillToFlag(b);
          setFlagReason(b?.manualAnomalyReason || "");
          setFlagDetail(b?.manualAnomalyDetail || "");
          setIsViewDialogOpen(false);
        }}
        onUnflag={handleUnflagManual}
        isPending={isPending}
        isLoading={isLoadingBill}
      />
    </TooltipProvider>
  );
}
