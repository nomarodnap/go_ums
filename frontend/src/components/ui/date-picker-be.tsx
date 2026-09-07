"use client";

import * as React from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function parseDateValue(v: string | Date | null | undefined): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  // If YYYY-MM-DD string, parse with local time components to avoid UTC shift
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const parts = v.split(/[-T ]/);
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const parsed = new Date(y, m, d);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export function DatePickerBE({
  id,
  name,
  defaultValue,
  value,
  onChange,
  required,
  disabled,
  className,
}: {
  id?: string;
  name?: string;
  defaultValue?: string | Date | null;
  value?: string | Date | null;
  onChange?: (date: Date | undefined, dateString: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(() =>
    parseDateValue(value !== undefined ? value : defaultValue),
  );

  React.useEffect(() => {
    if (isControlled) {
      setInternalDate(parseDateValue(value));
    }
  }, [value, isControlled]);

  const date = isControlled ? parseDateValue(value) : internalDate;

  const formatBE = (d: Date) => {
    const year = d.getFullYear() + 543;
    const dayMonth = format(d, "d MMMM", { locale: th });
    return `${dayMonth} ${year}`;
  };

  const handleSelect = (selected: Date | undefined) => {
    if (!isControlled) {
      setInternalDate(selected);
    }
    if (onChange) {
      const dateStr = selected ? format(selected, "yyyy-MM-dd") : "";
      onChange(selected, dateStr);
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-9.5 rounded-xl",
                !date && "text-muted-foreground",
                disabled && "opacity-50 cursor-not-allowed",
                className,
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
              {date ? formatBE(date) : <span>เลือกวันที่</span>}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
          <Calendar mode="single" selected={date} onSelect={handleSelect} />
        </PopoverContent>
      </Popover>
      {/* Hidden input for standard form submission (native YYYY-MM-DD) */}
      <input
        type="hidden"
        id={id}
        name={name}
        value={date ? format(date, "yyyy-MM-dd") : ""}
        disabled={disabled}
      />
    </>
  );
}

