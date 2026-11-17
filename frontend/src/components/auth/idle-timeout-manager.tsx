"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, ShieldAlert, LogOut, RefreshCw } from "lucide-react";

// Inactivity configuration (Default 30 minutes idle, 60s warning)
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_DURATION_MS = 60 * 1000; // 60 seconds
const LAST_ACTIVITY_KEY = "dof_last_activity_time";
const THROTTLE_MS = 2000; // Throttle activity updates to once every 2 seconds

interface IdleTimeoutManagerProps {
  /** Inactivity timeout in milliseconds (default: 30 minutes) */
  timeoutMs?: number;
  /** Warning countdown duration in milliseconds (default: 60 seconds) */
  warningMs?: number;
}

export function IdleTimeoutManager({
  timeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  warningMs = WARNING_DURATION_MS,
}: IdleTimeoutManagerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(warningMs / 1000)
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const lastThrottleRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);

  // Clear auth storage and cookies
  const clearAuthStorage = useCallback(() => {
    try {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      if (typeof document !== "undefined") {
        document.cookie =
          "auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie =
          "better-auth.session_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie =
          "__Secure-better-auth.session_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Perform logout
  const performLogout = useCallback(
    async (reason: string = "timeout") => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      setIsLoggingOut(true);

      try {
        await authClient.signOut();
      } catch {
        // Continue even if server call fails
      }

      clearAuthStorage();
      await queryClient.clear();

      window.location.href = `/sign-in?reason=${encodeURIComponent(reason)}`;
    },
    [clearAuthStorage, queryClient]
  );

  // Record user activity
  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastThrottleRef.current >= THROTTLE_MS) {
      lastThrottleRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      } catch {
        // Ignore localStorage quota errors
      }
    }
  }, []);

  // Reset activity explicitly (e.g. when clicking "Stay Logged In")
  const handleStayLoggedIn = useCallback(() => {
    const now = Date.now();
    lastThrottleRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    } catch {
      // Ignore
    }
    setIsWarningOpen(false);
  }, []);

  // Initialize activity timestamp on mount
  useEffect(() => {
    const now = Date.now();
    try {
      const existing = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (existing) {
        const lastActive = parseInt(existing, 10);
        if (!isNaN(lastActive) && lastActive > 0) {
          const elapsed = now - lastActive;
          // If inactive for longer than timeout (e.g. browser was closed for > 30 minutes), logout immediately
          if (elapsed >= timeoutMs) {
            performLogout("timeout");
            return;
          }
        }
      }
      // Valid session / fresh page load: update activity time to current
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      lastThrottleRef.current = now;
    } catch {
      // Ignore
    }

    // Event listeners to track activity
    const activityEvents = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    const handleUserEvent = () => {
      recordActivity();
    };

    for (const evt of activityEvents) {
      window.addEventListener(evt, handleUserEvent, { passive: true });
    }

    // Listen to storage events for cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        const newTime = parseInt(e.newValue, 10);
        if (!isNaN(newTime) && newTime > 0) {
          lastThrottleRef.current = newTime;
          setIsWarningOpen(false);
        }
      } else if (e.key === "auth_token" && !e.newValue) {
        // Logged out in another tab
        window.location.href = "/sign-in";
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      for (const evt of activityEvents) {
        window.removeEventListener(evt, handleUserEvent);
      }
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [recordActivity, timeoutMs, performLogout]);

  // Main check loop (runs every 1 second)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (isLoggingOutRef.current) return;

      let lastActive = Date.now();
      try {
        const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > 0) {
            lastActive = parsed;
          }
        }
      } catch {
        // Fallback to local ref
        lastActive = lastThrottleRef.current;
      }

      const elapsed = Date.now() - lastActive;

      // 1. Inactivity reached maximum limit -> Auto Logout
      if (elapsed >= timeoutMs) {
        clearInterval(checkInterval);
        performLogout("timeout");
        return;
      }

      // 2. Approaching limit -> Show Warning Modal with countdown
      const warningThreshold = timeoutMs - warningMs;
      if (elapsed >= warningThreshold) {
        const msRemaining = timeoutMs - elapsed;
        const secs = Math.max(1, Math.ceil(msRemaining / 1000));
        setSecondsRemaining(secs);
        setIsWarningOpen(true);
      } else {
        // If user became active in another tab, close warning automatically
        setIsWarningOpen(false);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [timeoutMs, warningMs, performLogout]);

  return (
    <Dialog open={isWarningOpen} onOpenChange={(open) => !open && handleStayLoggedIn()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[92vw] sm:max-w-md p-6 rounded-2xl border-slate-200/90 dark:border-slate-800 shadow-2xl"
      >
        <DialogHeader className="flex flex-col items-center text-center pb-2">
          <div className="size-14 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 border border-amber-200 dark:border-amber-800/80 shadow-sm animate-pulse">
            <Clock className="size-7" />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
            ไม่มีการใช้งานระบบเป็นเวลานาน
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1 max-w-sm">
            เพื่อความปลอดภัยของข้อมูล ระบบจะออกจากระบบโดยอัตโนมัติหากไม่มีการเคลื่อนไหว
          </DialogDescription>
        </DialogHeader>

        {/* Countdown Box */}
        <div className="my-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted-foreground font-medium mb-1">
            ระบบจะออกจากระบบอัตโนมัติในอีก
          </span>
          <div className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
            {secondsRemaining}{" "}
            <span className="text-sm font-semibold text-slate-500">วินาที</span>
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => performLogout("manual")}
            disabled={isLoggingOut}
            className="text-xs h-9 text-slate-600 dark:text-slate-400 cursor-pointer"
          >
            <LogOut className="size-3.5 mr-1.5" />
            <span>ออกจากระบบทันที</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleStayLoggedIn}
            disabled={isLoggingOut}
            className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer font-semibold shadow-xs"
          >
            <RefreshCw className="size-3.5 mr-1.5" />
            <span>ยังคงใช้งานต่อ</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

