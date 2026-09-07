"use client";

import { useState } from "react";
import { useListDepartments } from "@/lib/api/generated/departments/departments";
import { useListDepartmentServices } from "@/lib/api/generated/departments/departments";
import { useListUsers } from "@/lib/api/generated/users/users";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { DepartmentsTable } from "./departments-table";
import { DepartmentFormSheet } from "./department-form-sheet";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";

export default function DepartmentsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: deptRes, isLoading: isDeptLoading } = useListDepartments();
  const { data: usersRes, isLoading: isUsersLoading } = useListUsers();
  const { data: servicesRes, isLoading: isServicesLoading } = useListDepartmentServices();
  const { data: userRes, isLoading: isUserLoading } = useGetCurrentUser();

  const isLoading = isDeptLoading || isUsersLoading || isServicesLoading || isUserLoading;

  const departments =
    deptRes?.status === 200 && Array.isArray(deptRes.data)
      ? deptRes.data
      : [];

  const users =
    usersRes?.status === 200 && Array.isArray(usersRes.data)
      ? usersRes.data
      : [];

  const services =
    servicesRes?.status === 200 && Array.isArray(servicesRes.data)
      ? servicesRes.data
      : [];

  const user = userRes?.status === 200 ? userRes.data.user : null;
  const userRole = user?.role || "user";

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            หน่วยงาน (Departments)
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            จัดการข้อมูลหน่วยงาน 292 หน่วยงาน (ส่วนกลางและภูมิภาค)
          </p>
        </div>
        {["admin", "central_staff", "regional_staff"].includes(userRole) && (
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-xs shrink-0">
            <PlusCircle className="size-4" /> เพิ่มหน่วยงาน
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground text-sm">
            กำลังโหลดข้อมูลหน่วยงาน...
          </span>
        </div>
      ) : (
        <DepartmentsTable
          initialData={departments}
          users={users}
          services={services}
          userRole={userRole}
        />
      )}

      <DepartmentFormSheet
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        departments={departments}
      />
    </div>
  );
}
