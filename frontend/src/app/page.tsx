"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { getUserLandingPage } from "@/lib/permissions";

export default function IndexPage() {
  const router = useRouter();
  const { data: userData, isLoading, isError } = useGetCurrentUser({
    query: {
      retry: false,
    },
  });

  const user = userData?.status === 200 ? userData.data.user : null;

  useEffect(() => {
    if (!isLoading) {
      if (isError || !user) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user");
        }
        router.replace("/sign-in");
      } else {
        const landingPage = getUserLandingPage(user);
        router.replace(landingPage);
      }
    }
  }, [isLoading, isError, user, router]);

  return (
    <LoadingEffect
      fullScreen
      message="กำลังตรวจสอบสถานะการเข้าสู่ระบบ..."
      subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
    />
  );
}
