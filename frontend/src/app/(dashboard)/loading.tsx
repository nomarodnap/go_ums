import { LoadingEffect } from "@/components/ui/loading-effect";

export default function Loading() {
  return (
    <LoadingEffect
      fullScreen
      message="กำลังสลับหน้าและโหลดข้อมูล..."
      subMessage="ระบบรายงานและบริหารจัดการค่าสาธารณูปโภค กรมประมง"
    />
  );
}
