"use client";

import React, { useMemo } from "react";
import { AreaClosed, LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { scaleTime, scaleLinear } from "@visx/scale";

interface DataPoint {
  date: Date;
  value: number;
}

interface VisxSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  className?: string;
}

export function VisxSparkline({
  data,
  width = 120,
  height = 40,
  strokeColor = "#0071e3",
  gradientFrom = "#0071e3",
  gradientTo = "transparent",
  className,
}: VisxSparklineProps) {
  const chartData: DataPoint[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((val, idx) => ({
      date: new Date(2026, idx, 1),
      value: val,
    }));
  }, [data]);

  const margin = { top: 4, bottom: 4, left: 2, right: 2 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const xScale = useMemo(
    () =>
      scaleTime({
        range: [0, innerWidth],
        domain: chartData.length > 0
          ? [chartData[0].date, chartData[chartData.length - 1].date]
          : [new Date(), new Date()],
      }),
    [innerWidth, chartData],
  );

  const yScale = useMemo(() => {
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 100);
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [min, max * 1.05],
      nice: true,
    });
  }, [innerHeight, chartData]);

  if (!chartData || chartData.length < 2) {
    return (
      <div
        className={`flex items-center justify-center text-[10px] text-muted-foreground ${className}`}
        style={{ width, height }}
      >
        —
      </div>
    );
  }

  const gradientId = `visx-sparkline-grad-${Math.random().toString(36).substring(2, 7)}`;

  return (
    <svg width={width} height={height} className={className}>
      <defs>
        <LinearGradient
          id={gradientId}
          from={gradientFrom}
          to={gradientTo}
          fromOpacity={0.4}
          toOpacity={0.0}
        />
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        <AreaClosed<DataPoint>
          data={chartData}
          x={(d) => xScale(d.date)}
          y={(d) => yScale(d.value)}
          yScale={yScale}
          strokeWidth={0}
          curve={curveMonotoneX}
          fill={`url(#${gradientId})`}
        />
        <LinePath<DataPoint>
          data={chartData}
          x={(d) => xScale(d.date)}
          y={(d) => yScale(d.value)}
          stroke={strokeColor}
          strokeWidth={1.75}
          curve={curveMonotoneX}
        />
      </g>
    </svg>
  );
}
