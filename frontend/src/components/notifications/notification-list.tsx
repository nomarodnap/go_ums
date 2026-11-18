"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
  getGetNotificationCountsQueryKey,
} from "@/lib/api/generated/notifications/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  Building,
  Search,
  CheckCheck,
  Bell,
  MessageSquareText,
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
  const [ackTarget, setAckTarget] = useState<NotificationDTO | null>(null);
  const [ackReason, setAckReason] = useState("");

  const markReadMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListNotificationsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetNotificationCountsQueryKey(),
        });
        setAckTarget(null);
        setAckReason("");
        toast.success("บันทึกการรับทราบเรียบร้อยแล้ว");
      },
      onError: () => {
        toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      },
    },
  });

  const markAllMutation = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListNotificationsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetNotificationCountsQueryKey(),
        });
        toast.success("ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว");
      },
      onError: () => {
        toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      },
    },
  });

  const handleOpenAckDialog = (notif: NotificationDTO) => {
    setAckTarget(notif);
    setAckReason("");
  };

  const handleConfirmAcknowledge = () => {
    const trimmed = ackReason.trim();
    if (!ackTarget || !trimmed) return;
    markReadMutation.mutate({
      id: ackTarget.id,
      data: { reason: trimmed },
    });
  };

  const handleMarkAllAsRead = () => {
    markAllMutation.mutate({ params: { scope } });
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
                  {unreadCount}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        {showAcknowledgeButton && unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markAllMutation.isPending}
            className="rounded-xl border-black/[0.08] dark:border-white/[0.12] hover:bg-black/5 dark:hover:bg-white/5 font-medium text-xs h-9"
          >
            <CheckCheck className="mr-1.5 size-4 text-emerald-600 dark:text-emerald-400" />
            อ่านทั้งหมด ({unreadCount})
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาข้อความ หรือหน่วยงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9.5 text-xs rounded-xl bg-card/60 border-black/[0.08] dark:border-white/[0.12]"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] self-start sm:self-auto">
          <Button
            variant={filterStatus === "ALL" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterStatus("ALL")}
            className={cn(
              "text-xs h-7.5 rounded-lg px-3 font-medium transition-all",
              filterStatus === "ALL" && "shadow-xs bg-background",
            )}
          >
            ทั้งหมด ({notifications.length})
          </Button>
          <Button
            variant={filterStatus === "UNREAD" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterStatus("UNREAD")}
            className={cn(
              "text-xs h-7.5 rounded-lg px-3 font-medium transition-all",
              filterStatus === "UNREAD" &&
                "shadow-xs bg-background text-primary font-semibold",
            )}
          >
            ยังไม่ได้อ่าน ({unreadCount})
          </Button>
          <Button
            variant={filterStatus === "READ" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterStatus("READ")}
            className={cn(
              "text-xs h-7.5 rounded-lg px-3 font-medium transition-all",
              filterStatus === "READ" && "shadow-xs bg-background",
            )}
          >
            อ่านแล้ว ({notifications.length - unreadCount})
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-black/[0.08] dark:border-white/[0.12] bg-transparent">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="size-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3 text-muted-foreground">
              <Bell className="size-6 opacity-40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
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
          {filteredNotifications.map((notif) => {
            const isAnomalyEdited = notif.type === "MANUAL_ANOMALY_EDITED";
            const canAcknowledge =
              !notif.isRead && (showAcknowledgeButton || isAnomalyEdited);

            return (
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
                          {!notif.isRead ? (
                            <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                          ) : isAnomalyEdited ||
                            notif.acknowledgedReason ||
                            notif.acknowledgedBy ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 font-medium"
                            >
                              รับทราบแล้ว
                              {notif.acknowledgedBy
                                ? ` โดย ${notif.acknowledgedBy}`
                                : ""}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground border-black/10 dark:border-white/10"
                            >
                              อ่านแล้ว
                            </Badge>
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
                      {notif.isRead && notif.acknowledgedReason && (
                        <div className="mt-2 flex items-start gap-2 rounded-xl bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                          <MessageSquareText className="size-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div className="space-y-0.5 min-w-0">
                            <p className="leading-relaxed break-words">
                              <span className="font-semibold">เหตุผลการรับทราบ:</span>{" "}
                              {notif.acknowledgedReason}
                            </p>
                            {notif.acknowledgedAt && (
                              <p className="text-[11px] text-emerald-700/75 dark:text-emerald-300/75">
                                บันทึกเมื่อ{" "}
                                {format(
                                  new Date(notif.acknowledgedAt),
                                  "d MMM yyyy HH:mm น.",
                                  { locale: th },
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex flex-col gap-1.5 items-end pl-2">
                      {notif.link && (
                        <Link href={notif.link}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7.5 rounded-lg px-2.5 font-medium"
                          >
                            ดูรายละเอียด
                          </Button>
                        </Link>
                      )}
                      {canAcknowledge && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAckDialog(notif)}
                          disabled={markReadMutation.isPending}
                          className="text-xs h-7.5 rounded-lg px-2.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                        >
                          รับทราบ
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Acknowledge Reason Dialog */}
      <Dialog
        open={ackTarget !== null}
        onOpenChange={(open) => {
          if (!open && !markReadMutation.isPending) {
            setAckTarget(null);
            setAckReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              ยืนยันการรับทราบการแจ้งเตือน
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {ackTarget?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {ackTarget?.message && (
              <div className="rounded-xl bg-muted/50 border border-black/[0.06] dark:border-white/[0.08] px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
                {ackTarget.message}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="acknowledge-reason" className="text-xs font-semibold">
                เหตุผล / การดำเนินการที่รับทราบ{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="acknowledge-reason"
                value={ackReason}
                onChange={(e) => setAckReason(e.target.value)}
                placeholder="ระบุเหตุผลหรือแนวทางการดำเนินการ เช่น อยู่ระหว่างดำเนินการเบิกจ่าย / ตรวจสอบแก้ไขข้อมูลแล้ว..."
                rows={3}
                className="text-xs rounded-xl resize-none"
                disabled={markReadMutation.isPending}
              />
              {ackReason.length > 0 && ackReason.trim().length === 0 && (
                <p className="text-[11px] text-destructive">
                  กรุณาระบุเหตุผลหรือหมายเหตุการรับทราบ
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => {
                setAckTarget(null);
                setAckReason("");
              }}
              disabled={markReadMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-xl text-xs font-semibold"
              onClick={handleConfirmAcknowledge}
              disabled={
                ackReason.trim().length === 0 || markReadMutation.isPending
              }
            >
              {markReadMutation.isPending ? "กำลังบันทึก..." : "ยืนยันรับทราบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
