"use client";

import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building,
  Building2,
  CheckCircle2,
  FileText,
  Maximize2,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardAIInsights } from "@/components/ai/dashboard-ai-insights";
import { ForecastPanel } from "@/components/ai/forecast-panel";
import {
  type StatusDataPoint,
  StatusPieChart,
  serviceStatusConfig,
  TrendChart,
  type TrendDataPoint,
  TrendFullscreenDialog,
} from "@/components/dashboard/dashboard-charts";
import {
  RecentAnomaliesTable,
  type RecentAnomaly,
} from "@/components/dashboard/recent-anomalies-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DepartmentCombobox } from "@/components/ui/department-combobox";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { useGetDashboardSummary } from "@/lib/api/generated/dashboard/dashboard";
import { useListDepartments } from "@/lib/api/generated/departments/departments";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { id: "1m", label: "เดือนนี้", months: 1 },
  { id: "3m", label: "3 เดือนล่าสุด", months: 3 },
  { id: "6m", label: "6 เดือนล่าสุด", months: 6 },
  { id: "12m", label: "12 เดือนล่าสุด", months: 12 },
] as const;

type PeriodOption = (typeof PERIOD_OPTIONS)[number]["id"];

export default function OverviewPage() {
  const [scope, setScope] = useState<"all" | "department">("all");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [period, setPeriod] = useState<PeriodOption>("1m");
  const [isTrendFullscreen, setIsTrendFullscreen] = useState(false);

  const currentPeriod = PERIOD_OPTIONS.find((p) => p.id === period) || PERIOD_OPTIONS[0];

  const { data: userData, isLoading: isUserLoading } = useGetCurrentUser();
  const user = userData?.status === 200 ? userData.data.user : null;

  const allowedRoles = ["admin", "auditor", "strategy_finance", "central_staff"];
  const isAuthorized = user ? allowedRoles.includes(user.role || "") : false;

  const { data: deptRes } = useListDepartments({
    query: {
      enabled: isAuthorized,
    },
  });

  const departments = useMemo(() => {
    return deptRes?.status === 200 && Array.isArray(deptRes.data) ? deptRes.data : [];
  }, [deptRes]);

  // When switching to department scope, if no department selected yet, default to user's department or first department
  useEffect(() => {
    if (scope === "department" && !selectedDepartmentId && departments.length > 0) {
      if (user?.departmentId && departments.some((d) => d.id === user.departmentId)) {
        setSelectedDepartmentId(user.departmentId);
      } else {
        setSelectedDepartmentId(departments[0].id);
      }
    }
  }, [scope, selectedDepartmentId, departments, user?.departmentId]);

  const handleScopeChange = (newScope: "all" | "department") => {
    setScope(newScope);
    if (newScope === "department" && !selectedDepartmentId && departments.length > 0) {
      if (user?.departmentId && departments.some((d) => d.id === user.departmentId)) {
        setSelectedDepartmentId(user.departmentId);
      } else {
        setSelectedDepartmentId(departments[0].id);
      }
    }
  };

  const currentDepartment = useMemo(() => {
    if (!selectedDepartmentId) return null;
    return departments.find((d) => d.id === selectedDepartmentId) || null;
  }, [departments, selectedDepartmentId]);

  const disbursingUnitName = useMemo(() => {
    if (!currentDepartment?.depositUnit) return "-";
    const dep = departments.find(
      (d) =>
        d.id === currentDepartment.depositUnit ||
        d.fullName === currentDepartment.depositUnit ||
        d.shortName === currentDepartment.depositUnit,
    );
    return dep?.fullName || dep?.shortName || currentDepartment.depositUnit;
  }, [departments, currentDepartment?.depositUnit]);

  const depositedUnits = useMemo(() => {
    if (!currentDepartment?.id) return [];
    return departments.filter(
      (d) =>
        d.id !== currentDepartment.id &&
        (d.depositUnit === currentDepartment.id ||
          (currentDepartment.shortName && d.depositUnit === currentDepartment.shortName) ||
          (currentDepartment.fullName && d.depositUnit === currentDepartment.fullName)),
    );
  }, [
    departments,
    currentDepartment?.id,
    currentDepartment?.shortName,
    currentDepartment?.fullName,
  ]);

  const deptTypeName = useMemo(() => {
    const t = currentDepartment?.type;
    if (t === "central") return "ส่วนกลาง";
    if (t === "regional_central") return "ส่วนกลางที่มีสถานที่ตั้งอยู่ในส่วนภูมิภาค";
    if (t === "regional") return "ส่วนภูมิภาค";
    return t || "-";
  }, [currentDepartment?.type]);

  const queryParams = useMemo(() => {
    if (scope === "department" && selectedDepartmentId) {
      return {
        scope: "department",
        departmentId: selectedDepartmentId,
        period,
      };
    }
    return {
      scope: "all",
      period,
    };
  }, [scope, selectedDepartmentId, period]);

  const { data: summaryRes, isLoading: isSummaryLoading } = useGetDashboardSummary(
    queryParams as any,
    {
      query: {
        enabled: isAuthorized,
      },
    },
  );

  const stats = summaryRes?.status === 200 ? (summaryRes.data as any) : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalInvoicesCurrentMonth = stats?.totalInvoicesCurrentMonth ?? 0;
  const totalPaidCurrentMonth = stats?.totalPaidCurrentMonth ?? 0;
  const totalPaidBills =
    stats?.totalPaidBills ??
    stats?.statusData?.find((s: any) => s.name === "เบิกจ่ายแล้ว")?.value ??
    0;
  const totalPendingBills = stats?.totalPendingBills ?? 0;
  const pendingAmount = stats?.pendingAmount ?? 0;
  const totalAnomalies = stats?.totalAnomalies ?? 0;

  const trendData: TrendDataPoint[] = useMemo(() => {
    if (stats?.trendData && stats.trendData.length > 0) {
      return stats.trendData;
    }
    const defaultMonths = [
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
    return defaultMonths.map((m) => ({
      month: m,
      electricity: 0,
      water: 0,
      phone: 0,
      telecom: 0,
      postal: 0,
    }));
  }, [stats?.trendData]);

  const statusData: StatusDataPoint[] = useMemo(() => {
    if (stats?.statusData && stats.statusData.length > 0) {
      return stats.statusData;
    }
    return [
      { name: "เบิกจ่ายแล้ว", value: 0, color: "var(--chart-2)" },
      { name: "ค้างชำระ", value: 0, color: "var(--chart-4)" },
    ];
  }, [stats?.statusData]);

  const serviceStatusData: StatusDataPoint[] = useMemo(() => {
    if (stats?.serviceStatusData && stats.serviceStatusData.length > 0) {
      return stats.serviceStatusData;
    }
    return [
      { name: "บันทึกเข้าระบบแล้ว", value: 0, color: "var(--chart-1)" },
      { name: "ยังไม่ได้บันทึกเข้าระบบ", value: 0, color: "var(--chart-3)" },
    ];
  }, [stats?.serviceStatusData]);

  const recentAnomalies: RecentAnomaly[] = useMemo(() => {
    if (stats?.recentAnomalies && Array.isArray(stats.recentAnomalies)) {
      return stats.recentAnomalies.map((a: any) => ({
        ...a,
        departmentName: a.departmentName || "ไม่ระบุ",
        invoiceAmount: a.invoiceAmount != null ? String(a.invoiceAmount) : "0",
        paidAmount: a.paidAmount != null ? String(a.paidAmount) : null,
        usageAmount: a.usageAmount != null ? String(a.usageAmount) : null,
      }));
    }
    return [];
  }, [stats?.recentAnomalies]);

  const topDepartments: { name: string; amount: number }[] = useMemo(() => {
    if (stats?.topDepartments && Array.isArray(stats.topDepartments)) {
      return stats.topDepartments;
    }
    return [];
  }, [stats?.topDepartments]);

  // If user is loaded and not authorized, show permission error card
  if (!isUserLoading && user && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 space-y-4">
        <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="size-7" />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="text-xl font-bold text-foreground">ไม่มีสิทธิ์เข้าถึงแดชบอร์ดภาพรวมทั้งกรม</h2>
          <p className="text-sm text-muted-foreground">
            หน้านี้สงวนไว้สำหรับผู้ดูแลระบบและฝ่ายบริหาร (Admin, Auditor, Strategy Finance, Central Staff)
            เท่านั้น
          </p>
        </div>
        <Button render={<Link href="/dashboard" />} variant="outline" className="mt-2">
          กลับไปแดชบอร์ดหน่วยงานตนเอง
        </Button>
      </div>
    );
  }

  if (isUserLoading || (isAuthorized && isSummaryLoading && !summaryRes)) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดข้อมูลแดชบอร์ดภาพรวม..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  const deptDisplayName =
    stats?.departmentShortName ||
    currentDepartment?.shortName ||
    currentDepartment?.fullName ||
    "หน่วยงาน";

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {scope === "all"
                ? "แดชบอร์ดภาพรวมทั้งกรม"
                : `แดชบอร์ด: ${stats?.departmentName || currentDepartment?.fullName || "เฉพาะหน่วยงาน"}`}
            </h1>
            <Badge variant="default" className="font-semibold text-xs shrink-0">
              {scope === "all" ? "292 หน่วยงาน" : deptDisplayName}
            </Badge>
            <Badge variant="secondary" className="font-medium text-xs shrink-0">
              {currentPeriod.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {scope === "all"
              ? `ภาพรวมการบริหารจัดการค่าสาธารณูปโภค 292 หน่วยงาน (ส่วนกลางและภูมิภาค) (${currentPeriod.label})`
              : `สถิติและการเบิกจ่ายค่าสาธารณูปโภคเฉพาะหน่วยงาน (${stats?.departmentName || currentDepartment?.fullName || ""}) (${currentPeriod.label})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-auto">
          {/* Period segmented control */}
          <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-xs">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200",
                  period === opt.id
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {user?.role !== "admin" && (
            <Button
              render={<Link href="/dashboard" />}
              variant="outline"
              className="gap-2 shadow-xs shrink-0"
            >
              <Building2 className="size-4 text-muted-foreground" /> กลับไปแดชบอร์ดหน่วยงานตนเอง
            </Button>
          )}
        </div>
      </div>

      {/* Scope Switcher Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-muted/40 border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-sm">
        {/* Toggle between All vs Department */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background shadow-xs border border-border/50 shrink-0">
          <button
            type="button"
            onClick={() => handleScopeChange("all")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200",
              scope === "all"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            <Building2 className="size-4" />
            <span>ภาพรวมทั้งกรม (292 หน่วยงาน)</span>
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange("department")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200",
              scope === "department"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            <Building className="size-4" />
            <span>เฉพาะหน่วยงาน / กอง</span>
          </button>
        </div>

        {/* Department Selector when in department mode */}
        {scope === "department" && (
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2.5 lg:justify-end animate-in fade-in slide-in-from-right-3 duration-200">
            <span className="text-xs text-muted-foreground shrink-0 font-medium">เลือกหน่วยงาน:</span>
            <div className="w-full sm:w-[360px] md:w-[440px]">
              <DepartmentCombobox
                departments={departments}
                value={selectedDepartmentId}
                onValueChange={(val) => {
                  if (val) setSelectedDepartmentId(val);
                }}
                placeholder="เลือกหรือค้นหาหน่วยงาน / กอง..."
                className="h-9 bg-background text-xs sm:text-sm shadow-xs"
              />
            </div>
            {currentDepartment?.costCenterCode && (
              <Badge
                variant="outline"
                className="text-xs font-normal py-1 px-2.5 shrink-0 bg-background/80 self-start sm:self-auto"
              >
                <span className="font-semibold text-primary mr-1">รหัสเบิกจ่าย:</span>
                {currentDepartment.costCenterCode}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* KPI Metric Cards with NumberFlow & Motion */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08 },
          },
        }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Metric 1 */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
          }}
        >
          <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] h-full">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                  การบันทึกเข้าระบบ ({currentPeriod.label})
                </span>
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <FileText className="size-4.5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-baseline">
                  <NumberFlow value={totalInvoicesCurrentMonth} />
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">รายการ</span>
                </div>
                <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                  {scope === "all"
                    ? `จากทุกหน่วยงานทั่วประเทศ (${currentPeriod.label})`
                    : `ของ ${deptDisplayName} (${currentPeriod.label})`}
                </p>
                <Link
                  href={
                    scope === "department" && selectedDepartmentId
                      ? `/all-bills?departmentId=${selectedDepartmentId}`
                      : "/all-bills"
                  }
                  className="text-xs text-blue-600/90 dark:text-blue-400/90 hover:underline inline-flex items-center font-medium mt-2 gap-1"
                >
                  ดูรายการบันทึกทั้งหมด <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Metric 2 */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
          }}
        >
          <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] h-full">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                  ผลการเบิกจ่าย ({currentPeriod.label})
                </span>
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <CheckCircle2 className="size-4.5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 flex items-baseline">
                  <NumberFlow value={totalPaidBills} />
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">รายการ</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-baseline gap-1 font-medium">
                  <span>ยอดเงินรวม:</span>
                  <span className="text-foreground font-semibold">
                    {formatCurrency(totalPaidCurrentMonth)}
                  </span>
                </div>
                <Link
                  href={
                    scope === "department" && selectedDepartmentId
                      ? `/all-bills?departmentId=${selectedDepartmentId}&status=PAID`
                      : "/all-bills?status=PAID"
                  }
                  className="text-xs text-emerald-600/90 dark:text-emerald-400/90 hover:underline inline-flex items-center font-medium mt-2 gap-1"
                >
                  ดูรายการเบิกจ่ายแล้ว <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Metric 3 */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
          }}
        >
          <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] h-full">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                    {scope === "all" ? "ค้างชำระรวมทั้งระบบ" : `ค้างชำระ (${deptDisplayName})`}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 font-normal border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                  >
                    สะสม
                  </Badge>
                </div>
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <AlertTriangle className="size-4.5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 flex items-baseline">
                  <NumberFlow value={totalPendingBills} />
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">รายการ</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-baseline gap-1 font-medium">
                  <span>ยอดเงินรวม:</span>
                  <span className="text-foreground font-semibold">
                    {formatCurrency(pendingAmount)}
                  </span>
                </div>
                <Link
                  href={
                    scope === "department" && selectedDepartmentId
                      ? `/all-bills?departmentId=${selectedDepartmentId}&status=OVERDUE`
                      : "/all-bills?status=OVERDUE"
                  }
                  className="text-xs text-amber-600/90 dark:text-amber-400/90 hover:underline inline-flex items-center font-medium mt-2 gap-1"
                >
                  ดูรายการค้างชำระ <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Metric 4 */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
          }}
        >
          <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08] h-full">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                  ตรวจสอบพบความคลาดเคลื่อน ({currentPeriod.label})
                </span>
                <div
                  className={`flex size-9 items-center justify-center rounded-xl ${
                    totalAnomalies > 0
                      ? "bg-destructive/10 text-destructive dark:bg-destructive/20"
                      : "bg-slate-500/10 text-slate-500 dark:bg-slate-500/20 dark:text-slate-400"
                  }`}
                >
                  <Activity className="size-4.5" />
                </div>
              </div>
              <div className="mt-4">
                <div
                  className={`text-2xl sm:text-3xl font-bold tracking-tight flex items-baseline ${
                    totalAnomalies > 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  <NumberFlow value={totalAnomalies} />
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">รายการ</span>
                </div>
                <Link
                  href={
                    scope === "department" && selectedDepartmentId
                      ? `/all-bills?departmentId=${selectedDepartmentId}&anomaly=true`
                      : "/all-bills?anomaly=true"
                  }
                  className={`text-xs hover:underline inline-flex items-center font-medium mt-1 gap-1 ${
                    totalAnomalies > 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  ดูรายการที่พบความคลาดเคลื่อน <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* AI Monthly Insights Panel */}
      <DashboardAIInsights
        scope={scope}
        departmentId={scope === "department" ? selectedDepartmentId || undefined : undefined}
        enabled={isAuthorized && (scope === "all" || Boolean(selectedDepartmentId))}
      />

      {/* AI Forecasting, Budget Planning & Early Alerts */}
      <ForecastPanel
        scope={scope}
        departmentId={scope === "department" ? selectedDepartmentId || undefined : undefined}
        enabled={isAuthorized && (scope === "all" || Boolean(selectedDepartmentId))}
        billsHref={
          scope === "department" && selectedDepartmentId
            ? `/all-bills?departmentId=${selectedDepartmentId}`
            : "/all-bills"
        }
      />

      {/* Analytics Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
        <Card className="col-span-1 md:col-span-2 lg:col-span-6 border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                {scope === "all"
                  ? "แนวโน้มการเบิกจ่ายค่าสาธารณูปโภค (ทั้งกรม)"
                  : `แนวโน้มการเบิกจ่ายค่าสาธารณูปโภค (${deptDisplayName})`}
              </CardTitle>
              <CardDescription>
                {scope === "all"
                  ? `กราฟเปรียบเทียบค่าใช้จ่ายแต่ละประเภทสาธารณูปโภค 292 หน่วยงาน (${currentPeriod.label})`
                  : `กราฟเปรียบเทียบค่าใช้จ่ายแต่ละประเภทสาธารณูปโภคของ ${stats?.departmentName || currentDepartment?.fullName || "หน่วยงานนี้"} (${currentPeriod.label})`}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTrendFullscreen(true)}
              disabled={trendData.length === 0}
              className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-black/[0.08] dark:border-white/[0.08] text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              title="ดูแบบเต็มจอ (Full Screen)"
            >
              <Maximize2 className="size-3.5" />
              <span className="hidden sm:inline">เต็มจอ</span>
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {trendData.length > 0 ? (
              <TrendChart
                data={trendData}
                defaultMonths={period}
                onOpenFullscreen={() => setIsTrendFullscreen(true)}
              />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                ไม่มีข้อมูลเพียงพอสำหรับการแสดงกราฟ
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-1 lg:col-span-3 border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold tracking-tight">
              {scope === "all" ? "สถานะใบแจ้งหนี้ทั้งกรม" : `สถานะใบแจ้งหนี้ (${deptDisplayName})`}
            </CardTitle>
            <CardDescription>
              {scope === "all"
                ? `สัดส่วนสถานะใบแจ้งหนี้ทั้งหมดของทุกหน่วยงาน (${currentPeriod.label})`
                : `สัดส่วนสถานะใบแจ้งหนี้ของ ${stats?.departmentName || currentDepartment?.fullName || "หน่วยงานนี้"} (${currentPeriod.label})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {statusData.some((d) => d.value > 0) ? (
              <StatusPieChart data={statusData} />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                ไม่มีข้อมูล
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-1 lg:col-span-3 border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold tracking-tight">
              {scope === "all"
                ? "สถานะการบันทึกหมายเลขทั้งกรม"
                : `สถานะการบันทึกหมายเลข (${deptDisplayName})`}
            </CardTitle>
            <CardDescription>
              {scope === "all"
                ? `สัดส่วนหมายเลขที่บันทึกของทุกหน่วยงาน (${currentPeriod.label})`
                : `สัดส่วนหมายเลขที่บันทึกของ ${stats?.departmentName || currentDepartment?.fullName || "หน่วยงานนี้"} (${currentPeriod.label})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {serviceStatusData.some((d) => d.value > 0) ? (
              <StatusPieChart data={serviceStatusData} config={serviceStatusConfig} />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                ไม่มีข้อมูล
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Anomalies Table Card (Full Width) */}
      <Card className="border-black/[0.06] dark:border-white/[0.08]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                {scope === "all"
                  ? "รายการบันทึกที่ตรวจสอบพบความคลาดเคลื่อน (ทั้งกรม)"
                  : `รายการบันทึกที่ตรวจสอบพบความคลาดเคลื่อน (${deptDisplayName})`}
              </CardTitle>
              <CardDescription>
                {scope === "all"
                  ? `5 รายการล่าสุดที่ถูกปักธงหรือมีข้อมูลไม่สอดคล้อง (${currentPeriod.label})`
                  : `รายการล่าสุดที่ถูกปักธงหรือมีข้อมูลไม่สอดคล้องของหน่วยงานนี้ (${currentPeriod.label})`}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  href={
                    scope === "department" && selectedDepartmentId
                      ? `/all-bills?departmentId=${selectedDepartmentId}&anomaly=true`
                      : "/all-bills?anomaly=true"
                  }
                />
              }
              className="text-xs"
            >
              ดูทั้งหมด <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <RecentAnomaliesTable anomalies={recentAnomalies} />
        </CardContent>
      </Card>

      {/* Right Card: Top 5 Departments (if scope === "all") OR Department Info Summary (if scope === "department") */}
      {scope === "all" ? (
        <Card className="border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="size-4.5 text-amber-500" />
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  5 อันดับหน่วยงานที่เบิกจ่ายสูงสุด
                </CardTitle>
                <CardDescription>
                  ยอดรวมเบิกจ่ายแล้วของแต่ละหน่วยงาน ({currentPeriod.label})
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4.5 mt-1">
              {topDepartments.length > 0 ? (
                topDepartments.map((dept, i) => {
                  const maxAmount = Math.max(...topDepartments.map((d) => Number(d.amount)));
                  const percentage = maxAmount > 0 ? (Number(dept.amount) / maxAmount) * 100 : 0;

                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                            {dept.name}
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-foreground shrink-0">
                            {formatCurrency(Number(dept.amount))}
                          </p>
                        </div>
                        <div className="w-full bg-muted dark:bg-card/80 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-primary to-primary/80 h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  ไม่มีข้อมูลการเบิกจ่าย
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight">
                    ข้อมูลและสรุปภาพรวมหน่วยงาน
                  </CardTitle>
                  <CardDescription>รายละเอียดสังกัดและสถิติสะสมของ {deptDisplayName}</CardDescription>
                </div>
              </div>
              {currentDepartment?.costCenterCode && (
                <Badge variant="outline" className="font-mono text-xs shrink-0">
                  {currentDepartment.costCenterCode}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Department Info Details */}
            <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 p-3.5 space-y-2.5">
              <div>
                <span className="text-xs text-muted-foreground block">ชื่อหน่วยงานเต็ม</span>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {currentDepartment?.fullName || stats?.departmentName || "ไม่ระบุ"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/50 text-xs">
                <div>
                  <span className="text-muted-foreground block">หน่วยเบิกจ่าย</span>
                  <span className="font-medium text-foreground block mt-0.5">
                    {disbursingUnitName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">หน่วยรับฝาก</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {depositedUnits.length === 0 ? (
                      "-"
                    ) : depositedUnits.length === 1 ? (
                      depositedUnits[0].fullName
                    ) : (
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-normal block">
                          ({depositedUnits.length} หน่วยงาน)
                        </span>
                        <div className="max-h-28 overflow-y-auto pr-1 space-y-1">
                          <ul className="list-disc pl-3.5 space-y-0.5 text-foreground leading-snug">
                            {depositedUnits.map((u) => (
                              <li key={u.id}>{u.fullName}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block">ระดับหน่วยงาน</span>
                  <span className="font-medium text-foreground block mt-0.5">{deptTypeName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">เบอร์ติดต่อ</span>
                  <span className="font-medium text-foreground block mt-0.5">
                    {currentDepartment?.responsiblePhone || currentDepartment?.phone || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Cumulative Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-card p-3 text-center">
                <span className="text-[11px] text-muted-foreground block">บิลสะสมทั้งหมด</span>
                <span className="text-base font-bold text-foreground mt-0.5 block">
                  {stats?.totalBills ?? 0}
                </span>
                <span className="text-[10px] text-muted-foreground">รายการ</span>
              </div>
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 p-3 text-center">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">
                  เบิกจ่ายสะสม
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                  {formatCurrency(stats?.paidAmount || 0)}
                </span>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                  จ่ายแล้ว
                </span>
              </div>
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 p-3 text-center">
                <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium">
                  ค้างชำระสะสม
                </span>
                <span className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5 block truncate">
                  {formatCurrency(stats?.pendingAmount || 0)}
                </span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                  รอเบิกจ่าย
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={
                      selectedDepartmentId
                        ? `/all-bills?departmentId=${selectedDepartmentId}`
                        : "/all-bills"
                    }
                  />
                }
                className="flex-1 text-xs gap-1.5"
              >
                <FileText className="size-3.5" /> ดูบิลทั้งหมด
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={
                      selectedDepartmentId
                        ? `/services?departmentId=${selectedDepartmentId}`
                        : "/services"
                    }
                  />
                }
                className="flex-1 text-xs gap-1.5"
              >
                <Building className="size-3.5" /> บริการมิเตอร์
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <TrendFullscreenDialog
        open={isTrendFullscreen}
        onOpenChange={setIsTrendFullscreen}
        title={
          scope === "all"
            ? "แนวโน้มการเบิกจ่ายค่าสาธารณูปโภค (ทั้งกรม)"
            : `แนวโน้มการเบิกจ่ายค่าสาธารณูปโภค (${deptDisplayName})`
        }
        description={
          scope === "all"
            ? `กราฟเปรียบเทียบค่าใช้จ่ายแต่ละประเภทสาธารณูปโภค 292 หน่วยงาน (${currentPeriod.label})`
            : `กราฟเปรียบเทียบค่าใช้จ่ายแต่ละประเภทสาธารณูปโภคของ ${stats?.departmentName || currentDepartment?.fullName || "หน่วยงานนี้"} (${currentPeriod.label})`
        }
        data={trendData}
        defaultMonths={period}
      />
    </div>
  );
}
