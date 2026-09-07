"use client";

import * as React from "react";
import {
  FileText,
  LayoutDashboard,
  Settings,
  Building,
  LogOut,
  Activity,
  BarChart3,
  User,
  Bell,
  BellRing,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useGetCurrentUser, useLogout } from "@/lib/api/generated/auth/auth";
import { useListNotifications } from "@/lib/api/generated/notifications/notifications";
import { toast } from "sonner";

const navMain = [
  {
    title: "แดชบอร์ดหน่วยงาน",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "แดชบอร์ดภาพรวม",
    url: "/overview",
    icon: BarChart3,
    onlyAdmin: true,
  },
  {
    title: "การแจ้งเตือนหน่วยงาน",
    url: "/notifications",
    icon: Bell,
    badgeKey: "myDeptUnreadCount",
  },
  {
    title: "การแจ้งเตือนทุกหน่วยงาน",
    url: "/all-notifications",
    icon: BellRing,
    onlyAdmin: true,
  },
  {
    title: "รายการค่าใช้จ่าย",
    url: "/bills",
    icon: FileText,
  },
  {
    title: "รายการค่าใช้จ่ายทั้งหมด",
    url: "/all-bills",
    icon: FileText,
    staffOnly: true,
  },
  {
    title: "รหัสเครื่องวัด / เบอร์โทร",
    url: "/services",
    icon: Activity,
  },
  {
    title: "ติดตามสถานะบิล",
    url: "/bill-tracking",
    icon: Activity,
    staffOnly: true,
  },
  {
    title: "ศูนย์รวมรายงาน",
    url: "/reports",
    icon: FileText,
    staffOnly: true,
  },
  {
    title: "จัดการหน่วยงาน",
    url: "/departments",
    icon: Building,
    staffOnly: true,
  },
  {
    title: "ตั้งค่าระบบ",
    url: "/settings",
    icon: Settings,
    staffOnly: true,
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name: string;
    department: string;
    role?: string;
    myDeptUnreadCount?: number;
    allSystemUnreadCount?: number;
  };
}

export function AppSidebar({ user: initialUser, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const { data: userData } = useGetCurrentUser();
  const apiUser = userData?.status === 200 ? userData.data.user : null;

  const { data: notifData } = useListNotifications();
  const notifications =
    notifData?.status === 200 && Array.isArray(notifData.data)
      ? notifData.data
      : [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const user = initialUser || {
    name: apiUser?.name || "เจ้าหน้าที่",
    department: apiUser?.departmentName || "กรมประมง",
    role: apiUser?.role || "user",
    myDeptUnreadCount: unreadCount,
    allSystemUnreadCount: unreadCount,
  };

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        toast.success("ออกจากระบบเรียบร้อย");
        router.push("/sign-in");
      },
      onError: () => {
        // Clear anyway
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        router.push("/sign-in");
      },
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case "admin":
        return "ผู้ดูแลระบบ";
      case "auditor":
        return "ผู้ตรวจสอบภายใน (กตน.)";
      case "strategy_finance":
        return "กองยุทธศาสตร์ฯ / การคลัง";
      case "central_staff":
        return "จนท. ส่วนกลาง";
      case "regional_staff":
        return "จนท. ภูมิภาค";
      default:
        return "ผู้ใช้งาน";
    }
  };

  const isAdmin = [
    "admin",
    "auditor",
    "strategy_finance",
    "central_staff",
  ].includes(user?.role || "");

  return (
    <Sidebar
      variant="inset"
      className="border-r border-black/[0.06] dark:border-white/[0.08]"
      {...props}
    >
      <SidebarHeader className="p-4 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all p-2 h-auto"
            >
              <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-xs dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] shrink-0">
                <Image
                  src="/logo.png"
                  alt="ตราสัญลักษณ์กรมประมง"
                  width={32}
                  height={32}
                  className="size-7 object-contain"
                  priority
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight pl-1">
                <span className="truncate font-semibold text-foreground tracking-tight">
                  กรมประมง
                </span>
                <span className="truncate text-xs text-muted-foreground font-normal">
                  ระบบสาธารณูปโภค
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase px-3 mb-1">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navMain.map((item) => {
                if (item.onlyAdmin && user?.role !== "admin") {
                  return null;
                }

                if (item.staffOnly && !isAdmin) {
                  return null;
                }

                const isActive = pathname === item.url;
                const badgeCount = item.badgeKey
                  ? (user as any)?.[item.badgeKey] ?? 0
                  : 0;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={isActive}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 gap-3 justify-between",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold shadow-2xs dark:bg-primary/20 dark:text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <item.icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="truncate">{item.title}</span>
                      </div>
                      {badgeCount > 0 && (
                        <span className="flex size-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-2xs shrink-0 animate-pulse">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 pt-1">
        <SidebarMenu className="gap-2">
          {user && (
            <SidebarMenuItem>
              <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs shrink-0">
                    <User className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs text-foreground truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 truncate">
                      {getRoleLabel(user.role)}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground/70 line-clamp-1 border-t border-black/[0.04] dark:border-white/[0.06] pt-1.5 mt-0.5">
                  {user.department}
                </div>
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-all font-medium justify-center cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarSeparator />
    </Sidebar>
  );
}
