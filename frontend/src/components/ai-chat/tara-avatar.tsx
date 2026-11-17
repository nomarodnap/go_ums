"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Mic,
  Radio,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Dynamically import Live2D WebGL canvas with SSR disabled
const Live2DAvatarCanvas = dynamic(
  () =>
    import("./live2d-avatar-canvas").then((mod) => mod.Live2DAvatarCanvas),
  {
    ssr: false,
    loading: () => null,
  }
);

export type TaraEmotion =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "alert"
  | "happy";

export interface TaraAvatarProps {
  emotion: TaraEmotion;
  isSpeaking?: boolean;
  isListening?: boolean;
  isThinking?: boolean;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  live2DEnabled?: boolean;
  onToggleLive2D?: () => void;
  className?: string;
  subtitleText?: string;
  modelPath?: string;
}

const EMOTION_CONFIG: Record<
  TaraEmotion,
  {
    label: string;
    sublabel: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    haloColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  idle: {
    label: "พร้อมสนทนา",
    sublabel: "สแตนด์บายรับสาย",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/30",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    haloColor: "rgba(16, 185, 129, 0.25)",
    icon: Radio,
  },
  listening: {
    label: "กำลังรับฟัง",
    sublabel: "ตั้งใจฟังคำถามของคุณ...",
    badgeBg: "bg-sky-500/15",
    badgeBorder: "border-sky-500/35",
    badgeText: "text-sky-600 dark:text-sky-400",
    haloColor: "rgba(14, 165, 233, 0.3)",
    icon: Mic,
  },
  thinking: {
    label: "กำลังวิเคราะห์ข้อมูล",
    sublabel: "สแกนสถิติ 292 หน่วยงาน...",
    badgeBg: "bg-purple-500/15",
    badgeBorder: "border-purple-500/35",
    badgeText: "text-purple-600 dark:text-purple-400",
    haloColor: "rgba(168, 85, 247, 0.35)",
    icon: RefreshCw,
  },
  speaking: {
    label: "น้องธาร่า กำลังพูด",
    sublabel: "อธิบายรายงานผลการวิเคราะห์",
    badgeBg: "bg-emerald-500/15",
    badgeBorder: "border-emerald-500/35",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    haloColor: "rgba(16, 185, 129, 0.35)",
    icon: Volume2,
  },
  alert: {
    label: "พบจุดสังเกต / คลาดเคลื่อน",
    sublabel: "มีบิลผิดปกติหรือยอดค้างชำระสูง",
    badgeBg: "bg-amber-500/15",
    badgeBorder: "border-amber-500/40",
    badgeText: "text-amber-600 dark:text-amber-400",
    haloColor: "rgba(245, 158, 11, 0.35)",
    icon: AlertTriangle,
  },
  happy: {
    label: "ข้อมูลปกติ / ประหยัดงบ",
    sublabel: "การเบิกจ่ายเป็นไปตามเกณฑ์",
    badgeBg: "bg-teal-500/15",
    badgeBorder: "border-teal-500/35",
    badgeText: "text-teal-600 dark:text-teal-400",
    haloColor: "rgba(20, 184, 166, 0.3)",
    icon: Sparkles,
  },
};

const WAVE_BARS = [35, 75, 100, 85, 55, 90, 95, 65, 40, 80, 70, 45];

