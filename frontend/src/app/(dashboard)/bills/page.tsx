"use client";

import { useMemo } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { useListBills } from "@/lib/api/generated/bills/bills";
import { useListDepartmentServices } from "@/lib/api/generated/departments/departments";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { BillsTable } from "./bills-table";

export default function BillsPage() {
  const { data: meRes, isLoading: loadingMe } = useGetCurrentUser();
  const me = meRes?.status === 200 ? meRes.data.user : null;
  const userRole = me?.role;
  const userDepartmentId = me?.departmentId;

  // In next_ums, /bills is strictly scoped to the user's assigned department
  const { data: billsRes, isLoading: loadingBills } = useListBills(
    userDepartmentId
      ? { departmentId: userDepartmentId }
      : { departmentId: "NONE" },
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
          <h2 className="text-3xl font-bold tracking-tight">รายการค่าใช้จ่าย</h2>
          <p className="text-muted-foreground mt-1">
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
        <LoadingEffect message="กำลังโหลดรายการบิล..." />
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
