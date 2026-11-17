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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ErrorSpeechBubble } from "@/components/ui/error-speech-bubble";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateDepartmentService,
  useDeleteDepartmentService,
} from "@/lib/api/generated/departments/departments";
import type {
  DepartmentDTO,
  DepartmentServiceDTO,
} from "@/lib/api/generated/model";
import {
  POSITION_LEVEL_OPTIONS,
  getPhoneReimbursementLimit,
  getProvidersForUtility,
  sanitizeServiceNumber,
} from "@/app/(dashboard)/services/service-form-sheet";

export function DepartmentServicesSheet({
  department,
  services = [],
  open,
  onOpenChange,
}: {
  department: DepartmentDTO;
  services: DepartmentServiceDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateDepartmentService();
  const deleteMutation = useDeleteDepartmentService();

  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [utilityType, setUtilityType] = useState<string>("");
  const [phoneType, setPhoneType] = useState<string>("mobile");
  const [provider, setProvider] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [locationType, setLocationType] = useState("");
  const [phoneOwnerName, setPhoneOwnerName] = useState("");
  const [phoneOwnerPosition, setPhoneOwnerPosition] = useState("");
  const [phoneOwnerDivision, setPhoneOwnerDivision] = useState("");
  const currentProviders = getProvidersForUtility(utilityType);

  const [errors, setErrors] = useState<{
    utilityType?: string;
    provider?: string;
    serviceNumber?: string;
    phoneOwnerName?: string;
    phoneOwnerPosition?: string;
    phoneOwnerDivision?: string;
  }>({});

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบหมายเลขผู้ใช้นี้?")) return;

    setIsDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await queryClient.invalidateQueries({
        queryKey: ["/api/departments/services"],
      });
      toast.success("ลบหมายเลขผู้ใช้สำเร็จ");
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบข้อมูล";
      toast.error(errorMsg);
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!utilityType) newErrors.utilityType = "กรุณาเลือกประเภทสาธารณูปโภค";
    if (!provider.trim()) newErrors.provider = "กรุณาระบุผู้ให้บริการ";
    const cleanNumber = serviceNumber.trim();
    if (!cleanNumber) {
      newErrors.serviceNumber = "กรุณาระบุหมายเลขผู้ใช้ / รหัสเครื่องวัด";
    } else if (
      services.some(
        (s) => s.serviceNumber.trim().toUpperCase() === cleanNumber.toUpperCase(),
      )
    ) {
      newErrors.serviceNumber = "รหัสเครื่องวัด / หมายเลขผู้ใช้ นี้ถูกบันทึกในระบบแล้ว";
    }

    const isMobile = utilityType === "ค่าโทรศัพท์" && phoneType === "mobile";
    if (isMobile) {
      if (!phoneOwnerName.trim()) newErrors.phoneOwnerName = "กรุณาระบุชื่อ-สกุล ผู้ถือครอง";
      if (!phoneOwnerPosition.trim()) newErrors.phoneOwnerPosition = "กรุณาระบุประเภทและระดับตำแหน่ง";
      if (!phoneOwnerDivision.trim()) newErrors.phoneOwnerDivision = "กรุณาระบุตำแหน่ง / สังกัด";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const isMeterUtility = ["ค่าไฟฟ้า", "ค่าประปา&น้ำบาดาล", "ค่าน้ำประปา"].includes(utilityType);

    try {
      await createMutation.mutateAsync({
        data: {
          departmentId: department.id,
          utilityType,
          provider: provider.trim(),
          serviceNumber: cleanNumber,
          locationType: isMeterUtility ? (locationType || undefined) : undefined,
          phoneOwnerName: isMobile ? phoneOwnerName.trim() : undefined,
          phoneOwnerPosition: isMobile ? phoneOwnerPosition.trim() : undefined,
          phoneOwnerDivision: isMobile ? phoneOwnerDivision.trim() || undefined : undefined,
          phoneReimbursementLimit: isMobile ? getPhoneReimbursementLimit(phoneOwnerPosition) : undefined,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["/api/departments/services"],
      });

      toast.success("บันทึกหมายเลขผู้ใช้ใหม่สำเร็จ");
      setProvider("");
      setServiceNumber("");
      setLocationType("");
      setPhoneOwnerName("");
      setPhoneOwnerPosition("");
      setPhoneOwnerDivision("");
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
        (err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
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
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-foreground">จัดการหมายเลขผู้ใช้ / รหัสเครื่องวัด</SheetTitle>
          <SheetDescription className="mt-1">{department.fullName}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>รหัสเครื่องวัด / เบอร์โทร</TableHead>
                  <TableHead className="w-[50px] text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 text-center text-muted-foreground text-sm"
                    >
                      ไม่มีข้อมูลหมายเลขผู้ใช้
                    </TableCell>
                  </TableRow>
                ) : (
                  services.map((svc) => (
                    <TableRow key={svc.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-foreground">{svc.utilityType}</span>
                          <span className="text-xs text-muted-foreground">
                            {svc.provider}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {svc.serviceNumber}
                          </span>
                          {svc.locationType && (
                            <span className="text-xs text-muted-foreground">
                              {svc.locationType}
                            </span>
                          )}
                          {svc.utilityType === "ค่าโทรศัพท์" && svc.phoneOwnerName && (
                            <span className="text-xs text-muted-foreground">
                              {svc.phoneOwnerName} ({svc.phoneOwnerPosition})
                              {svc.phoneReimbursementLimit != null && ` - เพดาน ${svc.phoneReimbursementLimit.toLocaleString()} บาท`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer rounded-lg"
                          onClick={() => handleDelete(svc.id)}
                          disabled={isDeletingId === svc.id}
                        >
                          {isDeletingId === svc.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="border-t border-border/40 pt-6">
            <h4 className="font-semibold text-sm mb-4 text-foreground flex items-center gap-1.5">
              <Plus className="size-4 text-primary" /> เพิ่มหมายเลขผู้ใช้ใหม่
            </h4>
            <form onSubmit={handleAddService} noValidate className="space-y-4">
              <div className="grid gap-2 relative">
                <Label>
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
                      setErrors((prev) => ({ ...prev, utilityType: undefined, provider: undefined }));
                    }
                  }}
                >
                  <SelectTrigger className={cn("w-full", errors.utilityType && "border-rose-500 ring-2 ring-rose-500/20")}>
                    <SelectValue placeholder="เลือกประเภท..." />
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
                <div className="grid gap-2 pt-2 pb-2 border-y border-border/40">
                  <Label>ประเภทโทรศัพท์</Label>
                  <RadioGroup
                    value={phoneType}
                    onValueChange={setPhoneType}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mobile" id="modal-phone-mobile" />
                      <Label htmlFor="modal-phone-mobile" className="cursor-pointer">โทรศัพท์มือถือ</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="home" id="modal-phone-home" />
                      <Label htmlFor="modal-phone-home" className="cursor-pointer">โทรศัพท์บ้าน</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <div className="grid gap-2 relative">
                <Label htmlFor="deptProvider">
                  ผู้ให้บริการ <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    if (v) {
                      setProvider(v);
                      setErrors((prev) => ({ ...prev, provider: undefined }));
                    }
                  }}
                  disabled={!utilityType}
                >
                  <SelectTrigger
                    id="deptProvider"
                    className={cn("w-full", errors.provider && "border-rose-500 ring-2 ring-rose-500/20")}
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

              <div className="grid gap-2 relative">
                <Label htmlFor="deptServiceNumber">
                  หมายเลขผู้ใช้ / รหัสเครื่องวัด <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="deptServiceNumber"
                  value={serviceNumber}
                  onChange={(e) => {
                    const val = sanitizeServiceNumber(e.target.value);
                    setServiceNumber(val);
                    if (val.trim()) setErrors((prev) => ({ ...prev, serviceNumber: undefined }));
                  }}
                  placeholder="หมายเลขเครื่องวัด (เฉพาะตัวเลขและภาษาอังกฤษ)"
                  className={cn(
                    "uppercase",
                    errors.serviceNumber ? "border-rose-500 ring-2 ring-rose-500/20" : "",
                  )}
                />
                <ErrorSpeechBubble message={errors.serviceNumber} />
              </div>

              {["ค่าไฟฟ้า", "ค่าประปา&น้ำบาดาล", "ค่าน้ำประปา"].includes(utilityType) && (
                <div className="grid gap-2">
                  <Label>ที่ตั้ง (ถ้ามี)</Label>
                  <Select value={locationType} onValueChange={(v) => v && setLocationType(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="เลือกที่ตั้ง..." />
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
                <>
                  <div className="grid gap-2 relative">
                    <Label htmlFor="deptPhoneOwnerName">
                      ชื่อ-สกุล ผู้ถือครอง <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="deptPhoneOwnerName"
                      value={phoneOwnerName}
                      onChange={(e) => {
                        setPhoneOwnerName(e.target.value);
                        if (e.target.value.trim()) setErrors((prev) => ({ ...prev, phoneOwnerName: undefined }));
                      }}
                      placeholder="ระบุชื่อ-สกุลผู้ถือครอง"
                      className={errors.phoneOwnerName ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                    />
                    <ErrorSpeechBubble message={errors.phoneOwnerName} />
                  </div>
                  <div className="grid gap-2 relative">
                    <Label htmlFor="deptPhoneOwnerPosition">
                      ประเภทและระดับตำแหน่ง <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={phoneOwnerPosition}
                      onValueChange={(v) => {
                        if (v) {
                          setPhoneOwnerPosition(v);
                          setErrors((prev) => ({ ...prev, phoneOwnerPosition: undefined }));
                        }
                      }}
                    >
                      <SelectTrigger
                        id="deptPhoneOwnerPosition"
                        className={cn("w-full", errors.phoneOwnerPosition && "border-rose-500 ring-2 ring-rose-500/20")}
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
                  <div className="grid gap-2 relative">
                    <Label htmlFor="deptPhoneOwnerDivision">
                      ตำแหน่ง / สังกัด <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="deptPhoneOwnerDivision"
                      value={phoneOwnerDivision}
                      onChange={(e) => {
                        setPhoneOwnerDivision(e.target.value);
                        if (e.target.value.trim()) setErrors((prev) => ({ ...prev, phoneOwnerDivision: undefined }));
                      }}
                      placeholder="เช่น ผู้อำนวยการศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร"
                      className={errors.phoneOwnerDivision ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                    />
                    <ErrorSpeechBubble message={errors.phoneOwnerDivision} />
                  </div>
                  <div className="grid gap-2 relative">
                    <Label htmlFor="deptPhoneReimbursementLimit">
                      เพดานสิทธิเบิก (บาท/เดือน)
                    </Label>
                    <Input
                      id="deptPhoneReimbursementLimit"
                      value={`${getPhoneReimbursementLimit(phoneOwnerPosition).toLocaleString()} บาท`}
                      disabled
                      readOnly
                      className="bg-muted/60 text-foreground cursor-not-allowed font-medium select-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      * คำนวณอัตโนมัติตามประเภทและระดับตำแหน่งที่เลือก
                    </p>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full gap-2 shadow-xs"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {createMutation.isPending ? "กำลังบันทึก..." : "บันทึกหมายเลขผู้ใช้"}
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
