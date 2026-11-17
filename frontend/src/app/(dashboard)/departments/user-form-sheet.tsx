"use client";

import { useState, useEffect, useMemo } from "react";
import { useListRoles } from "@/lib/api/generated/roles/roles";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DepartmentCombobox } from "@/components/ui/department-combobox";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateUser } from "@/lib/api/generated/users/users";
import type { DepartmentDTO, ManageUserDTO } from "@/lib/api/generated/model";
import { Loader2 } from "lucide-react";

export function UserFormSheet({
  user,
  department,
  departments = [],
  open,
  onOpenChange,
}: {
  user: ManageUserDTO;
  department: DepartmentDTO;
  departments?: DepartmentDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateUser();

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    user.departmentId || department.id,
  );
  const { data: rolesRes } = useListRoles();
  const availableRoles = useMemo(() => {
    if (Array.isArray(rolesRes?.data) && rolesRes.data.length > 0) {
      return rolesRes.data;
    }
    return [
      { id: "user", name: "ผู้ใช้งานทั่วไป" },
      { id: "admin", name: "ผู้ดูแลระบบ" },
      { id: "central_staff", name: "เจ้าหน้าที่ส่วนกลาง" },
      { id: "regional_staff", name: "เจ้าหน้าที่ภูมิภาค" },
      { id: "auditor", name: "ผู้ตรวจสอบภายใน (กตน.)" },
    ];
  }, [rolesRes]);
  const [role, setRole] = useState(user.role || "user");
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [errorEmail, setErrorEmail] = useState("");

  const isPendingVerification = !user.hasPassword && !user.banned;

  useEffect(() => {
    if (open) {
      setSelectedDepartmentId(user.departmentId || department.id);
      setRole(user.role || "user");
      setPhone(user.phone || "");
      setEmail(user.email || "");
      setErrorEmail("");
    }
  }, [open, user, department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPendingVerification) {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setErrorEmail("กรุณาระบุอีเมล");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setErrorEmail("รูปแบบอีเมลไม่ถูกต้อง (เช่น example@fisheries.go.th)");
        return;
      }
    }

    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: {
          email: isPendingVerification ? email.trim() : undefined,
          role,
          departmentId: selectedDepartmentId,
          phone: phone.trim() || undefined,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["/api/users"],
      });

      toast.success("อัปเดตข้อมูลผู้ใช้งานสำเร็จ");
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปเดตข้อมูล";
      toast.error(errorMsg);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-xl md:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-foreground">แก้ไขข้อมูลผู้ใช้</SheetTitle>
          <SheetDescription>
            แก้ไขข้อมูลสำหรับ {user.name} ({user.email})
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-foreground">
              สังกัดหน่วยงาน <span className="text-destructive">*</span>
            </Label>
            <DepartmentCombobox
              departments={departments}
              name="departmentId"
              value={selectedDepartmentId}
              onValueChange={setSelectedDepartmentId}
              placeholder="เลือกสังกัดหน่วยงาน..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email" className="text-foreground">
                อีเมล {isPendingVerification && <span className="text-destructive">*</span>}
              </Label>
              {isPendingVerification ? (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-medium"
                >
                  รอยืนยันอีเมล (แก้ไขได้)
                </Badge>
              ) : user.hasPassword ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20 text-[10px] font-medium"
                >
                  ตั้งรหัสผ่านแล้ว
                </Badge>
              ) : null}
            </div>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              disabled={!isPendingVerification}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorEmail && (!e.target.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim()))) {
                  setErrorEmail("");
                }
              }}
              onBlur={() => {
                if (isPendingVerification) {
                  const val = email.trim();
                  if (!val) {
                    setErrorEmail("กรุณาระบุอีเมล");
                  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    setErrorEmail("รูปแบบอีเมลไม่ถูกต้อง (เช่น example@fisheries.go.th)");
                  } else {
                    setErrorEmail("");
                  }
                }
              }}
              placeholder="เช่น user@fisheries.go.th"
              className={
                !isPendingVerification
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                  : errorEmail
                    ? "border-rose-500 ring-2 ring-rose-500/20"
                    : ""
              }
            />
            {errorEmail ? (
              <span className="text-xs text-destructive">{errorEmail}</span>
            ) : isPendingVerification ? (
              <span className="text-xs text-muted-foreground">
                สามารถแก้ไขอีเมลได้เนื่องจากผู้ใช้งานยังไม่ได้ตั้งรหัสผ่าน
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                ไม่สามารถแก้ไขอีเมลได้หลังจากผู้ใช้งานตั้งรหัสผ่านเรียบร้อยแล้ว
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="role" className="text-foreground">
              สิทธิ์การใช้งาน (Role)
            </Label>
            <Select value={role} onValueChange={(val) => val && setRole(val)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="เลือกสิทธิ์">
                  {availableRoles.find((r) => r.id === role)?.name || role}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone" className="text-foreground">
              เบอร์โทรศัพท์
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="02-XXX-XXXX หรือ 08X-XXX-XXXX"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="gap-2 shadow-xs"
            >
              {updateMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
