"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";

interface LoadingEffectProps {
  className?: string;
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export function LoadingEffect({
  className,
  message = "กำลังโหลดข้อมูล...",
  subMessage = "ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง",
  fullScreen = true,
}: LoadingEffectProps) {
  const [progress, setProgress] = useState(28);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        const inc = Math.floor(Math.random() * 18 + 8);
        return Math.min(prev + inc, 95);
      });
    }, 220);

    return () => clearInterval(timer);
  }, []);

  if (fullScreen) {
    if (!mounted || typeof document === "undefined") {
      return (
        <div
          className={cn(
            "fixed inset-0 z-[9999999] flex h-screen w-screen flex-col items-center justify-center bg-background dark:bg-slate-950 backdrop-blur-2xl select-none",
            className,
          )}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            margin: 0,
            padding: 0,
          }}
        >
          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute -inset-2.5 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 animate-spin" />
            <div className="relative flex size-20 items-center justify-center rounded-full bg-card/95 dark:bg-slate-900/95 p-1 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] overflow-hidden">
              <Image
                src="/logo.png"
                alt="ตราสัญลักษณ์กรมประมง"
                width={72}
                height={72}
                className="size-full object-contain"
                priority
                unoptimized
              />
            </div>
          </div>
          <div className="space-y-1 mb-5 text-center">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              กรมประมง
            </h3>
            <p className="text-xs text-muted-foreground">{subMessage}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary animate-ping" />
            <span className="font-medium text-foreground/90">{message}</span>
          </div>
        </div>
      );
    }

    const fullScreenContent = (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className={cn(
          "fixed inset-0 z-[9999999] flex h-screen w-screen flex-col items-center justify-center bg-background dark:bg-slate-950 backdrop-blur-2xl select-none",
          className,
        )}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100vw",
          height: "100vh",
          margin: 0,
          padding: 0,
        }}
      >
        {/* Ambient background glows */}
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-blue-500/20 blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-cyan-500/20 blur-[140px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-md w-full">
          {/* Emblem with animated pulsing halo and rotating ring */}
          <div className="relative mb-6 flex items-center justify-center">
            {/* Soft breathing halo */}
            <motion.div
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.35, 0.7, 0.35],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -inset-4 rounded-full bg-gradient-to-tr from-blue-500/30 via-primary/30 to-cyan-400/30 blur-xl"
            />

            {/* Rotating outer spinner ring */}
            <div className="absolute -inset-2.5 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 animate-spin" />

            {/* Emblem container */}
            <div className="relative flex size-20 items-center justify-center rounded-full bg-card/95 dark:bg-slate-900/95 p-1 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] backdrop-blur-xl overflow-hidden">
              <Image
                src="/logo.png"
                alt="ตราสัญลักษณ์กรมประมง"
                width={72}
                height={72}
                className="size-full object-contain drop-shadow-md"
                priority
                unoptimized
              />
            </div>
          </div>

          {/* Titles */}
          <div className="space-y-1 mb-5">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              กรมประมง
            </h3>
            <p className="text-xs text-muted-foreground">
              {subMessage}
            </p>
          </div>

          {/* Progress track & NumberFlow counter */}
          <div className="w-full max-w-xs space-y-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium flex items-center gap-2 text-foreground/90">
                <span className="size-2 rounded-full bg-primary animate-ping" />
                {message}
              </span>
              <div className="flex items-center font-mono font-semibold text-primary">
                <NumberFlow value={progress} />
                <span>%</span>
              </div>
            </div>

            {/* Smooth progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1] p-0.5 border border-black/[0.04] dark:border-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-primary to-cyan-400 shadow-sm shadow-primary/50"
                initial={{ width: "20%" }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut", duration: 0.3 }}
              />
            </div>
          </div>

          {/* Subtle micro tag */}
          <p className="text-[11px] text-muted-foreground/60 mt-6 tracking-wider font-sans uppercase">
            กำลังเชื่อมต่อฐานข้อมูล • ความปลอดภัยระดับสูง
          </p>
        </div>
      </motion.div>
    );

    return createPortal(fullScreenContent, document.body);
  }

  // Non-fullscreen / inline container loading
  return (
    <div
      className={cn(
        "flex min-h-[45vh] w-full flex-col items-center justify-center gap-4 py-8 select-none",
        className,
      )}
    >
      <div className="relative flex items-center justify-center">
        {/* Soft breathing halo */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -inset-3 rounded-full bg-primary/20 blur-lg"
        />

        {/* Rotating outer spinner ring */}
        <div className="absolute -inset-2 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 animate-spin" />

        <div className="relative flex size-16 items-center justify-center rounded-full bg-card/90 dark:bg-slate-900/90 p-1 shadow-lg border border-black/[0.08] dark:border-white/[0.12] overflow-hidden">
          <Image
            src="/logo.png"
            alt="ตราสัญลักษณ์กรมประมง"
            width={58}
            height={58}
            className="size-full object-contain"
            priority
            unoptimized
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center mt-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="size-2 rounded-full bg-primary animate-ping" />
          <p>{message}</p>
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">{subMessage}</p>
      </div>

      <div className="w-48 h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1] mt-1">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 via-primary to-cyan-400"
          initial={{ width: "25%" }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: "easeOut", duration: 0.3 }}
        />
      </div>
    </div>
  );
}

export default LoadingEffect;
