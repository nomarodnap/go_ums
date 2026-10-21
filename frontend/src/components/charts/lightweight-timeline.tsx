"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  AreaSeries,
  Time,
} from "lightweight-charts";
import { useTheme } from "next-themes";

export interface TimelineDataPoint {
  time: string; // "YYYY-MM-DD"
  value: number;
}

interface LightweightTimelineProps {
  data: TimelineDataPoint[];
  height?: number;
  className?: string;
  title?: string;
}

export function LightweightTimeline({
  data,
  height = 220,
  className,
  title,
}: LightweightTimelineProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(0, 0, 0, 0.65)",
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: {
          color: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
        },
        horzLines: {
          color: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: {
          color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
          width: 1,
          style: 3,
        },
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#0071e3",
      topColor: "rgba(0, 113, 227, 0.35)",
      bottomColor: "rgba(0, 113, 227, 0.0)",
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 0,
        minMove: 1,
      },
    });

    if (data && data.length > 0) {
      // Ensure sorted by time
      const sorted = [...data].sort((a, b) => a.time.localeCompare(b.time));
      areaSeries.setData(sorted as { time: Time; value: number }[]);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [isDark, height, data]);

  return (
    <div className={`relative w-full ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <span className="text-[11px] text-muted-foreground/80 font-mono">
            Canvas 120fps GPU
          </span>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden" />
    </div>
  );
}
