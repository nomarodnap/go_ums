"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  X,
  ExternalLink,
  CheckCircle2,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ErrorSpeechBubble } from "@/components/ui/error-speech-bubble";
import { cn } from "@/lib/utils";

export interface FileUploadDropzoneProps {
  id?: string;
  name: string;
  label?: React.ReactNode;
  required?: boolean;
  accept?: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  existingUrl?: string | null;
  hint?: string;
  errorMessage?: string | string[];
  disabled?: boolean;
  className?: string;
}

export function FileUploadDropzone({
  id,
  name,
  label,
  required = false,
  accept = ".pdf,image/*",
  value,
  onChange,
  existingUrl,
  hint = "รองรับไฟล์ PDF, JPG, PNG",
  errorMessage,
  disabled = false,
  className,
}: FileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      // Only set dragging to false if we're leaving the container itself
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragging(false);
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        onChange(file);

        // Sync with underlying input element
        if (inputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          inputRef.current.files = dataTransfer.files;
        }
      }
    },
    [disabled, onChange]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onChange(file);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleClickZone = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const isPdf = value?.name.toLowerCase().endsWith(".pdf") || value?.type === "application/pdf";
  const isImage = value?.type.startsWith("image/");
  const hasError = !!errorMessage && (Array.isArray(errorMessage) ? errorMessage.length > 0 : true);

  return (
    <div
      className={cn("grid gap-2 relative w-full min-w-0", className)}
      data-has-error={hasError}
    >
      {label && (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <Label htmlFor={id || name} className="font-medium text-sm truncate">
            {label} {required && <span className="text-destructive">*</span>}
          </Label>
          {existingUrl && !value && (
            <a
              href={existingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full font-medium shrink-0"
            >
              <ExternalLink className="h-3 w-3" /> ดูไฟล์เดิม
            </a>
          )}
        </div>
      )}

      {/* Hidden file input for native FormData binding */}
      <input
        ref={inputRef}
        type="file"
        id={id || name}
        name={name}
        accept={accept}
        onChange={handleFileInputChange}
        disabled={disabled}
        className="hidden"
      />

      {/* Drag & Drop Zone (Frame stays exact same shape and size whether empty or with file) */}
      <div
        onClick={handleClickZone}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClickZone();
          }
        }}
        className={cn(
          "group relative flex flex-col items-center justify-center p-3.5 py-3 rounded-xl border border-dashed min-h-[82px] w-full min-w-0 overflow-hidden transition-colors duration-150 cursor-pointer text-center",
          value
            ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/15 hover:bg-emerald-50/60"
            : "border-muted-foreground/30 bg-muted/20 hover:bg-muted/30 hover:border-primary/50",
          isDragging && "border-primary bg-primary/10 border-solid",
          hasError && "border-rose-500 bg-rose-50/10",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        {isDragging ? (
          /* Dragging state inside the same frame */
          <div className="flex items-center gap-2 text-primary font-medium text-xs truncate">
            <UploadCloud className="size-5 shrink-0 animate-bounce" />
            <span className="truncate">ปล่อยไฟล์ที่นี่เพื่ออัพโหลด</span>
          </div>
        ) : value ? (
          /* File Selected state inside the same frame */
          <div className="flex items-center justify-between w-full min-w-0 gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden text-left">
              <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400">
                {isPdf ? (
                  <FileText className="size-4" />
                ) : isImage ? (
                  <ImageIcon className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                <span
                  className="font-medium text-xs text-foreground truncate block w-full"
                  title={value.name}
                >
                  {value.name}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate w-full">
                  <span className="shrink-0">{formatFileSize(value.size)}</span>
                  <span className="shrink-0">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                    พร้อมอัพโหลด (คลิก/ลากเพื่อเปลี่ยน)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                disabled={disabled}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                title="ลบไฟล์"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          /* Default Empty state inside the same frame */
          <div className="flex flex-col items-center gap-1 w-full min-w-0 px-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate max-w-full">
              <UploadCloud className="size-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="truncate">
                ลากและวางไฟล์ที่นี่ หรือ <span className="text-primary underline underline-offset-2">คลิกเลือกไฟล์</span>
              </span>
            </div>
            {hint && (
              <p className="text-[11px] text-muted-foreground truncate max-w-full">
                {hint}
              </p>
            )}
            {existingUrl && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate max-w-full">
                (มีไฟล์เดิมอยู่แล้ว หากไม่อัพโหลดใหม่ระบบจะใช้ไฟล์เดิม)
              </p>
            )}
          </div>
        )}
      </div>

      <ErrorSpeechBubble message={errorMessage} />
    </div>
  );
}
