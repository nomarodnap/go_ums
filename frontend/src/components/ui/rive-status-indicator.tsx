"use client";

import React, { useState } from "react";
import { useRive } from "@rive-app/react-canvas";
import { CheckCircle2, ShieldCheck } from "lucide-react";

interface RiveStatusProps {
  status?: "success" | "active" | "neutral";
  size?: number;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export function RiveStatusIndicator({
  status = "success",
  size = 28,
  className,
  fallbackIcon,
}: RiveStatusProps) {
  const [hasError, setHasError] = useState(false);

  // Example public Rive community clean micro-interaction or graceful SVG fallback
  const { RiveComponent } = useRive({
    src: "https://cdn.rive.app/animations/vehicles.riv",
    autoplay: false,
    onStop: () => {},
  });

  if (hasError || !RiveComponent) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ${className}`}
        style={{ width: size, height: size }}
      >
        {fallbackIcon || <CheckCircle2 className="w-4 h-4 animate-pulse" />}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
      onError={() => setHasError(true)}
    >
      <div className="absolute inset-0 flex items-center justify-center text-emerald-400">
        {fallbackIcon || <ShieldCheck className="w-4 h-4 text-emerald-500" />}
      </div>
    </div>
  );
}
