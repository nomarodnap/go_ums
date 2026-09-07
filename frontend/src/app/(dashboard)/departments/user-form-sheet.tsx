"use client";

import { useState, useEffect } from "react";
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
  const [role, setRole] = useState(user.role || "user");
  const [phone, setPhone] = useState(user.phone || "");

  useEffect(() => {
    if (open) {
      setSelectedDepartmentId(user.departmentId || department.id);
      setRole(user.role || "user");
      setPhone(user.phone || "");
    }
  }, [open, user, department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: {
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
      <SheetContent className="overflow-y-auto sm:max-w-md">
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
            <Label htmlFor="role" className="text-foreground">
              สิทธิ์การใช้งาน (Role)
            </Label>
            <Select value={role} onValueChange={(val) => val && setRole(val)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="เลือกสิทธิ์">
                  {role === "user"
                    ? "ผู้ใช้งานทั่วไป (User)"
                    : role === "admin"
                      ? "ผู้ดูแลระบบ (Admin)"
                      : role === "central_staff"
                        ? "เจ้าหน้าที่ส่วนกลาง (Central Staff)"
                        : role === "regional_staff"
                          ? "เจ้าหน้าที่ภูมิภาค (Regional Staff)"
                          : role === "auditor"
                            ? "ผู้ตรวจสอบ (Auditor)"
                            : role}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">ผู้ใช้งานทั่วไป (User)</SelectItem>
                <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                <SelectItem value="central_staff">เจ้าหน้าที่ส่วนกลาง (Central Staff)</SelectItem>
                <SelectItem value="regional_staff">เจ้าหน้าที่ภูมิภาค (Regional Staff)</SelectItem>
                <SelectItem value="auditor">ผู้ตรวจสอบ (Auditor)</SelectItem>
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
