"use client";

import * as React from "react";
import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
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

export const THAI_PROVINCES = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พะเยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
] as const;

export type ThaiProvince = (typeof THAI_PROVINCES)[number];

interface ProvinceComboboxProps {
  id?: string;
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ProvinceCombobox({
  id,
  name,
  value = "",
  onValueChange,
  disabled = false,
  placeholder = "-- เลือกจังหวัด --",
  className,
}: ProvinceComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(value);

  React.useEffect(() => {
    setInternalValue(value || "");
  }, [value]);

  const handleSelect = (provinceName: string) => {
    const newValue = provinceName === internalValue ? "" : provinceName;
    setInternalValue(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInternalValue("");
    if (onValueChange) {
      onValueChange("");
    }
  };

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
              disabled={disabled}
              className={cn(
                "w-full justify-between h-9.5 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/70 dark:bg-slate-900/50 px-3 text-sm font-normal transition-all",
                !internalValue && "text-muted-foreground",
                disabled && "bg-muted cursor-not-allowed opacity-60",
                className
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {internalValue || placeholder}
                </span>
              </div>
              <div className="flex items-center gap-1 ml-2">
                {internalValue && !disabled && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={handleClear}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleClear(e as unknown as React.MouseEvent);
                      }
                    }}
                    className="p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="ล้างจังหวัดที่เลือก"
                  >
                    <X className="size-3.5" />
                  </span>
                )}
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </div>
            </Button>
          }
        />
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[240px] p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              const searchTrimmed = search.trim().toLowerCase();
              if (!searchTrimmed) return 1;
              if (itemValue.toLowerCase().includes(searchTrimmed)) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="พิมพ์เพื่อค้นหาจังหวัด..." />
            <CommandList className="max-h-64 overflow-y-auto">
              <CommandEmpty>ไม่พบข้อมูลจังหวัด</CommandEmpty>
              <CommandGroup heading={`จังหวัดในประเทศไทย (${THAI_PROVINCES.length} จังหวัด)`}>
                {internalValue && (
                  <CommandItem
                    value="-- ไม่ระบุจังหวัด --"
                    onSelect={() => handleSelect("")}
                    className="text-muted-foreground text-xs cursor-pointer"
                  >
                    <X className="mr-2 size-3.5 opacity-60" />
                    -- ไม่ระบุจังหวัด --
                  </CommandItem>
                )}
                {THAI_PROVINCES.map((prov) => (
                  <CommandItem
                    key={prov}
                    value={prov}
                    onSelect={() => handleSelect(prov)}
                    className="cursor-pointer flex items-center justify-between"
                  >
                    <span>{prov}</span>
                    <Check
                      className={cn(
                        "size-4 text-primary shrink-0",
                        internalValue === prov ? "opacity-100" : "opacity-0"
                      )}
                    />
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
