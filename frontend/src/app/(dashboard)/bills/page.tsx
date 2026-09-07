"use client";

import { useMemo } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { useListBills } from "@/lib/api/generated/bills/bills";
import { useListDepartmentServices } from "@/lib/api/generated/departments/departments";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { BillsTable } from "./bills-table";

export default function BillsPage() {
  const { data: meRes, isLoading: loadingMe } = useGetCurrentUser();
  const me = meRes?.status === 200 ? meRes.data.user : null;
  const userRole = me?.role;
  const userDepartmentId = me?.departmentId;

  // If user is regional_staff, central_staff, or user, filter by their department
  const isSpecificDeptUser =
    userRole === "user" ||
    userRole === "regional_staff" ||
    userRole === "central_staff";

  const { data: billsRes, isLoading: loadingBills } = useListBills(
    isSpecificDeptUser && userDepartmentId
      ? { departmentId: userDepartmentId }
      : undefined,
  );
  const { data: servicesRes, isLoading: loadingServices } =
    useListDepartmentServices();

  const bills = useMemo(
    () => (Array.isArray(billsRes?.data) ? billsRes.data : []),
    [billsRes],
  );
  const services = useMemo(
    () => (Array.isArray(servicesRes?.data) ? servicesRes.data : []),
    [servicesRes],
  );

  const isLoading = loadingMe || loadingBills || loadingServices;

  return (
    <div className="flex-1 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            รายการค่าใช้จ่าย
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            จัดการและติดตามสถานะใบแจ้งหนี้ค่าสาธารณูปโภคของหน่วยงาน
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            href="/bills/new"
            className={buttonVariants({ variant: "default" })}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            บันทึกค่าใช้จ่ายใหม่
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground text-sm">
            กำลังโหลดรายการบิล...
          </span>
        </div>
      ) : (
        <BillsTable
          initialData={bills as any}
          services={services as any}
          showAuditStatus={true}
          userRole={userRole}
        />
      )}
    </div>
  );
}
