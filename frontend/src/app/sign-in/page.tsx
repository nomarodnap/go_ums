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
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentUserQueryKey } from "@/lib/api/generated/auth/auth";
import { DofGoldLogo3D } from "@/components/three/dof-gold-logo-3d";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

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

    setLoading(true);
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (signInError.message?.toLowerCase().includes("banned")) {
          setError("บัญชีผู้ใช้งานนี้ถูกระงับการใช้งาน");
        } else {
          setError(signInError.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }
        setLoading(false);
        return;
      }

      if (data) {
        const sessionToken = (data as any)?.session?.token || (data as any)?.token;
        if (sessionToken) {
          localStorage.setItem("auth_token", sessionToken);
          document.cookie = `auth_token=${sessionToken}; path=/; max-age=86400; SameSite=Lax`;
        }
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }

        await queryClient.resetQueries();
        window.location.href = "/";
      }
    } catch (err: unknown) {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden !bg-[#FDFDFD]"
      style={{ backgroundColor: "#FDFDFD" }}
    >
      {/* Soft ambient background blur glows */}
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      <Card
        className="relative w-full max-w-[440px] rounded-3xl border border-slate-200/80 !bg-[#FDFDFD] shadow-[0_20px_60px_rgba(0,0,0,0.06)] p-2 sm:p-5 !text-slate-800"
        style={{ backgroundColor: "#FDFDFD", color: "#1e293b" }}
      >
        <CardHeader className="space-y-3 text-center pb-2">
          {/* 3D Metallic Gold Emblem with Orbiting Lights */}
          <div
            className="mx-auto flex size-52 items-center justify-center rounded-3xl relative group"
            style={{ backgroundColor: "#FDFDFD" }}
          >
            <DofGoldLogo3D size={200} className="drop-shadow-[0_14px_32px_rgba(180,120,20,0.22)]" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight !text-slate-800">
              เข้าสู่ระบบ
            </CardTitle>
            <CardDescription className="text-xs !text-slate-500 mt-1.5 leading-relaxed">
              ระบบจัดการและรายงานค่าใช้จ่ายสาธารณูปโภค
              <br />
              <span className="font-semibold !text-slate-700">กรมประมง (Department of Fisheries)</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form noValidate onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold !text-slate-700 tracking-wide">
                อีเมลเจ้าหน้าที่
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@fisheries.go.th"
                  className="pl-9.5 h-10 rounded-xl bg-white border border-slate-200 !text-slate-800 placeholder:text-slate-400 shadow-xs focus-visible:ring-amber-500/30"
                  style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#1e293b" }}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold !text-slate-700 tracking-wide">
                  รหัสผ่าน
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pl-9.5 h-10 rounded-xl bg-white border border-slate-200 !text-slate-800 placeholder:text-slate-400 shadow-xs focus-visible:ring-amber-500/30"
                  style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#1e293b" }}
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
              className="w-full h-10 rounded-xl text-sm font-semibold shadow-xs bg-blue-600 hover:bg-blue-700 text-white"
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
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/70 text-left space-y-1 mt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                <Info className="size-4 shrink-0 text-blue-600" />
                <span>คำแนะนำสำหรับการเข้าใช้งานครั้งแรก</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-blue-900/80 pl-5.5">
                ในกรณีเข้าใช้งานระบบเป็นครั้งแรก ให้ท่านกดที่{" "}
                <Link
                  href="/forgot-password"
                  className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-800"
                >
                  "ลืมรหัสผ่าน?"
                </Link>{" "}
                และกรอกอีเมลที่หน่วยงานของท่านได้ส่งให้ทางกลุ่มตรวจสอบภายใน (กตน.) เพื่อตั้งรหัสผ่านใหม่สำหรับการเข้าใช้งาน
              </p>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200/80 text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              <span>ระบบรักษาความปลอดภัยสำหรับข้าราชการและเจ้าหน้าที่</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
