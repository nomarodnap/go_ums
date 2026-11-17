"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { extractAIErrorMessage, useExplainBillAnomaly } from "@/lib/api/ai-hooks";
import { cn } from "@/lib/utils";

interface AnomalyExplainDialogProps {
  billId: string | null;
  billCode?: string | null;
  departmentName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toUniqueKeyed = (prefix: string, items: string[]) => {
  const seen = new Map<string, number>();
  return items.map((text) => {
    const count = (seen.get(text) ?? 0) + 1;
    seen.set(text, count);
    return { key: `${prefix}-${text}-${count}`, text };
  });
};

const formatTHB = (val?: number | null) => {
  if (val == null) return "-";
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const METHOD_LABELS: Record<string, string> = {
  ZSCORE_IQR: "Z-Score + IQR (Outlier ชัดเจน)",
  ZSCORE: "Z-Score (|z| >= 2.0)",
  IQR: "IQR Fence (นอกช่วง Q1 - Q3)",
  FLAT_30_PCT: "ค่าเบี่ยงเบนจากฐานคงที่ (> 30%)",
  FALLBACK_30_PCT: "เทียบค่าเฉลี่ยย้อนหลัง (> 30%)",
  NONE: "ปกติ / ข้อมูลไม่พอ",
};

const THAI_MONTHS = [
  "",
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

export function AnomalyExplainDialog({
  billId,
  billCode,
  departmentName,
  open,
  onOpenChange,
}: AnomalyExplainDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFetchedBillRef = useRef<string | null>(null);

  const explainMutation = useExplainBillAnomaly();
  const { mutate: runExplain, isError: isExplainError } = explainMutation;

  // Synchronize native <dialog> showModal() / close() with controlled `open` prop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
      if (billId && (lastFetchedBillRef.current !== billId || isExplainError)) {
        lastFetchedBillRef.current = billId;
        runExplain({ billId, force: false });
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, billId, isExplainError, runExplain]);

  // Fallback light-dismiss for browsers without <dialog closedby="any"> (e.g. Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const handleDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const handleUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", handleDown);
    dialog.addEventListener("pointerup", handleUp);
    return () => {
      dialog.removeEventListener("pointerdown", handleDown);
      dialog.removeEventListener("pointerup", handleUp);
    };
  }, []);

