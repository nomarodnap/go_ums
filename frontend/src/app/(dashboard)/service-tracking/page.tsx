"use client";

import { useState, useMemo, useEffect } from "react";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { useListDepartments } from "@/lib/api/generated/departments/departments";
import { DepartmentServicesStatusSection } from "@/components/dashboard/department-services-status-section";
import { DepartmentCombobox } from "@/components/ui/department-combobox";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

export default function ServiceTrackingPage() {
  const { data: userData, isLoading: isUserLoading } = useGetCurrentUser();
  const user = userData?.status === 200 ? userData.data.user : null;

  const isAdminOrStaff = [
    "admin",
    "auditor",
    "strategy_finance",
    "central_staff",
  ].includes(user?.role || "");

  // Fetch departments list for admins/staff to allow switching departments
  const { data: deptRes, isLoading: isDeptLoading } = useListDepartments();
  const departments = useMemo(
    () => (Array.isArray(deptRes?.data) ? deptRes.data : []),
    [deptRes]
  );

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");

  useEffect(() => {
    if (!selectedDepartmentId) {
      if (user?.departmentId) {
        setSelectedDepartmentId(user.departmentId);
      } else if (departments.length > 0) {
        setSelectedDepartmentId(departments[0].id);
      }
    }
  }, [user?.departmentId, departments, selectedDepartmentId]);

  const activeDepartment = useMemo(() => {
    return departments.find((d) => d.id === selectedDepartmentId);
  }, [departments, selectedDepartmentId]);

  const activeDepartmentName =
    activeDepartment?.fullName || user?.departmentName || "หน่วยงานของคุณ";

  if (isUserLoading || (isAdminOrStaff && isDeptLoading && departments.length === 0)) {
    return (
      <LoadingEffect
        fullScreen
        message="กำลังโหลดข้อมูลสถานะรหัสเครื่องวัด..."
        subMessage="ระบบรายงานค่าสาธารณูปโภค 292 หน่วยงาน กรมประมง"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              สถานะตามรหัสเครื่องวัด / หมายเลขผู้ใช้
            </h1>
            <Badge variant="secondary" className="font-normal text-xs">
              ติดตามขั้นตอน
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
            <span>การดำเนินงานของแต่ละหมายเลขและมิเตอร์ในสังกัด —</span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Building2 className="size-3.5 text-primary shrink-0" />
              {activeDepartmentName}
            </span>
          </p>
        </div>

        {/* Department Switcher for Admin / Auditor / Staff */}
        {isAdminOrStaff && departments.length > 0 && (
          <div className="w-full sm:w-[320px] self-start sm:self-auto">
            <DepartmentCombobox
              departments={departments}
              value={selectedDepartmentId}
              onValueChange={(val) => {
                if (val) setSelectedDepartmentId(val);
              }}
              placeholder="เลือกหรือค้นหาหน่วยงาน..."
              className="h-9 bg-card text-xs sm:text-sm shadow-xs"
            />
          </div>
        )}
      </div>

      {/* Main Section */}
      <DepartmentServicesStatusSection
        departmentId={selectedDepartmentId || user?.departmentId || undefined}
        departmentName={activeDepartmentName}
      />
    </div>
  );
}

