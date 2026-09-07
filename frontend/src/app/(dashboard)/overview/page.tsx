"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  Building2,
  ArrowRight,
  FileText,
  CheckCircle2,
  Trophy,
  ShieldAlert,
} from "lucide-react";
import {
  TrendChart,
  StatusPieChart,
  type TrendDataPoint,
  type StatusDataPoint,
} from "@/components/dashboard/dashboard-charts";
import {
  RecentAnomaliesTable,
  type RecentAnomaly,
} from "@/components/dashboard/recent-anomalies-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetDashboardSummary } from "@/lib/api/generated/dashboard/dashboard";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";

export default function OverviewPage() {
  const { data: userData, isLoading: isUserLoading } = useGetCurrentUser();
  const user = userData?.status === 200 ? userData.data.user : null;

  const allowedRoles = ["admin", "auditor", "strategy_finance", "central_staff"];
  const isAuthorized = user ? allowedRoles.includes(user.role || "") : false;

  const { data: summaryRes } = useGetDashboardSummary(
    {
      scope: "all",
    } as any,
    {
      query: {
        enabled: isAuthorized,
      },
    }
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
  const totalPendingBills = stats?.totalPendingBills ?? 0;
  const totalAnomalies = stats?.totalAnomalies ?? 0;

  const trendData: TrendDataPoint[] = useMemo(() => {
    if (stats?.trendData && stats.trendData.length > 0) {
      return stats.trendData;
    }
    const defaultMonths = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
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

  const recentAnomalies: RecentAnomaly[] = useMemo(() => {
    if (stats?.recentAnomalies && Array.isArray(stats.recentAnomalies)) {
      return stats.recentAnomalies.map((a: any) => ({
        id: a.id,
        departmentName: a.departmentName || "ไม่ระบุ",
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
          <h2 className="text-xl font-bold text-foreground">
            ไม่มีสิทธิ์เข้าถึงแดชบอร์ดภาพรวมทั้งกรม
          </h2>
          <p className="text-sm text-muted-foreground">
            หน้านี้สงวนไว้สำหรับผู้ดูแลระบบและฝ่ายบริหาร (Admin, Auditor, Strategy Finance, Central Staff) เท่านั้น
          </p>
        </div>
        <Button render={<Link href="/" />} variant="outline" className="mt-2">
          กลับไปแดชบอร์ดหน่วยงานตนเอง
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              แดชบอร์ดภาพรวมทั้งกรม
            </h1>
            <Badge variant="default" className="font-semibold text-xs">
              Admin & Exec Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            ภาพรวมการบริหารจัดการค่าสาธารณูปโภค 292 หน่วยงาน (ส่วนกลางและภูมิภาค)
          </p>
        </div>

        <Button
          render={<Link href="/" />}
          variant="outline"
          className="self-start sm:self-auto gap-2 shadow-xs"
        >
          <Building2 className="size-4 text-muted-foreground" />{" "}
          กลับไปแดชบอร์ดหน่วยงานตนเอง
        </Button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08]">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                บันทึกบิลทั้งกรม (เดือนนี้)
              </span>
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <FileText className="size-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {totalInvoicesCurrentMonth.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  รายการ
                </span>
              </div>
              <p className="text-xs text-muted-foreground/80 mt-1">
                จากทุกหน่วยงานทั่วประเทศ
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08]">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                เบิกจ่ายแล้วทั้งกรม (เดือนนี้)
              </span>
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <CheckCircle2 className="size-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {formatCurrency(totalPaidCurrentMonth)}
              </div>
              <p className="text-xs text-muted-foreground/80 mt-1">
                ยอดเบิกจ่ายสะสมเดือนปัจจุบัน
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08]">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                ค้างชำระทั้งหมด (ทั้งกรม)
              </span>
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <AlertTriangle className="size-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {totalPendingBills.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  รายการ
                </span>
              </div>
              <Link
                href="/all-bills"
                className="text-xs text-amber-600/90 dark:text-amber-400/90 hover:underline inline-flex items-center font-medium mt-1 gap-1"
              >
                ดูรายการทั้งหมด <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4 */}
        <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08]">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                พบความผิดปกติทั้งกรม
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
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                  totalAnomalies > 0
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {totalAnomalies.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  รายการ
                </span>
              </div>
              <Link
                href="/all-bills"
                className={`text-xs hover:underline inline-flex items-center font-medium mt-1 gap-1 ${
                  totalAnomalies > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                ดูบิลที่พบความผิดปกติ <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-1 md:col-span-2 lg:col-span-5 border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold tracking-tight">
              แนวโน้มการเบิกจ่ายค่าสาธารณูปโภค (ทั้งกรม)
            </CardTitle>
            <CardDescription>
              กราฟเปรียบเทียบค่าใช้จ่ายแต่ละประเภทสาธารณูปโภค 292 หน่วยงาน (12 เดือนย้อนหลัง)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {trendData.length > 0 ? (
              <TrendChart data={trendData} />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                ไม่มีข้อมูลเพียงพอสำหรับการแสดงกราฟ
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 lg:col-span-2 border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold tracking-tight">
              สถานะบิลทั้งกรม
            </CardTitle>
            <CardDescription>สัดส่วนสถานะบิลทั้งหมดของทุกหน่วยงาน</CardDescription>
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
      </div>

      {/* Tables Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  รายการบิลที่พบความผิดปกติล่าสุด (ทั้งกรม)
                </CardTitle>
                <CardDescription>
                  5 รายการล่าสุดที่ถูกปักธงหรือมีข้อมูลไม่สอดคล้อง
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/all-bills" />}
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

        <Card className="border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="size-4.5 text-amber-500" />
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  5 อันดับหน่วยงานที่เบิกจ่ายสูงสุด
                </CardTitle>
                <CardDescription>
                  ยอดรวมเบิกจ่ายแล้วของแต่ละหน่วยงาน (สะสม)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4.5 mt-1">
              {topDepartments.length > 0 ? (
                topDepartments.map((dept, i) => {
                  const maxAmount = Math.max(
                    ...topDepartments.map((d) => Number(d.amount)),
                  );
                  const percentage =
                    maxAmount > 0 ? (Number(dept.amount) / maxAmount) * 100 : 0;

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
      </div>
    </div>
  );
}
