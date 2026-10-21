"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useListBills } from "@/lib/api/generated/bills/bills";
import { useListDepartmentServices } from "@/lib/api/generated/departments/departments";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { BillsTable } from "../bills/bills-table";
import { LoadingEffect } from "@/components/ui/loading-effect";

export default function AllBillsPage() {
  const router = useRouter();
  const { data: meRes, isLoading: loadingMe } = useGetCurrentUser();
  const me = meRes?.status === 200 ? meRes.data.user : null;
  const userRole = me?.role;

  useEffect(() => {
    if (
      !loadingMe &&
      userRole &&
      !["admin", "auditor", "strategy_finance"].includes(userRole)
    ) {
      router.replace("/unauthorized");
    }
  }, [loadingMe, userRole, router]);

  // Fetch all bills across all departments (no department filter)
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
          <h2 className="text-3xl font-bold tracking-tight">
            รายงานค่าใช้จ่ายทั้งหมด (ทุกหน่วยงาน)
          </h2>
          <p className="text-muted-foreground mt-1">
            ดูและติดตามสถานะใบแจ้งหนี้ค่าสาธารณูปโภคของทุกหน่วยงานในระบบ
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingEffect message="กำลังโหลดรายการบิลทั้งหมด..." />
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
