"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortOrder = "asc" | "desc" | null;
export type Comparator<T> = (a: T, b: T) => number;

export interface SortableHeaderProps
  extends React.ComponentProps<typeof TableHead> {
  sortKey: string;
  currentSortKey: string | null;
  currentSortOrder: SortOrder;
  onSort: (key: string) => void;
  align?: "left" | "center" | "right";
  children: React.ReactNode;
}

export function SortableHeader({
  sortKey,
  currentSortKey,
  currentSortOrder,
  onSort,
  align = "left",
  children,
  className,
  ...props
}: SortableHeaderProps) {
  const isSorted = currentSortKey === sortKey && currentSortOrder !== null;

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none transition-colors hover:bg-muted/60 hover:text-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      onClick={() => onSort(sortKey)}
      title={
        isSorted
          ? currentSortOrder === "asc"
            ? "เรียงจากน้อยไปมาก (คลิกเพื่อเรียงจากมากไปน้อย)"
            : "เรียงจากมากไปน้อย (คลิกเพื่อคืนค่าเริ่มต้น)"
          : "คลิกเพื่อเรียงลำดับ"
      }
      {...props}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1.5 font-semibold text-xs",
          align === "right" && "justify-end w-full",
          align === "center" && "justify-center w-full",
          align === "left" && "justify-start",
          isSorted
            ? "text-primary dark:text-primary font-bold"
            : "text-muted-foreground"
        )}
      >
        <span>{children}</span>
        {isSorted ? (
          currentSortOrder === "asc" ? (
            <ArrowUp className="size-3.5 text-primary shrink-0" />
          ) : (
            <ArrowDown className="size-3.5 text-primary shrink-0" />
          )
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground/40 shrink-0 hover:text-muted-foreground transition-opacity" />
        )}
      </div>
    </TableHead>
  );
}

export function useTableSort<T>(
  data: T[],
  options?: {
    defaultSortKey?: string | null;
    defaultSortOrder?: SortOrder;
    comparators?: Record<string, Comparator<T>>;
  }
) {
  const [sortKey, setSortKey] = useState<string | null>(
    options?.defaultSortKey ?? null
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    options?.defaultSortOrder ?? null
  );

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortOrder("asc");
    } else if (sortOrder === "asc") {
      setSortOrder("desc");
    } else if (sortOrder === "desc") {
      setSortKey(null);
      setSortOrder(null);
    } else {
      setSortOrder("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortOrder) return data;

    const customComparator = options?.comparators?.[sortKey];
    const modifier = sortOrder === "desc" ? -1 : 1;

    return [...data].sort((a, b) => {
      if (customComparator) {
        return customComparator(a, b) * modifier;
      }

      const valA = (a as any)[sortKey];
      const valB = (b as any)[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === "") return 1;
      if (valB === null || valB === undefined || valB === "") return -1;

      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * modifier;
      }

      // Check if numeric strings
      const numA =
        typeof valA === "string" ? parseFloat(valA.replace(/,/g, "")) : NaN;
      const numB =
        typeof valB === "string" ? parseFloat(valB.replace(/,/g, "")) : NaN;
      if (
        !isNaN(numA) &&
        !isNaN(numB) &&
        !isNaN(Number(valA)) &&
        !isNaN(Number(valB))
      ) {
        return (numA - numB) * modifier;
      }

      return (
        String(valA).localeCompare(String(valB), "th", {
          numeric: true,
          sensitivity: "base",
        }) * modifier
      );
    });
  }, [data, sortKey, sortOrder, options?.comparators]);

  return {
    sortKey,
    sortOrder,
    handleSort,
    sortedData,
    setSortKey,
    setSortOrder,
  };
}

