"use client";

import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  water: { label: "ค่าประปา&น้ำบาดาล", color: "var(--chart-2)" },
  phone: { label: "ค่าโทรศัพท์", color: "var(--chart-3)" },
  telecom: { label: "ค่าสื่อสาร&โทรคมนาคม", color: "var(--chart-4)" },
  postal: { label: "ค่าบริการไปรษณีย์", color: "var(--chart-5)" },
};

const statusConfig = {
  เบิกจ่ายแล้ว: { label: "เบิกจ่ายแล้ว", color: "var(--chart-2)" },
  ค้างชำระ: { label: "ค้างชำระ", color: "var(--chart-3)" },
};

export const serviceStatusConfig = {
  บันทึกเข้าระบบแล้ว: { label: "บันทึกเข้าระบบแล้ว", color: "var(--chart-1)" },
  ยังไม่ได้บันทึกเข้าระบบ: { label: "ยังไม่ได้บันทึกเข้าระบบ", color: "var(--chart-3)" },
};

export function TrendChart({
  data,
  defaultMonths,
  chartHeight = "h-[280px]",
  onOpenFullscreen,
}: {
  data: TrendDataPoint[];
  defaultMonths?: string;
  chartHeight?: string;
  onOpenFullscreen?: () => void;
}) {
  const [months, setMonths] = useState(defaultMonths || "6");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (defaultMonths) {
      setMonths(defaultMonths);
    }
  }, [defaultMonths]);

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
        <div className="flex items-center gap-2">
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

          {onOpenFullscreen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenFullscreen}
              className="h-8 px-2 text-xs gap-1 rounded-lg border-black/[0.08] dark:border-white/[0.08] text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              title="ดูแบบเต็มจอ (Full Screen)"
            >
              <Maximize2 className="size-3.5" />
              <span className="hidden sm:inline">เต็มจอ</span>
            </Button>
          )}
        </div>
      </div>

      <ChartContainer config={trendConfig} className={cn("w-full aspect-auto", chartHeight)}>
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

export function StatusPieChart({
  data,
  config = statusConfig,
}: {
  data: StatusDataPoint[];
  config?: any;
}) {
  return (
    <ChartContainer config={config} className="h-[250px] w-full">
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

export function TrendFullscreenDialog({
  open,
  onOpenChange,
  title,
  description,
  data,
  defaultMonths,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  data: TrendDataPoint[];
  defaultMonths?: string;
}) {
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsBrowserFullscreen(true);
        })
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsBrowserFullscreen(false);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-6 sm:p-8 rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl bg-background/95 dark:bg-background/95 backdrop-blur-2xl">
        <DialogHeader className="pr-12">
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {title}
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleBrowserFullscreen}
              className="h-7 px-2 text-xs gap-1.5 rounded-lg border-black/[0.08] dark:border-white/[0.08] text-muted-foreground hover:text-foreground hidden sm:inline-flex cursor-pointer"
              title="เปิด/ปิดเต็มหน้าจอเบราว์เซอร์"
            >
              {isBrowserFullscreen ? (
                <>
                  <Minimize2 className="size-3" />
                  <span>ย่อหน้าจอ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="size-3" />
                  <span>เต็มหน้าจอเบราว์เซอร์</span>
                </>
              )}
            </Button>
          </div>
          {description && (
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 pt-4 flex flex-col overflow-y-auto">
          {data && data.length > 0 ? (
            <TrendChart
              data={data}
              defaultMonths={defaultMonths}
              chartHeight="h-[480px] sm:h-[540px] lg:h-[600px]"
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm">
              ไม่มีข้อมูลเพียงพอสำหรับการแสดงกราฟ
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
