"use client";

import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import {
  useListDepartments,
  useListDepartmentServices,
} from "@/lib/api/generated/departments/departments";
import { ServicesTable } from "./services-table";
import { LoadingEffect } from "@/components/ui/loading-effect";

export default function ServicesPage() {
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

  // Filter based on role (admin sees all, non-admin sees only own department's services)
  const services =
    userRole === "admin"
      ? allServices
      : allServices.filter((s) => s.departmentId === userDepartmentId);

  // Filter allowed departments for dropdown
  const allowedDepartments =
    userRole === "admin"
      ? allDepartments
      : allDepartments.filter((d) => d.id === userDepartmentId);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          รหัสเครื่องวัด / เบอร์โทร
        </h2>
      </div>
      <p className="text-muted-foreground">
        จัดการข้อมูลบัญชีผู้ให้บริการสาธารณูปโภค หมายเลขผู้ใช้ รหัสเครื่องวัด
        และเบอร์โทรศัพท์ของหน่วยงาน
      </p>

      {isLoading ? (
        <LoadingEffect message="กำลังโหลดข้อมูลรหัสเครื่องวัดและเบอร์โทร..." />
      ) : (
        <ServicesTable
          services={services}
          departments={allowedDepartments}
          userRole={userRole}
          userDepartmentId={userDepartmentId}
        />
      )}
    </div>
  );
}
