"use client";

import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  useListDepartments,
  useListDepartmentServices,
} from "@/lib/api/generated/departments/departments";
import { useListBudgetCodes } from "@/lib/api/generated/budgets/budgets";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { CreateBillForm } from "@/components/bills/create-bill-form";
import { LoadingEffect } from "@/components/ui/loading-effect";

function NewBillContent() {
  const searchParams = useSearchParams();
  const departmentIdParam = searchParams.get("departmentId") || undefined;
  const utilityTypeParam = searchParams.get("utilityType") || undefined;
  const serviceNumberParam = searchParams.get("serviceNumber") || undefined;
  const billingMonthParam = searchParams.get("billingMonth") || undefined;

  const initialValues = useMemo(() => {
    if (
      !departmentIdParam &&
      !utilityTypeParam &&
      !serviceNumberParam &&
      !billingMonthParam
    ) {
      return undefined;
    }
    return {
      departmentId: departmentIdParam,
      utilityType: utilityTypeParam,
      serviceNumber: serviceNumberParam,
      billingMonth: billingMonthParam,
    };
  }, [
    departmentIdParam,
    utilityTypeParam,
    serviceNumberParam,
    billingMonthParam,
  ]);

  const { data: deptRes, isLoading: loadingDept } = useListDepartments();
  const { data: servicesRes, isLoading: loadingServices } =
    useListDepartmentServices();
  const { data: budgetCodesRes, isLoading: loadingCodes } = useListBudgetCodes();
  const { data: meRes } = useGetCurrentUser();

  const departments = useMemo(
    () => (Array.isArray(deptRes?.data) ? deptRes.data : []),
    [deptRes],
  );
  const services = useMemo(
    () => (Array.isArray(servicesRes?.data) ? servicesRes.data : []),
    [servicesRes],
  );
  const budgetCodes = useMemo(
    () => (Array.isArray(budgetCodesRes?.data) ? budgetCodesRes.data : []),
    [budgetCodesRes],
  );
  const me = meRes?.status === 200 ? meRes.data : null;
  const defaultDepartmentId =
    initialValues?.departmentId ||
    me?.user?.departmentId ||
    departments[0]?.id ||
    "";

  if (loadingDept || loadingServices || loadingCodes) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดข้อมูลฟอร์มบันทึกค่าใช้จ่าย..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">เพิ่มรายการใหม่</h2>
      </div>
      <CreateBillForm
        departments={departments as any}
        services={services}
        budgetCodes={budgetCodes}
        defaultDepartmentId={defaultDepartmentId}
        initialValues={initialValues}
      />
    </div>
  );
}

export default function NewBillPage() {
  return (
    <Suspense
      fallback={
        <LoadingEffect
          fullScreen
          message="กำลังโหลดข้อมูลฟอร์มบันทึกค่าใช้จ่าย..."
          subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
        />
      }
    >
      <NewBillContent />
    </Suspense>
  );
}
