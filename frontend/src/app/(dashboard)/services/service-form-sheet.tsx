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
import { DepartmentCombobox } from "@/components/ui/department-combobox";
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
import { Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
 
export const POSITION_LEVEL_OPTIONS = [
  "บริหารระดับสูง",
  "บริหารระดับทรงคุณวุฒิ",
  "บริหารระดับต้น",
  "อำนวยการระดับสูง",
  "วิชาการระดับเชี่ยวชาญ",
  "อำนวยการระดับต้น",
  "ชำนาญการพิเศษ",
  "ทั่วไประดับอาวุโส",
] as const;

export function getPhoneReimbursementLimit(position?: string | null): number {
  if (!position) return 1000;
  if (["บริหารระดับสูง", "บริหารระดับทรงคุณวุฒิ"].includes(position)) {
    return 4000;
  }
  if (
    ["บริหารระดับต้น", "อำนวยการระดับสูง", "วิชาการระดับเชี่ยวชาญ"].includes(
      position,
    )
  ) {
    return 2000;
  }
  return 1000;
}

export const UTILITY_PROVIDERS_MAP: Record<string, string[]> = {
  "ค่าไฟฟ้า": [
    "การไฟฟ้านครหลวง",
    "การไฟฟ้าส่วนภูมิภาค",
  ],
  "ค่าประปา&น้ำบาดาล": [
    "การประปานครหลวง",
    "การประปาเทศบาลตำบล",
    "การประปาส่วนภูมิภาค",
    "ประปาหมู่บ้าน",
    "องค์การบริหารส่วนตำบล",
  ],
  "ค่าโทรศัพท์": [
    "บริษัท ทรู มูฟ เอช ยูนิเวอร์แซล คอมมิวนิเคชั่น จำกัด",
    "บริษัท โทรคมนาคมแห่งชาติ จำกัด (มหาชน)",
    "บริษัท แอดวานซ์ ไวร์เลส เน็ทเวอร์ค จำกัด",
  ],
  "ค่าสื่อสาร&โทรคมนาคม": [
    "บริษัท ทริปเปิลที บรอดแบนด์ จำกัด (มหาชน)",
    "บริษัท ทรู อินเทอร์เน็ต คอร์ปอเรชั่น จำกัด",
    "บริษัท โทรคมนาคมแห่งชาติ จำกัด (มหาชน)",
  ],
  "ค่าบริการไปรษณีย์": [
    "บริษัท ไปรษณีย์ไทย จำกัด",
  ],
};

export function getProvidersForUtility(utilityType?: string | null): string[] {
  if (!utilityType) return [];
  if (utilityType === "ค่าน้ำประปา") {
    return UTILITY_PROVIDERS_MAP["ค่าประปา&น้ำบาดาล"] || [];
  }
  if (utilityType === "ค่าไปรษณีย์") {
    return UTILITY_PROVIDERS_MAP["ค่าบริการไปรษณีย์"] || [];
  }
  return UTILITY_PROVIDERS_MAP[utilityType] || [];
}

export function sanitizeServiceNumber(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function ServiceFormSheet({
  open,
  onOpenChange,
  departments,
  userRole,
  userDepartmentId,
  serviceToEdit,
  existingServices,
  scope = "all",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentDTO[];
  userRole: string;
  userDepartmentId: string | null;
  serviceToEdit?: DepartmentServiceDTO | null;
  existingServices?: DepartmentServiceDTO[];
  scope?: "my_dept" | "all";
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateDepartmentService();
  const updateMutation = useUpdateDepartmentService();

  const defaultDepartmentId =
    scope === "my_dept"
      ? userDepartmentId || ""
      : serviceToEdit?.departmentId || (userRole === "admin" ? "" : userDepartmentId || "");

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
  const [phoneOwnerDivision, setPhoneOwnerDivision] = useState<string>(
    serviceToEdit?.phoneOwnerDivision || "",
  );
  const [phoneReimbursementLimit, setPhoneReimbursementLimit] =
    useState<string>(
      serviceToEdit?.phoneReimbursementLimit
        ? serviceToEdit.phoneReimbursementLimit.toString()
        : "1000",
    );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const currentProviders = getProvidersForUtility(utilityType);

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
      setPhoneOwnerDivision(serviceToEdit?.phoneOwnerDivision || "");
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

    const targetDeptId = scope === "my_dept" ? (userDepartmentId || departmentId) : (departmentId || userDepartmentId || defaultDepartmentId);
    if (!targetDeptId) {
      newErrors.departmentId = "กรุณาระบุหน่วยงาน";
    }
    if (!utilityType) {
      newErrors.utilityType = "กรุณาระบุประเภทสาธารณูปโภค";
    }
    if (!provider.trim()) {
      newErrors.provider = "กรุณาระบุผู้ให้บริการ";
    }
    const cleanNumber = serviceNumber.trim();
    if (!cleanNumber) {
      newErrors.serviceNumber = "กรุณาระบุหมายเลขผู้ใช้/รหัสเครื่องวัด";
    } else if (
      existingServices?.some(
        (s) =>
          s.id !== serviceToEdit?.id &&
          s.serviceNumber.trim().toUpperCase() === cleanNumber.toUpperCase(),
      )
    ) {
      newErrors.serviceNumber = "รหัสเครื่องวัด / หมายเลขผู้ใช้ นี้ถูกบันทึกในระบบแล้ว";
    }

    const isMobile = utilityType === "ค่าโทรศัพท์" && phoneType === "mobile";
    if (isMobile) {
      if (!phoneOwnerName.trim()) {
        newErrors.phoneOwnerName = "กรุณาระบุชื่อ-สกุลผู้ถือครอง";
      }
      if (!phoneOwnerPosition.trim()) {
        newErrors.phoneOwnerPosition = "กรุณาระบุประเภทและระดับตำแหน่ง";
      }
      if (!phoneOwnerDivision.trim()) {
        newErrors.phoneOwnerDivision = "กรุณาระบุตำแหน่ง / สังกัด";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    let limitNum: number | undefined = undefined;
    if (isMobile) {
      limitNum = getPhoneReimbursementLimit(phoneOwnerPosition);
    }

    const isMeterUtility = ["ค่าไฟฟ้า", "ค่าประปา&น้ำบาดาล", "ค่าน้ำประปา"].includes(utilityType);

    const payload = {
      departmentId: targetDeptId,
      utilityType,
      provider: provider.trim(),
      serviceNumber: serviceNumber.trim(),
      locationType: isMeterUtility ? (locationType || undefined) : undefined,
      phoneOwnerName: isMobile ? phoneOwnerName.trim() : undefined,
      phoneOwnerPosition: isMobile ? phoneOwnerPosition.trim() : undefined,
      phoneOwnerDivision: isMobile ? phoneOwnerDivision.trim() || undefined : undefined,
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
      const errorData = err as {
        detail?: string;
        message?: string;
        title?: string;
        errors?: Array<{ message: string; location?: string }>;
      };
      const validationError = errorData?.errors?.[0]?.message;
      const errorMsg =
        (validationError
          ? `${errorData?.detail || errorData?.title || "ข้อผิดพลาด"}: ${validationError}`
          : undefined) ||
        errorData?.detail ||
        errorData?.message ||
        errorData?.title ||
        (err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      if (
        errorMsg.includes("รหัสเครื่องวัด") ||
        errorMsg.includes("หมายเลขผู้ใช้") ||
        errorMsg.includes("มีบันทึกในระบบแล้ว")
      ) {
        setErrors((prev) => ({ ...prev, serviceNumber: errorMsg }));
      }
      toast.error(errorMsg);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">
            {serviceToEdit ? "แก้ไขรายการ" : "เพิ่มรหัสเครื่องวัด / หมายเลขผู้ใช้"}
          </SheetTitle>
          <SheetDescription>
            {serviceToEdit
              ? "แก้ไขข้อมูลบัญชีผู้ให้บริการ หรือรหัสเครื่องวัด"
              : "ระบุข้อมูลบัญชีผู้ให้บริการ หรือรหัสเครื่องวัดของหน่วยงาน"}
          </SheetDescription>
        </SheetHeader>



        <form onSubmit={handleSubmit} noValidate className="space-y-6 mt-6">
          <div className="space-y-4">
            {scope === "all" ? (
              <div className="space-y-2 relative">
                <Label htmlFor="departmentId">
                  หน่วยงาน <span className="text-destructive">*</span>
                </Label>
                <DepartmentCombobox
                  id="departmentId"
                  departments={departments}
                  value={departmentId}
                  onValueChange={(v) => {
                    setDepartmentId(v);
                    setErrors((prev) => ({ ...prev, departmentId: "" }));
                  }}
                  placeholder="เลือกหน่วยงาน..."
                  className={
                    errors.departmentId
                      ? "border-rose-500 ring-2 ring-rose-500/20"
                      : ""
                  }
                />
                <ErrorSpeechBubble message={errors.departmentId} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>หน่วยงาน</Label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium text-foreground">
                  <Building2 className="size-4 text-primary shrink-0" />
                  <span>
                    {departments.find((d) => d.id === (serviceToEdit?.departmentId || userDepartmentId))?.fullName ||
                      departments[0]?.fullName ||
                      "หน่วยงานของท่าน"}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 relative">
              <Label htmlFor="utilityType">
                ประเภทสาธารณูปโภค <span className="text-destructive">*</span>
              </Label>
              <Select
                value={utilityType}
                onValueChange={(v) => {
                  if (v) {
                    setUtilityType(v);
                    const validProviders = getProvidersForUtility(v);
                    if (!validProviders.includes(provider)) {
                      setProvider("");
                    }
                    setErrors((prev) => ({ ...prev, utilityType: "", provider: "" }));
                  }
                }}
              >
                <SelectTrigger
                  id="utilityType"
                  className={cn(
                    "w-full",
                    errors.utilityType && "border-rose-500 ring-2 ring-rose-500/20",
                  )}
                >
                  <SelectValue placeholder="เลือกประเภท">
                    {utilityType || "เลือกประเภท"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ค่าไฟฟ้า">ค่าไฟฟ้า</SelectItem>
                  <SelectItem value="ค่าประปา&น้ำบาดาล">
                    ค่าประปา&น้ำบาดาล
                  </SelectItem>
                  <SelectItem value="ค่าโทรศัพท์">ค่าโทรศัพท์</SelectItem>
                  <SelectItem value="ค่าสื่อสาร&โทรคมนาคม">
                    ค่าสื่อสาร&โทรคมนาคม
                  </SelectItem>
                  <SelectItem value="ค่าบริการไปรษณีย์">ค่าบริการไปรษณีย์</SelectItem>
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
                      โทรศัพท์สำนักงาน
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-2 relative">
              <Label htmlFor="provider">
                ผู้ให้บริการ <span className="text-destructive">*</span>
              </Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  if (v) {
                    setProvider(v);
                    setErrors((prev) => ({ ...prev, provider: "" }));
                  }
                }}
                disabled={!utilityType}
              >
                <SelectTrigger
                  id="provider"
                  className={cn(
                    "w-full",
                    errors.provider && "border-rose-500 ring-2 ring-rose-500/20",
                  )}
                >
                  <SelectValue
                    placeholder={
                      utilityType
                        ? "เลือกผู้ให้บริการ"
                        : "กรุณาเลือกประเภทสาธารณูปโภคก่อน"
                    }
                  >
                    {provider ||
                      (utilityType
                        ? "เลือกผู้ให้บริการ"
                        : "กรุณาเลือกประเภทสาธารณูปโภคก่อน")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {provider &&
                    currentProviders.length > 0 &&
                    !currentProviders.includes(provider) && (
                      <SelectItem value={provider}>{provider}</SelectItem>
                    )}
                  {currentProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ErrorSpeechBubble message={errors.provider} />
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="serviceNumber">
                รหัสเครื่องวัด / หมายเลขผู้ใช้ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serviceNumber"
                name="serviceNumber"
                value={serviceNumber}
                onChange={(e) => {
                  const val = sanitizeServiceNumber(e.target.value);
                  setServiceNumber(val);
                  setErrors((prev) => ({ ...prev, serviceNumber: "" }));
                }}
                placeholder="ระบุหมายเลข (เฉพาะตัวเลขและภาษาอังกฤษ)"
                className={cn(
                  "uppercase",
                  errors.serviceNumber && "border-rose-500 ring-2 ring-rose-500/20",
                )}
              />
              <ErrorSpeechBubble message={errors.serviceNumber} />
            </div>

            {["ค่าไฟฟ้า", "ค่าประปา&น้ำบาดาล", "ค่าน้ำประปา"].includes(utilityType) && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="locationType">ประเภทสถานที่ / ที่ตั้ง</Label>
                <Select
                  value={locationType}
                  onValueChange={(v) => v && setLocationType(v)}
                >
                  <SelectTrigger id="locationType" className="w-full">
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
            )}

            {utilityType === "ค่าโทรศัพท์" && phoneType === "mobile" && (
              <div className="space-y-4 pt-4 border-t border-border/40">
                <div className="space-y-2 relative">
                  <Label htmlFor="phoneOwnerName">
                    ชื่อ-สกุล ผู้ถือครอง <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    name="phoneOwnerName"
                    id="phoneOwnerName"
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
                    ประเภทและระดับตำแหน่ง <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={phoneOwnerPosition}
                    onValueChange={(v) => {
                      if (v) {
                        setPhoneOwnerPosition(v);
                        setPhoneReimbursementLimit(getPhoneReimbursementLimit(v).toString());
                        setErrors((prev) => ({ ...prev, phoneOwnerPosition: "" }));
                      }
                    }}
                  >
                    <SelectTrigger
                      id="phoneOwnerPosition"
                      className={cn(
                        "w-full",
                        errors.phoneOwnerPosition && "border-rose-500 ring-2 ring-rose-500/20",
                      )}
                    >
                      <SelectValue placeholder="เลือกประเภทและระดับตำแหน่ง">
                        {phoneOwnerPosition || "เลือกประเภทและระดับตำแหน่ง"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {phoneOwnerPosition &&
                        !POSITION_LEVEL_OPTIONS.includes(
                          phoneOwnerPosition as (typeof POSITION_LEVEL_OPTIONS)[number],
                        ) && (
                          <SelectItem value={phoneOwnerPosition}>
                            {phoneOwnerPosition}
                          </SelectItem>
                        )}
                      {POSITION_LEVEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ErrorSpeechBubble message={errors.phoneOwnerPosition} />
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="phoneOwnerDivision">
                    ตำแหน่ง / สังกัด <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    name="phoneOwnerDivision"
                    id="phoneOwnerDivision"
                    value={phoneOwnerDivision}
                    onChange={(e) => {
                      setPhoneOwnerDivision(e.target.value);
                      setErrors((prev) => ({ ...prev, phoneOwnerDivision: "" }));
                    }}
                    placeholder="เช่น ผู้อำนวยการศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร"
                    className={
                      errors.phoneOwnerDivision
                        ? "border-rose-500 ring-2 ring-rose-500/20"
                        : ""
                    }
                  />
                  <ErrorSpeechBubble message={errors.phoneOwnerDivision} />
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="phoneReimbursementLimit">
                    เพดานสิทธิเบิก (บาท/เดือน)
                  </Label>
                  <Input
                    id="phoneReimbursementLimit"
                    name="phoneReimbursementLimit"
                    value={`${getPhoneReimbursementLimit(phoneOwnerPosition).toLocaleString()} บาท`}
                    disabled
                    readOnly
                    className="bg-muted/60 text-foreground cursor-not-allowed font-medium select-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    * คำนวณอัตโนมัติตามประเภทและระดับตำแหน่งที่เลือก
                  </p>
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
            <Button
              type="submit"
              disabled={isPending}
              className="gap-2 shadow-xs"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
