"use client";

import { useListNotifications } from "@/lib/api/generated/notifications/notifications";
import { NotificationList } from "@/components/notifications/notification-list";
import { Loader2 } from "lucide-react";

export default function AllNotificationsPage() {
  const { data: notifRes, isLoading } = useListNotifications();
  const notifications =
    notifRes?.status === 200 && Array.isArray(notifRes.data)
      ? notifRes.data
      : [];

  return (
    <div className="flex flex-col gap-6">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground text-sm">
            กำลังโหลดรายการแจ้งเตือนทั้งหมด...
          </span>
        </div>
      ) : (
        <NotificationList
          notifications={notifications}
          title="การแจ้งเตือนทุกหน่วยงานในระบบ"
          description="รายการแจ้งเตือนทั้งหมดจากทุกสำนัก/กอง/ศูนย์ทั่วประเทศ (สำหรับผู้ดูแลระบบ)"
          scope="all"
          showDepartmentBadge={true}
          showAcknowledgeButton={false}
        />
      )}
    </div>
  );
}
