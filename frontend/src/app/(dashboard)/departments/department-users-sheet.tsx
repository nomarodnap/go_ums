"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Ban,
  CheckCircle,
  Plus,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateUser,
  useSendPasswordReset,
} from "@/lib/api/generated/users/users";
import type { DepartmentDTO, ManageUserDTO } from "@/lib/api/generated/model";
import { UserFormSheet } from "./user-form-sheet";
import { CreateUserSheet } from "./create-user-sheet";

export function DepartmentUsersSheet({
  department,
  departments = [],
  users,
  open,
  onOpenChange,
}: {
  department: DepartmentDTO;
  departments?: DepartmentDTO[];
  users: ManageUserDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateUser();
  const sendResetMutation = useSendPasswordReset();

  const [editingUser, setEditingUser] = useState<ManageUserDTO | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);

  const toggleBan = async (u: ManageUserDTO) => {
    const actionText = u.banned ? "ปลดระงับ" : "ระงับ";
    if (!confirm(`คุณต้องการ ${actionText} บัญชี ${u.name} หรือไม่?`)) return;

    try {
      await updateMutation.mutateAsync({
        id: u.id,
        data: { banned: !u.banned },
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/users"],
      });
      toast.success(`${actionText}บัญชีผู้ใช้เรียบร้อยแล้ว`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการปรับสถานะ";
      toast.error(errorMsg);
    }
  };

  const handleSendResetEmail = async (u: ManageUserDTO) => {
    setSendingEmailFor(u.id);
    try {
      const res = await sendResetMutation.mutateAsync({ id: u.id });
      if (res?.status === 200 && res.data?.message) {
        toast.success(res.data.message);
      } else {
        toast.success(`ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านไปยัง ${u.email} เรียบร้อยแล้ว`);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่อีกครั้ง";
      toast.error(errorMsg);
    } finally {
      setSendingEmailFor(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl" side="right">
        <SheetHeader className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <SheetTitle className="text-foreground">จัดการบัญชีผู้ใช้งาน</SheetTitle>
            <SheetDescription className="mt-1">
              บัญชีผู้ใช้งานที่สังกัด {department.fullName}
            </SheetDescription>
          </div>
          <Button onClick={() => setCreatingUser(true)} className="gap-2 shadow-xs shrink-0">
            <Plus className="size-4" /> เพิ่มผู้ใช้งาน
          </Button>
        </SheetHeader>

        <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ใช้งาน</TableHead>
                <TableHead>สิทธิ์ (Role)</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="w-[80px] text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-muted-foreground text-sm"
                  >
                    ไม่พบบัญชีผู้ใช้งานในหน่วยงานนี้
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`}
                          />
                          <AvatarFallback className="text-xs">
                            {u.name.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-foreground">{u.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs font-normal">
                        {u.role === "admin"
                          ? "ผู้ดูแลระบบ"
                          : u.role === "central_staff"
                            ? "จนท.ส่วนกลาง"
                            : u.role === "regional_staff"
                              ? "จนท.ภูมิภาค"
                              : u.role === "auditor"
                                ? "ผู้ตรวจสอบ"
                                : "ผู้ใช้งาน"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {u.banned ? (
                          <Badge
                            variant="secondary"
                            className="bg-destructive/10 text-destructive border-destructive/20 font-medium text-xs"
                          >
                            ถูกระงับ
                          </Badge>
                        ) : !u.hasPassword ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium text-xs"
                          >
                            รอยืนยันอีเมล
                          </Badge>
                        ) : (
                          <Badge
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-600 text-white font-medium text-xs shadow-xs"
                          >
                            ใช้งานปกติ
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" className="size-8 p-0 cursor-pointer rounded-lg hover:bg-black/5 dark:hover:bg-white/5" />
                          }
                        >
                          <span className="sr-only">เปิดเมนู</span>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>การจัดการ</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => setEditingUser(u)}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 size-4" /> แก้ไขข้อมูล/สิทธิ์
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSendResetEmail(u)}
                              disabled={sendingEmailFor === u.id}
                              className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600"
                            >
                              {sendingEmailFor === u.id ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                              ) : (
                                <Mail className="mr-2 size-4" />
                              )}
                              {sendingEmailFor === u.id
                                ? "กำลังส่งลิงก์..."
                                : "ส่งลิงก์ตั้งรหัสผ่าน"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className={`cursor-pointer ${!u.banned ? "text-destructive focus:text-destructive focus:bg-destructive/10" : "text-emerald-600 focus:text-emerald-600 focus:bg-emerald-600/10"}`}
                              onClick={() => toggleBan(u)}
                            >
                              {!u.banned ? (
                                <>
                                  <Ban className="mr-2 size-4" /> ระงับการใช้งาน
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 size-4" />{" "}
                                  เปิดใช้งาน
                                </>
                              )}
                            </DropdownMenuItem>
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

        {editingUser && (
          <UserFormSheet
            user={editingUser}
            department={department}
            departments={departments}
            open={!!editingUser}
            onOpenChange={(open) => {
              if (!open) setEditingUser(null);
            }}
          />
        )}

        {creatingUser && (
          <CreateUserSheet
            department={department}
            departments={departments}
            open={creatingUser}
            onOpenChange={setCreatingUser}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
