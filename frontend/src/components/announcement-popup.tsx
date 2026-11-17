"use client";

import { useState, useEffect, useCallback, useId, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Megaphone,
  Pause,
  Play,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnnouncementImage {
  id: string;
  url: string;
  title?: string;
  linkUrl?: string;
}

export interface AnnouncementSettings {
  isEnabled: boolean;
  intervalSeconds: number;
  images: AnnouncementImage[];
  updatedAt?: string;
}

interface AnnouncementPopupProps {
  /** In preview mode, settings are passed in directly and localStorage is ignored */
  previewMode?: boolean;
  previewSettings?: AnnouncementSettings;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Whether to show the floating trigger button on login page */
  showFloatingButton?: boolean;
  /** Whether the parent page (e.g. login page) is ready and animations completed */
  ready?: boolean;
}

const STORAGE_KEY = "dof_announcement_hidden_date";

export function AnnouncementPopup({
  previewMode = false,
  previewSettings,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showFloatingButton = true,
  ready = true,
}: AnnouncementPopupProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [fetchedSettings, setFetchedSettings] =
    useState<AnnouncementSettings | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dontShowToday, setDontShowToday] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (isControlled && controlledOnOpenChange) {
        controlledOnOpenChange(nextOpen);
      } else {
        setInternalOpen(nextOpen);
      }

      if (!nextOpen && !previewMode && dontShowToday) {
        const todayStr = new Date().toISOString().split("T")[0];
        try {
          localStorage.setItem(STORAGE_KEY, todayStr);
        } catch {
          // Ignore localStorage errors
        }
      }
    },
    [isControlled, controlledOnOpenChange, previewMode, dontShowToday]
  );

  // Fetch settings if not in preview mode
  useEffect(() => {
    if (previewMode) return;

    let isMounted = true;
    async function loadSettings() {
      try {
        const res = await fetch("/api/announcements");
        if (!res.ok) return;
        const data: AnnouncementSettings = await res.json();
        if (!isMounted) return;
        setFetchedSettings(data);
      } catch {
        // Silently fail if public announcements endpoint cannot be reached
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [previewMode]);

  const hasAutoOpenedRef = useRef(false);

  // Handle auto-open once page is ready and settings loaded
  useEffect(() => {
    if (previewMode || !ready || !fetchedSettings || hasAutoOpenedRef.current) return;

    if (
      fetchedSettings.isEnabled &&
      fetchedSettings.images &&
      fetchedSettings.images.length > 0
    ) {
      const todayStr = new Date().toISOString().split("T")[0];
      const hiddenDate = localStorage.getItem(STORAGE_KEY);
      if (hiddenDate !== todayStr) {
        hasAutoOpenedRef.current = true;
        setInternalOpen(true);
      }
    }
  }, [previewMode, ready, fetchedSettings]);

  const activeSettings = previewMode ? previewSettings : fetchedSettings;
  const images = activeSettings?.images || [];
  const intervalSeconds = Math.max(2, activeSettings?.intervalSeconds || 5);
  const currentImage = images[currentIndex] || images[0];

  // Reset index if out of bounds
  useEffect(() => {
    if (currentIndex >= images.length) {
      setCurrentIndex(0);
      setProgress(0);
    }
  }, [images.length, currentIndex]);

  // Slideshow progress timer
  useEffect(() => {
    if (!isOpen || images.length <= 1 || isPaused) {
      return;
    }

    const totalMs = intervalSeconds * 1000;
    const stepMs = 50;
    const increment = (stepMs / totalMs) * 100;

    const intervalId = setInterval(() => {
      setProgress((prev) => {
        if (prev + increment >= 100) {
          setCurrentIndex((curr) => (curr + 1) % images.length);
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(intervalId);
  }, [isOpen, images.length, isPaused, intervalSeconds]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setProgress(0);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setProgress(0);
  }, [images.length]);

  const handleSelectSlide = (idx: number) => {
    setCurrentIndex(idx);
    setProgress(0);
  };

  const handleImageClick = () => {
    if (currentImage?.linkUrl) {
      window.open(currentImage.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  // If no images and not open, don't show anything
  const hasImages = images.length > 0;
  const shouldRenderTrigger =
    !previewMode &&
    ready &&
    showFloatingButton &&
    hasImages &&
    activeSettings?.isEnabled;

  return (
    <>
      {/* Floating Trigger Button on Sign-in Page */}
      {shouldRenderTrigger && !isOpen && (
        <button
          type="button"
          onClick={() => handleOpenChange(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
          title="ดูประกาศข่าวสาร"
        >
          <Megaphone className="size-4 animate-bounce" />
          <span>ข่าวสารและประกาศ</span>
          <span className="flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-blue-700">
            {images.length}
          </span>
        </button>
      )}

      {/* Frameless Announcement Dialog Modal */}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          style={{ maxWidth: "none", width: "auto", height: "auto" }}
          className="p-0 border-0 bg-transparent shadow-none max-w-none sm:max-w-none w-auto sm:w-auto h-auto flex items-center justify-center outline-none ring-0 focus:outline-none"
        >
          {/* Accessible title for screen readers */}
          <DialogTitle className="sr-only">ประกาศข่าวสาร</DialogTitle>

          {hasImages && currentImage ? (
            /* Frameless Image Wrapper - strictly hugs the natural aspect ratio of the image */
            <div
              className="relative inline-block max-w-[92vw] max-h-[88vh] rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] select-none group"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* The Announcement Image - natural aspect ratio */}
              <img
                src={currentImage.url}
                alt={currentImage.title || `ประกาศ ${currentIndex + 1}`}
                onClick={handleImageClick}
                style={{
                  maxWidth: "92vw",
                  maxHeight: "88vh",
                  width: "auto",
                  height: "auto",
                }}
                className={cn(
                  "block max-w-[92vw] max-h-[88vh] w-auto h-auto object-contain transition-transform duration-300",
                  currentImage.linkUrl &&
                    "cursor-pointer hover:brightness-105"
                )}
              />

              {/* Top-Left: Slide Counter & Preview Badge (Inside Image) */}
              <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2">
                {images.length > 1 && (
                  <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/15 shadow-md">
                    {currentIndex + 1} / {images.length}
                  </span>
                )}
                {previewMode && (
                  <span className="rounded-full bg-amber-500/80 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/20 shadow-md">
                    โหมดตัวอย่าง (Preview)
                  </span>
                )}
              </div>

              {/* Top-Center: Pause indicator when hovering (Inside Image) */}
              {isPaused && images.length > 1 && (
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md px-3 py-1 text-xs text-white/95 border border-white/15 shadow-md">
                  <Pause className="size-3.5" />
                  <span>พักเวลาชั่วคราว</span>
                </div>
              )}

              {/* Top-Right: External Link & Close Button (Inside Image) */}
              <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2">
                {currentImage.linkUrl && (
                  <div
                    onClick={handleImageClick}
                    className="flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-blue-600 backdrop-blur-md px-3 py-1.5 text-xs text-white cursor-pointer transition-colors border border-white/15 shadow-md"
                  >
                    <span>เปิดลิงก์</span>
                    <ExternalLink className="size-3.5" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 hover:scale-105 text-white backdrop-blur-md transition-all border border-white/15 shadow-lg cursor-pointer"
                  aria-label="ปิดหน้าต่างประกาศ"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Center Left & Right: Navigation Arrows (Inside Image) */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="รูปภาพก่อนหน้า"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 z-20 flex size-11 sm:size-12 items-center justify-center rounded-full bg-black/55 hover:bg-black/85 text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-xl border border-white/15 opacity-70 group-hover:opacity-100 cursor-pointer"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="รูปภาพถัดไป"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 z-20 flex size-11 sm:size-12 items-center justify-center rounded-full bg-black/55 hover:bg-black/85 text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-xl border border-white/15 opacity-70 group-hover:opacity-100 cursor-pointer"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </>
              )}

              {/* Bottom: Gradient Overlay with Title & Controls (Inside Image) */}
              <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent pt-12 pb-3.5 px-4 sm:px-6">
                {/* Title / Caption */}
                {currentImage.title && (
                  <p className="text-sm sm:text-base font-semibold text-white text-center mb-2.5 drop-shadow-md line-clamp-2 max-w-2xl mx-auto">
                    {currentImage.title}
                  </p>
                )}

                {/* Bottom Controls Row */}
                <div className="flex items-center justify-between gap-3 text-xs text-white">
                  {/* Don't show today option (login page only) */}
                  {!previewMode ? (
                    <label className="flex items-center gap-2 cursor-pointer rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md px-3 py-1 border border-white/15 transition-colors">
                      <Checkbox
                        checked={dontShowToday}
                        onCheckedChange={(val) => setDontShowToday(Boolean(val))}
                        className="border-white/50 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 size-3.5"
                      />
                      <span className="text-[11.5px] text-white/90">ไม่ต้องแสดงอีกในวันนี้</span>
                    </label>
                  ) : (
                    <span className="text-[11.5px] text-white/70 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15">
                      เปลี่ยนภาพทุกๆ {intervalSeconds} วิ
                    </span>
                  )}

                  {/* Slide dot indicators */}
                  {images.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
                      {images.map((img, idx) => (
                        <button
                          key={img.id || idx}
                          type="button"
                          onClick={() => handleSelectSlide(idx)}
                          aria-label={`ไปยังรูปภาพที่ ${idx + 1}`}
                          className={cn(
                            "h-2 rounded-full transition-all duration-200 cursor-pointer",
                            idx === currentIndex
                              ? "w-6 bg-blue-500 shadow-xs shadow-blue-500/50"
                              : "w-2 bg-white/50 hover:bg-white/80"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {/* Quick Close Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    className="rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md px-3.5 py-1 border border-white/15 text-[11.5px] text-white/90 transition-colors cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>
              </div>

              {/* Animated Progress Bar along the bottom edge of image */}
              {images.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 z-30 w-full bg-black/30 h-1">
                  <div
                    className="bg-blue-500 h-full transition-all duration-75 ease-linear shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 px-10 text-center text-white bg-black/80 rounded-2xl backdrop-blur-md">
              <Megaphone className="mx-auto mb-2 size-8 text-slate-400" />
              <p className="text-sm">ไม่มีรูปภาพประกาศในขณะนี้</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

