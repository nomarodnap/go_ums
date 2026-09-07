"use client";

import { useState } from "react";
import { useGetBillTracking } from "@/lib/api/generated/bills/bills";
import { TrackingDashboard } from "./tracking-dashboard";

export default function BillTrackingPage() {
  const currentDate = new Date();
  const [month, setMonth] = useState<number>(currentDate.getMonth() + 1);
  const [year, setYear] = useState<number>(currentDate.getFullYear());

  const { data: trackingRes, isLoading } = useGetBillTracking({
    month,
    year,
  });

  const trackingData =
    trackingRes?.status === 200 && trackingRes.data?.items
      ? trackingRes.data.items
      : [];

  const summary =
    trackingRes?.status === 200 && trackingRes.data?.summary
      ? trackingRes.data.summary
      : undefined;

  return (
    <div className="flex-1 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            ติดตามสถานะบิล
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            ตรวจสอบความคืบหน้าการบันทึกและการชำระเงินค่าสาธารณูปโภคประจำเดือน
          </p>
        </div>
      </div>

      <TrackingDashboard
        items={trackingData}
        summary={summary}
        month={month}
        year={year}
        onMonthChange={setMonth}
        onYearChange={setYear}
        isLoading={isLoading}
      />
    </div>
  );
}
