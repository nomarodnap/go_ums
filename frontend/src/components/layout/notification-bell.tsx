"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useListNotifications } from "@/lib/api/generated/notifications/notifications";

export function NotificationBell({
  initialCount,
}: {
  initialCount?: number;
}) {
  const { data: notifRes } = useListNotifications();
  const notifications =
    notifRes?.status === 200 && Array.isArray(notifRes.data)
      ? notifRes.data
      : [];

  const unreadCount =
    initialCount !== undefined
      ? initialCount
      : notifications.filter((n) => !n.isRead).length;

  return (
    <Button
      variant="ghost"
      size="icon"
      render={<Link href="/notifications" />}
      className="relative size-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground"
      title="การแจ้งเตือนของหน่วยงาน"
    >
      <Bell className="size-4.5" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-xs animate-pulse">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
