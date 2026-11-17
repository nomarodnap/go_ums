import { LoadingEffect } from "@/components/ui/loading-effect";

export default function SignInLoading() {
  return (
    <LoadingEffect
      fullScreen
      message="กำลังจัดเตรียมตราสัญลักษณ์และระบบ..."
      subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
    />
  );
}
