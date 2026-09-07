"use client";

import * as React from "react";
import { format } from "date-fns";
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
  onChange,
  className,
}: {
  id?: string;
  name?: string;
  defaultValue?: string; // Expects "YYYY-MM"
  value?: string;
  required?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(() =>
    parseMonthValue(value !== undefined ? value : defaultValue),
  );

  React.useEffect(() => {
    if (isControlled) {
      setInternalDate(parseMonthValue(value));
    }
  }, [value, isControlled]);

  const date = isControlled ? parseMonthValue(value) : internalDate;

  // For the view in the popover
  const [viewYear, setViewYear] = React.useState<number>(
    date ? date.getFullYear() : new Date().getFullYear(),
  );
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (date) {
      setViewYear(date.getFullYear());
    }
  }, [date]);

  const formatBE = (d: Date) => {
    const year = d.getFullYear() + 543;
    const month = months[d.getMonth()];
    return `${month} ${year}`;
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(viewYear, monthIndex, 1);
    if (!isControlled) {
      setDateInternal(newDate);
    }
    setIsOpen(false);
    if (onChange) {
      const mm = String(monthIndex + 1).padStart(2, "0");
      onChange(`${viewYear}-${mm}`);
    }
  };

  const setDateInternal = (d: Date) => {
    setInternalDate(d);
  };

  const formattedMonthString = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : "";

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant={"outline"}
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
              onClick={() => setViewYear(viewYear - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm font-semibold">พ.ศ. {viewYear + 543}</div>
            <Button
              variant="outline"
              type="button"
              className="size-7 rounded-lg bg-transparent p-0 opacity-70 hover:opacity-100"
              onClick={() => setViewYear(viewYear + 1)}
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

