import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Sparkles, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DofGoldModel } from "@/components/three/dof-gold-model";

export const metadata = {
  title: "3D Metallic Gold Emblem Preview | กรมประมง",
  description:
    "หน้าทดสอบพิเศษโมเดล 3D ตราสัญลักษณ์กรมประมงจาก vector.svg ด้วย Three.js วัสดุทองคำแท้สะท้อนแสง โปร่งทะลุ",
};

export default function Preview3DPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#06080e] text-slate-100">
      {/* Top Navigation Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 sm:px-8 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-slate-300 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="size-4" />
              <span>กลับสู่แดชบอร์ด</span>
            </Button>
          </Link>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                <span>Three.js 3D Gold Emblem</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  หน้าพิเศษ (Preview Only)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                ศึกษาจาก public/old_logo.png • เวกเตอร์ 445 เส้นจาก public/vector.svg
              </p>
            </div>
          </div>
        </div>

        {/* Reference Links */}
        <div className="flex items-center gap-3">
          <a
            href="/old_logo.png"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
            title="ดูไฟล์ภาพอ้างอิง old_logo.png"
          >
            <Image
              src="/old_logo.png"
              alt="old_logo"
              width={16}
              height={16}
              className="size-4 rounded-full"
            />
            <span>ภาพต้นฉบับ (old_logo.png)</span>
            <ExternalLink className="size-3" />
          </a>

          <a
            href="/vector.svg"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
            title="ดูไฟล์เวกเตอร์ vector.svg"
          >
            <span>ไฟล์เวกเตอร์ (vector.svg)</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </header>

      {/* Main 3D Canvas Area */}
      <main className="flex-1 relative flex flex-col">
        <DofGoldModel />
      </main>
    </div>
  );
}
