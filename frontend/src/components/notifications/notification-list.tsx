"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMarkNotificationRead,
  getListNotificationsQueryKey,
} from "@/lib/api/generated/notifications/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  Building,
  Search,
  CheckCheck,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/lib/api/generated/model";

interface NotificationListProps {
  notifications: NotificationDTO[];
  title?: string;
  description?: string;
  scope?: "my_dept" | "all";
  showDepartmentBadge?: boolean;
  showAcknowledgeButton?: boolean;
}

export function NotificationList({
  notifications,
  title = "การแจ้งเตือน",
  description = "รายการแจ้งเตือนและข้อความสำคัญ",
  scope = "my_dept",
  showDepartmentBadge = false,
  showAcknowledgeButton = true,
}: NotificationListProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "UNREAD" | "READ">(
    "ALL",
  );

  const markReadMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListNotificationsQueryKey(),
        });
        toast.success("ทำเครื่องหมายว่าอ่านแล้ว");
      },
      onError: () => {
        toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      },
    },
  });

  const handleMarkAsRead = (id: string) => {
    markReadMutation.mutate({ id });
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "URGENT":
        return <AlertCircle className="size-5 text-destructive shrink-0" />;
      case "WARNING":
        return <AlertTriangle className="size-5 text-amber-500 shrink-0" />;
      default:
        return <Info className="size-5 text-primary shrink-0" />;
    }
  };

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case "URGENT":
        return (
          <Badge variant="destructive" className="text-[11px] font-semibold">
            ด่วน
          </Badge>
        );
      case "WARNING":
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-semibold">
            เฝ้าระวัง
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[11px] font-medium">
            ปกติ
          </Badge>
        );
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    const matchesSearch =
      (notif.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (notif.message || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (notif.departmentName &&
        notif.departmentName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      filterStatus === "ALL" ||
      (filterStatus === "UNREAD" && !notif.isRead) ||
      (filterStatus === "READ" && notif.isRead);

    return matchesSearch && matchesStatus;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card/85 dark:bg-card/70 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Bell className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {title}
              </h2>
              {scope !== "all" && unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="rounded-full px-2 py-0.5 text-xs font-bold shadow-xs"
                >
                  {unreadCount} ใหม่
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาข้อความ, หัวข้อ, หรือชื่อหน่วยงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9.5 rounded-xl bg-card/70 border-black/[0.06] dark:border-white/[0.08] text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] self-start sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus("ALL")}
            className={cn(
              "h-7.5 px-3 rounded-lg text-xs font-medium transition-all",
              filterStatus === "ALL"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            ทั้งหมด ({notifications.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus("UNREAD")}
            className={cn(
              "h-7.5 px-3 rounded-lg text-xs font-medium transition-all",
              filterStatus === "UNREAD"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            ยังไม่ได้อ่าน ({unreadCount})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus("READ")}
            className={cn(
              "h-7.5 px-3 rounded-lg text-xs font-medium transition-all",
              filterStatus === "READ"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            อ่านแล้ว ({notifications.length - unreadCount})
          </Button>
        </div>
      </div>

      {/* Notification Cards List */}
      {filteredNotifications.length === 0 ? (
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center p-6">
            <div className="rounded-full bg-black/[0.04] dark:bg-white/[0.04] p-4 mb-3">
              <CheckCircle2 className="size-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              ไม่พบรายการแจ้งเตือน
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {searchTerm
                ? "ไม่พบการแจ้งเตือนที่ตรงกับคำค้นหาของคุณ"
                : "คุณได้อ่านการแจ้งเตือนทั้งหมดแล้ว หรือไม่มีรายการใหม่ในขณะนี้"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredNotifications.map((notif) => (
            <Card
              key={notif.id}
              className={cn(
                "rounded-2xl transition-all duration-150 border shadow-xs overflow-hidden",
                !notif.isRead
                  ? "border-primary/30 bg-primary/[0.02] dark:bg-primary/[0.04] shadow-xs hover:border-primary/50"
                  : "border-black/[0.06] dark:border-white/[0.08] bg-card/60 opacity-80 hover:opacity-100",
              )}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex gap-3.5 items-start">
                  <div className="mt-0.5">{getSeverityIcon(notif.severity)}</div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className={cn(
                            "text-sm font-semibold tracking-tight",
                            !notif.isRead
                              ? "text-foreground"
                              : "text-muted-foreground font-medium",
                          )}
                        >
                          {notif.title}
                        </h4>
                        {getSeverityBadge(notif.severity)}
                        {showDepartmentBadge && notif.departmentName && (
                          <Badge
                            variant="outline"
                            className="text-[11px] font-normal text-muted-foreground bg-black/[0.02] dark:bg-white/[0.04] flex items-center gap-1 border-black/[0.08] dark:border-white/[0.12]"
                          >
                            <Building className="size-3 text-primary/70" />
                            <span className="truncate max-w-[200px]">
                              {notif.departmentName}
                            </span>
                          </Badge>
                        )}
                        {!notif.isRead && (
                          <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center text-[11px] text-muted-foreground whitespace-nowrap">
                        <Clock className="mr-1 size-3" />
                        {notif.createdAt
                          ? format(
                              new Date(notif.createdAt),
                              "d MMM yyyy HH:mm น.",
                              { locale: th },
                            )
                          : "-"}
                      </div>
                    </div>
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        !notif.isRead
                          ? "text-foreground/90"
                          : "text-muted-foreground",
                      )}
                    >
                      {notif.message}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1.5 items-end pl-2">
                    {notif.link && (
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={notif.link} />}
                        className="text-xs h-7.5 rounded-lg px-2.5 font-medium"
                      >
                        ดูรายละเอียด
                      </Button>
                    )}
                    {showAcknowledgeButton && !notif.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notif.id)}
                        disabled={markReadMutation.isPending}
                        className="text-xs h-7.5 rounded-lg px-2.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        รับทราบ
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
