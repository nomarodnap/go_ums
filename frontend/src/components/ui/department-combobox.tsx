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
}

export function DepartmentCombobox({
  departments,
  name,
  value,
  onValueChange,
  disabled,
  placeholder = "เลือกหน่วยงาน...",
}: DepartmentComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(value || "");

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const handleSelect = (exactValue: string) => {
    const newValue = exactValue === internalValue ? "" : exactValue;
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
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between font-normal",
                !internalValue && "text-muted-foreground",
                disabled &&
                  "bg-muted cursor-not-allowed opacity-100 text-muted-foreground",
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
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command
            filter={(value, search) => {
              const dept = departments.find((d) => d.id === value);
              if (!dept) return 0;
              const searchLower = search.toLowerCase();
              if (
                dept.fullName.toLowerCase().includes(searchLower) ||
                (dept.shortName &&
                  dept.shortName.toLowerCase().includes(searchLower)) ||
                (dept.costCenterCode &&
                  dept.costCenterCode.toLowerCase().includes(searchLower))
              ) {
                return 1;
              }
              return 0;
            }}
          >
            <CommandInput placeholder="ค้นหาจากชื่อเต็ม, ชื่อย่อ, รหัสศูนย์..." />
            <CommandList>
              <CommandEmpty>ไม่พบหน่วยงาน</CommandEmpty>
              <CommandGroup>
                {departments.map((dept) => (
                  <CommandItem
                    key={dept.id}
                    value={dept.id}
                    onSelect={() => handleSelect(dept.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 flex-shrink-0",
                        internalValue === dept.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate">{dept.fullName}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {dept.shortName ? `ย่อ: ${dept.shortName}` : ""}
                        {dept.shortName && dept.costCenterCode ? " | " : ""}
                        {dept.costCenterCode
                          ? `รหัส: ${dept.costCenterCode}`
                          : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