  const handleNativeClose = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.returnValue = "";
    }
    if (!open) return;
    onOpenChange(false);
  };

  const handleForceRefresh = () => {
    if (!billId) return;
    lastFetchedBillRef.current = billId;
    explainMutation.mutate({ billId, force: true });
  };

  const data =
    billId && explainMutation.data?.billId === billId && !explainMutation.isError
      ? explainMutation.data
      : undefined;
  const stats = data?.stats;

  const severityBadgeClass =
    data?.severity === "HIGH"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : data?.severity === "MEDIUM"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleNativeClose}
      {...({ closedby: "any" } as Record<string, unknown>)}
      className={cn(
        "ai-modal-dialog fixed inset-0 m-auto hidden open:flex flex-col w-[min(94vw,42rem)] max-h-[86vh] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-popover text-popover-foreground shadow-2xl p-0 overflow-hidden",
      )}
    >
      {/* Dialog Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] bg-muted/30">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="size-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
                AI วิเคราะห์สาเหตุความคลาดเคลื่อน
              </h2>
              {data?.severity && (
                <Badge
                  variant="outline"
                  className={cn("text-[11px] font-semibold", severityBadgeClass)}
                >
                  ระดับความเสี่ยง: {data.severity}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              รหัสบิล:{" "}
              <span className="font-mono font-medium text-foreground">
                {data?.billCode || billCode || billId || "-"}
              </span>
              {(data?.departmentName || departmentName) &&
                ` • ${data?.departmentName || departmentName}`}
            </p>
          </div>
        </div>

        <form method="dialog">
          <button
            type="submit"
            aria-label="ปิดหน้าต่างวิเคราะห์สาเหตุ"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {explainMutation.isPending && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3 text-center">
            <Sparkles className="size-6 text-primary mx-auto animate-pulse" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              กำลังดึงสถิติบิลย้อนหลัง (Z-Score / IQR) และวิเคราะห์ด้วย AI...
            </p>
            <progress
              aria-label="กำลังวิเคราะห์ความผิดปกติของบิลด้วย AI"
              className="w-full max-w-xs mx-auto block h-1.5 rounded-full accent-primary"
            />
          </div>
        )}

        {explainMutation.isError && (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-2.5"
          >
            <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">ไม่สามารถวิเคราะห์รายการนี้ได้</p>
              <p>{extractAIErrorMessage(explainMutation.error, "เกิดข้อผิดพลาดในการเชื่อมต่อ AI")}</p>
            </div>
          </div>
        )}

        {data && !explainMutation.isPending && (
          <>
            {/* Bill Overview Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 px-3 py-2">
                <span className="text-[11px] text-muted-foreground block">ประเภท & รอบบิล</span>
                <span className="font-semibold text-foreground">
                  {data.utilityType} ({THAI_MONTHS[data.billingMonth] || data.billingMonth}{" "}
                  {data.billingYearBE})
                </span>
              </div>
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 px-3 py-2">
                <span className="text-[11px] text-muted-foreground block">ยอดเงินบิลนี้</span>
                <span className="font-semibold text-foreground">
                  ฿{formatTHB(data.invoiceAmount)}
                </span>
              </div>
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/30 px-3 py-2 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-muted-foreground block">
                  หมายเลขผู้ใช้ / เครื่องวัด
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {data.serviceNumber || "-"}
                </span>
              </div>
            </div>

            {/* Triggered Rules Badges */}
            {data.flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {toUniqueKeyed("flag", data.flags).map((item) => (
                  <Badge key={item.key} variant="destructive" className="text-[11px] font-normal">
                    {item.text}
                  </Badge>
                ))}
              </div>
            )}

            {/* AI Plain-Thai Summary */}
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary block">
                สรุปคำอธิบายจาก AI
              </span>
              <p className="text-sm font-medium text-foreground leading-relaxed">{data.summary}</p>
            </div>

            {/* Statistical Proof (Z-score & IQR) */}
            {stats && (
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BarChart3 className="size-4 text-primary" aria-hidden="true" />
                    ข้อมูลสถิติเปรียบเทียบย้อนหลัง ({stats.sampleCount} รอบบิล)
                  </h3>
                  <Badge variant="outline" className="text-[11px]">
                    {METHOD_LABELS[stats.method] || stats.method}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-xl bg-card border border-black/[0.05] dark:border-white/[0.07] p-2.5">
                    <span className="text-[11px] text-muted-foreground block">ค่าเฉลี่ย (Mean)</span>
                    <span className="font-semibold text-foreground">฿{formatTHB(stats.mean)}</span>
                  </div>
                  <div className="rounded-xl bg-card border border-black/[0.05] dark:border-white/[0.07] p-2.5">
                    <span className="text-[11px] text-muted-foreground block">
                      ค่ามัธยฐาน (Median)
                    </span>
                    <span className="font-semibold text-foreground">
                      ฿{formatTHB(stats.median)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-card border border-black/[0.05] dark:border-white/[0.07] p-2.5">
                    <span className="text-[11px] text-muted-foreground block">Z-Score</span>
                    <span
                      className={cn(
                        "font-semibold",
                        Math.abs(stats.zScore) >= 2.0 ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {stats.zScore > 0 ? "+" : ""}
                      {stats.zScore.toFixed(2)}σ ({stats.pctDiffFromBaseline > 0 ? "+" : ""}
                      {stats.pctDiffFromBaseline}%)
                    </span>
                  </div>
                  <div className="rounded-xl bg-card border border-black/[0.05] dark:border-white/[0.07] p-2.5">
                    <span className="text-[11px] text-muted-foreground block">
                      ช่วงปกติ IQR Fence
                    </span>
                    <span className="font-semibold text-foreground">
                      ฿{formatTHB(stats.lowerFence)} – {formatTHB(stats.upperFence)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Reasons & Action Items */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card p-4 space-y-2">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-600" aria-hidden="true" />
                  เหตุผลที่ตรวจพบ
                </h3>
                <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
                  {toUniqueKeyed("rs", data.reasons).map((item) => (
                    <li key={item.key}>{item.text}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card p-4 space-y-2">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="size-3.5 text-emerald-600" aria-hidden="true" />
                  แนวทางดำเนินการแนะนำ
                </h3>
                <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
                  {toUniqueKeyed("act", data.actionItems).map((item) => (
                    <li key={item.key}>{item.text}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-muted/30">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {data?.cached && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-600" aria-hidden="true" />
              ข้อมูลจาก Cache
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleForceRefresh}
            disabled={explainMutation.isPending || !billId}
            className="h-8 rounded-xl text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={cn("size-3.5", explainMutation.isPending && "animate-spin")}
              aria-hidden="true"
            />
            วิเคราะห์ใหม่
          </Button>
          <form method="dialog">
            <Button
              type="submit"
              variant="default"
              size="sm"
              autoFocus
              className="h-8 rounded-xl text-xs cursor-pointer"
            >
              ปิดหน้าต่าง
            </Button>
          </form>
        </div>
      </div>
    </dialog>
  );
}
