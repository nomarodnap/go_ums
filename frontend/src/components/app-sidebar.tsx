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
  Pencil,
  Gauge,
  MessageSquare,
  Sparkles,
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
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { hasPageAccess, getUserLandingPage } from "@/lib/permissions";
import { useGetCurrentUser, useLogout } from "@/lib/api/generated/auth/auth";
import { useGetNotificationCounts } from "@/lib/api/generated/notifications/notifications";
import { toast } from "sonner";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";

const navMain = [
  {
    title: "แดชบอร์ดหน่วยงาน",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "แดชบอร์ดภาพรวม",
    url: "/overview",
    icon: LayoutDashboard,
    onlyAdmin: true,
  },
  {
    title: "ผู้ช่วย AI ทั้งกรม (292 หน่วยงาน)",
    url: "/all-ai",
    icon: Sparkles,
    staffOnly: true,
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
    badgeKey: "allSystemUnreadCount",
    onlyAdmin: true,
  },
  {
    title: "สถานะการดำเนินงานตามรหัสเครื่องวัด",
    url: "/service-tracking",
    icon: Gauge,
  },
  {
    title: "รายการค่าใช้จ่าย",
    url: "/bills",
    icon: FileText,
    hideForAdmin: true,
  },
  {
    title: "รายการค่าใช้จ่ายทั้งหมด",
    url: "/all-bills",
    icon: FileText,
    staffOnly: true,
  },
  {
    title: "รหัสเครื่องวัด / หมายเลขผู้ใช้",
    url: "/services",
    icon: Activity,
  },
  {
    title: "รหัสเครื่องวัดทั้งหมด",
    url: "/all-services",
    icon: Activity,
    staffOnly: true,
  },
  {
    title: "ติดตามความคืบหน้า",
    url: "/bill-tracking",
    icon: BarChart3,
    staffOnly: true,
  },
  {
    title: "ศูนย์รวมรายงาน",
    url: "/reports",
    icon: FileText,
    staffOnly: true,
  },
  {
    title: "สนทนา LINE OA",
    url: "/line-chat",
    icon: MessageSquare,
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
    id?: string;
    name: string;
    department: string;
    email?: string;
    image?: string | null;
    phone?: string;
    role?: string;
    roleName?: string;
    permissions?: string[];
    defaultPath?: string;
    isGoogle?: boolean;
    isLine?: boolean;
    googleEmail?: string | null;
    lineName?: string | null;
    lineEmail?: string | null;
    myDeptUnreadCount?: number;
    allSystemUnreadCount?: number;
  };
}

function UserAvatar({
  image,
  name,
}: {
  image?: string | null;
  name: string;
}) {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [image]);

  return (
    <div className="relative flex size-8 group-data-[collapsible=icon]:size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs shrink-0 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 group-hover/user:ring-primary/30 group-hover/user:bg-primary group-hover/user:text-primary-foreground transition-all">
      {image && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover rounded-full z-10"
          onError={() => setImageError(true)}
        />
      ) : (
        <User className="size-4 group-data-[collapsible=icon]:size-3.5" />
      )}
    </div>
  );
}

