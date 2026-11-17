"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandMenu } from "@/components/layout/command-menu";
import Image from "next/image";
import Link from "next/link";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { useGetNotificationCounts } from "@/lib/api/generated/notifications/notifications";
import { useRouter, usePathname } from "next/navigation";
import { hasPageAccess, getUserLandingPage } from "@/lib/permissions";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { IdleTimeoutManager } from "@/components/auth/idle-timeout-manager";
import { AIChatWidget } from "@/components/ai-chat/chat-widget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: userData, isLoading, isError } = useGetCurrentUser();
  const { data: countsRes } = useGetNotificationCounts();
  const counts = countsRes?.status === 200 ? countsRes.data : undefined;

  // Handle redirect callback after Connect & Sync for LINE / Google in Edit Profile
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const linkedProvider = url.searchParams.get("auth_linked");
    const linkErrorProvider = url.searchParams.get("auth_link_error");
    const errorValues = url.searchParams.getAll("error");
    const urlError = errorValues[errorValues.length - 1] ?? null;

    if (!linkedProvider && !linkErrorProvider) return;

    const getProviderLabel = (p: string | null) =>
      p === "line" ? "LINE" : p === "google" ? "Google Workspace" : "โซเชียล";

    if (linkedProvider && !urlError) {
      const label = getProviderLabel(linkedProvider);
      toast.success(`เชื่อมต่อและซิงค์บัญชี ${label} สำเร็จ`, {
        description: `ครั้งถัดไปสามารถใช้ ${label} เข้าสู่ระบบได้ทันที`,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } else if (linkErrorProvider || urlError) {
      const label = getProviderLabel(linkErrorProvider || linkedProvider);
      if (urlError === "account_already_linked_to_different_user") {
        toast.error(`บัญชี ${label} นี้ถูกเชื่อมต่อกับผู้ใช้งานอื่นในระบบแล้ว`);
      } else if (urlError === "access_denied") {
        toast.error(`ท่านได้ยกเลิกการเชื่อมต่อบัญชี ${label}`);
      } else if (urlError === "email_does_not_match" || urlError === "email_doesn't_match") {
        toast.error(`อีเมลของบัญชี ${label} ไม่ตรงกับบัญชีผู้ใช้งานนี้`);
      } else {
        toast.error(
          urlError
            ? `ไม่สามารถเชื่อมต่อบัญชี ${label} ได้ (${urlError})`
            : `ไม่สามารถเชื่อมต่อบัญชี ${label} ได้`
        );
      }
    }

    url.searchParams.delete("auth_linked");
    url.searchParams.delete("auth_link_error");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    const cleanSearch = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ""}${url.hash}`);
  }, [queryClient]);

  // Early check: Inactivity timeout across browser closes (30 minutes)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dof_last_activity_time");
        if (stored) {
          const lastActive = parseInt(stored, 10);
          if (
            !isNaN(lastActive) &&
            lastActive > 0 &&
            Date.now() - lastActive >= 30 * 60 * 1000
          ) {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("user");
            localStorage.removeItem("dof_last_activity_time");
            document.cookie =
              "auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            document.cookie =
              "better-auth.session_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            document.cookie =
              "__Secure-better-auth.session_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            window.location.href = "/sign-in?reason=timeout";
          }
        }
      } catch {
        // Ignore storage access errors
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoading && (isError || (userData && userData.status !== 200))) {
      // Not logged in or expired token -> clear storage and redirect cleanly
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        localStorage.removeItem("dof_last_activity_time");
      }
      router.push("/sign-in");
    }
  }, [isLoading, isError, userData, router]);

  const user = userData?.status === 200 ? userData.data.user : undefined;

  // RBAC Route Guard
  useEffect(() => {
    if (user && pathname && pathname !== "/unauthorized") {
      const perms = (user as any).permissions;
      if (Array.isArray(perms) && perms.length > 0 && user.role !== "admin") {
        if (!hasPageAccess(user as any, pathname)) {
          router.push("/unauthorized");
        }
      }
    }
  }, [user, pathname, router]);

  // หากกำลังตรวจสอบ session หรือ session ว่างเปล่า ให้แสดง Loading Effect เต็มหน้าจอ
  if (isLoading || !user) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  const userProp = {
    name: user.name,
    department: user.departmentName || "กรมประมง",
    role: user.role,
    roleName: (user as any).roleName,
    permissions: (user as any).permissions,
    defaultPath: (user as any).defaultPath,
    image: (user as any).image || null,
    myDeptUnreadCount: counts?.myDeptCount,
    allSystemUnreadCount: counts?.allSystemCount,
    isGoogle: Boolean((user as any).isGoogle),
    isLine: Boolean((user as any).isLine),
    googleEmail: (user as any).googleEmail ?? null,
    lineName: (user as any).lineName ?? null,
    lineEmail: (user as any).lineEmail ?? null,
  };

  const landingPage = getUserLandingPage(user as any);

  return (
    <SidebarProvider>
      <IdleTimeoutManager />
      <AppSidebar user={userProp} />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-background/80 dark:bg-background/70 backdrop-blur-2xl px-5 sm:px-8 sticky top-0 z-30 transition-all">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground size-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" />
            <Link
              href={landingPage}
              className="flex items-center gap-3 transition-opacity hover:opacity-90 cursor-pointer"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-white dark:bg-slate-900 p-0.5 shadow-xs border border-black/[0.08] dark:border-white/[0.1] shrink-0 overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="ตราสัญลักษณ์กรมประมง"
                  width={36}
                  height={36}
                  className="size-full object-contain"
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
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <CommandMenu />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </div>
      </SidebarInset>
      <AIChatWidget userDepartment={userProp.department} />
    </SidebarProvider>
  );
}
