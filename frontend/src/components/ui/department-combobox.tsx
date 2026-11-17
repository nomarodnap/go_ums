"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Department = {
  id: string;
  fullName: string;
  shortName?: string | null;
  costCenterCode?: string | null;
};

interface DepartmentComboboxProps {
  departments: Department[];
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
  id?: string;
}

export function DepartmentCombobox({
  departments,
  name,
  value,
  onValueChange,
  disabled,
  placeholder = "เลือกหน่วยงาน...",
  className,
  popoverClassName,
  id,
}: DepartmentComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(value || "");

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const handleSelect = (exactValue: string) => {
    const isSelected =
      internalValue === exactValue ||
      selectedDepartment?.fullName === exactValue ||
      selectedDepartment?.id === exactValue;
    const newValue = isSelected ? "" : exactValue;
    setInternalValue(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
    setOpen(false);
  };

  const selectedDepartment = departments.find(
    (dept) => dept.fullName === internalValue || dept.id === internalValue,
  );

  return (
    <>
      {name && <input type="hidden" name={name} value={internalValue} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between font-normal text-left",
                !internalValue && "text-muted-foreground",
                disabled &&
                  "bg-muted cursor-not-allowed opacity-100 text-muted-foreground",
                className,
              )}
              disabled={disabled}
            >
              <span className="truncate">
                {internalValue
                  ? selectedDepartment
                    ? selectedDepartment.fullName
                    : internalValue
                  : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent
          className={cn(
            "w-[var(--anchor-width,100%)] min-w-[340px] sm:min-w-[520px] max-w-[calc(100vw-2rem)] p-0 z-50",
            popoverClassName,
          )}
          align="start"
        >
          <Command
            filter={(value, search) => {
              const searchTrimmed = search.trim().toLowerCase();
              if (!searchTrimmed) return 1;
              const dept = departments.find(
                (d) => d.id.toLowerCase() === value.toLowerCase(),
              );
              if (!dept) return 0;
              if (
                dept.fullName.toLowerCase().includes(searchTrimmed) ||
                (dept.shortName &&
                  dept.shortName.toLowerCase().includes(searchTrimmed)) ||
                (dept.costCenterCode &&
                  dept.costCenterCode.toLowerCase().includes(searchTrimmed))
              ) {
                return 1;
              }
              return 0;
            }}
          >
            <CommandInput placeholder="พิมพ์เพื่อค้นหาชื่อหน่วยงาน, ชื่อย่อ, รหัสเบิกจ่าย..." />
            <CommandList className="max-h-[320px] overflow-y-auto">
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                ไม่พบหน่วยงานที่ค้นหา
              </CommandEmpty>
              <CommandGroup>
                {departments.map((dept) => {
                  const isSelected =
                    internalValue === dept.id ||
                    internalValue === dept.fullName;
                  return (
                    <CommandItem
                      key={dept.id}
                      value={dept.id}
                      onSelect={() => handleSelect(dept.id)}
                      className="flex items-start gap-2.5 py-2.5 px-3 cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 mt-0.5 shrink-0 text-primary",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium leading-snug break-words text-foreground">
                          {dept.fullName}
                        </span>
                        {(dept.shortName || dept.costCenterCode) && (
                          <span className="text-xs text-muted-foreground mt-0.5 leading-normal">
                            {dept.shortName ? `ชื่อย่อ: ${dept.shortName}` : ""}
                            {dept.shortName && dept.costCenterCode ? "  •  " : ""}
                            {dept.costCenterCode
                              ? `รหัสเบิกจ่าย: ${dept.costCenterCode}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
