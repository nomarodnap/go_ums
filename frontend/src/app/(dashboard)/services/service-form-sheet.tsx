"use client";

import { useEffect, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ErrorSpeechBubble } from "@/components/ui/error-speech-bubble";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateDepartmentService,
  useUpdateDepartmentService,
} from "@/lib/api/generated/departments/departments";
import type {
  DepartmentDTO,
  DepartmentServiceDTO,
} from "@/lib/api/generated/model";
import { Loader2 } from "lucide-react";

export function ServiceFormSheet({
  open,
  onOpenChange,
  departments,
  userRole,
  userDepartmentId,
  serviceToEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentDTO[];
  userRole: string;
  userDepartmentId: string | null;
  serviceToEdit?: DepartmentServiceDTO | null;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateDepartmentService();
  const updateMutation = useUpdateDepartmentService();

  const defaultDepartmentId =
    userRole === "admin" ? "" : userDepartmentId || "";

  const [departmentId, setDepartmentId] = useState<string>(
    serviceToEdit?.departmentId || defaultDepartmentId,
  );
  const [utilityType, setUtilityType] = useState<string>(
    serviceToEdit?.utilityType || "",
  );
  const [provider, setProvider] = useState<string>(
    serviceToEdit?.provider || "",
  );
  const [serviceNumber, setServiceNumber] = useState<string>(
    serviceToEdit?.serviceNumber || "",
  );
  const [locationType, setLocationType] = useState<string>(
    serviceToEdit?.locationType || "",
  );
  const [phoneType, setPhoneType] = useState<string>(
    serviceToEdit
      ? serviceToEdit.phoneOwnerName
        ? "mobile"
        : "home"
      : "mobile",
  );
  const [phoneOwnerName, setPhoneOwnerName] = useState<string>(
    serviceToEdit?.phoneOwnerName || "",
  );
  const [phoneOwnerPosition, setPhoneOwnerPosition] = useState<string>(
    serviceToEdit?.phoneOwnerPosition || "",
  );
  const [phoneReimbursementLimit, setPhoneReimbursementLimit] =
    useState<string>(
      serviceToEdit?.phoneReimbursementLimit
        ? serviceToEdit.phoneReimbursementLimit.toString()
        : "1000",
    );

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setDepartmentId(serviceToEdit?.departmentId || defaultDepartmentId);
      setUtilityType(serviceToEdit?.utilityType || "");
      setProvider(serviceToEdit?.provider || "");
      setServiceNumber(serviceToEdit?.serviceNumber || "");
      setLocationType(serviceToEdit?.locationType || "");
      setPhoneType(
        serviceToEdit
          ? serviceToEdit.phoneOwnerName
            ? "mobile"
            : "home"
          : "mobile",
      );
      setPhoneOwnerName(serviceToEdit?.phoneOwnerName || "");
      setPhoneOwnerPosition(serviceToEdit?.phoneOwnerPosition || "");
      setPhoneReimbursementLimit(
        serviceToEdit?.phoneReimbursementLimit
          ? serviceToEdit.phoneReimbursementLimit.toString()
          : "1000",
      );
      setErrors({});
    }
  }, [open, serviceToEdit, defaultDepartmentId]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const targetDeptId = userRole === "admin" ? departmentId : defaultDepartmentId;
    if (!targetDeptId) {
      newErrors.departmentId = "กรุณาระบุหน่วยงาน";
    }
    if (!utilityType) {
      newErrors.utilityType = "กรุณาระบุประเภทสาธารณูปโภค";
    }
    if (!provider.trim()) {
      newErrors.provider = "กรุณาระบุผู้ให้บริการ";
    }
    if (!serviceNumber.trim()) {
      newErrors.serviceNumber = "กรุณาระบุหมายเลขผู้ใช้/รหัสเครื่องวัด";
    }

    const isMobile = utilityType === "ค่าโทรศัพท์" && phoneType === "mobile";
    if (isMobile) {
      if (!phoneOwnerName.trim()) {
        newErrors.phoneOwnerName = "กรุณาระบุชื่อ-สกุลผู้ถือครอง";
      }
      if (!phoneOwnerPosition.trim()) {
        newErrors.phoneOwnerPosition = "กรุณาระบุตำแหน่งผู้ถือครอง";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    let limitNum: number | undefined = undefined;
    if (isMobile) {
      limitNum = userRole === "user" ? 1000 : Number(phoneReimbursementLimit) || 1000;
    }

    const payload = {
      departmentId: targetDeptId,
      utilityType,
      provider: provider.trim(),
      serviceNumber: serviceNumber.trim(),
      locationType: locationType || undefined,
      phoneOwnerName: isMobile ? phoneOwnerName.trim() : undefined,
      phoneOwnerPosition: isMobile ? phoneOwnerPosition.trim() : undefined,
      phoneReimbursementLimit: limitNum,
    };

    try {
      if (serviceToEdit) {
        await updateMutation.mutateAsync({
          id: serviceToEdit.id,
          data: payload,
        });
      } else {
        await createMutation.mutateAsync({
          data: payload,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["/api/departments/services"],
      });

      toast.success("บันทึกข้อมูลสำเร็จ");
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      toast.error(errorMsg);
    }
  };

  const selectedDepartment = departments.find((d) => d.id === departmentId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">
            {serviceToEdit ? "แก้ไขรายการ" : "เพิ่มรหัสเครื่องวัด / เบอร์โทร"}
          </SheetTitle>
          <SheetDescription>
            {serviceToEdit
              ? "แก้ไขข้อมูลบัญชีผู้ให้บริการ หรือรหัสเครื่องวัด"
              : "ระบุข้อมูลบัญชีผู้ให้บริการ หรือรหัสเครื่องวัดของหน่วยงาน"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-6 mt-6">
          <div className="space-y-4">
            {userRole === "admin" ? (
              <div className="space-y-2 relative">
                <Label htmlFor="departmentId">
                  หน่วยงาน <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={departmentId}
                  onValueChange={(v) => {
                    if (v) {
                      setDepartmentId(v);
                      setErrors((prev) => ({ ...prev, departmentId: "" }));
                    }
                  }}
                >
                  <SelectTrigger
                    className={
                      errors.departmentId
                        ? "border-rose-500 ring-2 ring-rose-500/20"
                        : ""
                    }
                  >
                    <SelectValue placeholder="เลือกหน่วยงาน">
                      {selectedDepartment
                        ? selectedDepartment.shortName || selectedDepartment.fullName
                        : "เลือกหน่วยงาน"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.shortName || dept.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorSpeechBubble message={errors.departmentId} />
              </div>
            ) : null}

            <div className="space-y-2 relative">
              <Label htmlFor="utilityType">
                ประเภทสาธารณูปโภค <span className="text-destructive">*</span>
              </Label>
              <Select
                value={utilityType}
                onValueChange={(v) => {
                  if (v) {
                    setUtilityType(v);
                    setErrors((prev) => ({ ...prev, utilityType: "" }));
                  }
                }}
              >
                <SelectTrigger
                  className={
                    errors.utilityType
                      ? "border-rose-500 ring-2 ring-rose-500/20"
                      : ""
                  }
                >
                  <SelectValue placeholder="เลือกประเภท">
                    {utilityType || "เลือกประเภท"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ค่าไฟฟ้า">ค่าไฟฟ้า</SelectItem>
                  <SelectItem value="ค่าน้ำประปา">ค่าน้ำประปา</SelectItem>
                  <SelectItem value="ค่าโทรศัพท์">ค่าโทรศัพท์</SelectItem>
                  <SelectItem value="ค่าอินเทอร์เน็ต">ค่าอินเทอร์เน็ต</SelectItem>
                  <SelectItem value="ค่าไปรษณีย์">ค่าไปรษณีย์</SelectItem>
                </SelectContent>
              </Select>
              <ErrorSpeechBubble message={errors.utilityType} />
            </div>

            {utilityType === "ค่าโทรศัพท์" && (
              <div className="space-y-2">
                <Label>ประเภทโทรศัพท์</Label>
                <RadioGroup
                  value={phoneType}
                  onValueChange={setPhoneType}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mobile" id="edit-phone-mobile" />
                    <Label htmlFor="edit-phone-mobile" className="cursor-pointer">
                      โทรศัพท์มือถือ
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="home" id="edit-phone-home" />
                    <Label htmlFor="edit-phone-home" className="cursor-pointer">
                      โทรศัพท์บ้าน
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-2 relative">
              <Label htmlFor="provider">
                ผู้ให้บริการ <span className="text-destructive">*</span>
              </Label>
              <Input
                name="provider"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setErrors((prev) => ({ ...prev, provider: "" }));
                }}
                placeholder="เช่น กฟภ., กปภ., TOT, AIS"
                className={
                  errors.provider
                    ? "border-rose-500 ring-2 ring-rose-500/20"
                    : ""
                }
              />
              <ErrorSpeechBubble message={errors.provider} />
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="serviceNumber">
                รหัสเครื่องวัด / หมายเลขผู้ใช้ <span className="text-destructive">*</span>
              </Label>
              <Input
                name="serviceNumber"
                value={serviceNumber}
                onChange={(e) => {
                  setServiceNumber(e.target.value);
                  setErrors((prev) => ({ ...prev, serviceNumber: "" }));
                }}
                placeholder="ระบุหมายเลข"
                className={
                  errors.serviceNumber
                    ? "border-rose-500 ring-2 ring-rose-500/20"
                    : ""
                }
              />
              <ErrorSpeechBubble message={errors.serviceNumber} />
            </div>

            {!["ค่าไปรษณีย์", "ค่าบริการไปรษณีย์"].includes(utilityType) &&
            (utilityType !== "ค่าโทรศัพท์" || phoneType === "home") ? (
              <div className="space-y-2 pt-2">
                <Label htmlFor="locationType">ประเภทสถานที่ / ที่ตั้ง</Label>
                <Select
                  value={locationType}
                  onValueChange={(v) => v && setLocationType(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกประเภทสถานที่ (ถ้ามี)">
                      {locationType || "เลือกประเภทสถานที่ (ถ้ามี)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="สำนักงาน">สำนักงาน</SelectItem>
                    <SelectItem value="บ่อเพาะ">บ่อเพาะ</SelectItem>
                    <SelectItem value="บ้านพัก">บ้านพัก</SelectItem>
                    <SelectItem value="อื่นๆ">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {utilityType === "ค่าโทรศัพท์" && phoneType === "mobile" && (
              <div className="space-y-4 pt-4 border-t border-border/40">
                <div className="space-y-2 relative">
                  <Label htmlFor="phoneOwnerName">
                    ชื่อ-สกุล <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    name="phoneOwnerName"
                    value={phoneOwnerName}
                    onChange={(e) => {
                      setPhoneOwnerName(e.target.value);
                      setErrors((prev) => ({ ...prev, phoneOwnerName: "" }));
                    }}
                    placeholder="ระบุชื่อ-สกุลผู้ถือครอง"
                    className={
                      errors.phoneOwnerName
                        ? "border-rose-500 ring-2 ring-rose-500/20"
                        : ""
                    }
                  />
                  <ErrorSpeechBubble message={errors.phoneOwnerName} />
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="phoneOwnerPosition">
                    ตำแหน่ง <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    name="phoneOwnerPosition"
                    value={phoneOwnerPosition}
                    onChange={(e) => {
                      setPhoneOwnerPosition(e.target.value);
                      setErrors((prev) => ({ ...prev, phoneOwnerPosition: "" }));
                    }}
                    placeholder="ระบุตำแหน่ง"
                    className={
                      errors.phoneOwnerPosition
                        ? "border-rose-500 ring-2 ring-rose-500/20"
                        : ""
                    }
                  />
                  <ErrorSpeechBubble message={errors.phoneOwnerPosition} />
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="phoneReimbursementLimit">
                    เพดานสิทธิเบิก (บาท/เดือน){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={phoneReimbursementLimit}
                    onValueChange={(v) => v && setPhoneReimbursementLimit(v)}
                    disabled={userRole === "user"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเพดานการเบิก">
                        {phoneReimbursementLimit
                          ? `${Number(phoneReimbursementLimit).toLocaleString()} บาท`
                          : "เลือกเพดานการเบิก"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000">1,000 บาท</SelectItem>
                      <SelectItem value="2000">2,000 บาท</SelectItem>
                      <SelectItem value="4000">4,000 บาท</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
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
