"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { PageTransition } from "@/components/motion/page-transition";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: userData, isLoading, isError } = useGetCurrentUser();

  useEffect(() => {
    if (!isLoading && (isError || (userData && userData.status !== 200))) {
      // Not logged in or expired token
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        router.push("/sign-in");
      }
    }
  }, [isLoading, isError, userData, router]);

  const user = userData?.status === 200 ? userData.data.user : undefined;

  const userProp = user
    ? {
        name: user.name,
        department: user.departmentName || "กรมประมง",
        role: user.role,
      }
    : undefined;

  return (
    <SidebarProvider>
      <AppSidebar user={userProp} />
      <SidebarInset className="bg-background min-h-screen flex flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-background/80 dark:bg-background/70 backdrop-blur-2xl px-5 sm:px-8 sticky top-0 z-30 transition-all">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground size-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" />
            <div className="flex items-center gap-3">
              <div className="flex size-8.5 items-center justify-center rounded-xl bg-white dark:bg-slate-900 p-1 shadow-xs border border-black/[0.06] dark:border-white/[0.08]">
                <Image
                  src="/logo.png"
                  alt="ตราสัญลักษณ์กรมประมง"
                  width={28}
                  height={28}
                  className="size-7 object-contain"
                  priority
                />
              </div>
              <div>
                <div className="font-semibold text-sm sm:text-base text-foreground tracking-tight flex items-center gap-2">
                  <span>ระบบรายงานค่าสาธารณูปโภค</span>
                  <span className="hidden md:inline-flex text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    กรมประมง
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto">
          <PageTransition key={pathname} className="flex flex-1 flex-col gap-6">
            {children}
          </PageTransition>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
