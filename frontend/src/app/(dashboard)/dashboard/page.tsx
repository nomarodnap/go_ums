"use client";

import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Maximize2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { LoadingEffect } from "@/components/ui/loading-effect";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { useGetDashboardSummary } from "@/lib/api/generated/dashboard/dashboard";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { value: "1m", label: "เดือนนี้" },
  { value: "3m", label: "3 เดือนล่าสุด" },
  { value: "6m", label: "6 เดือนล่าสุด" },
  { value: "12m", label: "12 เดือนล่าสุด" },
] as const;

type PeriodOption = (typeof PERIOD_OPTIONS)[number]["value"];

export default function DashboardOverview() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodOption>("1m");
  const [isTrendFullscreen, setIsTrendFullscreen] = useState(false);
  const currentPeriod = PERIOD_OPTIONS.find((p) => p.value === period) || PERIOD_OPTIONS[0];

  const { data: userData } = useGetCurrentUser();
  const user = userData?.status === 200 ? userData.data.user : null;

  const isAdmin = ["admin", "auditor", "strategy_finance", "central_staff"].includes(
    user?.role || "",
  );

  const { data: summaryRes, isLoading } = useGetDashboardSummary({
    scope: "department",
    departmentId: user?.departmentId || undefined,
    period,
  } as any);

  const stats = summaryRes?.status === 200 ? (summaryRes.data as any) : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const departmentName = stats?.departmentName || user?.departmentName || "หน่วยงานของคุณ";

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
        id: a.id,
        billCode: a.billCode,
        departmentName: a.departmentName || departmentName,
        utilityType: a.utilityType,
        billingMonth: a.billingMonth,
        billingYear: a.billingYear,
        invoiceAmount: a.invoiceAmount != null ? String(a.invoiceAmount) : "0",
        isManualAnomaly: a.isManualAnomaly,
        manualAnomalyReason: a.manualAnomalyReason,
        isLateReceive: a.isLateReceive,
        isLatePayment: a.isLatePayment,
        isOverdueMoreThan2Months: a.isOverdueMoreThan2Months,
        isDisbursementOver2Months: a.isDisbursementOver2Months,
      }));
    }
    return [];
  }, [stats?.recentAnomalies, departmentName]);

  if (isLoading) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดข้อมูลแดชบอร์ดหน่วยงาน..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              แดชบอร์ดหน่วยงาน
            </h1>
            <Badge variant="secondary" className="font-normal text-xs">
              {currentPeriod.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            การบริหารจัดการและติดตามค่าสาธารณูปโภค —{" "}
            <span className="font-semibold text-foreground">{departmentName}</span>
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="inline-flex items-center p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md shadow-xs self-start sm:self-auto">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={cn(
                "px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 cursor-pointer select-none",
                period === opt.value
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.04]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Metric Cards (Apple Widget Style with NumberFlow & Motion) */}
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
        {/* Metric 1: Invoices recorded */}
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
                <p className="text-xs text-muted-foreground/80 mt-1">
                  รอบบิล{period === "1m" ? "เดือนปัจจุบัน" : currentPeriod.label}
                </p>
                <Link
                  href="/bills"
                  className="text-xs text-blue-600/90 dark:text-blue-400/90 hover:underline inline-flex items-center font-medium mt-2 gap-1"
                >
                  ดูรายการบันทึกทั้งหมด <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Metric 2: Total Paid */}
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
                  href="/bills?status=PAID"
                  className="text-xs text-emerald-600/90 dark:text-emerald-400/90 hover:underline inline-flex items-center font-medium mt-2 gap-1"
                >
                  ดูรายการเบิกจ่ายแล้ว <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Metric 3: Pending */}
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
                    ค้างชำระ
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
                  href="/bills?status=OVERDUE"
                  className="text-xs text-amber-600/90 dark:text-amber-400/90 hover:underline inline-flex items-center font-medium mt-2 gap-1"
                >
                  ดูรายการค้างชำระ <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Metric 4: Anomalies */}
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
                  href="/bills?anomaly=true"
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
        scope="department"
        departmentId={user?.departmentId || undefined}
        enabled={Boolean(user?.departmentId)}
      />

      {/* AI Forecasting, Budget Planning & Early Alerts */}
      <ForecastPanel
        scope="department"
        departmentId={user?.departmentId || undefined}
        enabled={Boolean(user?.departmentId)}
        billsHref="/bills"
      />

      {/* Analytics Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
        <Card className="col-span-1 md:col-span-2 lg:col-span-6 border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                แนวโน้มการเบิกจ่ายค่าสาธารณูปโภคของหน่วยงาน
              </CardTitle>
              <CardDescription>
                กราฟเปรียบเทียบค่าใช้จ่ายแต่ละประเภทสาธารณูปโภค ({currentPeriod.label})
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
                defaultMonths={
                  period === "1m" ? "3" : period === "3m" ? "3" : period === "6m" ? "6" : "12"
                }
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
              สถานะใบแจ้งหนี้ของหน่วยงาน
            </CardTitle>
            <CardDescription>สัดส่วนสถานะใบแจ้งหนี้ ({currentPeriod.label})</CardDescription>
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
              สถานะการบันทึกหมายเลข
            </CardTitle>
            <CardDescription>สัดส่วนหมายเลขที่บันทึก ({currentPeriod.label})</CardDescription>
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

      {/* Recent Anomalies Table Card */}
      <div>
        <Card className="border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  รายการบันทึกที่ตรวจสอบพบความคลาดเคลื่อน
                </CardTitle>
                <CardDescription>
                  5 รายการล่าสุดที่ถูกปักธงหรือมีข้อมูลไม่สอดคล้อง ({currentPeriod.label})
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/bills?anomaly=true" />}
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
      </div>

      <TrendFullscreenDialog
        open={isTrendFullscreen}
        onOpenChange={setIsTrendFullscreen}
        title="แนวโน้มการเบิกจ่ายค่าสาธารณูปโภคของหน่วยงาน"
        description={`กราฟเปรียบเทียบค่าใช้จ่ายแต่ละประเภทสาธารณูปโภค (${currentPeriod.label})`}
        data={trendData}
        defaultMonths={period === "1m" ? "3" : period === "3m" ? "3" : period === "6m" ? "6" : "12"}
      />
    </div>
  );
}
