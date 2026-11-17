"use client";

import { useState, useEffect, useMemo } from "react";
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
import { ProvinceCombobox } from "@/components/ui/province-combobox";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateDepartment,
  useUpdateDepartment,
} from "@/lib/api/generated/departments/departments";
import type { DepartmentDTO } from "@/lib/api/generated/model";
import { Loader2, Building2, CreditCard, Mail } from "lucide-react";

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

  const [unitType, setUnitType] = useState<"disbursing" | "deposit" | "">("");
  const [costCenterCode, setCostCenterCode] = useState("");
  const [type, setType] = useState("");
  const [fullName, setFullName] = useState("");
  const [shortName, setShortName] = useState("");
  const [division, setDivision] = useState("");
  const [province, setProvince] = useState("");
  const [depositUnit, setDepositUnit] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [errorUnitType, setErrorUnitType] = useState("");
  const [errorFullName, setErrorFullName] = useState("");
  const [errorCostCenter, setErrorCostCenter] = useState("");
  const [errorDepositUnit, setErrorDepositUnit] = useState("");
  const [errorEmail, setErrorEmail] = useState("");

  const disbursingDepartments = useMemo(() => {
    return departments.filter(
      (d) =>
        Boolean(d.costCenterCode && d.costCenterCode.trim()) &&
        (!department?.id || d.id !== department.id)
    );
  }, [departments, department?.id]);

  useEffect(() => {
    if (open) {
      const isDisbursing = !!(
        department?.costCenterCode ||
        department?.disbursingUnit === "หน่วยเบิกจ่าย"
      );
      const isDeposit = !!(
        department?.depositUnit ||
        department?.disbursingUnit === "หน่วยฝากเบิก"
      );

      let initialUnitType: "disbursing" | "deposit" | "" = "";
      if (isDisbursing) {
        initialUnitType = "disbursing";
      } else if (isDeposit) {
        initialUnitType = "deposit";
      }

      setUnitType(initialUnitType);
      setCostCenterCode(department?.costCenterCode || "");
      setType(department?.type || "");
      setFullName(department?.fullName || "");
      setShortName(department?.shortName || "");
      setDivision(department?.division || "");
      setProvince(department?.province || "");
      setDepositUnit(department?.depositUnit || "");
      setPhone(department?.phone || "");
      setEmail(department?.email || "");
      setErrorUnitType("");
      setErrorFullName("");
      setErrorCostCenter("");
      setErrorDepositUnit("");
      setErrorEmail("");
    }
  }, [open, department]);

  const handleUnitTypeChange = (val: string | null) => {
    const next = (val || "") as "disbursing" | "deposit" | "";
    setUnitType(next);
    setErrorUnitType("");
    if (next === "disbursing") {
      setDepositUnit("");
      setErrorDepositUnit("");
    } else if (next === "deposit") {
      setCostCenterCode("");
      setErrorCostCenter("");
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!unitType) {
      setErrorUnitType("กรุณาเลือกประเภทหน่วยงาน");
      hasError = true;
    } else {
      setErrorUnitType("");
    }

    if (!fullName.trim()) {
      setErrorFullName("กรุณาระบุชื่อหน่วยงาน (เต็ม)");
      hasError = true;
    } else {
      setErrorFullName("");
    }

    if (unitType === "disbursing") {
      const trimmedCostCenter = costCenterCode.trim();
      if (!trimmedCostCenter) {
        setErrorCostCenter("กรุณาระบุรหัสศูนย์ต้นทุน 10 หลัก");
        hasError = true;
      } else if (trimmedCostCenter.length !== 10) {
        setErrorCostCenter("รหัสศูนย์ต้นทุนต้องเป็นตัวเลข 10 หลัก");
        hasError = true;
      } else {
        setErrorCostCenter("");
      }
    } else if (unitType === "deposit") {
      if (!depositUnit.trim()) {
        setErrorDepositUnit("กรุณาเลือกหน่วยงานที่ต้องการฝากเบิก");
        hasError = true;
      } else {
        setErrorDepositUnit("");
      }
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorEmail("รูปแบบอีเมลไม่ถูกต้อง (เช่น example@fisheries.go.th)");
      hasError = true;
    } else {
      setErrorEmail("");
    }

    if (hasError) {
      return;
    }

    const payload = {
      costCenterCode: unitType === "disbursing" ? costCenterCode.trim() : undefined,
      disbursingUnit: unitType === "disbursing" ? "หน่วยเบิกจ่าย" : "หน่วยฝากเบิก",
      depositUnit: unitType === "deposit" ? depositUnit.trim() : undefined,
      type: type || undefined,
      fullName: fullName.trim(),
      shortName: shortName.trim() || undefined,
      division: division.trim() || undefined,
      province: province.trim() || undefined,
      phone: phone.trim() || undefined,
      email: trimmedEmail || undefined,
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
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="text-foreground">
            {department ? "แก้ไขข้อมูลหน่วยงาน" : "เพิ่มหน่วยงานใหม่"}
          </SheetTitle>
          <SheetDescription>
            กรอกข้อมูลรายละเอียดของหน่วยงานสังกัดกรมประมง
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
          {/* ส่วนที่ 1: ข้อมูลทั่วไปของหน่วยงาน */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-xs font-semibold tracking-wide text-muted-foreground">
              <Building2 className="size-4 text-primary" />
              <span>ข้อมูลทั่วไปของหน่วยงาน</span>
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
                <Label htmlFor="division">สังกัดกอง</Label>
                <Input
                  id="division"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="เช่น กองวิจัยและพัฒนาการเพาะเลี้ยงสัตว์น้ำจืด"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">ระดับหน่วยงาน</Label>
                <Select value={type} onValueChange={(val) => setType(val || "")}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="-- เลือกระดับหน่วยงาน --">
                      {type === "central"
                        ? "ส่วนกลาง"
                        : type === "regional_central"
                          ? "ส่วนกลางที่มีสถานที่ตั้งอยู่ในส่วนภูมิภาค"
                          : type === "regional"
                            ? "ส่วนภูมิภาค"
                            : "-- เลือกระดับหน่วยงาน --"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="central">ส่วนกลาง</SelectItem>
                    <SelectItem value="regional_central">ส่วนกลางที่มีสถานที่ตั้งอยู่ในส่วนภูมิภาค</SelectItem>
                    <SelectItem value="regional">ส่วนภูมิภาค</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="province">จังหวัด</Label>
                <ProvinceCombobox
                  id="province"
                  value={province}
                  onValueChange={setProvince}
                  placeholder="-- เลือกจังหวัด --"
                />
              </div>
            </div>
          </div>

          {/* ส่วนที่ 2: การเบิกจ่ายงบประมาณ */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-xs font-semibold tracking-wide text-muted-foreground">
              <CreditCard className="size-4 text-primary" />
              <span>การเบิกจ่ายงบประมาณ</span>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="unitType" className="text-foreground">
                ประเภทหน่วยงาน <span className="text-destructive">*</span>
              </Label>
              <Select value={unitType} onValueChange={handleUnitTypeChange}>
                <SelectTrigger
                  id="unitType"
                  className={errorUnitType ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                >
                  <SelectValue placeholder="-- เลือกประเภทหน่วยงาน --">
                    {unitType === "disbursing"
                      ? "หน่วยเบิกจ่าย"
                      : unitType === "deposit"
                        ? "หน่วยฝากเบิก"
                        : "-- เลือกประเภทหน่วยงาน --"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disbursing">หน่วยเบิกจ่าย</SelectItem>
                  <SelectItem value="deposit">หน่วยฝากเบิก</SelectItem>
                </SelectContent>
              </Select>
              {errorUnitType && (
                <span className="text-xs text-destructive">{errorUnitType}</span>
              )}
            </div>

            {/* Conditional Field based on unitType */}
            {unitType === "disbursing" && (
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-muted/40 border border-border/60 transition-all animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between">
                  <Label htmlFor="costCenterCode" className="text-foreground font-medium">
                    รหัสศูนย์ต้นทุน <span className="text-destructive">*</span>
                  </Label>
                </div>
                <Input
                  id="costCenterCode"
                  value={costCenterCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setCostCenterCode(val);
                    if (val.length === 10) {
                      setErrorCostCenter("");
                    }
                  }}
                  onBlur={() => {
                    const val = costCenterCode.trim();
                    if (!val) {
                      setErrorCostCenter("กรุณาระบุรหัสศูนย์ต้นทุน 10 หลัก");
                    } else if (val.length !== 10) {
                      setErrorCostCenter("รหัสศูนย์ต้นทุนต้องเป็นตัวเลข 10 หลัก");
                    } else {
                      setErrorCostCenter("");
                    }
                  }}
                  maxLength={10}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="เช่น 0700400000 (ตัวเลข 10 หลัก)"
                  className={errorCostCenter ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                />
                {errorCostCenter && (
                  <span className="text-xs text-destructive">{errorCostCenter}</span>
                )}
              </div>
            )}

            {unitType === "deposit" && (
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-muted/40 border border-border/60 transition-all animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between">
                  <Label htmlFor="depositUnit" className="text-foreground font-medium">
                    ฝากเบิกกับหน่วยงาน <span className="text-destructive">*</span>
                  </Label>
                </div>
                <DepartmentCombobox
                  departments={disbursingDepartments}
                  name="depositUnit"
                  value={depositUnit}
                  onValueChange={(val) => {
                    setDepositUnit(val);
                    if (val) setErrorDepositUnit("");
                  }}
                  placeholder="เลือกหน่วยงานที่ต้องการฝากเบิก..."
                />
                {errorDepositUnit && (
                  <span className="text-xs text-destructive">{errorDepositUnit}</span>
                )}
              </div>
            )}
          </div>

          {/* ส่วนที่ 3: ข้อมูลการติดต่อ */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-xs font-semibold tracking-wide text-muted-foreground">
              <Mail className="size-4 text-primary" />
              <span>ข้อมูลการติดต่อ</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์ (สำนักงาน)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 02-562-0600"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">อีเมลหน่วยงาน</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorEmail && (!e.target.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim()))) {
                      setErrorEmail("");
                    }
                  }}
                  onBlur={() => {
                    const val = email.trim();
                    if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                      setErrorEmail("รูปแบบอีเมลไม่ถูกต้อง (เช่น example@fisheries.go.th)");
                    } else {
                      setErrorEmail("");
                    }
                  }}
                  placeholder="เช่น admin@fisheries.go.th"
                  className={errorEmail ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                />
                {errorEmail && (
                  <span className="text-xs text-destructive">{errorEmail}</span>
                )}
              </div>
            </div>
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
