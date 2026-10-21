"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingEffect } from "@/components/ui/loading-effect";

export function GlobalRouteLoader() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  // When pathname changes, navigation has completed
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  // Global click listener for internal route navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");

      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("/#") &&
        !href.startsWith("//") &&
        targetAttr !== "_blank" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const currentPath = window.location.pathname;
        if (href !== currentPath && !href.startsWith(currentPath + "#")) {
          setIsNavigating(true);
        }
      }
    };

    const handlePreview = (e: Event) => {
      const customEvent = e as CustomEvent<{ duration?: number }>;
      setIsNavigating(true);
      const duration = customEvent.detail?.duration ?? 10000;
      if (duration > 0) {
        setTimeout(() => setIsNavigating(false), duration);
      }
    };

    const handleStop = () => {
      setIsNavigating(false);
    };

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("ums:preview-loading", handlePreview);
    window.addEventListener("ums:stop-loading", handleStop);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("ums:preview-loading", handlePreview);
      window.removeEventListener("ums:stop-loading", handleStop);
    };
  }, []);

  // Safety fallback
  useEffect(() => {
    if (!isNavigating) return;
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 60000);
    return () => clearTimeout(timer);
  }, [isNavigating]);

  if (!isNavigating) return null;

  return (
    <LoadingEffect
      fullScreen
      message="กำลังสลับหน้าและโหลดข้อมูลระบบ..."
      subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
    />
  );
}
