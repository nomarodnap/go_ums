"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Zap,
  Droplet,
  Phone,
  Wifi,
  Mail,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  Eye,
  Plus,
  Copy,
  Receipt,
  FileEdit,
  Loader2,
  RefreshCw,
  X,
  Gauge,
} from "lucide-react";
import { useGetBillTracking, getBill } from "@/lib/api/generated/bills/bills";
import type { BillTrackingItemDTO, BillDTO } from "@/lib/api/generated/model";
import { BillDetailDialog } from "@/components/bills/bill-detail-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";

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

const UTILITY_OPTIONS = [
  "ทั้งหมด",
  "ค่าไฟฟ้า",
  "ค่าประปา&น้ำบาดาล",
  "ค่าโทรศัพท์",
  "ค่าสื่อสาร&โทรคมนาคม",
  "ค่าบริการไปรษณีย์",
] as const;

type StatusFilterType = "ALL" | "UNRECORDED" | "NOT_RECEIVED" | "PENDING_PAYMENT" | "PAID";

interface DepartmentServicesStatusSectionProps {
  departmentId?: string;
  departmentName?: string;
}

export function DepartmentServicesStatusSection({
  departmentId,
  departmentName = "หน่วยงานของคุณ",
}: DepartmentServicesStatusSectionProps) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [month, setMonth] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);

  const [searchTerm, setSearchTerm] = useState("");
  const [utilityFilter, setUtilityFilter] = useState<string>("ทั้งหมด");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("ALL");

  // Selected Bill for Detail Dialog
  const [selectedBill, setSelectedBill] = useState<BillDTO | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isLoadingBill, setIsLoadingBill] = useState(false);

  // Fetch bill tracking data for this department and selected month/year
  const { data: trackingRes, isLoading, refetch, isFetching } = useGetBillTracking({
    month,
    year,
    departmentId: departmentId || undefined,
  });

  const trackingItems: BillTrackingItemDTO[] = useMemo(() => {
    return trackingRes?.status === 200 && Array.isArray(trackingRes.data?.items)
      ? trackingRes.data.items
      : [];
  }, [trackingRes]);

  const summary = useMemo(() => {
    return trackingRes?.status === 200 && trackingRes.data?.summary
      ? trackingRes.data.summary
      : {
          total: 0,
          unrecorded: 0,
          notReceived: 0,
          pending: 0,
          paid: 0,
          paidAmount: 0,
          pendingAmount: 0,
        };
  }, [trackingRes]);

  // Filtered items based on search and filters
  const filteredItems = useMemo(() => {
    return trackingItems.filter((item) => {
      // Search
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        (item.serviceNumber || "").toLowerCase().includes(search) ||
        (item.provider || "").toLowerCase().includes(search) ||
        (item.utilityType || "").toLowerCase().includes(search) ||
        (item.invoiceNumber || "").toLowerCase().includes(search) ||
        (item.paymentDocNumber || "").toLowerCase().includes(search);

      // Utility filter
      const matchesUtility =
        utilityFilter === "ทั้งหมด" || item.utilityType === utilityFilter;

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== "ALL") {
        matchesStatus = item.status === statusFilter;
      }

      return matchesSearch && matchesUtility && matchesStatus;
    });
  }, [trackingItems, searchTerm, utilityFilter, statusFilter]);

  // Month navigation
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setMonth(currentMonth);
    setYear(currentYear);
  };

  const isCurrentMonthActive = month === currentMonth && year === currentYear;

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`คัดลอกหมายเลข ${text} แล้ว`);
  };

  // Open Bill Detail
  const handleOpenBill = async (billId?: string) => {
    if (!billId) return;
    setIsLoadingBill(true);
    try {
      const res = await getBill(billId);
      if (res) {
        setSelectedBill(res as any);
        setIsViewDialogOpen(true);
      }
    } catch {
      toast.error("ไม่สามารถโหลดรายละเอียดบิลได้");
    } finally {
      setIsLoadingBill(false);
    }
  };

  const getUtilityBadge = (type?: string) => {
    switch (type) {
      case "ค่าไฟฟ้า":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 flex items-center gap-1 font-medium text-xs py-0.5 px-2"
          >
            <Zap className="size-3 text-amber-500 fill-amber-500" />
            <span>ค่าไฟฟ้า</span>
          </Badge>
        );
      case "ค่าประปา&น้ำบาดาล":
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 flex items-center gap-1 font-medium text-xs py-0.5 px-2"
          >
            <Droplet className="size-3 text-blue-500 fill-blue-500" />
            <span>ค่าน้ำประปา</span>
          </Badge>
        );
      case "ค่าโทรศัพท์":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 flex items-center gap-1 font-medium text-xs py-0.5 px-2"
          >
            <Phone className="size-3 text-emerald-500" />
            <span>ค่าโทรศัพท์</span>
          </Badge>
        );
      case "ค่าสื่อสาร&โทรคมนาคม":
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25 flex items-center gap-1 font-medium text-xs py-0.5 px-2"
          >
            <Wifi className="size-3 text-purple-500" />
            <span>สื่อสาร/อินเทอร์เน็ต</span>
          </Badge>
        );
      case "ค่าบริการไปรษณีย์":
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 flex items-center gap-1 font-medium text-xs py-0.5 px-2"
          >
            <Mail className="size-3 text-rose-500" />
            <span>ไปรษณีย์</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-xs py-0.5 px-2">
            <FileText className="size-3" />
            <span>{type || "ทั่วไป"}</span>
          </Badge>
        );
    }
  };

  const renderStageIndicator = (item: BillTrackingItemDTO) => {
    switch (item.status) {
      case "UNRECORDED":
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge
              variant="destructive"
              className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold text-[11px] gap-1 px-2.5 py-0.5"
            >
              <AlertCircle className="size-3" />
              <span>ยังไม่ได้บันทึก</span>
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              ยังไม่มีการลงข้อมูลในรอบบิลนี้
            </span>
          </div>
        );
      case "NOT_RECEIVED":
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge
              variant="outline"
              className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 font-semibold text-[11px] gap-1 px-2.5 py-0.5"
            >
              <Clock className="size-3 text-orange-500" />
              <span>ยังไม่ได้รับใบแจ้งหนี้</span>
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              แจ้งสถานะรอรับบิลจากผู้ให้บริการ
            </span>
          </div>
        );
      case "PENDING_PAYMENT":
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge
              variant="outline"
              className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold text-[11px] gap-1 px-2.5 py-0.5"
            >
              <Clock className="size-3 text-amber-500" />
              <span>รับบิลแล้ว (รอเบิกจ่าย)</span>
            </Badge>
            <span className="text-[11px] text-muted-foreground font-mono">
              {item.invoiceNumber ? `เลขที่บิล: ${item.invoiceNumber}` : "อยู่ระหว่างดำเนินการเบิกจ่าย"}
            </span>
          </div>
        );
      case "PAID":
        return (
          <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold text-[11px] gap-1 px-2.5 py-0.5"
              >
                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span>เบิกจ่ายแล้ว</span>
              </Badge>
              {item.attachmentReceipt && (
                <Badge
                  variant="outline"
                  className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 font-normal text-[10px] px-1.5 py-0"
                >
                  <Receipt className="size-2.5 mr-0.5" /> มีใบเสร็จ
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {item.paymentDocNumber ? `เลขที่ขอเบิก: ${item.paymentDocNumber}` : "เบิกจ่ายเรียบร้อย"}
            </span>
          </div>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[11px]">
            ไม่ทราบสถานะ
          </Badge>
        );
    }
  };

  const renderAuditBadge = (item: BillTrackingItemDTO) => {
    if (item.isManualAnomaly) {
      return (
        <Badge
          variant="outline"
          className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-semibold"
        >
          ระบุว่าผิดปกติ
        </Badge>
      );
    }
    if (item.auditStatus === "WAITING_RECHECK") {
      return (
        <Badge
          variant="outline"
          className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 text-[10px] font-semibold"
        >
          รอตรวจสอบใหม่
        </Badge>
      );
    }
    if (item.auditIssues && Object.values(item.auditIssues).some(Boolean)) {
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold"
        >
          พบข้อสังเกต
        </Badge>
      );
    }
    if (item.status !== "UNRECORDED") {
      return (
        <Badge
          variant="outline"
          className="bg-black/[0.03] dark:bg-white/[0.04] text-muted-foreground text-[10px]"
        >
          ปกติ
        </Badge>
      );
    }
    return <span className="text-muted-foreground text-xs">-</span>;
  };

  return (
    <Card className="rounded-2xl border-black/[0.06] dark:border-white/[0.08] shadow-xs overflow-hidden">
      {/* Header Section */}
      <CardHeader className="p-5 sm:p-6 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.01]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Gauge className="size-4.5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>สถานะการดำเนินงานตามรหัสเครื่องวัด / หมายเลขผู้ใช้</span>
                  <Badge variant="outline" className="text-xs font-normal bg-card">
                    {summary.total} หมายเลข
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  ติดตามขั้นตอนการลงบิลและการเบิกจ่ายของแต่ละมิเตอร์/หมายเลขในสังกัด {departmentName}
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Month Navigator & Full Tracking Link */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Month-Year Selector Bar */}
            <div className="flex items-center rounded-xl bg-card border border-black/[0.08] dark:border-white/[0.12] p-1 shadow-2xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                disabled={isLoading}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <div className="flex items-center gap-1.5 px-2.5 text-xs font-semibold text-foreground select-none">
                <Calendar className="size-3.5 text-primary" />
                <span>
                  {THAI_MONTHS[month - 1]} {year + 543}
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                disabled={isLoading}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="เดือนถัดไป"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {!isCurrentMonthActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToCurrentMonth}
                className="text-xs h-9 rounded-xl border-dashed"
              >
                กลับสู่เดือนนี้
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              className="size-9 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-muted-foreground hover:text-foreground"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-primary")} />
            </Button>

            <Link href="/bill-tracking">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 rounded-xl font-medium border-primary/30 text-primary hover:bg-primary/5 gap-1.5"
              >
                <span>หน้าติดตามเต็ม</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Workflow Summary Filter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4">
          {/* 1. ทั้งหมด */}
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              statusFilter === "ALL"
                ? "bg-primary/[0.06] border-primary text-primary shadow-xs ring-1 ring-primary/20"
                : "bg-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08]"
            )}
          >
            <span className="text-[11px] font-medium text-muted-foreground">
              ทั้งหมดในสังกัด
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-foreground">
                <NumberFlow value={summary.total} />
              </span>
              <span className="text-[11px] text-muted-foreground">หมายเลข</span>
            </div>
          </button>

          {/* 2. ยังไม่ได้บันทึก */}
          <button
            type="button"
            onClick={() => setStatusFilter("UNRECORDED")}
            className={cn(
              "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              statusFilter === "UNRECORDED"
                ? "bg-rose-500/[0.08] border-rose-500 text-rose-600 dark:text-rose-400 shadow-xs ring-1 ring-rose-500/30"
                : "bg-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-rose-500" />
                ยังไม่ได้บันทึก
              </span>
              {summary.total > 0 && (
                <span className="text-[10px] text-rose-600 font-semibold">
                  {Math.round((summary.unrecorded / summary.total) * 100)}%
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                <NumberFlow value={summary.unrecorded} />
              </span>
              <span className="text-[11px] text-muted-foreground">หมายเลข</span>
            </div>
          </button>

          {/* 3. ยังไม่ได้รับใบแจ้งหนี้ */}
          <button
            type="button"
            onClick={() => setStatusFilter("NOT_RECEIVED")}
            className={cn(
              "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              statusFilter === "NOT_RECEIVED"
                ? "bg-orange-500/[0.08] border-orange-500 text-orange-600 dark:text-orange-400 shadow-xs ring-1 ring-orange-500/30"
                : "bg-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-orange-500" />
                ยังไม่ได้รับบิล
              </span>
              {summary.total > 0 && (
                <span className="text-[10px] text-orange-600 font-semibold">
                  {Math.round((summary.notReceived / summary.total) * 100)}%
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
                <NumberFlow value={summary.notReceived} />
              </span>
              <span className="text-[11px] text-muted-foreground">หมายเลข</span>
            </div>
          </button>

          {/* 4. รอเบิกจ่าย */}
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING_PAYMENT")}
            className={cn(
              "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              statusFilter === "PENDING_PAYMENT"
                ? "bg-amber-500/[0.08] border-amber-500 text-amber-700 dark:text-amber-400 shadow-xs ring-1 ring-amber-500/30"
                : "bg-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-500" />
                รอเบิกจ่าย
              </span>
              {summary.total > 0 && (
                <span className="text-[10px] text-amber-600 font-semibold">
                  {Math.round((summary.pending / summary.total) * 100)}%
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                <NumberFlow value={summary.pending} />
              </span>
              <span className="text-[11px] text-muted-foreground">หมายเลข</span>
            </div>
          </button>

          {/* 5. เบิกจ่ายแล้ว */}
          <button
            type="button"
            onClick={() => setStatusFilter("PAID")}
            className={cn(
              "col-span-2 sm:col-span-1 p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
              statusFilter === "PAID"
                ? "bg-emerald-500/[0.08] border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30"
                : "bg-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                เบิกจ่ายแล้ว
              </span>
              {summary.total > 0 && (
                <span className="text-[10px] text-emerald-600 font-semibold">
                  {Math.round((summary.paid / summary.total) * 100)}%
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                <NumberFlow value={summary.paid} />
              </span>
              <span className="text-[11px] text-muted-foreground">
                ฿{summary.paidAmount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </button>
        </div>
      </CardHeader>

      {/* Filter and Search Toolbar */}
      <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.005] dark:bg-white/[0.005]">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหารหัสเครื่องวัด, หมายเลขผู้ใช้, หรือผู้ให้บริการ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8.5 h-8.5 text-xs rounded-xl bg-card border-black/[0.08] dark:border-white/[0.12]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <Select
            value={utilityFilter}
            onValueChange={(val) => setUtilityFilter(val ?? "ทั้งหมด")}
          >
            <SelectTrigger className="w-[140px] h-8.5 text-xs rounded-xl bg-card border-black/[0.08] dark:border-white/[0.12]">
              <SelectValue placeholder="ประเภท" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              {UTILITY_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-auto">
          <span>
            แสดง <strong className="text-foreground">{filteredItems.length}</strong> จาก{" "}
            {trackingItems.length} หมายเลข
          </span>
          {(searchTerm || utilityFilter !== "ทั้งหมด" || statusFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setUtilityFilter("ทั้งหมด");
                setStatusFilter("ALL");
              }}
              className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <Loader2 className="size-7 text-primary animate-spin mb-2" />
            <span className="text-xs text-muted-foreground">
              กำลังตรวจสอบสถานะรหัสเครื่องวัดและหมายเลขผู้ใช้...
            </span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
            <div className="size-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3 text-muted-foreground">
              <Gauge className="size-6 opacity-40" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">
              {trackingItems.length === 0
                ? "ยังไม่มีรายการรหัสเครื่องวัดหรือหมายเลขผู้ใช้ในสังกัดนี้"
                : "ไม่พบหมายเลขที่ตรงกับเงื่อนไขการค้นหา"}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {trackingItems.length === 0
                ? "คุณสามารถเพิ่มรหัสเครื่องวัดและบริการใหม่เพื่อเริ่มติดตามขั้นตอนได้ที่หน้าจัดการบริการ"
                : "ลองปรับเปลี่ยนคำค้นหาหรือตัวกรองประเภทสาธารณูปโภคเพื่อดูรายการอื่นๆ"}
            </p>
            {trackingItems.length === 0 && (
              <Link href="/services" className="mt-4">
                <Button size="sm" className="text-xs rounded-xl gap-1.5">
                  <Plus className="size-3.5" />
                  เพิ่มรหัสเครื่องวัด / บริการใหม่
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/[0.015] dark:bg-white/[0.02]">
                <TableRow className="border-black/[0.06] dark:border-white/[0.08] hover:bg-transparent text-xs">
                  <TableHead className="w-[60px] text-center font-semibold">ลำดับ</TableHead>
                  <TableHead className="min-w-[200px] font-semibold">รหัสเครื่องวัด / หมายเลขผู้ใช้</TableHead>
                  <TableHead className="min-w-[150px] font-semibold">ประเภทสาธารณูปโภค</TableHead>
                  <TableHead className="min-w-[220px] font-semibold">ขั้นตอน / สถานะการดำเนินงาน</TableHead>
                  <TableHead className="text-right min-w-[120px] font-semibold">ยอดเงิน (บาท)</TableHead>
                  <TableHead className="min-w-[120px] font-semibold">การตรวจสอบ</TableHead>
                  <TableHead className="text-right min-w-[120px] font-semibold pr-6">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {filteredItems.map((item, idx) => (
                  <TableRow
                    key={`${item.serviceNumber}-${item.billId || idx}`}
                    className="border-black/[0.04] dark:border-white/[0.06] hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Index */}
                    <TableCell className="text-center text-muted-foreground font-mono">
                      {idx + 1}
                    </TableCell>

                    {/* Service Number & Provider */}
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 group">
                          <span className="font-mono font-semibold text-foreground text-xs">
                            {item.serviceNumber}
                          </span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger
                                onClick={() => handleCopy(item.serviceNumber)}
                                className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                              >
                                <Copy className="size-3" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px]">
                                คัดลอกหมายเลข
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          {item.provider || "ไม่ระบุผู้ให้บริการ"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Utility Type */}
                    <TableCell>{getUtilityBadge(item.utilityType)}</TableCell>

                    {/* Stage / Progress Status */}
                    <TableCell>{renderStageIndicator(item)}</TableCell>

                    {/* Amount */}
                    <TableCell className="text-right font-mono font-medium">
                      {item.status !== "UNRECORDED" ? (
                        <span className="text-foreground">
                          {item.amount.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>

                    {/* Audit Status */}
                    <TableCell>{renderAuditBadge(item)}</TableCell>

                    {/* Action Buttons */}
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.billId ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenBill(item.billId)}
                              disabled={isLoadingBill}
                              className="text-xs h-7.5 px-2.5 rounded-lg border-black/[0.08] dark:border-white/[0.12] hover:bg-black/5 dark:hover:bg-white/5 font-medium"
                            >
                              <Eye className="size-3 mr-1 text-primary" />
                              <span>ดูบิล</span>
                            </Button>

                            <Link href={`/bills/${item.billId}/edit`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7.5 px-2 rounded-lg text-muted-foreground hover:text-foreground"
                                title="แก้ไขข้อมูลบิล"
                              >
                                <FileEdit className="size-3" />
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <Link
                            href={{
                              pathname: "/bills/new",
                              query: {
                                ...(item.departmentId || departmentId
                                  ? { departmentId: item.departmentId || departmentId }
                                  : {}),
                                ...(item.utilityType ? { utilityType: item.utilityType } : {}),
                                ...(item.serviceNumber ? { serviceNumber: item.serviceNumber } : {}),
                                billingMonth: `${year}-${String(month).padStart(2, "0")}`,
                              },
                              hash: "utility-invoice-section",
                            }}
                          >
                            <Button
                              size="sm"
                              className="text-xs h-7.5 px-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1"
                            >
                              <Plus className="size-3" />
                              <span>บันทึกบิล</span>
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Bill Detail Modal Dialog */}
      <BillDetailDialog
        bill={selectedBill}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />
    </Card>
  );
}

