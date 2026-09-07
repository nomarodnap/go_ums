"use client";

import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import {
  useListDepartments,
  useListDepartmentServices,
} from "@/lib/api/generated/departments/departments";
import { ServicesTable } from "./services-table";
import { Loader2 } from "lucide-react";

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
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            รหัสเครื่องวัด / เบอร์โทร
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            จัดการข้อมูลบัญชีผู้ให้บริการสาธารณูปโภค หมายเลขผู้ใช้ รหัสเครื่องวัด
            และเบอร์โทรศัพท์ของหน่วยงาน
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground text-sm">
            กำลังโหลดข้อมูลรหัสเครื่องวัดและเบอร์โทร...
          </span>
        </div>
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
