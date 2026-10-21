"use client";

import {
  FileText,
  Lock,
  ArrowRight,
  BarChart3,
  AlertTriangle,
  PieChart,
  ShieldCheck,
  Building,
  FileCheck2,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { LoadingEffect } from "@/components/ui/loading-effect";

const reportList = [
  {
    id: "utility",
    number: "01",
    title: "รายงานค่าสาธารณูปโภค",
    description:
      "แสดงงบประมาณจัดสรร ผลเบิกจ่าย งบพึงประสงค์ เปรียบเทียบรายกอง/รายหน่วยงาน (รายเดือนและรายปี)",
    href: "/reports/utility",
    icon: BarChart3,
    colorClass: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    badgeLabel: "ทุกหน่วยงาน",
    allowedRoles: [
      "admin",
      "auditor",
      "strategy_finance",
      "central_staff",
      "regional_staff",
      "user",
    ],
  },
  {
    id: "pending",
    number: "02",
    title: "รายงานค่าสาธารณูปโภคค้างชำระ",
    description: "สรุปรายการบิลค้างชำระ ยอดประมาณการที่อยู่ระหว่างขอจัดสรรงบ",
    href: "/reports/pending",
    icon: AlertTriangle,
    colorClass: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    badgeLabel: "ทุกหน่วยงาน",
    allowedRoles: [
      "admin",
      "auditor",
      "strategy_finance",
      "central_staff",
      "regional_staff",
      "user",
    ],
  },
  {
    id: "budget",
    number: "03",
    title: "รายงานการบริหารงบประมาณ",
    description:
      "เปรียบเทียบงบประมาณคงเหลือ และวิเคราะห์รายชื่อหน่วยงานที่งบประมาณมีแนวโน้มไม่เพียงพอ",
    href: "/reports/budget",
    icon: PieChart,
    colorClass: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    badgeLabel: "ทุกหน่วยงาน",
    allowedRoles: [
      "admin",
      "auditor",
      "strategy_finance",
      "central_staff",
      "regional_staff",
      "user",
    ],
  },
  {
    id: "audit-results",
    number: "04",
    title: "รายงานผลการตรวจสอบค่าสาธารณูปโภค",
    description:
      "รายงานประเด็นความคลาดเคลื่อน เทียบกับปีก่อนหน้า และติดตามการแก้ไขตามข้อเสนอแนะ",
    href: "/reports/audit-results",
    icon: ShieldCheck,
    colorClass: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
    badgeLabel: "ทุกหน่วยงาน",
    allowedRoles: [
      "admin",
      "auditor",
      "strategy_finance",
      "central_staff",
      "regional_staff",
      "user",
    ],
  },
  {
    id: "audit-summary",
    number: "05",
    title: "รายงานสรุปการเบิกจ่าย (สำหรับ กตน.)",
    description: "รายงานสำหรับกลุ่มตรวจสอบภายในเท่านั้น แสดงรายละเอียดบิลและหมายเลขผู้ใช้",
    href: "/reports/audit-summary",
    icon: FileCheck2,
    colorClass: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
    badgeLabel: "เฉพาะ กตน.",
    allowedRoles: ["admin", "auditor"],
  },
  {
    id: "finance-control",
    number: "06",
    title: "ทะเบียนคุมการเบิกจ่าย (สำหรับ กค.)",
    description: "ทะเบียนคุมการเบิกจ่ายของกองบริหารการคลัง แสดงวันรับเรื่องและเลขที่ใบสำคัญ",
    href: "/reports/finance-control",
    icon: Building,
    colorClass: "bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400",
    badgeLabel: "เฉพาะ กค.",
    allowedRoles: ["admin", "central_staff"],
  },
  {
    id: "additional-budget",
    number: "07",
    title: "แบบฟอร์มขอรับงบจัดสรรเพิ่มเติม (สำหรับ กยผ.)",
    description: "แบบฟอร์มคำขอสำหรับหน่วยงานที่งบประมาณไม่เพียงพอ",
    href: "/reports/additional-budget",
    icon: FileText,
    colorClass: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
    badgeLabel: "เฉพาะ กยผ.",
    allowedRoles: ["admin", "strategy_finance"],
  },
  {
    id: "audit-worksheet",
    number: "08",
    title: "กระดาษทำการตรวจสอบค่าสาธารณูปโภค (สำหรับ กตน.)",
    description: "เอกสารสรุปจำนวนวันตั้งแต่รับบิลจนถึงเบิกจ่าย เพื่อหากรณีเบิกจ่ายล่าช้า",
    href: "/reports/audit-worksheet",
    icon: ShieldCheck,
    colorClass: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
    badgeLabel: "เฉพาะ กตน.",
    allowedRoles: ["admin", "auditor"],
  },
];

export default function ReportsCenterPage() {
  const { data: userData, isLoading } = useGetCurrentUser();
  const user = userData?.status === 200 ? userData.data.user : null;
  const userRole = user?.role || "user";

  if (isLoading) {
    return <LoadingEffect message="กำลังโหลดศูนย์รวมรายงาน..." />;
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            ศูนย์รวมรายงาน (Report Center)
          </h1>
          <Badge variant="secondary" className="font-normal text-xs">
            8 รูปแบบ
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          ระบบออกรายงานการบริหารจัดการค่าสาธารณูปโภค
          โดยสิทธิ์การเข้าถึงจะขึ้นอยู่กับบทบาทและสังกัดของคุณ
        </p>
      </div>

      {/* Report Cards Bento Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reportList.map((report) => {
          const isAllowed = report.allowedRoles.includes(userRole || "");
          const Icon = report.icon;

          return (
            <div
              key={report.id}
              className={`group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 p-5 backdrop-blur-xl shadow-xs transition-all duration-200 ${
                isAllowed
                  ? "hover:-translate-y-1 hover:border-primary/40 hover:shadow-md cursor-pointer"
                  : "opacity-60 bg-muted/20 cursor-not-allowed"
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`flex size-11 items-center justify-center rounded-2xl ${
                      isAllowed ? report.colorClass : "bg-muted text-muted-foreground"
                    } ${isAllowed ? "group-hover:scale-105" : ""} transition-transform`}
                  >
                    {isAllowed ? (
                      <Icon className="size-5.5" />
                    ) : (
                      <Lock className="size-5" />
                    )}
                  </div>
                  <Badge
                    variant={isAllowed ? "secondary" : "outline"}
                    className="text-[10px] h-5 font-normal"
                  >
                    {report.badgeLabel}
                  </Badge>
                </div>

                <div className="text-[11px] font-semibold text-muted-foreground/80 tracking-wider uppercase mb-1">
                  Report #{report.number}
                </div>
                <h3 className="font-semibold text-base text-foreground leading-snug group-hover:text-primary transition-colors">
                  {report.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                  {report.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                {isAllowed ? (
                  <Link
                    href={report.href}
                    className="flex items-center justify-between text-xs font-semibold text-primary group-hover:underline"
                  >
                    <span>เปิดดูรายงาน</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    ไม่มีสิทธิ์เข้าถึงรายงานนี้
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
