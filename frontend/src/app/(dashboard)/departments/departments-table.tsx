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
import { DepartmentServicesSheet } from "./department-services-sheet";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Trash2,
  Edit,
  Users,
  Receipt,
  Search,
  Building2,
  Loader2,
} from "lucide-react";
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
import { useDeleteDepartment } from "@/lib/api/generated/departments/departments";
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
  const deleteMutation = useDeleteDepartment();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [editingDept, setEditingDept] = useState<DepartmentDTO | null>(null);
  const [selectedDeptForUsers, setSelectedDeptForUsers] =
    useState<DepartmentDTO | null>(null);
  const [selectedDeptForServices, setSelectedDeptForServices] =
    useState<DepartmentDTO | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<DepartmentDTO | null>(null);

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

    return matchesSearch && matchesType;
  });

  const handleConfirmDelete = async () => {
    if (!deptToDelete) return;

    try {
      await deleteMutation.mutateAsync({ id: deptToDelete.id });
      await queryClient.invalidateQueries({
        queryKey: ["/api/departments"],
      });
      toast.success("ลบหน่วยงานสำเร็จ");
      setDeptToDelete(null);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบหน่วยงาน";
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
                <SelectValue placeholder="ประเภทหน่วยงาน">
                  {typeFilter === "all"
                    ? "ทุกประเภทหน่วยงาน"
                    : typeFilter === "central"
                      ? "ส่วนกลาง"
                      : typeFilter === "regional"
                        ? "ส่วนภูมิภาค"
                        : typeFilter === "regional_central"
                          ? "ส่วนกลางในภูมิภาค"
                          : typeFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภทหน่วยงาน</SelectItem>
                <SelectItem value="central">ส่วนกลาง</SelectItem>
                <SelectItem value="regional">ส่วนภูมิภาค</SelectItem>
                <SelectItem value="regional_central">ส่วนกลางในภูมิภาค</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground self-center shrink-0">
          พบ {filteredData.length} จาก {initialData.length} หน่วยงาน
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">รหัสศูนย์ต้นทุน</TableHead>
              <TableHead>ชื่อหน่วยงาน</TableHead>
              <TableHead className="w-[150px]">ประเภท</TableHead>
              <TableHead className="w-[130px]">จังหวัด</TableHead>
              <TableHead className="w-[140px]">เบอร์โทรศัพท์</TableHead>
              <TableHead className="text-right w-[80px]">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-36 text-center text-muted-foreground text-sm"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Building2 className="size-8 text-muted-foreground/40" />
                    <span>ไม่พบข้อมูลหน่วยงานที่ตรงกับเงื่อนไขการค้นหา</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((dept) => (
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
                            ? "ส่วนกลางในภูมิภาค"
                            : "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground/80">{dept.province || "-"}</TableCell>
                  <TableCell className="text-xs text-foreground/80">{dept.phone || "-"}</TableCell>
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
                          <DropdownMenuItem
                            onClick={() => setSelectedDeptForServices(dept)}
                            className="cursor-pointer text-blue-600 dark:text-blue-400 focus:text-blue-600"
                          >
                            <Receipt className="mr-2 size-4" /> จัดการหมายเลขผู้ใช้
                          </DropdownMenuItem>
                          {userRole === "admin" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => setDeptToDelete(dept)}
                              >
                                <Trash2 className="mr-2 size-4" /> ลบหน่วยงาน
                              </DropdownMenuItem>
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

      {selectedDeptForServices && (
        <DepartmentServicesSheet
          department={selectedDeptForServices}
          services={services.filter(
            (s) => s.departmentId === selectedDeptForServices.id,
          )}
          open={!!selectedDeptForServices}
          onOpenChange={(open) => {
            if (!open) setSelectedDeptForServices(null);
          }}
        />
      )}

      {/* Delete Department Confirmation */}
      <AlertDialog
        open={!!deptToDelete}
        onOpenChange={(open) => !open && setDeptToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบหน่วยงาน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบหน่วยงาน{" "}
              <span className="font-semibold text-foreground">
                {deptToDelete?.fullName}
              </span>
              ? การลบนี้อาจส่งผลกระทบต่อรายการบิล หมายเลขผู้ใช้ และบัญชีผู้ใช้งานที่สังกัดหน่วยงานนี้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