export const TaraAvatar = React.memo(function TaraAvatar({
  emotion,
  isSpeaking = false,
  isListening = false,
  isThinking = false,
  voiceEnabled = true,
  onToggleVoice,
  live2DEnabled,
  onToggleLive2D,
  className,
  subtitleText,
  modelPath = "/live2d/Haru/Haru.model3.json",
}: TaraAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [live2DLoaded, setLive2DLoaded] = useState(false);
  const [internalLive2D, setInternalLive2D] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tara_live2d_enabled") !== "false";
    }
    return true;
  });

  const isLive2DActive = live2DEnabled !== undefined ? live2DEnabled : internalLive2D;

  const handleToggleLive2D = React.useCallback(() => {
    if (onToggleLive2D) {
      onToggleLive2D();
    } else {
      setInternalLive2D((prev) => {
        const next = !prev;
        if (typeof window !== "undefined") {
          localStorage.setItem("tara_live2d_enabled", String(next));
        }
        return next;
      });
    }
  }, [onToggleLive2D]);

  const handleLive2DLoaded = React.useCallback(() => {
    setLive2DLoaded(true);
  }, []);

  // Derive active emotional state
  const activeEmotion: TaraEmotion = isThinking
    ? "thinking"
    : isSpeaking
      ? "speaking"
      : isListening
        ? "listening"
        : emotion;

  const currentConfig = EMOTION_CONFIG[activeEmotion] || EMOTION_CONFIG.idle;
  const StatusIcon = currentConfig.icon;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950 via-[#0a1128] to-[#04081e] text-white shadow-2xl select-none transition-all duration-300",
        className
      )}
      style={{
        boxShadow: `0 20px 60px -10px ${currentConfig.haloColor}, 0 0 0 1px rgba(255, 255, 255, 0.08)`,
      }}
    >
      {/* Top Face Call HUD Header */}
      <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between gap-2 px-1 text-xs">
        {/* Call status badge */}
        <div className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 border border-white/15 shadow-xs">
          <span className="relative flex size-2.5">
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                activeEmotion === "alert"
                  ? "bg-amber-400"
                  : activeEmotion === "thinking"
                    ? "bg-purple-400"
                    : "bg-emerald-400"
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full size-2.5",
                activeEmotion === "alert"
                  ? "bg-amber-500"
                  : activeEmotion === "thinking"
                    ? "bg-purple-500"
                    : "bg-emerald-500"
              )}
            />
          </span>
          <span className="font-semibold text-[11px] tracking-wide text-white/95">
            FACE CALL LIVE
          </span>
          <span className="text-white/40">•</span>
          <span className="text-[10px] text-sky-400 font-mono">1080p 60fps</span>
        </div>

        {/* Live2D Interactive Badge & Audio toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleLive2D}
            title={
              isLive2DActive
                ? "คลิกเพื่อปิด 2D Live (เปลี่ยนเป็นภาพนิ่ง ประหยัดทรัพยากร)"
                : "คลิกเพื่อเปิด 2D Live (แอนิเมชันขยับตามเมาส์)"
            }
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all cursor-pointer backdrop-blur-md border shadow-xs select-none",
              isLive2DActive
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30"
                : "bg-black/50 text-white/50 border-white/10 hover:text-white/80 hover:border-white/20"
            )}
          >
            <Sparkles className={cn("size-3", isLive2DActive ? "text-sky-400 animate-pulse" : "text-white/40")} />
            <span>{isLive2DActive ? "Live2D ขยับตามเมาส์" : "2D Live ปิดอยู่ (ภาพนิ่ง)"}</span>
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                isLive2DActive ? "bg-emerald-400" : "bg-white/30"
              )}
            />
          </button>

          {/* Voice Audio Readout toggle */}
          {onToggleVoice && (
            <button
              type="button"
              onClick={onToggleVoice}
              title={
                voiceEnabled
                  ? "ปิดเสียงอ่านออกเสียง"
                  : "เปิดเสียงอ่านออกเสียง (Thai Voice)"
              }
              className={cn(
                "flex size-7 items-center justify-center rounded-full border transition-colors cursor-pointer",
                voiceEnabled
                  ? "bg-primary text-white border-primary/40 shadow-xs"
                  : "bg-black/40 text-white/60 border-white/10 hover:text-white"
              )}
            >
              {voiceEnabled ? (
                <Volume2 className="size-3.5" />
              ) : (
                <VolumeX className="size-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Background Holographic Studio Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Radial ambient glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full blur-3xl opacity-35 transition-all duration-700 pointer-events-none"
          style={{
            backgroundColor: currentConfig.haloColor,
          }}
        />
        {/* Subtle high-tech grid */}
        <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:18px_18px]" />

        {/* Thinking Radar Scan Rings */}
        {activeEmotion === "thinking" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-96 rounded-full border border-purple-500/20 animate-ping opacity-40" />
            <div className="size-72 rounded-full border border-purple-400/35 animate-spin opacity-50 [animation-duration:8s]" />
            <div className="size-56 rounded-full border border-dashed border-purple-300/45 animate-spin opacity-60 [animation-duration:12s]" />
          </div>
        )}

        {/* Alert Pulsing Aura */}
        {activeEmotion === "alert" && (
          <div className="absolute inset-0 border-2 border-amber-500/40 rounded-3xl animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Main Anime Avatar Character Presentation (Live2D Cubism WebGL Canvas) */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm px-4 pt-10 pb-3">
        <div className="relative size-64 sm:size-72 flex items-center justify-center">
          {/* Holographic Glowing Identity Ring */}
          <div
            className={cn(
              "absolute size-60 sm:size-68 rounded-full border-2 transition-all duration-500 pointer-events-none",
              activeEmotion === "alert"
                ? "border-amber-500/50 shadow-[0_0_35px_rgba(245,158,11,0.35)]"
                : activeEmotion === "thinking"
                  ? "border-purple-500/50 shadow-[0_0_35px_rgba(168,85,247,0.35)]"
                  : activeEmotion === "speaking"
                    ? "border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.35)]"
                    : "border-sky-500/40 shadow-[0_0_25px_rgba(14,165,233,0.25)]"
            )}
          />

          {/* Live2D Avatar Frame */}
          <div className="relative size-56 sm:size-64 rounded-full overflow-hidden border-2 border-white/25 shadow-2xl bg-slate-950">
            {/* Fallback image and static portrait mode */}
            <div
              className={cn(
                "relative size-full scale-[1.08] transition-opacity duration-500",
                isLive2DActive && live2DLoaded ? "opacity-0 pointer-events-none absolute" : "opacity-100"
              )}
            >
              <Image
                src="/images/tara-anime.jpg"
                alt="น้องธาร่า (Tara) - AI Specialist กรมประมง"
                fill
                priority
                sizes="(max-width: 768px) 256px, 288px"
                className="object-cover object-top"
              />
            </div>

            {/* Genuine Live2D Cubism WebGL Canvas (Active only when 2D Live is enabled) */}
            {isLive2DActive && (
              <Live2DAvatarCanvas
                emotion={activeEmotion}
                isSpeaking={activeEmotion === "speaking"}
                modelPath={modelPath}
                onLoaded={handleLive2DLoaded}
                className="absolute inset-0 size-full"
              />
            )}
          </div>
        </div>

        {/* Character Title & Anime Identity Badge */}
        <div className="text-center mt-1 space-y-0.5">
          <div className="flex items-center justify-center gap-1.5">
            <h3 className="font-bold text-base sm:text-lg text-white tracking-tight flex items-center gap-1.5">
              <span>น้องธาร่า</span>
              <span className="text-xs font-normal text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/25">
                Tara AI 🌸
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            ผู้เชี่ยวชาญด้านงบประมาณและสาธารณูปโภค (292 หน่วยงาน กรมประมง)
          </p>
        </div>

        {/* Dynamic Real-time Emotion Status Pill */}
        <div
          className={cn(
            "mt-2.5 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium border shadow-xs transition-all duration-300",
            currentConfig.badgeBg,
            currentConfig.badgeBorder,
            currentConfig.badgeText
          )}
        >
          <StatusIcon
            className={cn(
              "size-3.5 shrink-0",
              activeEmotion === "thinking" && "animate-spin"
            )}
          />
          <span className="font-semibold">{currentConfig.label}:</span>
          <span className="opacity-90">{currentConfig.sublabel}</span>
        </div>
      </div>

      {/* Real-time Audio Waveform Visualizer */}
      <div className="relative z-10 w-full px-6 py-2 flex items-center justify-center gap-1">
        {WAVE_BARS.map((height, i) => (
          <span
            key={i}
            className={cn(
              "w-1 rounded-full transition-all duration-150",
              activeEmotion === "speaking"
                ? "bg-emerald-400 animate-pulse"
                : activeEmotion === "listening"
                  ? "bg-sky-400"
                  : activeEmotion === "thinking"
                    ? "bg-purple-400"
                    : activeEmotion === "alert"
                      ? "bg-amber-400"
                      : "bg-white/20"
            )}
            style={{
              height:
                activeEmotion === "speaking"
                  ? `${Math.max(8, height * 0.75)}px`
                  : activeEmotion === "listening"
                    ? `${Math.max(6, height * 0.35)}px`
                    : "6px",
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>

      {/* In-Call Live Closed Caption / Subtitle Overlay */}
      {subtitleText && (
        <div className="relative z-10 w-full px-4 pb-3">
          <div className="mx-auto max-w-md rounded-2xl bg-black/65 backdrop-blur-md px-3.5 py-2 border border-white/10 text-center shadow-lg">
            <p className="text-xs sm:text-sm text-white/95 leading-relaxed font-sans line-clamp-2">
              <span className="text-sky-300 font-semibold mr-1.5">
                น้องธาร่า 🌸:
              </span>
              {subtitleText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
