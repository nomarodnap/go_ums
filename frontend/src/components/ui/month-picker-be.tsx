"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const months = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function parseMonthValue(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const parts = v.split("-");
  if (parts.length >= 2) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const parsed = new Date(y, m, 1);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export function MonthPickerBE({
  id,
  name,
  defaultValue,
  value,
  required,
  disabled,
  onChange,
  className,
}: {
  id?: string;
  name?: string;
  defaultValue?: string; // Expects "YYYY-MM"
  value?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState<string>(
    defaultValue || "",
  );

  const currentValue = isControlled ? (value || "") : internalValue;
  const date = React.useMemo(
    () => parseMonthValue(currentValue),
    [currentValue],
  );

  const [isOpen, setIsOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState<number>(() =>
    date ? date.getFullYear() : new Date().getFullYear(),
  );

  // Sync viewYear whenever the selected value's year changes externally
  const selectedYear = date ? date.getFullYear() : undefined;
  React.useEffect(() => {
    if (selectedYear !== undefined) {
      setViewYear(selectedYear);
    }
  }, [selectedYear]);

  // When opening the popover, initialize viewYear to the currently selected year or current year
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setViewYear(date ? date.getFullYear() : new Date().getFullYear());
    }
  };

  const formatBE = (d: Date) => {
    const year = d.getFullYear() + 543;
    const month = months[d.getMonth()];
    return `${month} ${year}`;
  };

  const handleMonthSelect = (monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, "0");
    const formatted = `${viewYear}-${mm}`;
    if (!isControlled) {
      setInternalValue(formatted);
    }
    setIsOpen(false);
    if (onChange) {
      onChange(formatted);
    }
  };

  const formattedMonthString = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : "";

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              id={id ? `${id}-trigger` : undefined}
              type="button"
              variant={"outline"}
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal h-9.5 rounded-xl",
                !date && "text-muted-foreground",
                className,
              )}
            >
              <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
              {date ? formatBE(date) : <span>เลือกเดือน</span>}
            </Button>
          }
        />
        <PopoverContent className="w-64 p-3 rounded-2xl" align="start">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              type="button"
              className="size-7 rounded-lg bg-transparent p-0 opacity-70 hover:opacity-100"
              onClick={() => setViewYear((prev) => prev - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm font-semibold">พ.ศ. {viewYear + 543}</div>
            <Button
              variant="outline"
              type="button"
              className="size-7 rounded-lg bg-transparent p-0 opacity-70 hover:opacity-100"
              onClick={() => setViewYear((prev) => prev + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {months.map((month, idx) => {
              const isSelected =
                date?.getMonth() === idx && date?.getFullYear() === viewYear;
              return (
                <Button
                  key={month}
                  type="button"
                  variant={isSelected ? "default" : "ghost"}
                  className="h-8 text-xs rounded-lg"
                  onClick={() => handleMonthSelect(idx)}
                >
                  {month}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {/* Hidden input for standard form submission (native YYYY-MM) */}
      <input
        type="hidden"
        id={id}
        name={name}
        value={formattedMonthString}
      />
    </>
  );
}
