"use client";

import { useState } from "react";
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
import { useCreateUser } from "@/lib/api/generated/users/users";
import type { DepartmentDTO } from "@/lib/api/generated/model";
import { Loader2 } from "lucide-react";

export function CreateUserSheet({
  department,
  departments = [],
  open,
  onOpenChange,
}: {
  department: DepartmentDTO;
  departments?: DepartmentDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    department.id,
  );
  const [role, setRole] = useState("user");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) newErrors.name = "กรุณาระบุชื่อ-นามสกุล";
    if (!email.trim()) newErrors.email = "กรุณาระบุอีเมล";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    try {
      await createMutation.mutateAsync({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          departmentId: selectedDepartmentId || department.id,
          role,
          phone: phone.trim() || undefined,
          password: password ? password : undefined,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["/api/users"],
      });

      toast.success(
        "เพิ่มบัญชีผู้ใช้งานสำเร็จ! ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว",
      );
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างบัญชี";
      toast.error(errorMsg);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-foreground">เพิ่มบัญชีผู้ใช้งานใหม่</SheetTitle>
          <SheetDescription>
            สร้างบัญชีผู้ใช้งานสำหรับ {department.fullName}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">
              ชื่อ-นามสกุล <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              required
              placeholder="เช่น นายประมง รักษ์น้ำ"
              className={errors.name ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
            />
            {errors.name && (
              <span className="text-xs text-destructive">{errors.name}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">
              อีเมล (ใช้สำหรับเข้าสู่ระบบ) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value.trim()) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              required
              placeholder="email@fisheries.go.th"
              className={errors.email ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
            />
            {errors.email && (
              <span className="text-xs text-destructive">{errors.email}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>
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
            <Label htmlFor="role">
              สิทธิ์การใช้งาน (Role) <span className="text-destructive">*</span>
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
            <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="02-XXX-XXXX หรือ 08X-XXX-XXXX"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">กำหนดรหัสผ่านเบื้องต้น (เว้นว่างได้)</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="เว้นว่างเพื่อให้ผู้ใช้ตั้งรหัสผ่านเอง"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="gap-2 shadow-xs"
            >
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {createMutation.isPending ? "กำลังบันทึก..." : "เพิ่มบัญชี"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
