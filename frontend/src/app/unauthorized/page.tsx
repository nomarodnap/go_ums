import Image from "next/image";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ไม่มีสิทธิ์เข้าถึง | UMS กรมประมง",
  description: "คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้",
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground text-center p-4">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 p-2.5 shadow-md ring-1 ring-slate-900/5 dark:ring-slate-100/10 transition-transform hover:scale-105">
        <Image
          src="/logo.png"
          alt="ตราสัญลักษณ์กรมประมง"
          width={80}
          height={80}
          style={{ width: "auto", height: "auto" }}
          className="h-full w-full object-contain"
          priority
        />
      </div>

      <div className="inline-flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4">
        <ShieldAlert className="size-4" />
        <span>403 - ไม่มีสิทธิ์เข้าถึง</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-foreground">
        คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้
      </h1>

      <p className="text-muted-foreground mb-8 text-sm max-w-md leading-relaxed">
        กรุณาติดต่อผู้ดูแลระบบ กรมประมง
        หากคุณเชื่อว่านี่คือข้อผิดพลาดหรือต้องการขอสิทธิ์การใช้งานเพิ่มเติม
      </p>

      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium text-sm rounded-xl shadow-xs hover:bg-primary/90 transition-all hover:shadow-sm"
      >
        <ArrowLeft className="size-4" />
        <span>กลับสู่หน้าหลัก</span>
      </Link>
    </div>
  );
}
