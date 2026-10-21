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
  fullScreen = false,
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
      return null;
    }

    const fullScreenContent = (
      <div
        className={cn(
          "fixed inset-0 z-[9999999] flex h-screen w-screen flex-col items-center justify-center bg-background/80 dark:bg-slate-950/85 backdrop-blur-2xl transition-all duration-300 select-none",
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
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative flex size-20 items-center justify-center rounded-3xl bg-card/95 dark:bg-slate-900/95 p-3.5 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] backdrop-blur-xl"
            >
              <Image
                src="/logo.png"
                alt="ตราสัญลักษณ์กรมประมง"
                width={56}
                height={56}
                style={{ width: "auto", height: "auto" }}
                className="max-h-14 max-w-14 object-contain drop-shadow-md"
                priority
              />
            </motion.div>
          </div>

          {/* Titles */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="space-y-1 mb-5"
          >
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              กรมประมง
            </h3>
            <p className="text-xs text-muted-foreground">
              {subMessage}
            </p>
          </motion.div>

          {/* Progress track & NumberFlow counter */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="w-full max-w-xs space-y-2.5"
          >
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
          </motion.div>

          {/* Subtle micro tag */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-[11px] text-muted-foreground/60 mt-6 tracking-wider font-sans uppercase"
          >
            กำลังเชื่อมต่อฐานข้อมูล • ความปลอดภัยระดับสูง
          </motion.p>
        </div>
      </div>
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

        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-card/90 dark:bg-slate-900/90 p-2.5 shadow-lg border border-black/[0.08] dark:border-white/[0.12]">
          <Image
            src="/logo.png"
            alt="ตราสัญลักษณ์กรมประมง"
            width={48}
            height={48}
            style={{ width: "auto", height: "auto" }}
            className="max-h-12 max-w-12 object-contain"
            priority
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
