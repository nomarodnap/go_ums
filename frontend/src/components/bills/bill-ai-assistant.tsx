"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ScanText,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type AIExtractDocumentResponse,
  extractAIErrorMessage,
  useExtractBillDocument,
} from "@/lib/api/ai-hooks";
import { cn } from "@/lib/utils";

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function isSupportedDocumentFile(file: File): boolean {
  if (file.type && ACCEPTED_MIME_TYPES.has(file.type.toLowerCase())) {
    return true;
  }
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp")
  );
}

function formatTHB(val?: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return "-";
  return `฿${val.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface BillAIAssistantProps {
  departmentId?: string;
  onApplyOCRResult: (result: AIExtractDocumentResponse, file: File) => void;
}

export function BillAIAssistant({ departmentId, onApplyOCRResult }: BillAIAssistantProps) {
  const inputId = useId();
  const statusId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<AIExtractDocumentResponse | null>(null);
  const [appliedBanner, setAppliedBanner] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const extractMutation = useExtractBillDocument();

  const runOCR = async (file: File) => {
    setValidationError(null);
    setAppliedBanner(false);

    if (!isSupportedDocumentFile(file)) {
      setValidationError("รองรับเฉพาะไฟล์ใบแจ้งหนี้นามสกุล PDF, PNG, JPEG หรือ WebP เท่านั้น");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setValidationError("ไฟล์มีขนาดเกิน 15 MB กรุณาย่อไฟล์ก่อนอัปโหลด");
      return;
    }

    setSelectedFile(file);
    try {
      const res = await extractMutation.mutateAsync({
        file,
        departmentId: departmentId || undefined,
      });
      setOcrResult(res);
      onApplyOCRResult(res, file);
      setAppliedBanner(true);
    } catch {
      // Error details are read from extractMutation.error
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void runOCR(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (extractMutation.isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void runOCR(file);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setOcrResult(null);
    setValidationError(null);
    setAppliedBanner(false);
    extractMutation.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const errorMessage =
    validationError ||
    (extractMutation.isError
      ? extractAIErrorMessage(
          extractMutation.error,
          "ไม่สามารถอ่านข้อมูลจากเอกสารใบแจ้งหนี้ด้วย AI ได้ กรุณาลองใหม่อีกครั้ง",
        )
      : null);

  return (
    <section
      aria-label="ผู้ช่วย AI อ่านใบแจ้งหนี้อัตโนมัติ"
      className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card/70 to-indigo-500/[0.04] p-4 shadow-xs space-y-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <ScanText className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm text-foreground">
                AI อ่านใบแจ้งหนี้อัตโนมัติ (Smart Bill OCR)
              </h3>
              <Badge
                variant="secondary"
                className="text-[10px] px-2 py-0 h-5 bg-primary/10 text-primary border-primary/20 font-medium"
              >
                <Sparkles className="size-3 mr-1" />
                Gemini Vision
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              อัปโหลดไฟล์บิล (PDF หรือรูปภาพ) เพื่อให้ AI ช่วยถอดเลขที่ใบแจ้งหนี้ วันที่ (พ.ศ. → ค.ศ.) จำนวนเงิน
              ปริมาณหน่วย และจัดหมวดหมู่อัตโนมัติ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor={inputId} className="sr-only">
            อัปโหลดไฟล์ใบแจ้งหนี้สำหรับ AI OCR
          </label>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            disabled={extractMutation.isPending}
            className="sr-only"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={extractMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="h-8.5 rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
          >
            <Upload className="size-3.5" />
            {selectedFile ? "เปลี่ยนไฟล์สแกน" : "อัปโหลด & สแกนบิล"}
          </Button>
          {selectedFile && !extractMutation.isPending && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8.5 w-8.5 p-0 rounded-xl text-muted-foreground hover:text-destructive cursor-pointer"
              title="ล้างผลการสแกน"
              aria-label="ล้างผลการสแกน AI"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Drag and drop zone */}
      {!selectedFile && !extractMutation.isPending && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
          className={cn(
            "rounded-xl border border-dashed px-4 py-3 text-center text-xs transition-colors",
            isDragging
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-primary/25 bg-background/60 text-muted-foreground",
          )}
        >
          ลากไฟล์ใบแจ้งหนี้มาวางที่นี่ หรือกดปุ่ม{" "}
          <span className="font-medium text-foreground">“อัปโหลด &amp; สแกนบิล”</span> (รองรับ PDF,
          PNG, JPEG, WebP สูงสุด 15 MB)
        </div>
      )}

      {/* Selected file pill */}
      {selectedFile && (
        <div className="flex items-center justify-between gap-2 rounded-xl border bg-background/80 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {selectedFile.name.toLowerCase().endsWith(".pdf") ? (
              <FileText className="size-4 text-primary shrink-0" />
            ) : (
              <ImageIcon className="size-4 text-primary shrink-0" />
            )}
            <span className="font-medium text-foreground truncate">{selectedFile.name}</span>
            <span className="text-muted-foreground shrink-0">
              ({(selectedFile.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          {ocrResult && (
            <Badge
              variant="outline"
              className="text-[10px] shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            >
              ความมั่นใจ {Math.round(ocrResult.confidence * 100)}%
            </Badge>
          )}
        </div>
      )}

      {/* Native indeterminate progress bar (modern-web-guidance: progress) */}
      {extractMutation.isPending && (
        <div className="space-y-1.5 rounded-xl bg-background/70 border p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-primary">
              กำลังอ่านข้อมูลจากเอกสารด้วย Gemini Vision...
            </span>
            <span className="text-[11px] text-muted-foreground">กรุณารอสักครู่</span>
          </div>
          <progress aria-label="กำลังอ่านข้อมูลจากเอกสารใบแจ้งหนี้ด้วย AI" className="ai-progress" />
        </div>
      )}

      {/* Error live alert */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-medium">{errorMessage}</p>
            {selectedFile && !extractMutation.isPending && (
              <button
                type="button"
                onClick={() => void runOCR(selectedFile)}
                className="underline font-medium hover:opacity-80 cursor-pointer"
              >
                ลองสแกนใหม่อีกครั้ง
              </button>
            )}
          </div>
        </div>
      )}

      {/* Extracted review card + polite status */}
      {ocrResult && !extractMutation.isPending && (
        <div className="rounded-xl border bg-background/90 p-3.5 space-y-3">
          <div
            id={statusId}
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                {appliedBanner
                  ? "นำข้อมูลจากเอกสารกรอกลงฟอร์มแล้ว — กรุณาตรวจสอบความถูกต้องก่อนบันทึก"
                  : "อ่านข้อมูลจากเอกสารสำเร็จ พร้อมนำกรอกลงฟอร์ม"}
              </span>
            </div>
            {selectedFile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onApplyOCRResult(ocrResult, selectedFile);
                  setAppliedBanner(true);
                }}
                className="h-7.5 rounded-lg text-xs gap-1 cursor-pointer"
              >
                <Wand2 className="size-3" />
                นำข้อมูลกรอกลงฟอร์มอีกครั้ง
              </Button>
            )}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs pt-1 border-t">
            <div>
              <dt className="text-[11px] text-muted-foreground">ประเภทสาธารณูปโภค</dt>
              <dd className="font-medium text-foreground">
                {ocrResult.utilityType || "-"}
                {ocrResult.accountCode && (
                  <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                    ({ocrResult.accountCode})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">หมายเลขผู้ใช้ / เครื่องวัด</dt>
              <dd className="font-mono font-medium text-foreground">
                {ocrResult.matchedServiceNumber || ocrResult.serviceNumber || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">เลขที่ใบแจ้งหนี้</dt>
              <dd className="font-mono font-medium text-foreground">
                {ocrResult.invoiceNumber || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">วันที่ใบแจ้งหนี้ (ค.ศ.)</dt>
              <dd className="font-medium text-foreground">
                {ocrResult.invoiceDate || "-"}
                {ocrResult.invoiceDateRaw && ocrResult.invoiceDateRaw !== ocrResult.invoiceDate && (
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    ({ocrResult.invoiceDateRaw})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">รอบบิล</dt>
              <dd className="font-medium text-foreground">
                {ocrResult.billingMonth && ocrResult.billingYearBE
                  ? `${ocrResult.billingMonth}/${ocrResult.billingYearBE}`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">ยอดเงิน / ปริมาณหน่วย</dt>
              <dd className="font-semibold text-foreground">
                {formatTHB(ocrResult.invoiceAmount)}
                {ocrResult.usageAmount !== undefined && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ({ocrResult.usageAmount.toLocaleString("th-TH")} หน่วย)
                  </span>
                )}
              </dd>
            </div>
            {ocrResult.budgetCode && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-[11px] text-muted-foreground">รหัสงบประมาณที่แนะนำ</dt>
                <dd className="font-medium text-foreground">
                  <span className="font-mono">{ocrResult.budgetCode}</span>
                  {ocrResult.budgetFiscalYear ? ` (ปีงบฯ ${ocrResult.budgetFiscalYear})` : ""}
                  {ocrResult.budgetCodeName ? ` — ${ocrResult.budgetCodeName}` : ""}
                </dd>
              </div>
            )}
          </dl>

          {ocrResult.notes && (
            <p className="text-[11px] text-muted-foreground border-t pt-2">
              หมายเหตุ OCR: {ocrResult.notes}
            </p>
          )}

          {ocrResult.warnings && ocrResult.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 p-2.5 space-y-1">
              {[...new Set(ocrResult.warnings)].map((w) => (
                <p
                  key={w}
                  className="text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5"
                >
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
