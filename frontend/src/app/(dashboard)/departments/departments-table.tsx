"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DepartmentFormSheet } from "./department-form-sheet";
import { DepartmentUsersSheet } from "./department-users-sheet";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Power,
  PowerOff,
  Edit,
  Users,
  Search,
  Building2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SortableHeader, useTableSort } from "@/components/ui/sortable-header";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { exportToExcel } from "@/lib/excel-export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useToggleDepartmentStatus } from "@/lib/api/generated/departments/departments";
import type {
  DepartmentDTO,
  DepartmentServiceDTO,
  ManageUserDTO,
} from "@/lib/api/generated/model";

export function DepartmentsTable({
  initialData = [],
  users = [],
  services = [],
  userRole = "admin",
}: {
  initialData: DepartmentDTO[];
  users: ManageUserDTO[];
  services?: DepartmentServiceDTO[];
  userRole?: string;
}) {
  const queryClient = useQueryClient();
  const toggleMutation = useToggleDepartmentStatus();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [editingDept, setEditingDept] = useState<DepartmentDTO | null>(null);
  const [selectedDeptForUsers, setSelectedDeptForUsers] =
    useState<DepartmentDTO | null>(null);
  const [deptToToggle, setDeptToToggle] = useState<DepartmentDTO | null>(null);

  const filteredData = initialData.filter((dept) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      term === "" ||
      (dept.fullName && dept.fullName.toLowerCase().includes(term)) ||
      (dept.shortName && dept.shortName.toLowerCase().includes(term)) ||
      (dept.costCenterCode &&
        dept.costCenterCode.toLowerCase().includes(term)) ||
      (dept.province && dept.province.toLowerCase().includes(term));

    const matchesType = typeFilter === "all" || dept.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? dept.isActive !== false : dept.isActive === false);

    return matchesSearch && matchesType && matchesStatus;
  });

  const { sortKey, sortOrder, handleSort, sortedData } = useTableSort(filteredData, {
    comparators: {
      costCenterCode: (a, b) => (a.costCenterCode || "").localeCompare(b.costCenterCode || "", "th", { numeric: true }),
      fullName: (a, b) => (a.fullName || "").localeCompare(b.fullName || "", "th"),
      type: (a, b) => (a.type || "").localeCompare(b.type || "", "th"),
      province: (a, b) => (a.province || "").localeCompare(b.province || "", "th"),
      phone: (a, b) => (a.phone || "").localeCompare(b.phone || "", "th", { numeric: true }),
      status: (a, b) => (a.isActive !== false ? 1 : 0) - (b.isActive !== false ? 1 : 0),
    },
  });

  const handleExportExcel = () => {
    exportToExcel({
      filename: `รายชื่อหน่วยงาน_กรมประมง`,
      sheetName: "หน่วยงาน",
      data: sortedData,
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1, width: 8 },
        { header: "รหัสศูนย์ต้นทุน", transform: (d) => d.costCenterCode || "-", width: 18 },
        { header: "ชื่อหน่วยงาน", key: "fullName", width: 35 },
        { header: "ชื่อย่อ", transform: (d) => d.shortName || "-", width: 18 },
        {
          header: "ระดับหน่วยงาน",
          transform: (d) =>
            d.type === "central"
              ? "ส่วนกลาง"
              : d.type === "regional"
                ? "ส่วนภูมิภาค"
                : d.type === "regional_central"
                  ? "ส่วนกลางที่มีสถานที่ตั้งอยู่ในส่วนภูมิภาค"
                  : d.type || "-",
          width: 32,
        },
        { header: "จังหวัด", transform: (d) => d.province || "-", width: 16 },
        { header: "เบอร์โทรศัพท์", transform: (d) => d.phone || "-", width: 18 },
        { header: "อีเมล", transform: (d) => d.email || "-", width: 25 },
        {
          header: "จำนวนบริการ/มิเตอร์",
          transform: (d) => services.filter((s) => s.departmentId === d.id).length,
          width: 20,
        },
        {
          header: "จำนวนผู้ใช้งาน",
          transform: (d) => users.filter((u) => u.departmentId === d.id).length,
          width: 16,
        },
        {
          header: "สถานะการใช้งาน",
          transform: (d) => (d.isActive !== false ? "ใช้งานอยู่" : "ระงับการใช้งาน"),
          width: 16,
        },
        {
          header: "วันที่ระงับ",
          transform: (d) => (d.suspendedAt ? d.suspendedAt.slice(0, 10) : "-"),
          width: 16,
        },
      ],
    });
  };

  const handleConfirmToggle = async () => {
    if (!deptToToggle) return;
    const willSuspend = deptToToggle.isActive !== false;

    try {
      await toggleMutation.mutateAsync({
        id: deptToToggle.id,
        data: { isActive: !willSuspend },
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/departments"],
      });
      toast.success(
        willSuspend ? "ระงับการใช้งานหน่วยงานสำเร็จ" : "เปิดใช้งานหน่วยงานสำเร็จ",
      );
      setDeptToToggle(null);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเปลี่ยนสถานะหน่วยงาน";
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="p-4 rounded-2xl bg-card/85 dark:bg-card/70 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อหน่วยงาน, ชื่อย่อ หรือรหัสศูนย์ต้นทุน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9.5 rounded-xl bg-background/60 text-xs"
            />
          </div>

          <div className="w-[180px]">
            <Select
              value={typeFilter}
              onValueChange={(val) => val && setTypeFilter(val)}
            >
              <SelectTrigger className="h-9.5 rounded-xl text-xs">
                <SelectValue placeholder="ระดับหน่วยงาน">
                  {typeFilter === "all"
                    ? "ทุกระดับหน่วยงาน"
                    : typeFilter === "central"
                      ? "ส่วนกลาง"
                      : typeFilter === "regional"
                        ? "ส่วนภูมิภาค"
                        : typeFilter === "regional_central"
                          ? "ส่วนกลางที่มีสถานที่ตั้งอยู่ในส่วนภูมิภาค"
                          : typeFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับหน่วยงาน</SelectItem>
                <SelectItem value="central">ส่วนกลาง</SelectItem>
                <SelectItem value="regional">ส่วนภูมิภาค</SelectItem>
                <SelectItem value="regional_central">ส่วนกลางที่มีสถานที่ตั้งอยู่ในส่วนภูมิภาค</SelectItem>
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
        </div>

        <div className="flex items-center gap-3 self-center shrink-0">
          <span className="text-xs text-muted-foreground">
            พบ {filteredData.length} จาก {initialData.length} หน่วยงาน
          </span>
          <ExportExcelButton
            onExport={handleExportExcel}
            disabled={sortedData.length === 0}
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                className="w-[160px]"
                sortKey="costCenterCode"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                รหัสศูนย์ต้นทุน
              </SortableHeader>
              <SortableHeader
                sortKey="fullName"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                ชื่อหน่วยงาน
              </SortableHeader>
              <SortableHeader
                className="w-[180px]"
                sortKey="type"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                ระดับหน่วยงาน
              </SortableHeader>
              <SortableHeader
                className="w-[130px]"
                sortKey="province"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                จังหวัด
              </SortableHeader>
              <SortableHeader
                className="w-[140px]"
                sortKey="phone"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                เบอร์โทรศัพท์
              </SortableHeader>
              <SortableHeader
                className="w-[130px]"
                sortKey="status"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                สถานะ
              </SortableHeader>
              <TableHead className="text-right w-[80px]">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-36 text-center text-muted-foreground text-sm"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Building2 className="size-8 text-muted-foreground/40" />
                    <span>ไม่พบข้อมูลหน่วยงานที่ตรงกับเงื่อนไขการค้นหา</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((dept) => (
                <TableRow key={dept.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <TableCell className="font-mono text-xs font-semibold text-foreground/90">
                    {dept.costCenterCode ? (
                      <span className="bg-muted/60 px-2 py-0.5 rounded-md border border-black/[0.04] dark:border-white/[0.06]">
                        {dept.costCenterCode}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground text-sm">{dept.fullName}</span>
                      {dept.shortName && (
                        <span className="text-xs text-muted-foreground">
                          {dept.shortName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {dept.type === "central"
                        ? "ส่วนกลาง"
                        : dept.type === "regional"
                          ? "ส่วนภูมิภาค"
                          : dept.type === "regional_central"
                            ? "ส่วนกลางที่มีสถานที่ตั้งอยู่ในส่วนภูมิภาค"
                            : "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground/80">{dept.province || "-"}</TableCell>
                  <TableCell className="text-xs text-foreground/80">{dept.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5",
                        dept.isActive !== false
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40"
                          : "bg-slate-50 text-slate-600 border-slate-200/80 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800/40",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          dept.isActive !== false
                            ? "bg-emerald-500"
                            : "bg-slate-400",
                        )}
                      />
                      {dept.isActive !== false ? "ใช้งานอยู่" : "ระงับการใช้งาน"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" className="size-8 p-0 cursor-pointer rounded-lg hover:bg-black/5 dark:hover:bg-white/5" />
                        }
                      >
                        <span className="sr-only">เปิดเมนู</span>
                        <MoreHorizontal className="size-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>การจัดการ</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setEditingDept(dept)}
                            className="cursor-pointer"
                          >
                            <Edit className="mr-2 size-4" /> แก้ไขข้อมูล
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setSelectedDeptForUsers(dept)}
                            className="cursor-pointer text-primary focus:text-primary"
                          >
                            <Users className="mr-2 size-4" /> จัดการบัญชีผู้ใช้งาน
                          </DropdownMenuItem>
                          {userRole === "admin" && (
                            <>
                              <DropdownMenuSeparator />
                              {dept.isActive !== false ? (
                                <DropdownMenuItem
                                  className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600 focus:bg-amber-500/10"
                                  onClick={() => setDeptToToggle(dept)}
                                >
                                  <PowerOff className="mr-2 size-4" /> ระงับการใช้งาน
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="cursor-pointer text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 focus:bg-emerald-500/10"
                                  onClick={() => setDeptToToggle(dept)}
                                >
                                  <Power className="mr-2 size-4" /> เปิดใช้งาน
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingDept && (
        <DepartmentFormSheet
          department={editingDept}
          departments={initialData}
          open={editingDept !== null}
          onOpenChange={(open) => !open && setEditingDept(null)}
        />
      )}

      {selectedDeptForUsers && (
        <DepartmentUsersSheet
          department={selectedDeptForUsers}
          departments={initialData}
          users={users.filter(
            (u) => u.departmentId === selectedDeptForUsers.id,
          )}
          open={!!selectedDeptForUsers}
          onOpenChange={(open) => {
            if (!open) setSelectedDeptForUsers(null);
          }}
        />
      )}

      {/* Toggle Department Status Confirmation */}
      <AlertDialog
        open={!!deptToToggle}
        onOpenChange={(open) => !open && setDeptToToggle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deptToToggle?.isActive !== false ? (
                <>
                  <PowerOff className="size-5 text-amber-600 dark:text-amber-400" />
                  ยืนยันการระงับการใช้งานหน่วยงาน
                </>
              ) : (
                <>
                  <Power className="size-5 text-emerald-600 dark:text-emerald-400" />
                  ยืนยันการเปิดใช้งานหน่วยงาน
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {deptToToggle?.isActive !== false ? (
                <>
                  คุณต้องการระงับการใช้งานหน่วยงาน{" "}
                  <span className="font-semibold text-foreground">
                    {deptToToggle?.fullName}
                  </span>{" "}
                  ใช่หรือไม่?
                  <br />
                  <span className="text-xs text-muted-foreground mt-2 block">
                    * ข้อมูลบิลในอดีต สถิติ และการตรวจสอบทั้งหมดจะยังคงอยู่ครบถ้วน ไม่สูญหาย และสามารถเปิดกลับมาใช้งานใหม่ได้ตลอดเวลา
                  </span>
                </>
              ) : (
                <>
                  คุณต้องการเปิดใช้งานหน่วยงาน{" "}
                  <span className="font-semibold text-foreground">
                    {deptToToggle?.fullName}
                  </span>{" "}
                  ใช่หรือไม่?
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
              className={cn(
                "cursor-pointer",
                deptToToggle?.isActive !== false
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white",
              )}
            >
              {toggleMutation.isPending && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              {deptToToggle?.isActive !== false ? "ยืนยันการระงับ" : "เปิดใช้งาน"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
