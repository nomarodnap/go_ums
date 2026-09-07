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
import {
  useCreateDepartment,
  useUpdateDepartment,
} from "@/lib/api/generated/departments/departments";
import type { DepartmentDTO } from "@/lib/api/generated/model";
import { Loader2 } from "lucide-react";

export function DepartmentFormSheet({
  department,
  departments = [],
  open,
  onOpenChange,
}: {
  department?: DepartmentDTO | null;
  departments?: DepartmentDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();

  const [costCenterCode, setCostCenterCode] = useState("");
  const [type, setType] = useState("");
  const [fullName, setFullName] = useState("");
  const [shortName, setShortName] = useState("");
  const [province, setProvince] = useState("");
  const [depositUnit, setDepositUnit] = useState("");
  const [phone, setPhone] = useState("");
  const [errorFullName, setErrorFullName] = useState("");

  useEffect(() => {
    if (open) {
      setCostCenterCode(department?.costCenterCode || "");
      setType(department?.type || "");
      setFullName(department?.fullName || "");
      setShortName(department?.shortName || "");
      setProvince(department?.province || "");
      setDepositUnit(department?.depositUnit || "");
      setPhone(department?.phone || "");
      setErrorFullName("");
    }
  }, [open, department]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorFullName("กรุณาระบุชื่อหน่วยงาน (เต็ม)");
      return;
    }
    setErrorFullName("");

    const payload = {
      costCenterCode: costCenterCode.trim() || undefined,
      type: type || undefined,
      fullName: fullName.trim(),
      shortName: shortName.trim() || undefined,
      province: province.trim() || undefined,
      depositUnit: depositUnit || undefined,
      phone: phone.trim() || undefined,
    };

    try {
      if (department?.id) {
        await updateMutation.mutateAsync({
          id: department.id,
          data: payload,
        });
      } else {
        await createMutation.mutateAsync({
          data: payload,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["/api/departments"],
      });

      toast.success(department ? "แก้ไขข้อมูลหน่วยงานสำเร็จ" : "เพิ่มหน่วยงานใหม่สำเร็จ");
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      toast.error(errorMsg);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-foreground">
            {department ? "แก้ไขข้อมูลหน่วยงาน" : "เพิ่มหน่วยงานใหม่"}
          </SheetTitle>
          <SheetDescription>
            กรอกข้อมูลรายละเอียดของหน่วยงานสังกัดกรมประมง
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="costCenterCode">รหัสศูนย์ต้นทุน</Label>
              <Input
                id="costCenterCode"
                value={costCenterCode}
                onChange={(e) => setCostCenterCode(e.target.value)}
                placeholder="เช่น 0700400000"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">ประเภทหน่วยงาน</Label>
              <Select value={type} onValueChange={(val) => setType(val || "")}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="-- เลือกประเภท --">
                    {type === "central"
                      ? "ส่วนกลาง"
                      : type === "regional_central"
                        ? "ส่วนกลางในภูมิภาค"
                        : type === "regional"
                          ? "ส่วนภูมิภาค"
                          : "-- เลือกประเภท --"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="central">ส่วนกลาง</SelectItem>
                  <SelectItem value="regional_central">ส่วนกลางในภูมิภาค</SelectItem>
                  <SelectItem value="regional">ส่วนภูมิภาค</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName" className="text-foreground">
              ชื่อหน่วยงาน (เต็ม) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (e.target.value.trim()) setErrorFullName("");
              }}
              placeholder="เช่น สำนักบริหารกลาง กรมประมง"
              className={errorFullName ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
            />
            {errorFullName && (
              <span className="text-xs text-destructive">{errorFullName}</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="shortName">ชื่อย่อ</Label>
              <Input
                id="shortName"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="เช่น สบก."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="province">จังหวัด</Label>
              <Input
                id="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="เช่น กรุงเทพมหานคร"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="depositUnit">รหัสหน่วยรับฝาก</Label>
            <DepartmentCombobox
              departments={departments}
              name="depositUnit"
              value={depositUnit}
              onValueChange={setDepositUnit}
              placeholder="ระบุหน่วยรับฝาก..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">เบอร์โทรศัพท์ (สำนักงาน)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="เช่น 02-562-0600"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2 shadow-xs">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
