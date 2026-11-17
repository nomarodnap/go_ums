"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { DofGoldLogo3D } from "@/components/three/dof-gold-logo-3d";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { AnimatePresence } from "framer-motion";
import { AnnouncementPopup } from "@/components/announcement-popup";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/components/icons/google-icon";
import { LineIcon } from "@/components/icons/line-icon";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [is3DLoaded, setIs3DLoaded] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const isBusy = loading || googleLoading || lineLoading;

  useEffect(() => {
    // Safety fallback: ensure loading effect dismisses within 3.5s even if 3D fails
    const timer = setTimeout(() => {
      setIs3DLoaded(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const reason = params.get("reason");
      if (reason === "timeout") {
        setInfoMessage("ระบบได้ออกจากระบบโดยอัตโนมัติเนื่องจากไม่มีการใช้งานระบบเป็นเวลานาน เพื่อความปลอดภัยของข้อมูล กรุณาลงชื่อเข้าใช้งานใหม่อีกครั้ง");
      }
      const errorValues = params.getAll("error");
      const urlError = errorValues[errorValues.length - 1] ?? null;
      const provider = params.get("provider");
      const providerLabel =
        provider === "line" ? "LINE" : provider === "google" ? "Google" : "โซเชียล";

      if (urlError) {
        if (
          urlError === "signup_disabled" ||
          urlError === "user_not_found" ||
          urlError === "user_not_registered"
        ) {
          setError(
            "ไม่พบบัญชีผู้ใช้นี้ในระบบ (อนุญาตเฉพาะอีเมลเจ้าหน้าที่ที่ลงทะเบียนไว้ล่วงหน้าเท่านั้น กรุณาติดต่อกลุ่มตรวจสอบภายใน)"
          );
        } else if (
          urlError === "email_not_found" ||
          urlError === "USER_EMAIL_NOT_FOUND"
        ) {
          setError(
            provider === "line"
              ? "ไม่พบข้อมูลอีเมลจากบัญชี LINE ของท่าน (กรุณาอนุญาตการแชร์อีเมลเมื่อเข้าสู่ระบบ หรือตรวจสอบว่าบัญชี LINE ได้ยืนยันอีเมลไว้แล้ว)"
              : `ไม่พบข้อมูลอีเมลจากบัญชี ${providerLabel} ของท่าน กรุณาอนุญาตการเข้าถึงอีเมลแล้วลองใหม่อีกครั้ง`
          );
        } else if (
          urlError === "account_not_linked" ||
          urlError === "unable_to_link_account"
        ) {
          setError(
            `ไม่สามารถเชื่อมโยงบัญชี ${providerLabel} ได้ กรุณาตรวจสอบว่าใช้อีเมลเดียวกับในระบบ หรือติดต่อกลุ่มตรวจสอบภายใน`
          );
        } else if (urlError === "access_denied") {
          setError(`ท่านได้ยกเลิกการเข้าสู่ระบบผ่านบัญชี ${providerLabel}`);
        } else if (urlError === "BANNED_USER" || urlError === "banned_user") {
          setError("บัญชีผู้ใช้งานนี้ถูกระงับการใช้งาน กรุณาติดต่อกลุ่มตรวจสอบภายใน");
        } else {
          setError(`การเข้าสู่ระบบผ่าน ${providerLabel} ไม่สำเร็จ (${urlError})`);
        }
      }
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/sign-in?provider=google",
      });
      if (res?.error) {
        setError(res.error.message || "ไม่สามารถเชื่อมต่อไปยัง Google ได้ในขณะนี้");
        setGoogleLoading(false);
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อบริการ Google ได้ กรุณาลองใหม่อีกครั้ง");
      setGoogleLoading(false);
    }
  };

  const handleLineSignIn = async () => {
    setError("");
    setLineLoading(true);
    try {
      const res = await authClient.signIn.social({
        provider: "line",
        callbackURL: "/",
        errorCallbackURL: "/sign-in?provider=line",
      });
      if (res?.error) {
        setError(res.error.message || "ไม่สามารถเชื่อมต่อไปยัง LINE ได้ในขณะนี้");
        setLineLoading(false);
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อบริการ LINE ได้ กรุณาลองใหม่อีกครั้ง");
      setLineLoading(false);
    }
  };

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
          setError("บัญชีผู้ใช้งานนี้ถูกระงับการใช้งาน กรุณาติดต่อกลุ่มตรวจสอบภายใน");
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
          document.cookie = `better-auth.session_token=${sessionToken}; path=/; max-age=86400; SameSite=Lax`;
        }
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }
        localStorage.setItem("dof_last_activity_time", Date.now().toString());

        await queryClient.clear();
        window.location.href = "/";
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!is3DLoaded && (
          <LoadingEffect
            fullScreen
            message="กำลังจัดเตรียมตราสัญลักษณ์และระบบ..."
            subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
          />
        )}
      </AnimatePresence>

      <div
        className={cn(
          "relative min-h-screen w-full flex flex-col justify-between items-center px-4 py-8 sm:py-12 bg-[#F8FAFC] text-slate-800 antialiased selection:bg-blue-500/20 selection:text-blue-900 transition-opacity duration-300",
          is3DLoaded ? "opacity-100" : "opacity-0 pointer-events-none select-none"
        )}
      >
        {/* Soft Ambient Background Light */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-blue-100/50 via-amber-50/30 to-transparent blur-3xl opacity-80" />
        </div>

        {/* Main Centered Content */}
        <div className="relative z-10 w-full max-w-[420px] my-auto flex flex-col items-center">
          {/* Emblem & System Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative flex size-44 sm:size-48 items-center justify-center mb-2">
              <DofGoldLogo3D
                size={180}
                onLoaded={() => setIs3DLoaded(true)}
                className="drop-shadow-[0_14px_32px_rgba(217,119,6,0.26)]"
              />
            </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            ระบบรายงานค่าสาธารณูปโภค
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            กรมประมง • กระทรวงเกษตรและสหกรณ์
          </p>
        </div>

                {/* Info Message (e.g. Inactive Session Timeout) */}
        {infoMessage && (
          <div className="w-full mb-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed shadow-xs">
            <Clock className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">แจ้งเตือนความปลอดภัย</span>
              <span>{infoMessage}</span>
            </div>
          </div>
        )}

        {/* Error Alert Message */}
        {error && (
          <div
            role="alert"
            className="w-full mb-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed shadow-xs"
          >
            <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">เข้าสู่ระบบไม่สำเร็จ</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Sign-In Card */}
        <div className="w-full rounded-2xl bg-white border border-slate-200/90 shadow-[0_12px_32px_rgba(15,23,42,0.06),0_2px_6px_rgba(15,23,42,0.03)] p-6 sm:p-7 space-y-4.5">
          <form noValidate onSubmit={handleSignIn} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold text-slate-700 block"
              >
                อีเมลเจ้าหน้าที่
              </label>
              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@fisheries.go.th"
                  className="pl-10 h-10.5 rounded-xl border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 text-xs sm:text-sm shadow-xs transition-all"
                  style={{ backgroundColor: "#f8fafc", color: "#0f172a", borderColor: "#cbd5e1" }}
                  disabled={isBusy}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-700"
                >
                  รหัสผ่าน
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <div className="relative">
                <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="pl-10 pr-10 h-10.5 rounded-xl border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 text-xs sm:text-sm shadow-xs transition-all"
                  style={{ backgroundColor: "#f8fafc", color: "#0f172a", borderColor: "#cbd5e1" }}
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  tabIndex={-1}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="size-4" />
                  ) : (
                    <Eye aria-hidden="true" className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Email Sign-In Button */}
            <Button
              type="submit"
              disabled={isBusy}
              className="w-full h-10.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "ลงชื่อเข้าใช้งาน"
              )}
            </Button>
          </form>

          {/* Simple Divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2.5 text-slate-400 font-medium">
                หรือ
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Google Sign-in Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isBusy}
              aria-busy={googleLoading}
              className="w-full h-10.5 rounded-xl text-xs sm:text-sm font-medium border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 flex items-center justify-center gap-2.5 transition-all shadow-xs active:scale-[0.99] cursor-pointer"
              style={{ backgroundColor: "#ffffff", color: "#1e293b", borderColor: "#cbd5e1" }}
            >
              {googleLoading ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin text-slate-500" />
                  <span>กำลังเชื่อมต่อไปยัง Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon className="size-4 shrink-0" />
                  <span>เข้าสู่ระบบด้วย Google Workspace</span>
                </>
              )}
            </Button>

            {/* LINE Sign-in Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleLineSignIn}
              disabled={isBusy}
              aria-busy={lineLoading}
              className="w-full h-10.5 rounded-xl text-xs sm:text-sm font-medium border-slate-200 bg-white hover:bg-emerald-50/70 hover:border-emerald-300 text-slate-700 flex items-center justify-center gap-2.5 transition-all shadow-xs active:scale-[0.99] cursor-pointer"
              style={{ backgroundColor: "#ffffff", color: "#1e293b", borderColor: "#cbd5e1" }}
            >
              {lineLoading ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin text-emerald-600" />
                  <span>กำลังเชื่อมต่อไปยัง LINE...</span>
                </>
              ) : (
                <>
                  <LineIcon className="size-4 shrink-0" />
                  <span>เข้าสู่ระบบด้วย LINE</span>
                </>
              )}
            </Button>
          </div>

          {/* First-time login guidance note */}
          <div className="pt-2 text-center border-t border-slate-100">
            <p className="text-[11.5px] text-slate-500 leading-relaxed">
              เข้าใช้งานระบบครั้งแรก?{" "}
              <Link
                href="/forgot-password"
                className="font-semibold text-blue-600 hover:underline inline-flex items-center gap-0.5"
              >
                กดที่นี่เพื่อตั้งรหัสผ่านใหม่
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Subtle Bottom Footer */}
      <div className="relative z-10 text-center space-y-1 text-slate-400 text-[11px] pt-4">
        <div className="inline-flex items-center gap-1.5 text-slate-500">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          <span>ระบบรักษาความปลอดภัยเครือข่าย กรมประมง</span>
        </div>
        <p className="text-slate-400">
          กลุ่มตรวจสอบภายใน โทร. 02-562-0545
        </p>
      </div>
    </div>
      <AnnouncementPopup ready={is3DLoaded} />
  </>
);
}
