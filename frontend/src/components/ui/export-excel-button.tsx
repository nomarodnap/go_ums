"use client";

import * as React from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ExportExcelButtonProps {
  onExport: () => Promise<void> | void;
  disabled?: boolean;
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "outline" | "default" | "secondary" | "ghost";
}

export function ExportExcelButton({
  onExport,
  disabled = false,
  label = "ส่งออก Excel",
  className,
  size = "sm",
  variant = "outline",
}: ExportExcelButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleClick = async () => {
    if (disabled || isExporting) return;
    try {
      setIsExporting(true);
      await Promise.resolve(onExport());
      toast.success("ส่งออกไฟล์ Excel สำเร็จ");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการส่งออกไฟล์";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || isExporting}
      onClick={handleClick}
      className={cn(
        "gap-1.5 rounded-xl font-medium cursor-pointer transition-all duration-200",
        "border-emerald-600/30 hover:border-emerald-600/50 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400",
        className,
      )}
      title="ส่งออกตารางเป็นไฟล์ Microsoft Excel (.xlsx)"
    >
      {isExporting ? (
        <Loader2 className="size-4 animate-spin text-emerald-600 shrink-0" />
      ) : (
        <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      )}
      <span className="text-xs">{isExporting ? "กำลังส่งออก..." : label}</span>
    </Button>
  );
}

