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
  Sparkles,
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
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import {
  type AISearchResponse,
  extractAIErrorMessage,
  searchAI,
} from "@/lib/api/ai-hooks";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [aiLoading, setAILoading] = React.useState(false);
  const [aiError, setAIError] = React.useState<string | null>(null);
  const [aiResult, setAIResult] = React.useState<AISearchResponse | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { data: userData } = useGetCurrentUser();
  const user = userData?.status === 200 ? userData.data.user : null;
  const isAdminRole = user?.role === "admin";
  const canViewAllBills = ["admin", "auditor", "strategy_finance"].includes(
    user?.role || "",
  );
  const billsBasePath = canViewAllBills ? "/all-bills" : "/bills";

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

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      abortRef.current?.abort();
      setQuery("");
      setAILoading(false);
      setAIError(null);
      setAIResult(null);
    }
  }, []);

  const runCommand = React.useCallback(
    (command: () => void) => {
      handleOpenChange(false);
      command();
    },
    [handleOpenChange],
  );

  const runPaletteAISearch = React.useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length < 2) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAILoading(true);
    setAIError(null);
    try {
      const res = await searchAI(
        { query: q, entityType: "all", limit: 10 },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setAIResult(res);
      }
    } catch (err) {
      if (
        (err as { name?: string })?.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }
      setAIError(
        extractAIErrorMessage(
          err,
          "ไม่สามารถค้นหาด้วย AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
        ),
      );
    } finally {
      if (!controller.signal.aborted) {
        setAILoading(false);
      }
    }
  }, []);

  return (
    <>
      {/* Header Search Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
        className="relative h-9 w-40 sm:w-60 md:w-72 justify-between rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border-black/[0.08] dark:border-white/[0.1] text-xs font-normal text-muted-foreground shadow-none hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-3"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="size-3.5 opacity-60 shrink-0" />
          <span className="truncate">ค้นหาหน้า, บิล หรือใช้ AI Search...</span>
        </span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-black/10 dark:border-white/10 bg-muted px-1.5 font-mono text-[10px] font-medium opacity-80 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <CommandInput
          value={query}
          onValueChange={(next) => {
            setQuery(next);
            if (aiResult && next.trim() !== aiResult.query) {
              setAIResult(null);
              setAIError(null);
            }
          }}
          placeholder="พิมพ์คำค้นหา เช่น บิลค่าไฟที่ยังไม่จ่ายภาคใต้, รายงาน, สลับธีม..."
        />
        <CommandList>
          <CommandEmpty>ไม่พบผลการค้นหาที่ตรงกับคำค้น</CommandEmpty>

          {query.trim().length >= 2 && (
            <>
              <CommandGroup heading="ค้นหาอัจฉริยะด้วย AI (Semantic Search)">
                <CommandItem
                  value={`ai-search-trigger ${query}`}
                  keywords={[query]}
                  onSelect={() => {
                    void runPaletteAISearch(query);
                  }}
                >
                  <Sparkles className="mr-2 size-4 text-primary shrink-0" />
                  <span className="truncate">
                    ค้นหา “{query.trim()}” ด้วย AI (บิลและหน่วยงาน)
                  </span>
                </CommandItem>

                {aiLoading && (
                  <div className="px-3 py-2 space-y-1.5">
                    <p className="text-[11px] text-primary font-medium">
                      กำลังค้นหาด้วย AI...
                    </p>
                    <progress
                      aria-label="กำลังค้นหาข้อมูลด้วย AI"
                      className="ai-progress"
                    />
                  </div>
                )}

                {aiError && (
                  <div
                    role="alert"
                    className="mx-2 my-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
                  >
                    {aiError}
                  </div>
                )}

                {aiResult && !aiLoading && (
                  <>
                    <div
                      role="status"
                      aria-live="polite"
                      className="px-2.5 py-1 text-[11px] text-muted-foreground flex items-center justify-between gap-2"
                    >
                      <span>
                        พบ {aiResult.bills.length} บิล และ{" "}
                        {aiResult.departments.length} หน่วยงาน ({aiResult.tookMs} ms)
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        {aiResult.mode === "hybrid" ? "Hybrid AI" : "Smart Intent"}
                      </Badge>
                    </div>

                    {aiResult.bills.slice(0, 5).map((bill) => (
                      <CommandItem
                        key={`ai-bill-${bill.id}`}
                        value={`ai-bill-${bill.id} ${query} ${bill.billCode || ""} ${bill.departmentName} ${bill.utilityType}`}
                        keywords={[query]}
                        onSelect={() =>
                          runCommand(() =>
                            router.push(
                              `${billsBasePath}?q=${encodeURIComponent(bill.billCode || aiResult.query)}`,
                            ),
                          )
                        }
                      >
                        <FileText className="mr-2 size-4 text-primary shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate text-xs font-medium">
                            {bill.billCode || bill.utilityType} •{" "}
                            {bill.departmentName}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {bill.utilityType} • {bill.billingMonth}/
                            {bill.billingYearBE} • ฿
                            {bill.invoiceAmount.toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            {bill.matchReasons?.length
                              ? ` (${bill.matchReasons.slice(0, 2).join(", ")})`
                              : ""}
                          </span>
                        </div>
                      </CommandItem>
                    ))}

                    {aiResult.bills.length > 0 && (
                      <CommandItem
                        value={`ai-open-all-bills ${query}`}
                        keywords={[query]}
                        onSelect={() =>
                          runCommand(() =>
                            router.push(
                              `${billsBasePath}?q=${encodeURIComponent(aiResult.query)}`,
                            ),
                          )
                        }
                      >
                        <Search className="mr-2 size-4 text-primary shrink-0" />
                        <span className="text-xs font-medium text-primary">
                          ดูบิลทั้งหมดสำหรับ “{aiResult.query}” ในตาราง
                        </span>
                      </CommandItem>
                    )}

                    {aiResult.departments.slice(0, 4).map((dept) => (
                      <CommandItem
                        key={`ai-dept-${dept.id}`}
                        value={`ai-dept-${dept.id} ${query} ${dept.fullName} ${dept.shortName || ""} ${dept.province || ""}`}
                        keywords={[query]}
                        onSelect={() =>
                          runCommand(() =>
                            router.push(
                              canViewAllBills
                                ? `/all-bills?departmentId=${encodeURIComponent(dept.id)}`
                                : "/bills",
                            ),
                          )
                        }
                      >
                        <Building className="mr-2 size-4 text-emerald-500 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate text-xs font-medium">
                            {dept.fullName}
                            {dept.shortName ? ` (${dept.shortName})` : ""}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {dept.province || dept.region || "หน่วยงานกรมประมง"}
                            {dept.matchReasons?.length
                              ? ` • ${dept.matchReasons.slice(0, 2).join(", ")}`
                              : ""}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </>
                )}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="การนำทางหลัก (Main Navigation)">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/dashboard"))}
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

            {!isAdminRole && (
              <CommandItem
                onSelect={() => runCommand(() => router.push("/bills"))}
              >
                <FileText className="mr-2 size-4 text-indigo-500" />
                <span>รายการค่าใช้จ่ายหน่วยงาน</span>
              </CommandItem>
            )}

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
              <span>รหัสเครื่องวัด / หมายเลขผู้ใช้</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/bill-tracking"))}
            >
              <Clock className="mr-2 size-4 text-cyan-500" />
              <span>ติดตามความคืบหน้า</span>
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
