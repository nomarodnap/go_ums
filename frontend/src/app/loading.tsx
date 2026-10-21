import { LoadingEffect } from "@/components/ui/loading-effect";

export default function Loading() {
  return (
    <LoadingEffect
      fullScreen
      message="กำลังโหลดข้อมูลระบบ..."
      subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
    />
  );
}
