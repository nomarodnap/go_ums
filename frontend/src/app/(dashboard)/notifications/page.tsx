"use client";

import { useListNotifications } from "@/lib/api/generated/notifications/notifications";
import { NotificationList } from "@/components/notifications/notification-list";
import { LoadingEffect } from "@/components/ui/loading-effect";

export default function NotificationsPage() {
  const { data: notifRes, isLoading } = useListNotifications({
    scope: "my_dept",
  });
  const notifications =
    notifRes?.status === 200 && Array.isArray(notifRes.data)
      ? notifRes.data
      : [];

  return (
    <div className="flex flex-col gap-6">
      {isLoading ? (
        <LoadingEffect message="กำลังโหลดรายการแจ้งเตือน..." />
      ) : (
        <NotificationList
          notifications={notifications}
          title="การแจ้งเตือนของหน่วยงาน"
          description="รายการแจ้งเตือนเฉพาะหน่วยงานที่ท่านสังกัดและประกาศสำคัญของระบบ"
          scope="my_dept"
          showDepartmentBadge={false}
        />
      )}
    </div>
  );
}
