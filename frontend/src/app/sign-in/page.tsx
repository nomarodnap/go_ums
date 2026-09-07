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
import { Loader2, Lock, Mail, ShieldCheck, Info } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLogin, getGetCurrentUserQueryKey } from "@/lib/api/generated/auth/auth";
import { useQueryClient } from "@tanstack/react-query";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const loginMutation = useLogin();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("กรุณากรอกอีเมลเจ้าหน้าที่");
      return;
    }
    if (!password) {
      setError("กรุณากรอกรหัสผ่าน");
      return;
    }

    try {
      const res = await loginMutation.mutateAsync({
        data: {
          email: email.trim(),
          password,
        },
      });

      if (res.status === 200 && res.data.token) {
        localStorage.setItem("auth_token", res.data.token);
        if (res.data.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
        }
        document.cookie = `auth_token=${res.data.token}; path=/; max-age=86400; SameSite=Lax`;

        await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        router.push("/");
        router.refresh();
      } else {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch (err: unknown) {
      let message = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      if (typeof err === "object" && err !== null) {
        const errorObj = err as { detail?: string; title?: string; message?: string };
        if (errorObj.detail === "account is suspended") {
          message = "บัญชีผู้ใช้งานนี้ถูกระงับการใช้งาน";
        } else if (errorObj.detail === "invalid email or password") {
          message = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        } else if (errorObj.detail) {
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

  const loading = loginMutation.isPending;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-[#f5f5f7] dark:bg-[#000000]">
      {/* Apple ambient background blur glows */}
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-blue-500/15 dark:bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-teal-500/15 dark:bg-teal-600/20 blur-3xl pointer-events-none" />

      <Card className="relative w-full max-w-[420px] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl shadow-2xl p-2 sm:p-4">
        <CardHeader className="space-y-3 text-center pb-4">
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
              เข้าสู่ระบบ
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              ระบบจัดการและรายงานค่าใช้จ่ายสาธารณูปโภค
              <br />
              <span className="font-semibold text-foreground/80">กรมประมง (Department of Fisheries)</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form noValidate onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-foreground tracking-wide">
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
                  className="pl-9.5 h-10 rounded-xl bg-background/50"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-foreground tracking-wide shrink-0">
                  รหัสผ่าน
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] sm:text-xs text-primary hover:underline font-medium text-right transition-colors"
                >
                  ลืมรหัสผ่าน / ตั้งรหัสผ่าน
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pl-9.5 h-10 rounded-xl bg-background/50"
                  disabled={loading}
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
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "ลงชื่อเข้าใช้งาน"
              )}
            </Button>

            {/* First-time login guidance note */}
            <div className="p-3.5 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-left space-y-1 mt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>คำแนะนำสำหรับการเข้าใช้งานครั้งแรก</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-blue-900/80 dark:text-blue-200/80 pl-5.5">
                ในกรณีเข้าใช้งานระบบเป็นครั้งแรก ให้ท่านกดที่{" "}
                <Link
                  href="/forgot-password"
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  "ลืมรหัสผ่าน / ตั้งรหัสผ่าน"
                </Link>{" "}
                และกรอกอีเมลที่หน่วยงานของท่านได้ส่งให้ทางกลุ่มตรวจสอบภายใน (กตน.) เพื่อตั้งรหัสผ่านใหม่สำหรับการเข้าใช้งาน
              </p>
            </div>
          </form>

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
