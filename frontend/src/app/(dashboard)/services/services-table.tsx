"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Ban,
  CheckCircle2,
  Zap,
  Droplet,
  Phone,
  Wifi,
  Mail,
  Edit,
  Radio,
  Loader2,
  Building2,
  X,
} from "lucide-react";
import { SortableHeader, useTableSort } from "@/components/ui/sortable-header";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { exportToExcel } from "@/lib/excel-export";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useToggleDepartmentServiceStatus } from "@/lib/api/generated/departments/departments";
import type {
  DepartmentDTO,
  DepartmentServiceDTO,
} from "@/lib/api/generated/model";
import { ServiceFormSheet } from "./service-form-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ServicesTable({
  services,
  departments,
  userRole,
  userDepartmentId,
  initialDepartmentId,
  scope = "all",
}: {
  services: DepartmentServiceDTO[];
  departments: DepartmentDTO[];
  userRole: string;
  userDepartmentId: string | null;
  initialDepartmentId?: string | null;
  scope?: "my_dept" | "all";
}) {
  const queryClient = useQueryClient();
  const toggleMutation = useToggleDepartmentServiceStatus();

  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(scope === "all" ? initialDepartmentId || "all" : "all");
  const [utilityFilter, setUtilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<DepartmentServiceDTO | null>(null);
  const [serviceToToggle, setServiceToToggle] = useState<DepartmentServiceDTO | null>(null);

  useEffect(() => {
    if (scope === "all" && initialDepartmentId) {
      setDepartmentFilter(initialDepartmentId);
    }
  }, [scope, initialDepartmentId]);

  const selectedDeptName = useMemo(() => {
    if (departmentFilter === "all") return null;
    const dept = departments.find((d) => d.id === departmentFilter);
    if (dept) return dept.fullName || dept.shortName || departmentFilter;
    const serviceMatch = services.find((s) => s.departmentId === departmentFilter);
    if (serviceMatch) return serviceMatch.departmentName || departmentFilter;
    return departmentFilter;
  }, [departmentFilter, departments, services]);

  // Extract unique utility types from actual data
  const availableUtilityTypes = Array.from(
    new Set(services.map((s) => s.utilityType).filter(Boolean)),
  );

  const filteredServices = services.filter((s) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      searchTerm === "" ||
      (s.departmentName || "").toLowerCase().includes(searchLower) ||
      s.serviceNumber.toLowerCase().includes(searchLower) ||
      s.provider.toLowerCase().includes(searchLower) ||
      (s.phoneOwnerName || "").toLowerCase().includes(searchLower) ||
      (s.phoneOwnerPosition || "").toLowerCase().includes(searchLower) ||
      (s.phoneOwnerDivision || "").toLowerCase().includes(searchLower) ||
      (s.locationType || "").toLowerCase().includes(searchLower);

    const matchesDepartment =
      scope === "my_dept" ||
      departmentFilter === "all" ||
      s.departmentId === departmentFilter;

    const matchesUtility =
      utilityFilter === "all" || s.utilityType === utilityFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? s.isActive !== false : s.isActive === false);

    return matchesSearch && matchesDepartment && matchesUtility && matchesStatus;
  });

  const { sortKey, sortOrder, handleSort, sortedData } = useTableSort(filteredServices, {
    comparators: {
      department: (a, b) => (a.departmentName || "").localeCompare(b.departmentName || "", "th"),
      utilityType: (a, b) => `${a.utilityType || ""} ${a.provider || ""}`.localeCompare(`${b.utilityType || ""} ${b.provider || ""}`, "th"),
      serviceNumber: (a, b) => (a.serviceNumber || "").localeCompare(b.serviceNumber || "", "th", { numeric: true }),
      location: (a, b) => `${a.locationType || ""} ${a.phoneOwnerName || ""}`.localeCompare(`${b.locationType || ""} ${b.phoneOwnerName || ""}`, "th"),
      status: (a, b) => (a.isActive !== false ? 1 : 0) - (b.isActive !== false ? 1 : 0),
    },
  });

  const handleExportExcel = () => {
    exportToExcel({
      filename: `รายการบริการสาธารณูปโภค_${scope === "all" ? "ทั้งหมด" : "หน่วยงาน"}`,
      sheetName: "บริการ",
      data: sortedData,
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1, width: 8 },
        { header: "หน่วยงาน", transform: (s) => s.departmentName || "-", width: 28 },
        { header: "ประเภทสาธารณูปโภค", key: "utilityType", width: 20 },
        { header: "ผู้ให้บริการ", key: "provider", width: 18 },
        { header: "หมายเลขผู้ใช้/เครื่องวัด", key: "serviceNumber", width: 22 },
        { header: "สถานที่ตั้ง/ประเภทจุดติดตั้ง", transform: (s) => s.locationType || "-", width: 25 },
        { header: "ชื่อผู้ถือครองสาย", transform: (s) => s.phoneOwnerName || "-", width: 22 },
        { header: "ตำแหน่ง", transform: (s) => s.phoneOwnerPosition || "-", width: 20 },
        { header: "ฝ่าย/กลุ่ม", transform: (s) => s.phoneOwnerDivision || "-", width: 20 },
        {
          header: "วงเงินเบิกจ่าย (บาท)",
          transform: (s) => (s.phoneReimbursementLimit ? Number(s.phoneReimbursementLimit) : "-"),
          width: 18,
        },
        {
          header: "สถานะการใช้งาน",
          transform: (s) => (s.isActive !== false ? "ใช้งานอยู่" : "ระงับการใช้งาน"),
          width: 16,
        },
        {
          header: "วันที่ระงับ",
          transform: (s) => (s.suspendedAt ? s.suspendedAt.slice(0, 10) : "-"),
          width: 16,
        },
      ],
    });
  };

  const getUtilityIcon = (type: string) => {
    switch (type) {
      case "ค่าไฟฟ้า":
        return <Zap className="h-4 w-4 text-amber-500 shrink-0" />;
      case "ค่าน้ำประปา":
      case "ค่าประปา&น้ำบาดาล":
        return <Droplet className="h-4 w-4 text-blue-500 shrink-0" />;
      case "ค่าโทรศัพท์":
        return <Phone className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "ค่าอินเทอร์เน็ต":
      case "ค่าสื่อสาร&โทรคมนาคม":
        return <Wifi className="h-4 w-4 text-purple-500 shrink-0" />;
      case "ค่าไปรษณีย์":
      case "ค่าบริการไปรษณีย์":
        return <Mail className="h-4 w-4 text-rose-500 shrink-0" />;
      default:
        return <Radio className="h-4 w-4 text-primary shrink-0" />;
    }
  };

  const handleConfirmToggle = async () => {
    if (!serviceToToggle) return;
    const willSuspend = serviceToToggle.isActive !== false;
    try {
      await toggleMutation.mutateAsync({
        id: serviceToToggle.id,
        data: { isActive: !willSuspend },
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/departments/services"],
      });
      toast.success(
        willSuspend ? "ระงับการใช้งานสำเร็จ" : "เปิดใช้งานสำเร็จ",
      );
      setServiceToToggle(null);
    } catch (err: unknown) {
      const errorData = err as {
        detail?: string;
        message?: string;
        title?: string;
      };
      const errorMsg =
        errorData?.detail ||
        errorData?.message ||
        errorData?.title ||
        (err instanceof Error
          ? err.message
          : "เกิดข้อผิดพลาดในการปรับเปลี่ยนสถานะ");
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Dropdown Filter Bar */}
      <div className="p-4 rounded-2xl bg-card/85 dark:bg-card/70 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาหน่วยงาน, รหัสเครื่องวัด, ชื่อเจ้าของ..."
              className="pl-9 h-9.5 rounded-xl bg-background/60 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="w-[190px]">
            <Select
              value={utilityFilter}
              onValueChange={(val) => val && setUtilityFilter(val)}
            >
              <SelectTrigger className="h-9.5 rounded-xl text-xs">
                <SelectValue placeholder="ประเภทสาธารณูปโภค">
                  {utilityFilter === "all"
                    ? "ทุกประเภทสาธารณูปโภค"
                    : utilityFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภทสาธารณูปโภค</SelectItem>
                {availableUtilityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[150px]">
            <Select
              value={statusFilter}
              onValueChange={(val) =>
                val && setStatusFilter(val as "all" | "active" | "inactive")
              }
            >
              <SelectTrigger className="h-9.5 rounded-xl text-xs">
                <SelectValue placeholder="สถานะ">
                  {statusFilter === "all"
                    ? "สถานะทั้งหมด"
                    : statusFilter === "active"
                      ? "ใช้งานอยู่"
                      : "ระงับการใช้งาน"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="active">ใช้งานอยู่</SelectItem>
                <SelectItem value="inactive">ระงับการใช้งาน</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "all" && departmentFilter !== "all" && (
            <Badge
              variant="secondary"
              className="gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary border border-primary/20 shrink-0 self-start sm:self-center"
            >
              <Building2 className="size-3.5" />
              <span>กรองตามหน่วยงาน: {selectedDeptName}</span>
              <button
                type="button"
                onClick={() => setDepartmentFilter("all")}
                className="ml-1 hover:text-destructive cursor-pointer inline-flex items-center"
                title="ล้างตัวกรองหน่วยงาน"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          <span className="text-xs text-muted-foreground">
            พบ {filteredServices.length} จาก {services.length} รายการ
          </span>
          <ExportExcelButton
            onExport={handleExportExcel}
            disabled={sortedData.length === 0}
          />
          {scope === "all" && (
            <Button
              onClick={() => {
                setServiceToEdit(null);
                setIsFormOpen(true);
              }}
              className="shrink-0 gap-1.5 shadow-xs"
            >
              <Plus className="size-4" /> เพิ่มรายการใหม่
            </Button>
          )}
        </div>
      </div>

      {/* Services Table Card */}
      <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-2xl bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {scope === "all" && (
                <SortableHeader
                  sortKey="department"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  หน่วยงาน
                </SortableHeader>
              )}
              <SortableHeader
                sortKey="utilityType"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                ประเภท / ผู้ให้บริการ
              </SortableHeader>
              <SortableHeader
                sortKey="serviceNumber"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                รหัสเครื่องวัด / หมายเลขผู้ใช้
              </SortableHeader>
              <SortableHeader
                sortKey="location"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                สถานที่ / ผู้ใช้งาน
              </SortableHeader>
              <SortableHeader
                className="w-[120px]"
                sortKey="status"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                สถานะ
              </SortableHeader>
              {scope === "all" && <TableHead className="text-right">จัดการ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={scope === "all" ? 6 : 4}
                  className="text-center py-12 text-muted-foreground text-sm"
                >
                  ไม่พบข้อมูลที่ตรงกับเงื่อนไข
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((service) => (
                <TableRow
                  key={service.id}
                  className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                >
                  {scope === "all" && (
                    <TableCell className="font-medium text-foreground text-xs sm:text-sm">
                      {service.departmentName || "ไม่ทราบหน่วยงาน"}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/90">
                        {getUtilityIcon(service.utilityType)}
                        <span>{service.utilityType}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {service.provider}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-semibold text-foreground/90 bg-muted/60 px-2 py-0.5 rounded-md border border-black/[0.04] dark:border-white/[0.06]">
                      {service.serviceNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {service.locationType && (
                        <span className="text-muted-foreground">
                          {service.locationType}
                        </span>
                      )}
                      {service.phoneOwnerName && (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {service.phoneOwnerName}
                            {service.phoneOwnerPosition && (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                ({service.phoneOwnerPosition})
                              </span>
                            )}
                          </span>
                          {service.phoneOwnerDivision && (
                            <span className="text-muted-foreground/80 font-normal text-[11px]">
                              {service.phoneOwnerDivision}
                            </span>
                          )}
                        </div>
                      )}
                      {service.phoneReimbursementLimit != null && (
                        <span className="text-[11px] text-primary font-medium">
                          วงเงินเบิก: ฿
                          {service.phoneReimbursementLimit.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {service.isActive !== false ? (
                      <Badge
                        variant="outline"
                        className="text-xs font-normal border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                      >
                        ใช้งานอยู่
                      </Badge>
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        <Badge
                          variant="outline"
                          className="text-xs font-normal border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                        >
                          ระงับการใช้งาน
                        </Badge>
                        {service.suspendedAt && (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            ระงับเมื่อ:{" "}
                            {new Date(service.suspendedAt).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  {scope === "all" && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setServiceToEdit(service);
                            setIsFormOpen(true);
                          }}
                          className="size-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          title="แก้ไข"
                        >
                          <Edit className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        {service.isActive !== false ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={
                              toggleMutation.isPending &&
                              serviceToToggle?.id === service.id
                            }
                            onClick={() => setServiceToToggle(service)}
                            className="size-8 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                            title="ระงับการใช้งาน"
                          >
                            <Ban className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={
                              toggleMutation.isPending &&
                              serviceToToggle?.id === service.id
                            }
                            onClick={() => setServiceToToggle(service)}
                            className="size-8 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                            title="เปิดใช้งาน"
                          >
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit/Add Sheet */}
      <ServiceFormSheet
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setTimeout(() => setServiceToEdit(null), 300);
        }}
        departments={departments}
        userRole={userRole}
        userDepartmentId={userDepartmentId}
        serviceToEdit={serviceToEdit}
        existingServices={services}
        scope={scope}
      />

      {/* Suspend / Reactivate Confirmation Dialog */}
      <AlertDialog
        open={!!serviceToToggle}
        onOpenChange={(open) => !open && setServiceToToggle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {serviceToToggle?.isActive !== false
                ? "ยืนยันการระงับการใช้งาน"
                : "ยืนยันการเปิดใช้งาน"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {serviceToToggle?.isActive !== false ? (
                <>
                  คุณแน่ใจหรือไม่ที่จะระงับการใช้งานรายการรหัสเครื่องวัด / หมายเลขผู้ใช้หมายเลข{" "}
                  <span className="font-semibold text-foreground">
                    {serviceToToggle?.serviceNumber}
                  </span>{" "}
                  ({serviceToToggle?.utilityType} - {serviceToToggle?.provider})?
                  รายการนี้จะไม่ถูกนำไปใช้ในการออกบิลใหม่ แต่ประวัติในอดีตจะยังคงอยู่
                </>
              ) : (
                <>
                  คุณต้องการเปิดใช้งานรายการรหัสเครื่องวัด / หมายเลขผู้ใช้หมายเลข{" "}
                  <span className="font-semibold text-foreground">
                    {serviceToToggle?.serviceNumber}
                  </span>{" "}
                  ({serviceToToggle?.utilityType} - {serviceToToggle?.provider}) อีกครั้งหรือไม่?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleMutation.isPending}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              disabled={toggleMutation.isPending}
              className={
                serviceToToggle?.isActive !== false
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }
            >
              {toggleMutation.isPending && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              {serviceToToggle?.isActive !== false
                ? "ระงับการใช้งาน"
                : "เปิดใช้งาน"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
