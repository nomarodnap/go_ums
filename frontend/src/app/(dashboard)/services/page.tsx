"use client";

import { Suspense } from "react";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import {
  useListDepartments,
  useListDepartmentServices,
} from "@/lib/api/generated/departments/departments";
import { ServicesTable } from "./services-table";
import { LoadingEffect } from "@/components/ui/loading-effect";

function ServicesContent() {
  const { data: userRes, isLoading: isUserLoading } = useGetCurrentUser();
  const { data: deptRes, isLoading: isDeptLoading } = useListDepartments();
  const { data: servicesRes, isLoading: isServicesLoading } =
    useListDepartmentServices();

  const isLoading = isUserLoading || isDeptLoading || isServicesLoading;

  const user = userRes?.status === 200 ? userRes.data.user : null;
  const userRole = user?.role || "user";
  const userDepartmentId = user?.departmentId || null;

  const allDepartments =
    deptRes?.status === 200 && Array.isArray(deptRes.data)
      ? deptRes.data
      : [];

  const allServices =
    servicesRes?.status === 200 && Array.isArray(servicesRes.data)
      ? servicesRes.data
      : [];

  // แสดงเฉพาะรายการรหัสเครื่องวัดของหน่วยงานตนเอง
  const services = allServices.filter(
    (s) => s.departmentId === userDepartmentId,
  );

  const allowedDepartments = allDepartments.filter(
    (d) => d.id === userDepartmentId,
  );

  if (isLoading) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดข้อมูลรหัสเครื่องวัดของหน่วยงาน..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          รหัสเครื่องวัด / หมายเลขผู้ใช้
        </h2>
      </div>
      <p className="text-muted-foreground text-sm">
        จัดการข้อมูลบัญชีผู้ให้บริการสาธารณูปโภค รหัสเครื่องวัด
        และหมายเลขผู้ใช้ของหน่วยงานตนเอง
      </p>

      <ServicesTable
        services={services}
        departments={allowedDepartments}
        userRole={userRole}
        userDepartmentId={userDepartmentId}
        scope="my_dept"
      />
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <LoadingEffect
          fullScreen
          message="กำลังโหลดข้อมูลรหัสเครื่องวัดของหน่วยงาน..."
          subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
        />
      }
    >
      <ServicesContent />
    </Suspense>
  );
}
