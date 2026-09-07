"use client";

import { useMemo } from "react";
import {
  useListDepartments,
  useListDepartmentServices,
} from "@/lib/api/generated/departments/departments";
import { useListBudgetCodes } from "@/lib/api/generated/budgets/budgets";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { CreateBillForm } from "@/components/bills/create-bill-form";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function NewBillPage() {
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
    me?.user?.departmentId || departments[0]?.id || "";

  if (loadingDept || loadingServices || loadingCodes) {
    return (
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">เพิ่มรายการใหม่</h2>
        </div>
        <Card className="max-w-3xl mx-auto border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">กำลังโหลดข้อมูลฟอร์มบันทึกค่าใช้จ่าย...</p>
          </CardContent>
        </Card>
      </div>
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
      />
    </div>
  );
}
