"use client";

import { useState } from "react";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

export type TrendDataPoint = {
  month: string;
  electricity: number;
  water: number;
  phone: number;
  telecom: number;
  postal: number;
};

export type StatusDataPoint = {
  name: string;
  value: number;
  color: string;
};

const trendConfig = {
  electricity: { label: "ค่าไฟฟ้า", color: "var(--chart-1)" },
  water: { label: "ค่าน้ำประปา", color: "var(--chart-2)" },
  phone: { label: "ค่าโทรศัพท์", color: "var(--chart-3)" },
  telecom: { label: "ค่าสื่อสารฯ", color: "var(--chart-4)" },
  postal: { label: "ค่าไปรษณีย์", color: "var(--chart-5)" },
};

const statusConfig = {
  เบิกจ่ายแล้ว: { label: "เบิกจ่ายแล้ว", color: "var(--chart-2)" },
  ค้างชำระ: { label: "ค้างชำระ", color: "var(--chart-3)" },
};

export function TrendChart({ data }: { data: TrendDataPoint[] }) {
  const [months, setMonths] = useState("6");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const displayData = data.slice(-parseInt(months));

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>แสดงข้อมูลย้อนหลัง</span>
        </div>
        <Select
          value={months}
          onValueChange={(val) => {
            if (val) setMonths(val);
          }}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg">
            <SelectValue placeholder="เลือกช่วงเวลา">
              {months === "3"
                ? "3 เดือนล่าสุด"
                : months === "6"
                  ? "6 เดือนล่าสุด"
                  : "12 เดือนล่าสุด"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 เดือนล่าสุด</SelectItem>
            <SelectItem value="6">6 เดือนล่าสุด</SelectItem>
            <SelectItem value="12">12 เดือนล่าสุด</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ChartContainer config={trendConfig} className="h-[280px] w-full">
        <AreaChart
          data={displayData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gradient-electricity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-electricity)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-electricity)" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="gradient-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-water)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-water)" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="gradient-phone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-phone)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-phone)" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="gradient-telecom" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-telecom)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-telecom)" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="gradient-postal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-postal)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-postal)" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-[11px] text-muted-foreground"
          />
          <YAxis
            tickFormatter={(value) => `฿${value / 1000}k`}
            tickLine={false}
            axisLine={false}
            className="text-[11px] text-muted-foreground"
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            hide={hiddenSeries.has("electricity")}
            dataKey="electricity"
            stackId="a"
            fill="url(#gradient-electricity)"
            stroke="var(--color-electricity)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            hide={hiddenSeries.has("water")}
            dataKey="water"
            stackId="a"
            fill="url(#gradient-water)"
            stroke="var(--color-water)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            hide={hiddenSeries.has("phone")}
            dataKey="phone"
            stackId="a"
            fill="url(#gradient-phone)"
            stroke="var(--color-phone)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            hide={hiddenSeries.has("telecom")}
            dataKey="telecom"
            stackId="a"
            fill="url(#gradient-telecom)"
            stroke="var(--color-telecom)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            hide={hiddenSeries.has("postal")}
            dataKey="postal"
            stackId="a"
            fill="url(#gradient-postal)"
            stroke="var(--color-postal)"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-black/[0.04] dark:border-white/[0.06] mt-2">
        {Object.entries(trendConfig).map(([key, config]) => {
          const isHidden = hiddenSeries.has(key);
          return (
            <div
              key={key}
              onClick={() => toggleSeries(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-black/[0.04] dark:border-white/[0.06] cursor-pointer select-none transition-all duration-150 ${
                isHidden
                  ? "opacity-35 bg-muted/30"
                  : "opacity-100 bg-card hover:shadow-xs"
              }`}
            >
              <div
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: `var(--color-${key})` }}
              />
              <span className="text-[11px] text-foreground/80">
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatusPieChart({ data }: { data: StatusDataPoint[] }) {
  return (
    <ChartContainer config={statusConfig} className="h-[250px] w-full">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={85}
          paddingAngle={4}
          dataKey="value"
          stroke="transparent"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <ChartLegend content={<ChartLegendContent />} className="flex-wrap pt-2" />
      </PieChart>
    </ChartContainer>
  );
}
