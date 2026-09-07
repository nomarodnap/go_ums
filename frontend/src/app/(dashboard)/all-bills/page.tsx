"use client";

import { useMemo } from "react";
import { useListBills } from "@/lib/api/generated/bills/bills";
import { useListDepartmentServices } from "@/lib/api/generated/departments/departments";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { BillsTable } from "../bills/bills-table";
import { Loader2 } from "lucide-react";

export default function AllBillsPage() {
  const { data: meRes, isLoading: loadingMe } = useGetCurrentUser();
  const me = meRes?.status === 200 ? meRes.data.user : null;
  const userRole = me?.role;

  // Fetch all bills across all departments
  const { data: billsRes, isLoading: loadingBills } = useListBills();
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
            รายงานค่าใช้จ่ายทั้งหมด (ทุกหน่วยงาน)
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            ดูและติดตามสถานะใบแจ้งหนี้ค่าสาธารณูปโภคของทุกหน่วยงานในระบบ
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground text-sm">
            กำลังโหลดรายการบิลทั้งหมด...
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
