"use client";

import * as React from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type ServiceItem = {
  id?: string;
  serviceNumber: string;
  provider?: string | null;
  locationType?: string | null;
  [key: string]: any;
};

interface ServiceNumberComboboxProps {
  services: ServiceItem[];
  selectedNumbers: string[];
  onSelect: (serviceNumber: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  id?: string;
  recordedNumbers?: Map<string, any> | Set<string>;
}

export function ServiceNumberCombobox({
  services,
  selectedNumbers,
  onSelect,
  disabled = false,
  placeholder,
  className,
  hasError = false,
  id = "serviceNumber",
  recordedNumbers,
}: ServiceNumberComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const availableServices = React.useMemo(() => {
    return services.filter(
      (svc) => !selectedNumbers.includes(svc.serviceNumber),
    );
  }, [services, selectedNumbers]);

  const displayPlaceholder = React.useMemo(() => {
    if (disabled) {
      return placeholder || "⚠️ กรุณาเลือกประเภทสาธารณูปโภคด้านบนก่อน";
    }
    if (services.length === 0) {
      return "ไม่พบหมายเลขผู้ใช้ในระบบ";
    }
    if (availableServices.length === 0) {
      return "เลือกหมายเลขครบทุกรายการแล้ว";
    }
    return placeholder || "+ ค้นหาและคลิกเพื่อเลือกหมายเลขผู้ใช้ / รหัสเครื่องวัด...";
  }, [disabled, placeholder, services.length, availableServices.length]);

  const isTriggerDisabled = disabled || availableServices.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isTriggerDisabled}
            className={cn(
              "h-10 w-full justify-between font-normal text-left bg-background shadow-2xs text-xs sm:text-sm rounded-xl",
              isTriggerDisabled &&
                "bg-muted cursor-not-allowed opacity-60 text-muted-foreground",
              hasError && "border-rose-500 ring-2 ring-rose-500/20",
              className,
            )}
          >
            <span className="truncate text-muted-foreground">
              {displayPlaceholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent
        className="w-[var(--anchor-width,100%)] min-w-[340px] sm:min-w-[500px] max-w-[calc(100vw-2rem)] p-0 z-50"
        align="start"
      >
        <Command
          filter={(value, search) => {
            const searchTrimmed = search.trim().toLowerCase();
            if (!searchTrimmed) return 1;
            const item = availableServices.find(
              (d) => d.serviceNumber.toLowerCase() === value.toLowerCase(),
            );
            if (!item) return 0;
            if (
              item.serviceNumber.toLowerCase().includes(searchTrimmed) ||
              (item.provider &&
                item.provider.toLowerCase().includes(searchTrimmed)) ||
              (item.locationType &&
                item.locationType.toLowerCase().includes(searchTrimmed))
            ) {
              return 1;
            }
            return 0;
          }}
        >
          <CommandInput placeholder="พิมพ์เพื่อค้นหาหมายเลขผู้ใช้, รหัสเครื่องวัด, ผู้ให้บริการ, ที่ตั้ง..." />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              ไม่พบหมายเลขผู้ใช้ / รหัสเครื่องวัดที่ค้นหา
            </CommandEmpty>
            <CommandGroup
              heading={`หมายเลขที่เลือกได้ (${availableServices.length})`}
            >
              {availableServices.map((svc) => {
                const isRecorded = recordedNumbers?.has(svc.serviceNumber.trim().toLowerCase());
                return (
                  <CommandItem
                    key={svc.id || svc.serviceNumber}
                    value={svc.serviceNumber}
                    onSelect={() => {
                      if (isRecorded) {
                        toast.error(
                          `หมายเลข ${svc.serviceNumber} ได้รับการบันทึกบิลในรอบบิลนี้แล้ว ไม่อนุญาตให้บันทึกซ้ำ`,
                        );
                        return;
                      }
                      onSelect(svc.serviceNumber);
                      setOpen(false);
                    }}
                    className={cn(
                      "py-2.5 px-3 cursor-pointer flex items-center justify-between gap-3",
                      isRecorded && "opacity-75 bg-destructive/5 hover:bg-destructive/10",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="size-3.5 text-primary shrink-0" />
                      <span className="font-mono font-semibold text-xs text-foreground">
                        {svc.serviceNumber}
                      </span>
                      {isRecorded && (
                        <Badge
                          variant="destructive"
                          className="text-[9px] px-1.5 py-0 h-4 font-normal"
                        >
                          บันทึกบิลแล้วในรอบนี้
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {svc.provider && <span>({svc.provider})</span>}
                      {svc.locationType && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {svc.locationType}
                        </Badge>
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
  );
}

