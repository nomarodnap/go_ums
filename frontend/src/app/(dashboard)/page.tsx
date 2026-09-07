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
  Building,
  ArrowRight,
  PlusCircle,
  FileText,
  FilePlus2,
  Bell,
  Sparkles,
  CheckCircle2,
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

export default function DashboardOverview() {
  const { data: userData } = useGetCurrentUser();
  const user = userData?.status === 200 ? userData.data.user : null;
  const isAdmin = [
    "admin",
    "auditor",
    "strategy_finance",
    "central_staff",
  ].includes(user?.role || "");

  const { data: summaryRes, isLoading } = useGetDashboardSummary({
    scope: "department",
  } as any);

  const stats = summaryRes?.status === 200 ? (summaryRes.data as any) : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const departmentName =
    stats?.departmentName || user?.departmentName || "หน่วยงานของคุณ";

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
              ภาพรวม
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            การบริหารจัดการและติดตามค่าสาธารณูปโภค —{" "}
            <span className="font-semibold text-foreground">
              {departmentName}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            render={<Link href="/bills/new" />}
            className="gap-2 shadow-xs"
          >
            <PlusCircle className="size-4" /> บันทึกบิลใหม่
          </Button>

          {isAdmin && (
            <Button
              render={<Link href="/overview" />}
              variant="outline"
              className="gap-2"
            >
              <Building className="size-4 text-muted-foreground" /> แดชบอร์ดภาพรวมทั้งกรม
            </Button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards (Apple Widget Style) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Invoices recorded */}
        <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08]">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                บิลบันทึกเข้าระบบ (เดือนนี้)
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
                รอบบิลเดือนปัจจุบัน
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Total Paid */}
        <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08]">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                เบิกจ่ายแล้ว (เดือนนี้)
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
                ยอดขอเบิกจ่ายสำเร็จแล้ว
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Pending */}
        <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08]">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                ค้างชำระ (ทั้งหมด)
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
                href="/bills"
                className="text-xs text-amber-600/90 dark:text-amber-400/90 hover:underline inline-flex items-center font-medium mt-1 gap-1"
              >
                จัดการรายการเบิกจ่าย <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Anomalies */}
        <Card className="apple-card-hover border-black/[0.06] dark:border-white/[0.08]">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                ตรวจสอบพบความผิดปกติ
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
                href={isAdmin ? "/all-bills" : "/bills"}
                className={`text-xs hover:underline inline-flex items-center font-medium mt-1 gap-1 ${
                  totalAnomalies > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                ดูรายการบิล <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Shortcuts Grid (Apple Bento Box style) */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              เมนูลัดสำหรับหน่วยงาน (Quick Actions)
            </h2>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            เข้าถึงฟังก์ชันงานหลักได้สะดวกรวดเร็ว
          </span>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/bills/new"
            className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 p-4.5 backdrop-blur-xl shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md cursor-pointer"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <FilePlus2 className="size-5" />
                </div>
                <Badge
                  variant="success"
                  className="text-[10px] h-5"
                >
                  บันทึกข้อมูล
                </Badge>
              </div>
              <h3 className="font-semibold text-sm text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                บันทึกบิลใหม่
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                บันทึกใบแจ้งหนี้ค่าไฟฟ้า น้ำประปา โทรศัพท์ เพื่อขอเบิกจ่าย
              </p>
            </div>
            <div className="mt-3.5 flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span>สร้างรายการ</span>
              <ArrowRight className="ml-1 size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/bills"
            className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 p-4.5 backdrop-blur-xl shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-md cursor-pointer"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 group-hover:scale-105 transition-transform">
                  <FileText className="size-5" />
                </div>
                <Badge
                  variant="default"
                  className="text-[10px] h-5"
                >
                  จัดการบิล
                </Badge>
              </div>
              <h3 className="font-semibold text-sm text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                รายการค่าใช้จ่ายหน่วยงาน
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                ตรวจสอบประวัติการเบิกจ่าย สถานะบิล และแก้ไขข้อมูล
              </p>
            </div>
            <div className="mt-3.5 flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
              <span>ดูรายการบิล</span>
              <ArrowRight className="ml-1 size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/services"
            className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 p-4.5 backdrop-blur-xl shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-md cursor-pointer"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <Activity className="size-5" />
                </div>
                <Badge
                  variant="warning"
                  className="text-[10px] h-5"
                >
                  ทะเบียนบริการ
                </Badge>
              </div>
              <h3 className="font-semibold text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                รหัสเครื่องวัด / เบอร์โทร
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                ทะเบียนเลขมิเตอร์ไฟฟ้า น้ำประปา และเบอร์โทรศัพท์ของหน่วยงาน
              </p>
            </div>
            <div className="mt-3.5 flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
              <span>จัดการทะเบียน</span>
              <ArrowRight className="ml-1 size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/notifications"
            className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 p-4.5 backdrop-blur-xl shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-md cursor-pointer"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 group-hover:scale-105 transition-transform">
                  <Bell className="size-5" />
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5"
                >
                  การแจ้งเตือน
                </Badge>
              </div>
              <h3 className="font-semibold text-sm text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                ศูนย์การแจ้งเตือน
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                ติดตามการแจ้งเตือนเตือนชำระบิลและแจ้งเตือนงบประมาณ
              </p>
            </div>
            <div className="mt-3.5 flex items-center text-xs font-medium text-purple-600 dark:text-purple-400">
              <span>ดูการแจ้งเตือน</span>
              <ArrowRight className="ml-1 size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-1 md:col-span-2 lg:col-span-5 border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold tracking-tight">
              แนวโน้มการเบิกจ่ายค่าสาธารณูปโภคของหน่วยงาน
            </CardTitle>
            <CardDescription>
              กราฟเปรียบเทียบค่าใช้จ่ายแต่ละประเภทสาธารณูปโภค
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
              สถานะบิลของหน่วยงาน
            </CardTitle>
            <CardDescription>สัดส่วนสถานะบิลทั้งหมด</CardDescription>
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

      {/* Recent Anomalies Table Card */}
      <div>
        <Card className="border-black/[0.06] dark:border-white/[0.08]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  รายการบิลที่พบความผิดปกติล่าสุดของหน่วยงาน
                </CardTitle>
                <CardDescription>
                  5 รายการล่าสุดที่ถูกปักธงหรือมีข้อมูลไม่สอดคล้อง
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={isAdmin ? "/all-bills" : "/bills"} />}
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
    </div>
  );
}
