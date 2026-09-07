"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorSpeechBubbleProps {
  message?: string | string[] | null;
  className?: string;
  arrowPosition?: "left" | "center" | "right";
}

export function ErrorSpeechBubble({
  message,
  className,
  arrowPosition = "left",
}: ErrorSpeechBubbleProps) {
  if (!message) return null;
  const text = Array.isArray(message) ? message[0] : message;
  if (!text) return null;

  const arrowClasses = {
    left: "left-4",
    center: "left-1/2 -translate-x-1/2",
    right: "right-4",
  };

  return (
    <div
      className={cn(
        "relative z-20 mt-2 inline-block w-fit animate-in fade-in-0 slide-in-from-top-1.5 duration-200",
        className,
      )}
    >
      {/* Speech Bubble Arrow pointing UP */}
      <div
        className={cn(
          "absolute -top-1.5 w-0 h-0 border-x-[6px] border-x-transparent border-b-[6px] border-b-rose-600 dark:border-b-rose-500 drop-shadow-xs",
          arrowClasses[arrowPosition],
        )}
      />
      {/* Speech Bubble Body */}
      <div className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-rose-950/15 backdrop-blur-xs transition-all dark:bg-rose-500">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-white" />
        <span className="leading-snug">{text}</span>
      </div>
    </div>
  );
}
