"use client";

import { useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useListBills } from "@/lib/api/generated/bills/bills";
import { useListDepartmentServices } from "@/lib/api/generated/departments/departments";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { BillsTable } from "../bills/bills-table";
import { LoadingEffect } from "@/components/ui/loading-effect";

function AllBillsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const departmentIdParam = searchParams.get("departmentId");
  const statusParam = searchParams.get("status");
  const anomalyParam = searchParams.get("anomaly");
  const queryParam = searchParams.get("q");

  const { data: meRes, isLoading: loadingMe } = useGetCurrentUser();
  const me = meRes?.status === 200 ? meRes.data.user : null;
  const userRole = me?.role;
  const userPermissions = me?.permissions;

  useEffect(() => {
    if (
      !loadingMe &&
      userRole &&
      !["admin", "auditor", "strategy_finance"].includes(userRole)
    ) {
      router.replace("/unauthorized");
    }
  }, [loadingMe, userRole, router]);

  // Fetch all bills across all departments (no department filter at API level to allow switching/clearing)
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

  if (isLoading) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดรายการบิลทั้งหมด (ทุกหน่วยงาน)..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

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

      <BillsTable
        initialData={bills as any}
        services={services as any}
        showAuditStatus={true}
        userRole={userRole}
        userPermissions={userPermissions}
        pagePath="/all-bills"
        initialSearchTerm={queryParam}
        initialDepartmentId={departmentIdParam}
        initialStatusFilter={statusParam}
        initialAnomalyFilter={anomalyParam}
        disableDrawer={true}
      />
    </div>
  );
}

export default function AllBillsPage() {
  return (
    <Suspense
      fallback={
        <LoadingEffect
          fullScreen
          message="กำลังโหลดรายการบิลทั้งหมด..."
          subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
        />
      }
    >
      <AllBillsContent />
    </Suspense>
  );
}
