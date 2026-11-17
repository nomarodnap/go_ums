"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import {
  useListDepartments,
  useListDepartmentServices,
} from "@/lib/api/generated/departments/departments";
import { ServicesTable } from "../services/services-table";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { hasPageAccess } from "@/lib/permissions";

function AllServicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const departmentIdParam = searchParams.get("departmentId");

  const { data: userRes, isLoading: isUserLoading } = useGetCurrentUser();
  const { data: deptRes, isLoading: isDeptLoading } = useListDepartments();
  const { data: servicesRes, isLoading: isServicesLoading } =
    useListDepartmentServices();

  const user = userRes?.status === 200 ? userRes.data.user : null;
  const userRole = user?.role || "user";
  const userDepartmentId = user?.departmentId || null;

  // RBAC check
  useEffect(() => {
    if (!isUserLoading && user) {
      const allowedRoles = ["admin", "auditor", "central_staff", "strategy_finance"];
      const hasPerm = hasPageAccess(user as any, "/all-services");
      if (!allowedRoles.includes(userRole) && !hasPerm) {
        router.replace("/unauthorized");
      }
    }
  }, [isUserLoading, user, userRole, router]);

  const isLoading = isUserLoading || isDeptLoading || isServicesLoading;

  const allDepartments =
    deptRes?.status === 200 && Array.isArray(deptRes.data)
      ? deptRes.data
      : [];

  const allServices =
    servicesRes?.status === 200 && Array.isArray(servicesRes.data)
      ? servicesRes.data
      : [];

  if (isLoading) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดข้อมูลรหัสเครื่องวัดทุกหน่วยงาน..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          รหัสเครื่องวัดทั้งหมด
        </h2>
      </div>
      <p className="text-muted-foreground text-sm">
        ตรวจสอบและจัดการข้อมูลบัญชีผู้ให้บริการ รหัสเครื่องวัด
        และหมายเลขผู้ใช้ของทุกหน่วยงานในระบบ (292 หน่วยงาน กรมประมง)
      </p>

      <ServicesTable
        services={allServices}
        departments={allDepartments}
        userRole={userRole}
        userDepartmentId={userDepartmentId}
        initialDepartmentId={departmentIdParam}
        scope="all"
      />
    </div>
  );
}

export default function AllServicesPage() {
  return (
    <Suspense
      fallback={
        <LoadingEffect
          fullScreen
          message="กำลังโหลดข้อมูลรหัสเครื่องวัดทุกหน่วยงาน..."
          subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
        />
      }
    >
      <AllServicesContent />
    </Suspense>
  );
}

