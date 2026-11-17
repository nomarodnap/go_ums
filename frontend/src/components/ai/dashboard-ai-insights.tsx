"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useId, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { extractAIErrorMessage, useAISummary, useRefreshAISummary } from "@/lib/api/ai-hooks";
import { cn } from "@/lib/utils";

interface DashboardAIInsightsProps {
  scope?: "all" | "department";
  departmentId?: string;
  month?: number;
  year?: number;
  enabled?: boolean;
}

const toUniqueKeyed = (prefix: string, items: string[]) => {
  const seen = new Map<string, number>();
  return items.map((text) => {
    const count = (seen.get(text) ?? 0) + 1;
    seen.set(text, count);
    return { key: `${prefix}-${text}-${count}`, text };
  });
};

const formatTHB = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatTimestampTH = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function DashboardAIInsights({
  scope = "department",
  departmentId,
  month,
  year,
  enabled = true,
}: DashboardAIInsightsProps) {
  const headingId = useId();
  const {
    data: summary,
    isLoading,
    error,
  } = useAISummary({
    scope,
    departmentId,
    month,
    year,
    enabled,
  });

  const refreshMutation = useRefreshAISummary();

  // Clear stale mutation errors when scope/department changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset mutation status when target changes
  useEffect(() => {
    refreshMutation.reset();
  }, [scope, departmentId]);

  const activeData = useMemo(() => {
    if (
      refreshMutation.data &&
      refreshMutation.data.scope === scope &&
      (scope === "all" || refreshMutation.data.departmentId === departmentId)
    ) {
      return refreshMutation.data;
    }
    return summary;
  }, [refreshMutation.data, summary, scope, departmentId]);

  const handleRefresh = () => {
    refreshMutation.mutate({
      scope,
      departmentId: scope === "department" ? departmentId : undefined,
      month,
      year,
    });
  };

  if (!enabled || error) {
    return null;
  }

  const aiEnabled = activeData?.enabled ?? true;
  const hasSummary = Boolean(activeData?.hasSummary);
  const metrics = activeData?.metrics;
  const momUp = (metrics?.moMChangePct ?? 0) > 0;

  return (
    <Card
      aria-labelledby={headingId}
      className="border-black/[0.06] dark:border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/[0.03]"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="size-4.5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id={headingId}
                  className="text-base font-semibold tracking-tight text-foreground"
                >
                  สรุปและข้อเสนอแนะอัจฉริยะ (AI Insights)
                </h2>
                {activeData?.periodLabel && (
                  <Badge variant="secondary" className="text-[11px] font-medium">
                    {activeData.periodLabel}
                  </Badge>
                )}
                {hasSummary && activeData?.source === "worker" && (
                  <Badge
                    variant="outline"
                    className="text-[11px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5"
                  >
                    อัปเดตอัตโนมัติประจำวัน
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-0.5 text-xs flex flex-wrap items-center gap-2">
                <span>{activeData?.departmentName || "กำลังโหลดขอบเขตข้อมูล..."}</span>
                {hasSummary && activeData?.generatedAt && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    อัปเดตเมื่อ {formatTimestampTH(activeData.generatedAt)}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant={hasSummary ? "outline" : "default"}
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || refreshMutation.isPending || !aiEnabled}
            className="min-h-8 h-8 px-3 text-xs rounded-xl gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={cn("size-3.5", refreshMutation.isPending && "animate-spin")}
              aria-hidden="true"
            />
            {refreshMutation.isPending
              ? "กำลังวิเคราะห์..."
              : hasSummary
                ? "วิเคราะห์ใหม่ด้วย AI"
                : "สร้างสรุปด้วย AI"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {refreshMutation.isPending && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-primary font-medium">
              <span>กำลังรวบรวมข้อมูลจริงและประมวลผลสรุปด้วย Gemini AI...</span>
            </div>
            <progress
              aria-label="กำลังวิเคราะห์ข้อมูลประจำเดือนด้วย AI"
              className="w-full h-1.5 rounded-full overflow-hidden accent-primary"
            />
          </div>
        )}

        {refreshMutation.isError && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {extractAIErrorMessage(
                refreshMutation.error,
                "ไม่สามารถสร้างสรุป AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
              )}
            </span>
          </div>
        )}

        {!aiEnabled && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
            ยังไม่ได้กำหนดค่า <code>GEMINI_API_KEY</code> ใน Backend จึงยังไม่สามารถสร้างคำวิเคราะห์ใหม่ด้วย AI
            ได้
          </div>
        )}

        {/* Quick Live Snapshot Strip */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 px-3 py-2">
              <span className="text-[11px] text-muted-foreground block">ยอดรวมรอบเดือนนี้</span>
              <span className="text-sm font-semibold text-foreground">
                ฿{formatTHB(metrics.combinedTotal)}
              </span>
              {metrics.prevMonthTotal > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[11px] ml-1.5 font-medium",
                    momUp
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {momUp ? (
                    <TrendingUp className="size-3" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="size-3" aria-hidden="true" />
                  )}
                  {metrics.moMChangePct > 0 ? "+" : ""}
                  {metrics.moMChangePct}%
                </span>
              )}
            </div>

            <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 px-3 py-2">
              <span className="text-[11px] text-muted-foreground block">ค้างชำระเดือนนี้</span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {metrics.pendingBills} รายการ
              </span>
              <span className="text-[11px] text-muted-foreground block truncate">
                ฿{formatTHB(metrics.pendingAmount)}
              </span>
            </div>

            <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 px-3 py-2">
              <span className="text-[11px] text-muted-foreground block">พบความคลาดเคลื่อน</span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  metrics.totalAnomalies > 0
                    ? "text-destructive"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {metrics.totalAnomalies} รายการ
              </span>
            </div>

            <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 px-3 py-2">
              <span className="text-[11px] text-muted-foreground block">มิเตอร์ยังไม่บันทึกเดือนนี้</span>
              <span className="text-sm font-semibold text-foreground">
                {metrics.unrecordedServices} หมายเลข
              </span>
              <span className="text-[11px] text-muted-foreground block">
                บันทึกแล้ว {metrics.recordedServices}
              </span>
            </div>
          </div>
        )}

        {hasSummary && activeData ? (
          <div className="space-y-3">
            {activeData.headline && (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm font-medium text-foreground leading-relaxed">
                {activeData.headline}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {/* Key Points */}
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-card p-3.5 space-y-2">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
                  ประเด็นสำคัญประจำเดือน
                </h3>
                {activeData.keyPoints.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
                    {toUniqueKeyed("kp", activeData.keyPoints).map((item) => (
                      <li key={item.key}>{item.text}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">ไม่มีประเด็นเพิ่มเติม</p>
                )}
              </div>

              {/* Actionable Recommendations inside native accessible <details> disclosure */}
              <details
                open
                className="ai-disclosure rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-card p-3.5"
              >
                <summary className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer select-none min-h-6">
                  <ChevronDown
                    className="ai-disclosure-chevron size-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  <span>คำแนะนำเชิงปฏิบัติ ({activeData.recommendations.length} ข้อ)</span>
                </summary>
                <div className="mt-2">
                  {activeData.recommendations.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
                      {toUniqueKeyed("rec", activeData.recommendations).map((item) => (
                        <li key={item.key}>{item.text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">ยังไม่มีคำแนะนำเพิ่มเติมในช่วงเวลานี้</p>
                  )}
                </div>
              </details>
            </div>
          </div>
        ) : (
          !isLoading &&
          !refreshMutation.isPending && (
            <div className="rounded-xl border border-dashed border-black/[0.12] dark:border-white/[0.12] px-4 py-4 text-center space-y-1.5">
              <p className="text-xs text-muted-foreground">
                ยังไม่มีรายงานสรุปด้วย AI สำหรับช่วงเวลานี้ — กดปุ่ม{" "}
                <strong className="text-foreground">“สร้างสรุปด้วย AI”</strong>{" "}
                เพื่อให้ระบบวิเคราะห์ยอดใช้จ่าย ความผิดปกติ และคำแนะนำจากข้อมูลจริง
              </p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