export function AppSidebar({ user: initialUser, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = React.useState(false);

  const { data: userData } = useGetCurrentUser();
  const apiUser = userData?.status === 200 ? userData.data.user : null;

  const { data: countsRes } = useGetNotificationCounts();
  const counts = countsRes?.status === 200 ? countsRes.data : undefined;

  const user = {
    id: apiUser?.id || initialUser?.id,
    name: apiUser?.name || initialUser?.name || "เจ้าหน้าที่",
    email: apiUser?.email || (initialUser as any)?.email || "",
    image: (apiUser as any)?.image || (initialUser as any)?.image || null,
    department: apiUser?.departmentName || initialUser?.department || "กรมประมง",
    role: apiUser?.role || initialUser?.role || "user",
    roleName: (apiUser as any)?.roleName || (initialUser as any)?.roleName,
    permissions: (apiUser as any)?.permissions || (initialUser as any)?.permissions || [],
    defaultPath: (apiUser as any)?.defaultPath || (initialUser as any)?.defaultPath,
    phone: apiUser?.phone || (initialUser as any)?.phone || "",
    isGoogle: Boolean((apiUser as any)?.isGoogle ?? (initialUser as any)?.isGoogle),
    isLine: Boolean((apiUser as any)?.isLine ?? (initialUser as any)?.isLine),
    googleEmail: (apiUser as any)?.googleEmail ?? (initialUser as any)?.googleEmail ?? null,
    lineName: (apiUser as any)?.lineName ?? (initialUser as any)?.lineName ?? null,
    lineEmail: (apiUser as any)?.lineEmail ?? (initialUser as any)?.lineEmail ?? null,
    myDeptUnreadCount: counts?.myDeptCount ?? initialUser?.myDeptUnreadCount ?? 0,
    allSystemUnreadCount: counts?.allSystemCount ?? initialUser?.allSystemUnreadCount ?? 0,
  };

  const queryClient = useQueryClient();

  const clearAuthStorage = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    localStorage.removeItem("dof_last_activity_time");
    if (typeof document !== "undefined") {
      document.cookie = "auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "better-auth.session_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "__Secure-better-auth.session_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  };

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        clearAuthStorage();
        queryClient.clear();
        toast.success("ออกจากระบบเรียบร้อย");
        window.location.href = "/sign-in";
      },
      onError: () => {
        clearAuthStorage();
        queryClient.clear();
        window.location.href = "/sign-in";
      },
    },
  });

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch {}
    clearAuthStorage();
    await queryClient.clear();
    logoutMutation.mutate();
  };

  const getRoleLabel = (role?: string) => {
    if (user?.roleName) return user.roleName;
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

  const landingPage = getUserLandingPage(user as any);

  const isAdmin = [
    "admin",
    "auditor",
    "strategy_finance",
    "central_staff",
  ].includes(user?.role || "");

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="border-r border-black/[0.06] dark:border-white/[0.08]"
      {...props}
    >
      <SidebarHeader className="p-4 pb-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:pt-3">
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              size="lg"
              tooltip="กรมประมง — ระบบสาธารณูปโภค"
              render={<Link href={landingPage} />}
              className="rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all p-2 h-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
            >
              <div className="flex aspect-square size-10 group-data-[collapsible=icon]:size-8 items-center justify-center rounded-full bg-white shadow-xs dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.1] shrink-0 overflow-hidden p-0.5">
                <Image
                  src="/logo.png"
                  alt="ตราสัญลักษณ์กรมประมง"
                  width={38}
                  height={38}
                  className="size-full object-contain"
                  priority
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight pl-1 group-data-[collapsible=icon]:hidden">
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

      <SidebarContent className="px-3 group-data-[collapsible=icon]:px-1.5">
        <SidebarGroup className="group-data-[collapsible=icon]:p-0">
          <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase px-3 mb-1">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:gap-1.5 group-data-[collapsible=icon]:items-center">
              {navMain.map((item) => {
                const hasDynamicPerms =
                  Array.isArray(user?.permissions) && user.permissions.length > 0;
                if (hasDynamicPerms || user?.role === "admin") {
                  if (!hasPageAccess(user, item.url)) {
                    return null;
                  }
                } else {
                  if (item.hideForAdmin && user?.role === "admin") {
                    return null;
                  }
                  if (item.onlyAdmin && user?.role !== "admin") {
                    return null;
                  }
                  if (item.staffOnly && !isAdmin) {
                    return null;
                  }
                }

                const isActive = pathname === item.url;
                const badgeCount = item.badgeKey
                  ? (user as any)?.[item.badgeKey] ?? 0
                  : 0;

                return (
                  <SidebarMenuItem
                    key={item.title}
                    className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                  >
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={isActive}
                      tooltip={badgeCount > 0 ? `${item.title} (${badgeCount})` : item.title}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 gap-3 justify-between group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:p-0 relative",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold shadow-2xs dark:bg-primary/20 dark:text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 group-data-[collapsible=icon]:justify-center">
                        <item.icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </div>
                      {badgeCount > 0 && (
                        <>
                          <span className="flex size-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-2xs shrink-0 animate-pulse group-data-[collapsible=icon]:hidden">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background group-data-[collapsible=icon]:block hidden animate-pulse" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 pt-1 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:pt-1">
        <SidebarMenu className="gap-2 group-data-[collapsible=icon]:gap-1.5 group-data-[collapsible=icon]:items-center">
          {user && (
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setProfileOpen(true)}
                      title="คลิกเพื่อแก้ไขข้อมูลผู้ใช้งาน (ตนเอง)"
                      className="group/user w-full flex flex-col group-data-[collapsible=icon]:flex-row group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center gap-1.5 p-3 rounded-2xl group-data-[collapsible=icon]:rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] hover:bg-primary/5 hover:border-primary/20 dark:hover:bg-primary/10 dark:hover:border-primary/30 transition-all text-left cursor-pointer"
                    />
                  }
                >
                  <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:gap-0">
                    <UserAvatar image={user.image} name={user.name} />
                    <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold text-xs text-foreground truncate group-hover/user:text-primary transition-colors">
                          {user.name}
                        </p>
                        <Pencil className="size-3 text-muted-foreground/60 opacity-0 group-hover/user:opacity-100 group-hover/user:text-primary transition-all shrink-0" />
                      </div>
                      <p className="text-[11px] text-muted-foreground/80 truncate">
                        {getRoleLabel(user.role)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 border-t border-black/[0.04] dark:border-white/[0.06] pt-1.5 mt-0.5 group-data-[collapsible=icon]:hidden">
                    <span className="truncate">{user.department}</span>
                    <span className="text-[10px] text-primary/80 font-medium group-hover/user:underline shrink-0 pl-1">
                      แก้ไขข้อมูล
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  <div className="text-left space-y-0.5">
                    <p className="font-semibold text-xs">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground">{getRoleLabel(user.role)}</p>
                    {user.isGoogle && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        เข้าสู่ระบบด้วย Google Workspace
                      </p>
                    )}
                    {user.isLine && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        เชื่อมต่อบัญชี LINE แล้ว
                      </p>
                    )}
                    <p className="text-[10px] text-primary/90">คลิกเพื่อแก้ไขข้อมูลส่วนตัว</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="ออกจากระบบ"
              className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-all font-medium justify-center cursor-pointer group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:p-0"
            >
              <LogOut className="mr-2 group-data-[collapsible=icon]:mr-0 h-4 w-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarSeparator />
      <SidebarRail />

      {user && (
        <EditProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          user={user}
          roleLabel={getRoleLabel(user.role)}
        />
      )}
    </Sidebar>
  );
}
