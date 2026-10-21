"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building,
  FileText,
  FilePlus2,
  Activity,
  Bell,
  Clock,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Laptop,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      {/* Header Search Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative h-9 w-40 sm:w-60 md:w-72 justify-between rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border-black/[0.08] dark:border-white/[0.1] text-xs font-normal text-muted-foreground shadow-none hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-3"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="size-3.5 opacity-60 shrink-0" />
          <span className="truncate">ค้นหาหน้า หรือพิมพ์คำสั่ง...</span>
        </span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-black/10 dark:border-white/10 bg-muted px-1.5 font-mono text-[10px] font-medium opacity-80 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="พิมพ์สิ่งที่ต้องการค้นหา เช่น บันทึกบิล, รายงาน, สลับธีม..." />
        <CommandList>
          <CommandEmpty>ไม่พบผลการค้นหาที่ตรงกับคำค้น</CommandEmpty>

          <CommandGroup heading="การนำทางหลัก (Main Navigation)">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/"))}
            >
              <LayoutDashboard className="mr-2 size-4 text-blue-500" />
              <span>แดชบอร์ดหน่วยงาน</span>
              <CommandShortcut>G D</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/overview"))}
            >
              <Building className="mr-2 size-4 text-emerald-500" />
              <span>แดชบอร์ดภาพรวมทั้งกรม</span>
              <CommandShortcut>G O</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/bills/new"))}
            >
              <FilePlus2 className="mr-2 size-4 text-emerald-600" />
              <span>บันทึกบิลสาธารณูปโภคใหม่</span>
              <CommandShortcut>N B</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/bills"))}
            >
              <FileText className="mr-2 size-4 text-indigo-500" />
              <span>รายการค่าใช้จ่ายหน่วยงาน</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/all-bills"))}
            >
              <FileText className="mr-2 size-4 text-purple-500" />
              <span>รายการค่าใช้จ่ายทั้งหมด (ทุกหน่วยงาน)</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/services"))}
            >
              <Activity className="mr-2 size-4 text-amber-500" />
              <span>รหัสเครื่องวัด / เบอร์โทรศัพท์</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/bill-tracking"))}
            >
              <Clock className="mr-2 size-4 text-cyan-500" />
              <span>ติดตามสถานะบิลและรอบเบิกจ่าย</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/notifications"))}
            >
              <Bell className="mr-2 size-4 text-rose-500" />
              <span>ศูนย์การแจ้งเตือน</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="ศูนย์รายงาน (Reports & Analytics)">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/reports"))}
            >
              <BarChart3 className="mr-2 size-4 text-primary" />
              <span>ศูนย์รวมรายงานค่าสาธารณูปโภค</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/reports/budget"))}
            >
              <BarChart3 className="mr-2 size-4 text-blue-500" />
              <span>รายงานการใช้งบประมาณรายหน่วยงาน</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/reports/pending"))}
            >
              <BarChart3 className="mr-2 size-4 text-amber-500" />
              <span>รายงานรายการค้างชำระ / รอเบิกจ่าย</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/reports/utility"))}
            >
              <BarChart3 className="mr-2 size-4 text-emerald-500" />
              <span>รายงานค่าสาธารณูปโภคแยกตามประเภท</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="การตั้งค่า & เครื่องมือ (Settings & Theme)">
            <CommandItem
              onSelect={() => {
                runCommand(() => {
                  window.dispatchEvent(new CustomEvent("ums:preview-loading"));
                });
              }}
            >
              <Activity className="mr-2 size-4 text-cyan-400" />
              <span>ทดสอบหน้า Loading เต็มจอ (Preview Full-screen Loading)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/settings"))}
            >
              <Settings className="mr-2 size-4 text-slate-500" />
              <span>ตั้งค่าระบบและรหัสงบประมาณ</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setTheme("light"))}
            >
              <Sun className="mr-2 size-4 text-amber-500" />
              <span>เปลี่ยนธีมเป็นโหมดสว่าง (Light Mode)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setTheme("dark"))}
            >
              <Moon className="mr-2 size-4 text-blue-400" />
              <span>เปลี่ยนธีมเป็นโหมดมืด (Dark Mode)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setTheme("system"))}
            >
              <Laptop className="mr-2 size-4 text-slate-400" />
              <span>ใช้โหมดตามระบบ (System Theme)</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
