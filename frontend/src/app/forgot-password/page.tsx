"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useForgotPassword } from "@/lib/api/generated/auth/auth";
import { motion } from "motion/react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const forgotPasswordMutation = useForgotPassword();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("กรุณากรอกอีเมลเจ้าหน้าที่");
      return;
    }

    try {
      const res = await forgotPasswordMutation.mutateAsync({
        data: { email: email.trim() },
      });

      if (res.status === 200) {
        setSuccess(true);
      } else {
        setError("ไม่พบอีเมลนี้ในระบบ");
      }
    } catch (err: unknown) {
      let message = "ไม่พบอีเมลนี้ในระบบ";
      if (typeof err === "object" && err !== null) {
        const errorObj = err as { detail?: string; title?: string; message?: string };
        if (errorObj.detail) {
          message = errorObj.detail;
        } else if (errorObj.message) {
          message = errorObj.message;
        } else if (errorObj.title) {
          message = errorObj.title;
        }
      }
      setError(message);
    }
  };

  const loading = forgotPasswordMutation.isPending;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-[#f5f5f7] dark:bg-[#000000]">
      {/* Apple ambient background blur glows */}
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-blue-500/15 dark:bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-teal-500/15 dark:bg-teal-600/20 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px]"
      >
        <Card className="w-full rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl shadow-2xl p-2 sm:p-4">
        <CardHeader className="space-y-3 text-center pb-2">
          <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-white dark:bg-slate-900/90 p-2 shadow-sm border border-black/[0.06] dark:border-white/[0.1]">
            {success ? (
              <CheckCircle2 className="size-12 text-emerald-500" />
            ) : (
              <Image
                src="/logo.png"
                alt="ตราสัญลักษณ์กรมประมง"
                width={70}
                height={70}
                className="size-full object-contain"
                priority
              />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {success ? "ตรวจสอบอีเมลของคุณ" : "ลืมรหัสผ่าน / ตั้งรหัสผ่าน"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {success
                ? `เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านไปที่ ${email} เรียบร้อยแล้ว โปรดตรวจสอบกล่องจดหมายของคุณ`
                : "กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่ หรือใช้สำหรับตั้งรหัสผ่านครั้งแรก"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!success ? (
            <form noValidate onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold text-foreground tracking-wide"
                >
                  อีเมลเจ้าหน้าที่
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@fisheries.go.th"
                    disabled={loading}
                    className="pl-9.5 h-10 rounded-xl bg-background/50"
                  />
                </div>
              </div>
              {error && (
                <div className="p-3 text-xs text-destructive bg-destructive/10 rounded-xl border border-destructive/20 font-medium">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-10 rounded-xl text-sm font-semibold shadow-xs"
                disabled={loading || !email}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    กำลังส่งลิงก์...
                  </>
                ) : (
                  "ส่งลิงก์ตั้งรหัสผ่าน"
                )}
              </Button>
              <div className="text-center mt-4">
                <Link
                  href="/sign-in"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 font-medium transition-colors"
                >
                  <ArrowLeft className="size-3.5" /> กลับไปหน้าเข้าสู่ระบบ
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 mb-2">
                <p className="text-xs text-amber-900 dark:text-amber-200 text-center font-medium leading-relaxed">
                  ⚠️ หากไม่พบอีเมลในกล่องจดหมายขาเข้า (Inbox)
                  กรุณาตรวจสอบในโฟลเดอร์จดหมายขยะ (Spam / Junk Mail)
                  และแนะนำให้กดปุ่ม <strong>&quot;ไม่ใช่จดหมายขยะ&quot; (Not Spam)</strong>{" "}
                  หรือเพิ่มลงในรายชื่อผู้ติดต่อที่ปลอดภัย เพื่อไม่ให้พลาดการแจ้งเตือนในครั้งถัดไป
                </p>
              </div>
              <Button
                variant="outline"
                render={<Link href="/sign-in" />}
                className="w-full h-10 rounded-xl text-xs font-semibold"
              >
                กลับไปหน้าเข้าสู่ระบบ
              </Button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>ระบบรักษาความปลอดภัยสำหรับข้าราชการและเจ้าหน้าที่</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
