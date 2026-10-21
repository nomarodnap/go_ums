"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useListNotifications } from "@/lib/api/generated/notifications/notifications";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { NotificationList } from "@/components/notifications/notification-list";
import { LoadingEffect } from "@/components/ui/loading-effect";

export default function AllNotificationsPage() {
  const router = useRouter();
  const { data: meRes, isLoading: loadingMe } = useGetCurrentUser();
  const me = meRes?.status === 200 ? meRes.data.user : null;
  const userRole = me?.role;

  useEffect(() => {
    if (!loadingMe && userRole && !["admin", "auditor"].includes(userRole)) {
      router.replace("/unauthorized");
    }
  }, [loadingMe, userRole, router]);

  const { data: notifRes, isLoading: loadingNotifs } = useListNotifications({
    scope: "all",
  });
  const notifications =
    notifRes?.status === 200 && Array.isArray(notifRes.data)
      ? notifRes.data
      : [];

  const isLoading = loadingMe || loadingNotifs;

  return (
    <div className="flex flex-col gap-6">
      {isLoading ? (
        <LoadingEffect message="กำลังโหลดรายการแจ้งเตือนทั้งหมด..." />
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
