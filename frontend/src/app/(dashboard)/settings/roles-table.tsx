"use client";

import { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Shield,
  PlusCircle,
  Search,
  Edit2,
  Trash2,
  Users,
  Eye,
  Lock,
} from "lucide-react";
import {
  useListRoles,
  useDeleteRole,
  getListRolesQueryKey,
} from "@/lib/api/generated/roles/roles";
import type { RoleDTO } from "@/lib/api/generated/model";
import { RoleFormSheet } from "./role-form-sheet";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function RolesTable() {
  const queryClient = useQueryClient();
  const { data: rolesRes, isLoading, error } = useListRoles();
  const deleteMutation = useDeleteRole();

  const [searchTerm, setSearchTerm] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleDTO | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleDTO | null>(null);

  const roles = useMemo(() => {
    return Array.isArray(rolesRes?.data) ? rolesRes.data : [];
  }, [rolesRes]);

  const filteredRoles = useMemo(() => {
    if (!searchTerm.trim()) return roles;
    const term = searchTerm.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.description && r.description.toLowerCase().includes(term)) ||
        r.id.toLowerCase().includes(term),
    );
  }, [roles, searchTerm]);

  // Create a map from permission path to title
  const permTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of PERMISSION_GROUPS) {
      for (const item of group.items) {
        map.set(item.id, item.title);
        if (item.subPermissions) {
          for (const sub of item.subPermissions) {
            map.set(sub.id, `${item.title} (${sub.title})`);
          }
        }
      }
    }
    return map;
  }, []);

  const handleOpenCreate = () => {
    setSelectedRole(null);
    setSheetOpen(true);
  };

  const handleOpenEdit = (role: RoleDTO) => {
    setSelectedRole(role);
    setSheetOpen(true);
  };

  const handleOpenDelete = (role: RoleDTO) => {
    setRoleToDelete(role);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    try {
      await deleteMutation.mutateAsync({ id: roleToDelete.id });
      toast.success("ลบบทบาทเรียบร้อยแล้ว");
      await queryClient.invalidateQueries({
        queryKey: getListRolesQueryKey(),
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "ไม่สามารถลบบทบาทนี้ได้",
      );
    } finally {
      setDeleteConfirmOpen(false);
      setRoleToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar and search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อบทบาท หรือคำอธิบาย..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9.5 rounded-xl bg-card"
          />
        </div>

        <Button
          onClick={handleOpenCreate}
          className="h-9.5 gap-2 rounded-xl shrink-0"
        >
          <PlusCircle className="h-4 w-4" />
          <span>สร้างบทบาทใหม่</span>
        </Button>
      </div>

      {/* Roles Table */}
      <div className="rounded-2xl border bg-card/60 shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[240px]">ชื่อบทบาท (Role)</TableHead>
              <TableHead>คำอธิบาย</TableHead>
              <TableHead className="w-[180px]">สิทธิ์การเข้าถึง</TableHead>
              <TableHead className="w-[130px] text-center">ผู้ใช้งาน</TableHead>
              <TableHead className="w-[110px] text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  กำลังโหลดข้อมูลบทบาทและสิทธิ์...
                </TableCell>
              </TableRow>
            ) : filteredRoles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  {searchTerm
                    ? "ไม่พบบทบาทที่ตรงกับคำค้นหา"
                    : "ยังไม่มีบทบาทในระบบ กดปุ่ม 'สร้างบทบาทใหม่' เพื่อเริ่มต้น"}
                </TableCell>
              </TableRow>
            ) : (
              filteredRoles.map((r) => {
                const isAllAccess = Array.isArray(r.permissions) && r.permissions.includes("*");
                const permCount = isAllAccess
                  ? "เข้าถึงทุกหน้า"
                  : `${r.permissions?.length || 0} หน้า`;

                return (
                  <TableRow key={r.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {r.name}
                          </span>
                          {r.isSystem && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 gap-1 font-normal"
                            >
                              <Lock className="size-2.5" />
                              ระบบ
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] text-muted-foreground font-mono">
                            {r.id}
                          </code>
                          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-md">
                            <span>หน้าแรก:</span>
                            <span className="font-mono text-primary font-medium">{r.defaultPath || "/dashboard"}</span>
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground max-w-xs break-words">
                      {r.description || "-"}
                    </TableCell>

                    <TableCell>
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5 rounded-lg font-normal cursor-pointer"
                            >
                              <Shield className="size-3 text-primary" />
                              <span>{permCount}</span>
                              <Eye className="size-3 text-muted-foreground opacity-60" />
                            </Button>
                          }
                        />
                        <PopoverContent
                          className="w-80 p-3 rounded-2xl space-y-2 z-50 text-xs shadow-lg"
                          align="start"
                        >
                          <div className="font-semibold pb-1.5 border-b flex items-center justify-between">
                            <span>หน้าที่เข้าถึงได้ ({r.name})</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {isAllAccess ? "ทุกหน้า" : `${r.permissions?.length || 0} หน้า`}
                            </Badge>
                          </div>
                          {isAllAccess ? (
                            <p className="text-muted-foreground text-xs py-2">
                              สิทธิ์สูงสุด: สามารถเข้าถึงและจัดการได้ทุกหน้าและทุกฟังก์ชันในระบบ
                            </p>
                          ) : !r.permissions || r.permissions.length === 0 ? (
                            <p className="text-muted-foreground text-xs py-2">
                              ยังไม่ได้กำหนดสิทธิ์เข้าถึงหน้าใด
                            </p>
                          ) : (
                            <ul className="max-h-56 overflow-y-auto space-y-1 pr-1">
                              {(r.permissions || []).map((p) => (
                                <li
                                  key={p}
                                  className="flex items-center justify-between p-1.5 rounded-md bg-muted/50"
                                >
                                  <span className="font-medium text-foreground">
                                    {permTitleMap.get(p) || p}
                                  </span>
                                  <code className="text-[10px] text-muted-foreground font-mono">
                                    {p}
                                  </code>
                                </li>
                              ))}
                            </ul>
                          )}
                        </PopoverContent>
                      </Popover>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <Users className="size-3.5 text-muted-foreground" />
                        <span>{r.userCount} คน</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(r)}
                          className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                          title="แก้ไขบทบาท"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDelete(r)}
                          disabled={r.isSystem || r.userCount > 0}
                          className="size-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            r.isSystem
                              ? "ไม่สามารถลบบทบาทระบบได้"
                              : r.userCount > 0
                                ? `ไม่สามารถลบได้เนื่องจากมีผู้ใช้งาน ${r.userCount} คน`
                                : "ลบบทบาท"
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Role Form Sheet (Create / Edit) */}
      <RoleFormSheet
        role={selectedRole}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบบทบาท?</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบบทบาท{" "}
              <strong className="text-foreground">{roleToDelete?.name}</strong>{" "}
              ออกจากระบบใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
