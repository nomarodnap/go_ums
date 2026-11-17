"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  LineChart as LineChartIcon,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  type AlertPredictionItem,
  type BudgetPlanStatus,
  extractAIErrorMessage,
  useAIForecast,
  useGenerateAIForecastInsights,
} from "@/lib/api/ai-hooks";
import { cn } from "@/lib/utils";

export type ForecastTabId = "forecast" | "budget" | "alerts";

export interface ForecastPanelProps {
  scope?: "all" | "department";
  departmentId?: string;
  defaultTab?: ForecastTabId;
  enabled?: boolean;
  billsHref?: string;
}

const TABS: { id: ForecastTabId; label: string }[] = [
  { id: "forecast", label: "พยากรณ์ค่าใช้จ่าย" },
  { id: "budget", label: "วางแผนงบประมาณ" },
  { id: "alerts", label: "คาดการณ์ความเสี่ยงล่วงหน้า" },
];

const forecastChartConfig = {
  actualLine: {
    label: "ยอดค่าใช้จ่ายจริง",
    color: "var(--chart-1)",
  },
  predictedLine: {
    label: "ค่าพยากรณ์",
    color: "var(--chart-3)",
  },
  upperBound: {
    label: "ขอบเขตบน (80%)",
    color: "var(--chart-5)",
  },
  lowerBound: {
    label: "ขอบเขตล่าง (80%)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const BUDGET_STATUS_META: Record<
  BudgetPlanStatus,
  { label: string; badgeClass: string; barFill: string }
> = {
  HEALTHY: {
    label: "เพียงพอทั้งปีงบประมาณ",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    barFill: "oklch(0.65 0.17 155)",
  },
  WATCH: {
    label: "เฝ้าระวังใกล้เกณฑ์",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    barFill: "var(--primary)",
  },
  RISK: {
    label: "เสี่ยงงบไม่พอ (>90%)",
    badgeClass: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    barFill: "oklch(0.72 0.17 70)",
  },
  DEFICIT: {
    label: "คาดการณ์งบขาดดุล",
    badgeClass: "border-destructive/40 bg-destructive/10 text-destructive",
    barFill: "var(--destructive)",
  },
  NO_BUDGET: {
    label: "ยังไม่มีข้อมูลงบจัดสรร",
    badgeClass: "border-border bg-muted text-muted-foreground",
    barFill: "var(--muted-foreground)",
  },
};

const SEVERITY_META: Record<AlertPredictionItem["severity"], { label: string; className: string }> =
  {
    HIGH: {
      label: "ความเสี่ยงสูง",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    },
    MEDIUM: {
      label: "ความเสี่ยงปานกลาง",
      className: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    },
    LOW: {
      label: "เฝ้าระวัง",
      className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
  };

const toUniqueKeyed = (prefix: string, items: string[]) => {
  const seen = new Map<string, number>();
  return items.map((text) => {
    const count = (seen.get(text) ?? 0) + 1;
    seen.set(text, count);
    return { key: `${prefix}-${text}-${count}`, text };
  });
};

const formatTHB = (value: number, decimals = 0) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

const formatAxisTHB = (value: number) => {
  if (Math.abs(value) >= 1_000_000) {
    return `฿${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `฿${Math.round(value / 1000)}k`;
  }
  return `฿${Math.round(value)}`;
};

export function ForecastPanel({
  scope = "department",
  departmentId,
  defaultTab = "forecast",
  enabled = true,
  billsHref,
}: ForecastPanelProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const horizonSelectId = `${baseId}-horizon`;
  const fiscalYearSelectId = `${baseId}-fy`;
  const seriesTableCaptionId = `${baseId}-series-caption`;
  const budgetTableCaptionId = `${baseId}-budget-caption`;
  const ytdProgressLabelId = `${baseId}-ytd-progress`;
  const projProgressLabelId = `${baseId}-proj-progress`;

  const [horizon, setHorizon] = useState<number>(6);
  const [fiscalYear, setFiscalYear] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ForecastTabId>(defaultTab);
  const tabRefs = useRef<Record<ForecastTabId, HTMLButtonElement | null>>({
    forecast: null,
    budget: null,
    alerts: null,
  });

  const {
    data: forecastData,
    isLoading,
    error,
  } = useAIForecast({
    scope,
    departmentId,
    horizon,
    fiscalYear,
    enabled,
  });

  const generateMutation = useGenerateAIForecastInsights();

  // Clear stale mutation state when scope, department, horizon, or fiscal year changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset mutation status when query target changes
  useEffect(() => {
    generateMutation.reset();
  }, [scope, departmentId, horizon, fiscalYear]);

  const activeData = useMemo(() => {
    if (
      generateMutation.data &&
      generateMutation.data.scope === scope &&
      generateMutation.data.horizon === horizon &&
      (scope === "all" || generateMutation.data.departmentId === departmentId) &&
      (fiscalYear === 0 || generateMutation.data.budgetPlan.fiscalYearBE === fiscalYear)
    ) {
      return generateMutation.data;
    }
    return forecastData;
  }, [generateMutation.data, forecastData, scope, departmentId, horizon, fiscalYear]);

  const chartSeriesData = useMemo(() => {
    if (!activeData?.series) return [];
    const lastHistIdx = activeData.series.reduce(
      (acc, pt, idx) => (!pt.isForecast ? idx : acc),
      -1,
    );
    return activeData.series.map((pt, idx) => ({
      ...pt,
      actualLine: !pt.isForecast ? pt.actualAmount : null,
      predictedLine: pt.isForecast
        ? pt.predictedAmount
        : idx === lastHistIdx
          ? pt.actualAmount
          : null,
      upperBandPlot: pt.isForecast ? pt.upperBound : null,
      lowerBandPlot: pt.isForecast ? pt.lowerBound : null,
    }));
  }, [activeData?.series]);

  const boundaryLabel = useMemo(() => {
    const futurePt = activeData?.series.find((pt) => pt.isForecast);
    return futurePt?.label;
  }, [activeData?.series]);

  const handleGenerateInsights = () => {
    generateMutation.mutate({
      scope,
      departmentId: scope === "department" ? departmentId : undefined,
      horizon,
      fiscalYear,
      force: Boolean(activeData?.insights.hasInsights),
    });
  };

  const selectTab = (nextId: ForecastTabId, moveFocus = false) => {
    setActiveTab(nextId);
    const el = tabRefs.current[nextId];
    if (el) {
      if (moveFocus) {
        el.focus();
      }
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let targetIndex: number | null = null;
    if (e.key === "ArrowRight") {
      targetIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      targetIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = TABS.length - 1;
    }
    if (targetIndex !== null) {
      e.preventDefault();
      selectTab(TABS[targetIndex].id, true);
    }
  };

  if (!enabled) {
    return null;
  }

  const budget = activeData?.budgetPlan;
  const budgetMeta =
    BUDGET_STATUS_META[budget?.status ?? "NO_BUDGET"] ?? BUDGET_STATUS_META.NO_BUDGET;
  const insights = activeData?.insights;
  const aiEnabled = activeData?.enabled ?? true;
  const alerts = activeData?.alertPredictions ?? [];
  const highRiskCount = alerts.filter((a) => a.severity === "HIGH").length;
  const momUp = (activeData?.moMForecastChangePct ?? 0) > 0;

  const resolvedBillsLink = billsHref ?? (scope === "all" ? "/all-bills" : "/bills");

  const availableFY = budget?.availableFiscalYearsBE ?? [];

  return (
    <Card
      aria-labelledby={headingId}
      className="border-black/[0.06] dark:border-white/[0.08] bg-gradient-to-br from-card via-card to-sky-500/[0.025]"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
              <LineChartIcon className="size-4.5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id={headingId}
                  className="text-base font-semibold tracking-tight text-foreground"
                >
                  การพยากรณ์ค่าใช้จ่ายและวางแผนงบประมาณ (AI Forecasting)
                </h2>
                {activeData?.confidenceLabel && (
                  <Badge variant="secondary" className="text-[11px] font-medium">
                    {activeData.confidenceLabel}
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-0.5 text-xs flex flex-wrap items-center gap-2">
                <span>
                  {activeData?.departmentName ||
                    (scope === "all" ? "ภาพรวมทั้งกรมประมง" : "เฉพาะหน่วยงาน")}
                </span>
                {budget?.fiscalYearLabel && (
                  <span className="text-muted-foreground">• {budget.fiscalYearLabel}</span>
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor={horizonSelectId}
                className="text-xs font-medium text-muted-foreground whitespace-nowrap"
              >
                ระยะพยากรณ์
              </label>
              <select
                id={horizonSelectId}
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                className="min-h-8 h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <option value={3}>3 เดือน</option>
                <option value={6}>6 เดือน</option>
                <option value={12}>12 เดือน</option>
              </select>
            </div>

            {availableFY.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor={fiscalYearSelectId}
                  className="text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  ปีงบประมาณ
                </label>
                <select
                  id={fiscalYearSelectId}
                  value={fiscalYear > 0 ? fiscalYear : (budget?.fiscalYearBE ?? availableFY[0])}
                  onChange={(e) => setFiscalYear(Number(e.target.value))}
                  className="min-h-8 h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {availableFY.map((fy) => (
                    <option key={fy} value={fy}>
                      พ.ศ. {fy}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              type="button"
              variant={insights?.hasInsights ? "outline" : "default"}
              size="sm"
              onClick={handleGenerateInsights}
              disabled={isLoading || generateMutation.isPending || !aiEnabled || Boolean(error)}
              className="min-h-8 h-8 px-3 text-xs rounded-xl gap-1.5 shrink-0 cursor-pointer"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {generateMutation.isPending
                ? "กำลังวิเคราะห์..."
                : insights?.hasInsights
                  ? "อัปเดตคำแนะนำ AI"
                  : "วิเคราะห์แผนงบด้วย AI"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && !activeData && (
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-3.5 space-y-2">
            <span className="text-xs font-medium text-primary block">
              กำลังคำนวณอนุกรมเวลาและแผนงบประมาณ...
            </span>
            <progress aria-label="กำลังโหลดข้อมูลพยากรณ์ค่าสาธารณูปโภค" className="ai-progress" />
          </div>
        )}

        {error && !activeData && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {extractAIErrorMessage(
                error,
                "ไม่สามารถโหลดข้อมูลการพยากรณ์ได้ กรุณาตรวจสอบการเชื่อมต่อ Backend",
              )}
            </span>
          </div>
        )}

        {activeData && (
          <>
            {/* Top 3 KPI Summary Strip */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    คาดการณ์{activeData.nextMonthLabel || "เดือนถัดไป"}
                  </span>
                  {activeData.latestMonthActual > 0 && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[11px] font-semibold",
                        momUp
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      {momUp ? (
                        <TrendingUp className="size-3" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="size-3" aria-hidden="true" />
                      )}
                      {activeData.moMForecastChangePct > 0 ? "+" : ""}
                      {activeData.moMForecastChangePct}%
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  ฿{formatTHB(activeData.nextMonthPredicted, 0)}
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  ช่วงเชื่อมั่น 80%: ฿{formatTHB(activeData.nextMonthLowerBound, 0)} – ฿
                  {formatTHB(activeData.nextMonthUpperBound, 0)}
                </p>
              </div>

              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    แนวโน้มการใช้ทั้งปีงบ ({budget?.fiscalYearBE || "-"})
                  </span>
                  <Badge variant="outline" className={cn("text-[10px]", budgetMeta.badgeClass)}>
                    {budgetMeta.label}
                  </Badge>
                </div>
                <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  ฿{formatTHB(budget?.projectedTotalSpend ?? 0, 0)}
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  งบสุทธิ ฿{formatTHB(budget?.netBudget ?? 0, 0)} •{" "}
                  {(budget?.projectedBalance ?? 0) < 0 ? (
                    <span className="text-destructive font-semibold">
                      ขาดดุล -฿{formatTHB(Math.abs(budget?.projectedBalance ?? 0), 0)}
                    </span>
                  ) : (
                    <span>คงเหลือคาดการณ์ ฿{formatTHB(budget?.projectedBalance ?? 0, 0)}</span>
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    คาดการณ์ความเสี่ยงล่วงหน้า
                  </span>
                  <ShieldAlert
                    className={cn(
                      "size-4",
                      highRiskCount > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                </div>
                <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {alerts.length} รายการ
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {highRiskCount > 0
                    ? `ความเสี่ยงสูง ${highRiskCount} รายการควรตรวจสอบก่อนปิดรอบ`
                    : alerts.length > 0
                      ? "ควรติดตามตามรอบบิลถัดไป"
                      : "ไม่พบสัญญาณเตือนผิดปกติในรอบถัดไป"}
                </p>
              </div>
            </div>

            {generateMutation.isPending && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                <span className="text-xs font-medium text-primary block">
                  กำลังสรุปแผนงบประมาณและมาตรการป้องกันล่วงหน้าด้วย Gemini AI...
                </span>
                <progress
                  aria-label="กำลังวิเคราะห์แผนงบประมาณด้วย Gemini AI"
                  className="ai-progress"
                />
              </div>
            )}

            {generateMutation.isError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2"
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  {extractAIErrorMessage(
                    generateMutation.error,
                    "ไม่สามารถสร้างคำแนะนำพยากรณ์ AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
                  )}
                </span>
              </div>
            )}

            {/* Single-row accessible tabs */}
            <div>
              <div
                role="tablist"
                aria-label="หมวดหมู่การพยากรณ์และวางแผน AI"
                className="ai-tabs-list border-b border-border gap-1"
              >
                {TABS.map((tab, idx) => {
                  const selected = activeTab === tab.id;
                  const badgeCount = tab.id === "alerts" ? alerts.length : undefined;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tab.id] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`${baseId}-tab-${tab.id}`}
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => selectTab(tab.id)}
                      onKeyDown={(e) => handleTabKeyDown(e, idx)}
                      className={cn(
                        "min-h-9 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-ring",
                        selected
                          ? "text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span>{tab.label}</span>
                      {badgeCount !== undefined && badgeCount > 0 && (
                        <Badge
                          variant={highRiskCount > 0 ? "destructive" : "secondary"}
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {badgeCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Panel 1: Expense Forecasting */}
              <div
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-forecast`}
                hidden={activeTab !== "forecast"}
                tabIndex={
                  activeTab === "forecast" && activeData.series.length === 0 ? 0 : undefined
                }
              >
                <div className="pt-4 space-y-4">
                  {chartSeriesData.length > 0 ? (
                    <figure className="rounded-xl border border-border/60 bg-card p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold text-foreground">
                          อนุกรมเวลาย้อนหลังและค่าพยากรณ์ {horizon} เดือนข้างหน้า
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          โมเดล: {activeData.method}
                        </span>
                      </div>
                      <ChartContainer
                        config={forecastChartConfig}
                        className="h-[270px] w-full aspect-auto"
                      >
                        <ComposedChart
                          data={chartSeriesData}
                          margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id={`${baseId}-actual-grad`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="var(--color-actualLine)"
                                stopOpacity={0.32}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--color-actualLine)"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            fontSize={11}
                          />
                          <YAxis
                            tickFormatter={formatAxisTHB}
                            tickLine={false}
                            axisLine={false}
                            width={64}
                            fontSize={11}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          {boundaryLabel && (
                            <ReferenceLine
                              x={boundaryLabel}
                              stroke="var(--muted-foreground)"
                              strokeDasharray="3 3"
                              opacity={0.5}
                            />
                          )}
                          <Area
                            type="monotone"
                            dataKey="upperBandPlot"
                            name="upperBound"
                            stroke="var(--color-upperBound)"
                            strokeDasharray="2 3"
                            strokeWidth={1.2}
                            fill="var(--color-upperBound)"
                            fillOpacity={0.08}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="lowerBandPlot"
                            name="lowerBound"
                            stroke="var(--color-lowerBound)"
                            strokeDasharray="2 3"
                            strokeWidth={1.2}
                            dot={false}
                            connectNulls={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="actualLine"
                            name="actualLine"
                            stroke="var(--color-actualLine)"
                            strokeWidth={2.2}
                            fill={`url(#${baseId}-actual-grad)`}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="predictedLine"
                            name="predictedLine"
                            stroke="var(--color-predictedLine)"
                            strokeWidth={2.4}
                            strokeDasharray="5 5"
                            dot={{ r: 3 }}
                            connectNulls={false}
                          />
                        </ComposedChart>
                      </ChartContainer>
                      <figcaption className="text-[11px] text-muted-foreground">
                        เส้นทึบสีน้ำเงินแสดงยอดค่าใช้จ่ายจริงย้อนหลัง และเส้นประสีส้มแสดงค่าพยากรณ์ล่วงหน้า {horizon}{" "}
                        เดือน พร้อมกรอบความเชื่อมั่น 80% ตามฤดูกาล
                      </figcaption>
                    </figure>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                      ยังไม่มีประวัติใบแจ้งหนี้เพียงพอสำหรับการพยากรณ์แนวโน้มรายเดือน
                    </div>
                  )}

                  {/* Per-utility breakdown */}
                  <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-3">
                    <h3 className="text-xs font-semibold text-foreground">
                      ประมาณการแยกตามประเภทสาธารณูปโภค (เดือนถัดไป)
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {activeData.utilityBreakdown.map((item, idx) => {
                        const pct = Math.min(100, Math.max(0, item.sharePct));
                        const pLabelId = `${baseId}-util-lbl-${idx}`;
                        return (
                          <div
                            key={item.utilityType}
                            className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                id={pLabelId}
                                className="text-xs font-semibold text-foreground truncate"
                              >
                                {item.utilityType}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {item.sharePct}%
                              </span>
                            </div>
                            <div className="text-sm font-bold text-foreground tabular-nums">
                              ฿{formatTHB(item.nextMonthPredicted, 0)}
                            </div>
                            <progress
                              aria-labelledby={pLabelId}
                              value={pct}
                              max={100}
                              className="ai-progress"
                            />
                            <span className="text-[11px] text-muted-foreground block tabular-nums">
                              เฉลี่ย 3 เดือน: ฿{formatTHB(item.avgRecent3Months, 0)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Accessible data table alternative for the chart */}
                  {activeData.series.length > 0 && (
                    <details className="ai-disclosure rounded-xl border border-border/60 bg-card p-3.5">
                      <summary className="min-h-8 flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer select-none">
                        <ChevronDown
                          className="ai-disclosure-chevron size-4 text-primary shrink-0"
                          aria-hidden="true"
                        />
                        <span>ตารางข้อมูลอนุกรมเวลา ({activeData.series.length} เดือน)</span>
                      </summary>
                      <div className="mt-3">
                        <div
                          tabIndex={0}
                          role="region"
                          aria-labelledby={seriesTableCaptionId}
                          className="ai-responsive-table-wrap rounded-lg border border-border/50"
                        >
                          <table className="ai-responsive-table ai-table-series text-xs">
                            <caption id={seriesTableCaptionId} className="sr-only">
                              ตารางข้อมูลค่าใช้จ่ายจริงและค่าพยากรณ์รายเดือน
                            </caption>
                            <thead>
                              <tr className="border-b border-border text-muted-foreground">
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  เดือน / พ.ศ.
                                </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  ประเภท
                                </th>
                                <th scope="col" className="px-3 py-2 text-right font-medium">
                                  ยอดจริง (บาท)
                                </th>
                                <th scope="col" className="px-3 py-2 text-right font-medium">
                                  พยากรณ์ (บาท)
                                </th>
                                <th scope="col" className="px-3 py-2 text-right font-medium">
                                  ช่วงคาดการณ์ 80%
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {activeData.series.map((pt) => (
                                <tr key={`${pt.yearCE}-${pt.month}`}>
                                  <th
                                    scope="row"
                                    className="px-3 py-2 font-medium text-foreground whitespace-nowrap"
                                  >
                                    {pt.fullLabel}
                                  </th>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {pt.isForecast ? "พยากรณ์" : "ข้อมูลจริง"}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {pt.isForecast ? "–" : formatTHB(pt.actualAmount, 2)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                                    {pt.isForecast ? formatTHB(pt.predictedAmount, 2) : "–"}
                                  </td>
                                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                                    {pt.isForecast
                                      ? `${formatTHB(pt.lowerBound, 0)} – ${formatTHB(pt.upperBound, 0)}`
                                      : "–"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Tab Panel 2: Budget Planning */}
              <div
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-budget`}
                hidden={activeTab !== "budget"}
                tabIndex={
                  activeTab === "budget" && !budget?.departmentPlans?.length ? 0 : undefined
                }
              >
                <div className="pt-4 space-y-4">
                  {budget && (
                    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Wallet className="size-4 text-primary" aria-hidden="true" />
                          <h3 className="text-sm font-semibold text-foreground">
                            สถานะการบริหารงบประมาณ{budget.fiscalYearLabel}
                          </h3>
                        </div>
                        <Badge variant="outline" className={cn("text-xs", budgetMeta.badgeClass)}>
                          {budgetMeta.label}
                        </Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                        <div className="rounded-lg bg-muted/30 p-3">
                          <span className="text-muted-foreground block">งบสุทธิหลังโอนเปลี่ยนแปลง</span>
                          <span className="text-base font-bold text-foreground tabular-nums">
                            ฿{formatTHB(budget.netBudget, 2)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <span className="text-muted-foreground block">
                            ใช้ไปสะสมถึงปัจจุบัน ({budget.monthsElapsed} เดือน)
                          </span>
                          <span className="text-base font-bold text-foreground tabular-nums">
                            ฿{formatTHB(budget.ytdSpent, 2)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <span className="text-muted-foreground block">
                            คาดการณ์ใช้เพิ่มอีก {budget.monthsRemaining} เดือน
                          </span>
                          <span className="text-base font-bold text-foreground tabular-nums">
                            ฿{formatTHB(budget.projectedRemainingSpend, 2)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <span className="text-muted-foreground block">
                            ข้อเสนอแนะงบสำรอง/เพิ่มเติม
                          </span>
                          <span
                            className={cn(
                              "text-base font-bold tabular-nums",
                              budget.recommendedAdditional > 0
                                ? "text-destructive"
                                : "text-emerald-700 dark:text-emerald-400",
                            )}
                          >
                            {budget.recommendedAdditional > 0
                              ? `+฿${formatTHB(budget.recommendedAdditional, 0)}`
                              : "ไม่ต้องขอเพิ่ม"}
                          </span>
                        </div>
                      </div>

                      {/* Accessible budget utilization progress bars */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span id={ytdProgressLabelId} className="font-medium text-foreground">
                              อัตราการเบิกจ่ายจริงถึงปัจจุบัน (YTD)
                            </span>
                            <span className="font-semibold tabular-nums">
                              {budget.utilizationPct}%
                            </span>
                          </div>
                          <progress
                            aria-labelledby={ytdProgressLabelId}
                            value={Math.min(100, Math.max(0, budget.utilizationPct))}
                            max={100}
                            className="ai-progress"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span id={projProgressLabelId} className="font-medium text-foreground">
                              คาดการณ์การใช้รวมตลอดปีงบประมาณ
                            </span>
                            <span
                              className={cn(
                                "font-semibold tabular-nums",
                                budget.projectedUtilizationPct >= 100 && "text-destructive",
                              )}
                            >
                              {budget.projectedUtilizationPct}%
                            </span>
                          </div>
                          <progress
                            aria-labelledby={projProgressLabelId}
                            value={Math.min(100, Math.max(0, budget.projectedUtilizationPct))}
                            max={100}
                            className="ai-progress"
                            style={
                              {
                                "--progress-bar-fill": budgetMeta.barFill,
                              } as React.CSSProperties
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Executive Budget Advice Card */}
                  {insights?.hasInsights ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                          บทวิเคราะห์และข้อเสนอแนะเชิงกลยุทธ์จาก AI
                        </h3>
                        <Badge variant="outline" className="text-[10px]">
                          {insights.model}
                        </Badge>
                      </div>
                      {insights.executiveSummary && (
                        <p className="text-xs text-foreground leading-relaxed bg-background/80 rounded-lg p-3 border border-border/50">
                          {insights.executiveSummary}
                        </p>
                      )}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg bg-background/80 border border-border/50 p-3 space-y-1.5">
                          <h4 className="text-xs font-semibold text-foreground">
                            ข้อเสนอแนะด้านการจัดสรรและโอนเปลี่ยนแปลงงบ
                          </h4>
                          <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                            {toUniqueKeyed("br", insights.budgetRecommendations).map((item) => (
                              <li key={item.key}>{item.text}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg bg-background/80 border border-border/50 p-3 space-y-1.5">
                          <h4 className="text-xs font-semibold text-foreground">
                            มาตรการป้องกันล่วงหน้า
                          </h4>
                          <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                            {toUniqueKeyed("pa", insights.preventiveActions).map((item) => (
                              <li key={item.key}>{item.text}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground text-center">
                      กดปุ่ม <strong className="text-foreground">“วิเคราะห์แผนงบด้วย AI”</strong> ด้านบน
                      เพื่อให้ Gemini AI สรุปแนวทางปรับโอนงบประมาณและลดความเสี่ยงจากข้อมูลจริงชุดนี้
                    </div>
                  )}

                  {/* Per-department allocation & reallocation table */}
                  {budget && budget.departmentPlans.length > 0 && (
                    <div
                      tabIndex={0}
                      role="region"
                      aria-labelledby={budgetTableCaptionId}
                      className="ai-responsive-table-wrap rounded-xl border border-border/60"
                    >
                      <table className="ai-responsive-table ai-table-budget text-xs">
                        <caption id={budgetTableCaptionId} className="sr-only">
                          ตารางวางแผนและแนวโน้มงบประมาณรายหน่วยงาน
                        </caption>
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th scope="col" className="px-3 py-2 text-left font-medium">
                              หน่วยงาน
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">
                              งบสุทธิ (บาท)
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">
                              ใช้ไป YTD (บาท)
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">
                              คาดการณ์ทั้งปี
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">
                              ส่วนต่างคาดการณ์
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">
                              เสนอแนะปรับงบ
                            </th>
                            <th scope="col" className="px-3 py-2 text-center font-medium">
                              สถานะ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {budget.departmentPlans.map((dept) => {
                            const meta =
                              BUDGET_STATUS_META[dept.status] ?? BUDGET_STATUS_META.NO_BUDGET;
                            return (
                              <tr key={dept.departmentId}>
                                <th
                                  scope="row"
                                  className="px-3 py-2 font-medium text-foreground whitespace-nowrap"
                                >
                                  {dept.departmentName}
                                </th>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {formatTHB(dept.netBudget, 0)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {formatTHB(dept.ytdSpent, 0)}
                                </td>
                                <td className="px-3 py-2 text-right font-medium tabular-nums">
                                  {formatTHB(dept.projectedTotalSpend, 0)}
                                </td>
                                <td
                                  className={cn(
                                    "px-3 py-2 text-right font-semibold tabular-nums",
                                    dept.projectedBalance < 0
                                      ? "text-destructive"
                                      : "text-emerald-700 dark:text-emerald-400",
                                  )}
                                >
                                  {dept.projectedBalance < 0 ? "-" : "+"}
                                  {formatTHB(Math.abs(dept.projectedBalance), 0)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {dept.recommendedAdjustment > 0 ? (
                                    <span className="text-destructive font-medium">
                                      เพิ่ม +{formatTHB(dept.recommendedAdjustment, 0)}
                                    </span>
                                  ) : dept.recommendedAdjustment < 0 ? (
                                    <span className="text-emerald-700 dark:text-emerald-400">
                                      ถัวจ่าย {formatTHB(Math.abs(dept.recommendedAdjustment), 0)}
                                    </span>
                                  ) : (
                                    "–"
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[10px]", meta.badgeClass)}
                                  >
                                    {meta.label}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab Panel 3: Early Alert Predictions */}
              <div
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-alerts`}
                hidden={activeTab !== "alerts"}
                tabIndex={activeTab === "alerts" && alerts.length === 0 ? 0 : undefined}
              >
                <div className="pt-4 space-y-3">
                  {alerts.length > 0 ? (
                    <ul className="space-y-2.5">
                      {alerts.map((alert) => {
                        const sev = SEVERITY_META[alert.severity] ?? SEVERITY_META.LOW;
                        const detailHref =
                          scope === "all" && alert.departmentId
                            ? `/all-bills?departmentId=${alert.departmentId}`
                            : resolvedBillsLink;
                        return (
                          <li
                            key={`${alert.departmentId}-${alert.utilityType}-${alert.title}`}
                            className="rounded-xl border border-border/60 bg-card p-3.5 space-y-2"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[11px]", sev.className)}
                                  >
                                    <Activity className="size-3 mr-1" aria-hidden="true" />
                                    {sev.label} (คะแนน {alert.riskScore}/100)
                                  </Badge>
                                  <Badge variant="secondary" className="text-[11px]">
                                    {alert.utilityType}
                                  </Badge>
                                  <span className="text-xs font-semibold text-foreground">
                                    {alert.departmentName}
                                  </span>
                                </div>
                                <h3 className="text-xs font-semibold text-foreground">
                                  {alert.title}
                                </h3>
                              </div>

                              <Link
                                href={detailHref}
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "min-h-8 h-8 px-2.5 text-xs gap-1 shrink-0",
                                )}
                              >
                                <span>
                                  ดูรายการบิล
                                  <span className="sr-only"> ({alert.departmentName})</span>
                                </span>
                                <ArrowRight className="size-3" aria-hidden="true" />
                              </Link>
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {alert.reason}
                            </p>
                            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-foreground">
                              <span className="font-semibold">แนวทางป้องกัน: </span>
                              {alert.recommendedAction}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                      ไม่พบสัญญาณเตือนความเสี่ยงหรือแนวโน้มความผิดปกติล่วงหน้าในขอบเขตที่เลือก
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
