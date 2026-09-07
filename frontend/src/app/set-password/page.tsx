"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("ไม่พบ Token สำหรับการตั้งรหัสผ่าน");
      return;
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (password.length < 8) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setIsPending(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail || data?.title || "เกิดข้อผิดพลาดในการตั้งรหัสผ่าน");
      } else {
        toast.success("ตั้งรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่");
        router.push("/sign-in");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsPending(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <p className="text-xs text-destructive font-medium">
          ไม่พบ Token ที่ใช้ในการตั้งรหัสผ่าน หรือลิงก์หมดอายุแล้ว
        </p>
        <Button
          render={<Link href="/sign-in" />}
          variant="outline"
          className="h-9.5 rounded-xl text-xs"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-xs font-medium text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-xs font-semibold text-foreground tracking-wide"
        >
          รหัสผ่านใหม่
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-9.5 h-10 rounded-xl bg-background/50 text-xs"
            disabled={isPending}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="text-xs font-semibold text-foreground tracking-wide"
        >
          ยืนยันรหัสผ่านใหม่
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-9.5 h-10 rounded-xl bg-background/50 text-xs"
            disabled={isPending}
          />
        </div>
      </div>
      <Button
        type="submit"
        className="w-full h-10 rounded-xl text-sm font-semibold shadow-xs"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            กำลังบันทึก...
          </>
        ) : (
          "ตั้งรหัสผ่าน"
        )}
      </Button>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-[#f5f5f7] dark:bg-[#000000]">
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-blue-500/15 dark:bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-teal-500/15 dark:bg-teal-600/20 blur-3xl pointer-events-none" />

      <Card className="relative w-full max-w-[420px] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl shadow-2xl p-2 sm:p-4">
        <CardHeader className="space-y-3 text-center pb-2">
          <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-white dark:bg-slate-900/90 p-2 shadow-sm border border-black/[0.06] dark:border-white/[0.1]">
            <Image
              src="/logo.png"
              alt="ตราสัญลักษณ์กรมประมง"
              width={70}
              height={70}
              className="size-full object-contain"
              priority
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              ตั้งรหัสผ่านใหม่
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              กรุณาตั้งรหัสผ่านสำหรับการเข้าใช้งานระบบจัดการสาธารณูปโภค กรมประมง
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                กำลังโหลด...
              </div>
            }
          >
            <SetPasswordForm />
          </Suspense>

          <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>ระบบรักษาความปลอดภัยสำหรับข้าราชการและเจ้าหน้าที่</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
