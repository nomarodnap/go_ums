"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { updateBill, getLatestEstimatedAmount } from "@/server/actions/bills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePickerBE } from "@/components/ui/date-picker-be";
import { MonthPickerBE } from "@/components/ui/month-picker-be";
import { ErrorSpeechBubble } from "@/components/ui/error-speech-bubble";
import { format } from "date-fns";
import {
  Building2,
  Receipt,
  CalendarClock,
  UploadCloud,
  X,
  Banknote,
  ExternalLink,
  AlertCircle,
  Flag,
  FileText,
  Gauge,
  MapPin,
} from "lucide-react";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { ServiceNumberPresets } from "@/components/bills/service-number-presets";
import { ServiceNumberCombobox } from "@/components/bills/service-number-combobox";
import { cn } from "@/lib/utils";

type Department = {
  id: string;
  fullName: string;
  shortName?: string | null;
  division?: string | null;
  costCenterCode?: string | null;
  depositUnit?: string | null;
  type?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type BudgetCodeOption = {
  id: string;
  code: string;
  name: string;
  fiscalYear: number;
  description?: string | null;
  isActive?: boolean;
};

export function EditBillForm({
  departments,
  services = [],
  budgetCodes = [],
  initialData,
}: {
  departments: Department[];
  services?: any[];
  budgetCodes?: BudgetCodeOption[];
  initialData: any;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, formAction, isPending] = useActionState(updateBill, null);
  const fieldErrors =
    typeof state?.error === "object"
      ? (state.error as Record<string, string[]>)
      : {};

  const toDateInputString = (val: any) => {
    if (!val) return "";
    if (typeof val === "string") return val.slice(0, 10);
    try {
      return format(new Date(val), "yyyy-MM-dd");
    } catch {
      return "";
    }
  };

  const [selectedDept, setSelectedDept] = useState(
    initialData?.departmentId || "",
  );
  const [selectedUtility, setSelectedUtility] = useState(
    initialData?.utilityType || "",
  );
  const [selectedServiceNumbers, setSelectedServiceNumbers] = useState<
    string[]
  >(
    initialData?.serviceNumber
      ? initialData.serviceNumber.split(",").map((s: string) => s.trim())
      : [],
  );
  const [paymentStatus, setPaymentStatus] = useState(
    initialData?.paymentStatus || "PENDING",
  );
  const [invoiceStatus, setInvoiceStatus] = useState(
    initialData?.invoiceStatus || "NOT_RECEIVED",
  );
  const [receiptStatus, setReceiptStatus] = useState<string>(
    initialData?.attachmentReceipt && initialData.attachmentReceipt.trim() !== "" ? "RECEIVED" : "NOT_RECEIVED",
  );
  const [disbursingType, setDisbursingType] = useState(() => {
    if (initialData?.departmentId) {
      const dept = departments.find((d) => d.id === initialData.departmentId);
      if (dept && !dept.costCenterCode) return "หน่วยฝากเบิก";
    }
    return (initialData?.isPendingBillOnly || initialData?.disbursingType === "หน่วยงานฝากเบิก" || initialData?.disbursingType === "หน่วยฝากเบิก") ? "หน่วยฝากเบิก" : "หน่วยเบิกจ่าย";
  });
  const [depositUnitId, setDepositUnitId] = useState(() => {
    if (initialData?.depositUnitId) {
      return initialData.depositUnitId;
    }
    if (initialData?.departmentId) {
      const dept = departments.find((d) => d.id === initialData.departmentId);
      if (dept?.type === "central") {
        const fin = departments.find(
          (d) =>
            d.fullName.includes("กองบริหารการคลัง") ||
            d.shortName === "กบค." ||
            d.shortName === "กบค" ||
            d.fullName.includes("การคลัง"),
        );
        if (fin) return fin.id;
      }
    }
    return "";
  });
  const [costCenterCode, setCostCenterCode] = useState(() => {
    if (initialData?.depositUnitId) {
      const dep = departments.find((d) => d.id === initialData.depositUnitId);
      if (dep?.costCenterCode) return dep.costCenterCode;
    }
    if (initialData?.departmentId) {
      const dept = departments.find((d) => d.id === initialData.departmentId);
      if (dept?.costCenterCode) return dept.costCenterCode;
    }
    return "";
  });

  const [invoiceDate, setInvoiceDate] = useState<string>(
    toDateInputString(initialData?.invoiceDate),
  );
  const [receivedDate, setReceivedDate] = useState<string>(
    toDateInputString(initialData?.receivedDate),
  );
  const [sentToDisbursingDate, setSentToDisbursingDate] = useState<string>(
    toDateInputString(initialData?.sentToDisbursingDate),
  );
  const [disbursingReceivedDate, setDisbursingReceivedDate] = useState<string>(
    toDateInputString(initialData?.disbursingReceivedDate),
  );
  const [paymentDate, setPaymentDate] = useState<string>(
    toDateInputString(initialData?.paymentDate),
  );
  const [documentRef, setDocumentRef] = useState<string>(
    initialData?.invoiceNumber || initialData?.documentRef || "",
  );
  const [unitsUsed, setUnitsUsed] = useState<string>(
    initialData?.usageAmount !== undefined && initialData?.usageAmount !== null
      ? String(initialData.usageAmount)
      : initialData?.unitsUsed !== undefined && initialData?.unitsUsed !== null
        ? String(initialData.unitsUsed)
        : "",
  );
  const [paymentDocNumber, setPaymentDocNumber] = useState<string>(
    initialData?.paymentDocNumber || "",
  );
  const [docType, setDocType] = useState<string>(initialData?.docType || "");


  useEffect(() => {
    const code =
      disbursingType === "หน่วยฝากเบิก" && depositUnitId
        ? departments.find((d) => d.id === depositUnitId)?.costCenterCode || ""
        : departments.find((d) => d.id === selectedDept)?.costCenterCode || "";
    if (code) {
      setCostCenterCode(code);
    }
  }, [selectedDept, disbursingType, depositUnitId, departments]);
  const getAccountCode = (utility: string) => {
    switch (utility) {
      case "ค่าไฟฟ้า":
        return "5104020101";
      case "ค่าประปา&น้ำบาดาล":
        return "5104020103";
      case "ค่าโทรศัพท์":
        return "5104020105";
      case "ค่าสื่อสาร&โทรคมนาคม":
        return "5104020106";
      case "ค่าบริการไปรษณีย์":
        return "5104020107";
      default:
        return "";
    }
  };

  const [accountCode, setAccountCode] = useState(
    initialData?.accountCode || getAccountCode(initialData?.utilityType || ""),
  );
  const [budgetCode, setBudgetCode] = useState(initialData?.budgetCode || "");
  const [billingMonthStr, setBillingMonthStr] = useState<string>(
    initialData?.billingYear
      ? `${initialData.billingYear}-${String(initialData.billingMonth).padStart(2, "0")}`
      : "",
  );
  const [estimatedAmount, setEstimatedAmount] = useState<number | "">(
    initialData?.estimatedAmount || "",
  );
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState<File | null>(null);
  const [selectedReceiptFile, setSelectedReceiptFile] = useState<File | null>(null);
  const [selectedDirectPaymentFile, setSelectedDirectPaymentFile] = useState<File | null>(null);

  const currentFiscalYear = useMemo(() => {
    if (billingMonthStr) {
      const [yr, mo] = billingMonthStr.split("-").map(Number);
      if (yr && mo) {
        const be = yr + 543;
        return mo >= 10 ? be + 1 : be;
      }
    }
    const now = new Date();
    const be = now.getFullYear() + 543;
    return now.getMonth() >= 9 ? be + 1 : be;
  }, [billingMonthStr]);

  const sortedBudgetCodes = useMemo(() => {
    if (!budgetCodes || budgetCodes.length === 0) return [];
    return [...budgetCodes].sort((a, b) => {
      const aIsCurrent = a.fiscalYear === currentFiscalYear ? 1 : 0;
      const bIsCurrent = b.fiscalYear === currentFiscalYear ? 1 : 0;
      if (aIsCurrent !== bIsCurrent) return bIsCurrent - aIsCurrent;
      return b.fiscalYear - a.fiscalYear;
    });
  }, [budgetCodes, currentFiscalYear]);
  const [serviceAmounts, setServiceAmounts] = useState<Record<string, string>>(
    () => {
      if (initialData?.serviceBreakdown) {
        try {
          const parsed =
            typeof initialData.serviceBreakdown === "string"
              ? JSON.parse(initialData.serviceBreakdown)
              : initialData.serviceBreakdown;
          if (parsed && typeof parsed === "object") {
            return parsed;
          }
        } catch (e) {
          console.error("Error parsing serviceBreakdown:", e);
        }
      }
      if (initialData?.serviceNumber && initialData?.invoiceAmount) {
        const numbers = initialData.serviceNumber
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (numbers.length === 1) {
          return { [numbers[0]]: String(initialData.invoiceAmount) };
        }
      }
      return {};
    },
  );

  const handleServiceAmountChange = (sn: string, val: string) => {
    setServiceAmounts((prev) => ({
      ...prev,
      [sn]: val,
    }));
  };

  const hasEnteredAnyAmount = selectedServiceNumbers.some(
    (sn) => serviceAmounts[sn] !== undefined && serviceAmounts[sn] !== "",
  );

  const totalCalculatedAmount = selectedServiceNumbers.reduce((sum, sn) => {
    const val = parseFloat(serviceAmounts[sn] || "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const displayTotalAmount = hasEnteredAnyAmount
    ? totalCalculatedAmount.toFixed(2)
    : initialData?.invoiceAmount
      ? String(initialData.invoiceAmount)
      : "";

  useEffect(() => {
    async function fetchEstimated() {
      if (billingMonthStr && selectedServiceNumbers.length > 0) {
        const serviceNumberString = selectedServiceNumbers.join(", ");
        const amount = await getLatestEstimatedAmount(
          serviceNumberString,
          billingMonthStr,
        );
        if (amount !== null) {
          setEstimatedAmount(amount);
        } else {
          setEstimatedAmount("");
        }
      } else {
        setEstimatedAmount("");
      }
    }

    // Only fetch if it changed from initial data, to avoid overriding the saved estimate unnecessarily
    // But since this runs on mount, if billingMonthStr matches initial, we shouldn't overwrite unless they change it.
    const initialMonthStr = initialData?.billingYear
      ? `${initialData.billingYear}-${String(initialData.billingMonth).padStart(2, "0")}`
      : "";
    const initialServiceNumbers = initialData?.serviceNumber
      ? initialData.serviceNumber
          .split(",")
          .map((s: string) => s.trim())
          .join(",")
      : "";
    const currentServiceNumbers = selectedServiceNumbers.join(",");

    if (
      billingMonthStr !== initialMonthStr ||
      currentServiceNumbers !== initialServiceNumbers
    ) {
      fetchEstimated();
    }
  }, [billingMonthStr, selectedServiceNumbers, initialData]);

  const mainDepartments = initialData?.departmentId
    ? departments.filter((d) => d.id === initialData.departmentId)
    : departments;

  const [paidAmountVal, setPaidAmountVal] = useState(
    initialData?.paidAmount ? String(initialData.paidAmount) : "",
  );

  const deptServices = services.filter((s) => s.departmentId === selectedDept);
  const utilityServices = deptServices.filter(
    (s) => s.utilityType === selectedUtility,
  );

  const maxReimbursableAmount = useMemo(() => {
    if (selectedUtility !== "ค่าโทรศัพท์") return null;
    let total = 0;
    let hasLimit = false;
    for (const sn of selectedServiceNumbers) {
      const svc = utilityServices.find((s) => s.serviceNumber === sn);
      const billed = parseFloat(serviceAmounts[sn] || "0") || 0;
      if (svc?.phoneReimbursementLimit && svc.phoneReimbursementLimit > 0) {
        hasLimit = true;
        total += Math.min(billed, svc.phoneReimbursementLimit);
      } else {
        total += billed;
      }
    }
    return hasLimit ? total : null;
  }, [
    selectedUtility,
    selectedServiceNumbers,
    utilityServices,
    serviceAmounts,
  ]);

  const isPaidOverLimit =
    selectedUtility === "ค่าโทรศัพท์" &&
    maxReimbursableAmount !== null &&
    parseFloat(paidAmountVal || "0") > maxReimbursableAmount + 0.001;

  const firstService = utilityServices.find(
    (s) => s.serviceNumber === selectedServiceNumbers[0],
  );
  const provider = firstService?.provider || "";
  const selectedLocation = firstService?.locationType || "";

  const selectedDeptData = departments.find((d) => d.id === selectedDept);

  const financeDept = useMemo(() => {
    return (
      departments.find(
        (d) =>
          d.fullName.includes("กองบริหารการคลัง") ||
          d.shortName === "กบค." ||
          d.shortName === "กบค" ||
          d.fullName.includes("การคลัง"),
      ) || null
    );
  }, [departments]);

  const isCentralDept = selectedDeptData?.type === "central";

  const hasCostCenter = Boolean(
    selectedDeptData?.costCenterCode &&
      selectedDeptData.costCenterCode.trim() !== "" &&
      selectedDeptData.costCenterCode !== "-",
  );

  const depositUnitDept = useMemo(() => {
    if (depositUnitId) {
      const found = departments.find((d) => d.id === depositUnitId);
      if (found) return found;
    }
    if (isCentralDept && financeDept) {
      return financeDept;
    }
    if (selectedDeptData?.depositUnit) {
      return (
        departments.find((d) => d.id === selectedDeptData.depositUnit) || null
      );
    }
    return null;
  }, [depositUnitId, departments, isCentralDept, financeDept, selectedDeptData]);

  const depositUnitName =
    depositUnitDept?.fullName ||
    initialData?.depositUnitName ||
    (isCentralDept ? financeDept?.fullName || "กองบริหารการคลัง" : "-");

  const depositUnitCostCenter =
    depositUnitDept?.costCenterCode ||
    (isCentralDept ? financeDept?.costCenterCode : null) ||
    "-";

  useEffect(() => {
    if (hasCostCenter) {
      if (disbursingType !== "หน่วยเบิกจ่าย") {
        setDisbursingType("หน่วยเบิกจ่าย");
      }
      if (depositUnitId !== "") {
        setDepositUnitId("");
      }
    } else {
      if (disbursingType !== "หน่วยฝากเบิก") {
        setDisbursingType("หน่วยฝากเบิก");
      }
      if (isCentralDept && financeDept) {
        if (depositUnitId !== financeDept.id) {
          setDepositUnitId(financeDept.id);
        }
      } else if (!depositUnitId && selectedDeptData?.depositUnit) {
        setDepositUnitId(selectedDeptData.depositUnit);
      }
    }
  }, [hasCostCenter, disbursingType, depositUnitId, isCentralDept, financeDept, selectedDeptData]);

  const getDeptTypeName = (type: string | null | undefined) => {
    if (type === "central") return "ส่วนกลาง";
    if (type === "regional_central") return "ส่วนภูมิภาค (ส่วนกลาง)";
    if (type === "regional") return "ส่วนภูมิภาค";
    return type || "-";
  };

  const handleDeptChange = (val: string | null) => {
    if (!val) return;
    setSelectedDept(val);
    setSelectedUtility("");
    setSelectedServiceNumbers([]);
    setServiceAmounts({});

    const dept = departments.find((d) => d.id === val);
    if (dept && !dept.costCenterCode) {
      setDisbursingType("หน่วยฝากเบิก");
      if (dept.type === "central" && financeDept) {
        setDepositUnitId(financeDept.id);
      } else {
        setDepositUnitId(dept.depositUnit || "");
      }
    } else {
      setDisbursingType("หน่วยเบิกจ่าย");
      setDepositUnitId("");
    }
  };

  const handleUtilityChange = (val: string | null) => {
    if (!val) return;
    setSelectedUtility(val);
    setSelectedServiceNumbers([]);
    setServiceAmounts({});
    setAccountCode(getAccountCode(val));
  };

  const addServiceNumber = (val: string | null) => {
    if (val && !selectedServiceNumbers.includes(val)) {
      setSelectedServiceNumbers(
        [...selectedServiceNumbers, val].sort((a, b) =>
          a.localeCompare(b, "th"),
        ),
      );
    }
  };

  const removeServiceNumber = (val: string) => {
    setSelectedServiceNumbers(
      selectedServiceNumbers.filter((sn) => sn !== val),
    );
    setServiceAmounts((prev) => {
      const next = { ...prev };
      delete next[val];
      return next;
    });
  };

  useEffect(() => {
    if (state?.success) {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/bills"),
      });
      router.refresh();
      router.back();
    }
  }, [state?.success, router, queryClient]);

  useEffect(() => {
    if (state?.error) {
      setTimeout(() => {
        const firstErrorEl = document.querySelector("[data-has-error='true']");
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [state?.error]);

  const handleFormSubmit = (formData: FormData) => {
    formData.set("receiptStatus", receiptStatus);
    if (selectedInvoiceFile) {
      formData.set("attachmentInvoice", selectedInvoiceFile);
    }
    if (receiptStatus === "RECEIVED" && selectedReceiptFile) {
      formData.set("attachmentReceipt", selectedReceiptFile);
    }
    if (selectedDirectPaymentFile) {
      formData.set("attachmentDirectPayment", selectedDirectPaymentFile);
    }
    formAction(formData);
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>อัพเดทข้อมูลค่าใช้จ่าย</CardTitle>
        <CardDescription>
          อัพเดทข้อมูลรายละเอียดค่าใช้จ่ายสาธารณูปโภคประจำเดือน
        </CardDescription>
      </CardHeader>
      <form noValidate action={handleFormSubmit}>
        <input type="hidden" name="billId" value={initialData.id} />
        <CardContent className="space-y-6">
          {state?.error && typeof state.error === "string" && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20 font-medium">
              {state.error}
            </div>
          )}

          {state?.error && typeof state.error === "object" && (
            <div className="flex items-center gap-3 p-3.5 text-sm text-rose-700 bg-rose-50/90 rounded-2xl border border-rose-200/80 shadow-xs dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 animate-in fade-in-0 duration-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="flex-1">
                <p className="font-semibold text-rose-900 dark:text-rose-200">
                  พบข้อมูลที่ต้องแก้ไข ({Object.keys(state.error).length} รายการ)
                </p>
                <p className="text-xs text-rose-700/90 dark:text-rose-400 mt-0.5">
                  โปรดตรวจสอบและแก้ไขข้อมูลในช่องที่มีบอลลูนแจ้งเตือนสีแดงด้านล่าง
                </p>
              </div>
            </div>
          )}

          {state?.success && (
            <div className="p-3 text-sm text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
              บันทึกข้อมูลสำเร็จ
            </div>
          )}

          {/* Anomaly Notice from Auditor */}
          {initialData?.isManualAnomaly && (initialData.manualAnomalyReason || initialData.manualAnomalyDetail) && (
            <div className="flex items-start gap-3.5 p-4 text-sm text-destructive bg-destructive/10 rounded-2xl border border-destructive/20 shadow-xs animate-in fade-in-0 duration-200">
              <Flag className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-destructive text-sm">
                    ข้อสังเกตความผิดปกติจากผู้ตรวจสอบ
                  </span>
                  {initialData.manualAnomalyReason && (
                    <Badge variant="destructive" className="text-xs font-normal">
                      {initialData.manualAnomalyReason}
                    </Badge>
                  )}
                </div>
                {initialData.manualAnomalyDetail && (
                  <p className="text-xs text-destructive/90 whitespace-pre-line leading-relaxed">
                    {initialData.manualAnomalyDetail}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Group 1: ข้อมูลทั่วไป */}
          <div className="space-y-4 rounded-2xl border bg-card/50 p-4 shadow-xs">
            <div className="flex items-center gap-2 border-b pb-3">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg tracking-tight">ข้อมูลทั่วไป</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="grid gap-2 relative md:col-span-2" data-has-error={!!fieldErrors?.departmentId}>
                <Label htmlFor="departmentId">ชื่อหน่วยงาน</Label>
                <input type="hidden" name="departmentId" value={selectedDept} />
                <Input
                  id="departmentId"
                  type="text"
                  value={selectedDeptData?.fullName || "ไม่ระบุหน่วยงาน"}
                  readOnly
                  disabled
                  className="bg-background disabled:bg-background disabled:opacity-100 disabled:cursor-not-allowed font-medium text-foreground shadow-2xs"
                />
                <ErrorSpeechBubble message={fieldErrors?.departmentId} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="disbursingType">ประเภทหน่วยงาน</Label>
                <input type="hidden" name="disbursingType" value={disbursingType} />
                <Input
                  id="disbursingType"
                  type="text"
                  value={disbursingType}
                  readOnly
                  disabled
                  className="bg-background disabled:bg-background disabled:opacity-100 disabled:cursor-not-allowed font-medium text-foreground shadow-2xs"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="deptType">ระดับหน่วยงาน</Label>
                <Input
                  type="text"
                  id="deptType"
                  value={getDeptTypeName(selectedDeptData?.type)}
                  readOnly
                  disabled
                  className="bg-background disabled:bg-background disabled:opacity-100 disabled:cursor-not-allowed font-medium text-foreground shadow-2xs"
                />
              </div>

              {hasCostCenter ? (
                <>
                  {/* กรณีมีรหัสศูนย์ต้นทุน: บังคับเป็นหน่วยเบิกจ่าย แสดงรหัสศูนย์ต้นทุน */}
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="costCenterCode">รหัสศูนย์ต้นทุน</Label>
                    <Input
                      type="text"
                      id="costCenterCode"
                      value={selectedDeptData?.costCenterCode || "-"}
                      readOnly
                      disabled
                      className="bg-background disabled:bg-background disabled:opacity-100 disabled:cursor-not-allowed font-mono font-medium text-foreground shadow-2xs"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* กรณีไม่มีรหัสศูนย์ต้นทุน: บังคับเป็นหน่วยฝากเบิก แสดงฝากเบิกกับหน่วยงาน (ล็อค) + รหัสศูนย์ต้นทุนของหน่วยงานที่ฝากให้เบิกจ่าย */}
                  <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.depositUnitId}>
                    <Label htmlFor="depositUnit">ฝากเบิกกับหน่วยงาน</Label>
                    <input
                      type="hidden"
                      name="depositUnit"
                      value={depositUnitDept?.id || depositUnitId}
                    />
                    <Input
                      id="depositUnit"
                      type="text"
                      value={depositUnitName}
                      readOnly
                      disabled
                      className="bg-background disabled:bg-background disabled:opacity-100 disabled:cursor-not-allowed font-medium text-foreground shadow-2xs"
                    />
                    <ErrorSpeechBubble message={fieldErrors?.depositUnitId} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="depositUnitCostCenter">
                      รหัสศูนย์ต้นทุนของหน่วยงานที่ฝากให้เบิกจ่าย
                    </Label>
                    <Input
                      type="text"
                      id="depositUnitCostCenter"
                      value={depositUnitCostCenter}
                      readOnly
                      disabled
                      className="bg-background disabled:bg-background disabled:opacity-100 disabled:cursor-not-allowed font-mono font-medium text-foreground shadow-2xs"
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground md:col-span-2 -mt-2.5 whitespace-nowrap">
                    * กรณีประสงค์เปลี่ยนแปลงหน่วยงานที่รับฝากเบิกจ่าย กรุณาติดต่อกลุ่มตรวจสอบภายใน (กตน.)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Group 2: ใบแจ้งหนี้ค่าสาธารณูปโภค */}
          <div className="space-y-4 rounded-2xl border bg-card/50 p-4 shadow-xs">
            <div className="flex items-center gap-2 border-b pb-3">
              <Receipt className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg tracking-tight">
                ใบแจ้งหนี้ค่าสาธารณูปโภค
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.utilityType}>
                <Label htmlFor="utilityType">
                  ประเภทสาธารณูปโภค <span className="text-destructive">*</span>
                </Label>
                <Select
                  name="utilityType"
                  value={selectedUtility}
                  onValueChange={handleUtilityChange}
                >
                  <SelectTrigger className={fieldErrors?.utilityType ? "border-rose-500 ring-2 ring-rose-500/20" : ""}>
                    <SelectValue placeholder="เลือกประเภทสาธารณูปโภค" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ค่าไฟฟ้า" label="ค่าไฟฟ้า">
                      ค่าไฟฟ้า
                    </SelectItem>
                    <SelectItem value="ค่าประปา&น้ำบาดาล" label="ค่าประปา&น้ำบาดาล">
                      ค่าประปา&น้ำบาดาล
                    </SelectItem>
                    <SelectItem value="ค่าโทรศัพท์" label="ค่าโทรศัพท์">
                      ค่าโทรศัพท์
                    </SelectItem>
                    <SelectItem
                      value="ค่าสื่อสาร&โทรคมนาคม"
                      label="ค่าสื่อสาร&โทรคมนาคม"
                    >
                      ค่าสื่อสาร&โทรคมนาคม
                    </SelectItem>
                    <SelectItem value="ค่าบริการไปรษณีย์" label="ค่าบริการไปรษณีย์">
                      ค่าบริการไปรษณีย์
                    </SelectItem>
                  </SelectContent>
                </Select>
                <ErrorSpeechBubble message={fieldErrors?.utilityType} />
              </div>

              {/* Redesigned Service Number Section */}
              <div
                className="md:col-span-2 rounded-2xl border bg-muted/20 dark:bg-muted/10 p-4.5 space-y-4 relative transition-all shadow-2xs"
                data-has-error={!!fieldErrors?.serviceNumber}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between gap-3 flex-wrap border-b pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Gauge className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="serviceNumber" className="font-semibold text-sm">
                          หมายเลขผู้ใช้ / รหัสเครื่องวัด
                        </Label>
                        <span className="text-destructive font-bold">*</span>
                        {selectedServiceNumbers.length > 0 && (
                          <Badge variant="secondary" className="text-[11px] px-2 py-0 h-5 font-medium bg-primary/15 text-primary border-primary/20">
                            เลือกแล้ว {selectedServiceNumbers.length} หมายเลข
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        สามารถเลือกได้หลายหมายเลขสำหรับบิลที่ชำระรวมกัน
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <ServiceNumberPresets
                      departmentId={selectedDept}
                      utilityType={selectedUtility}
                      availableServices={utilityServices}
                      currentSelected={selectedServiceNumbers}
                      onApplyPreset={(numbers) => {
                        setSelectedServiceNumbers(numbers);
                      }}
                    />
                  </div>
                </div>

                {/* Selection Dropdown */}
                <div className="space-y-2">
                  <ServiceNumberCombobox
                    id="serviceNumber"
                    services={utilityServices}
                    selectedNumbers={selectedServiceNumbers}
                    onSelect={addServiceNumber}
                    disabled={!selectedUtility || utilityServices.length === 0}
                    hasError={!!fieldErrors?.serviceNumber}
                  />

                  <input
                    type="hidden"
                    name="serviceNumber"
                    value={selectedServiceNumbers.join(", ")}
                  />
                  <input
                    type="hidden"
                    name="serviceBreakdown"
                    value={JSON.stringify(serviceAmounts)}
                  />
                  <ErrorSpeechBubble message={fieldErrors?.serviceNumber} />
                </div>

                {/* Selected Numbers List Chips */}
                {selectedServiceNumbers.length > 0 ? (
                  <div className="p-3 rounded-xl bg-background/90 border shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground text-[11px]">
                        หมายเลขที่เลือก ({selectedServiceNumbers.length}):
                      </span>
                      {selectedServiceNumbers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedServiceNumbers([]);
                            setServiceAmounts({});
                          }}
                          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors underline"
                        >
                          ล้างทั้งหมด
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedServiceNumbers.map((sn) => {
                        const svc = utilityServices.find((s) => s.serviceNumber === sn);
                        return (
                          <div
                            key={sn}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-primary/10 border border-primary/20 text-foreground shadow-2xs"
                          >
                            <span className="font-mono font-medium">{sn}</span>
                            {svc?.provider && (
                              <span className="text-[10px] text-muted-foreground">
                                ({svc.provider})
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeServiceNumber(sn)}
                              className="size-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-0.5"
                              title="ลบหมายเลขนี้"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-2.5 px-4 rounded-xl border border-dashed bg-muted/20 text-center text-xs text-muted-foreground">
                    ยังไม่ได้เลือกหมายเลข (คลิกที่ช่องด้านบนเพื่อเลือกหมายเลข)
                  </div>
                )}

                {/* Detected Metadata Summary (Provider & Location) */}
                <div className="pt-2.5 border-t flex items-center justify-between flex-wrap gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    <span>ผู้ให้บริการ:</span>
                    <span className="font-medium text-foreground">
                      {provider || "ตรวจจับอัตโนมัติจากหมายเลขที่เลือก"}
                    </span>
                    <input type="hidden" name="provider" value={provider} />
                  </div>

                  {(selectedUtility === "ค่าไฟฟ้า" ||
                    selectedUtility === "ค่าประปา&น้ำบาดาล") && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      <span>ที่ตั้ง:</span>
                      <span className="font-medium text-foreground">
                        {selectedLocation || "ตรวจจับอัตโนมัติจากหมายเลขที่เลือก"}
                      </span>
                    </div>
                  )}
                  <input
                    type="hidden"
                    name="locationType"
                    value={
                      selectedUtility === "ค่าไฟฟ้า" ||
                      selectedUtility === "ค่าประปา&น้ำบาดาล"
                        ? selectedLocation
                        : ""
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.billingMonth}>
                <Label htmlFor="billingMonth">
                  รอบบิลประจำเดือน <span className="text-destructive">*</span>
                </Label>
                <MonthPickerBE
                  id="billingMonth"
                  name="billingMonth"
                  value={billingMonthStr}
                  required
                  onChange={(val) => setBillingMonthStr(val)}
                  className={fieldErrors?.billingMonth ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                />
                <ErrorSpeechBubble message={fieldErrors?.billingMonth} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="estimatedAmount">ค่าใช้จ่ายโดยประมาณการ</Label>
                <Input
                  type="number"
                  step="0.01"
                  id="estimatedAmount"
                  name="estimatedAmount"
                  value={estimatedAmount}
                  readOnly
                  className="bg-muted"
                  placeholder="ระบบคำนวณอัตโนมัติ"
                />
              </div>
            </div>
          </div>

          {/* Group 3: การรับใบแจ้งหนี้ */}
          <div className="space-y-4 rounded-2xl border bg-card/50 p-4 shadow-xs">
            <div className="flex items-center gap-2 border-b pb-3">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg tracking-tight">
                การรับใบแจ้งหนี้
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="grid gap-2">
                <Label>
                  สถานะใบแจ้งหนี้ <span className="text-destructive">*</span>
                </Label>
                <input
                  type="hidden"
                  name="invoiceStatus"
                  value={invoiceStatus}
                />
                <RadioGroup
                  value={invoiceStatus}
                  onValueChange={(val) => {
                    setInvoiceStatus(val);
                    if (val === "NOT_RECEIVED") {
                      setPaymentStatus("PENDING");
                      setReceiptStatus("NOT_RECEIVED");
                      setSelectedReceiptFile(null);
                    }
                  }}
                  name="invoiceStatus"
                  className="flex flex-col space-y-2 mt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="NOT_RECEIVED" id="not_received" />
                    <Label
                      htmlFor="not_received"
                      className="font-normal cursor-pointer"
                    >
                      ยังไม่ได้รับใบแจ้งหนี้
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="RECEIVED" id="received" />
                    <Label
                      htmlFor="received"
                      className="font-normal cursor-pointer"
                    >
                      ได้รับใบแจ้งหนี้แล้ว
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {invoiceStatus === "RECEIVED" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-dashed mt-2">
                  <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.invoiceDate}>
                    <Label htmlFor="invoiceDate">
                      วันที่ใบแจ้งหนี้ <span className="text-destructive">*</span>
                    </Label>
                    <DatePickerBE
                      id="invoiceDate"
                      name="invoiceDate"
                      value={invoiceDate}
                      onChange={(_, str) => setInvoiceDate(str)}
                      required={true}
                      className={fieldErrors?.invoiceDate ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                    />
                    <ErrorSpeechBubble message={fieldErrors?.invoiceDate} />
                  </div>

                  <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.receivedDate}>
                    <Label htmlFor="receivedDate">
                      วันที่ลงรับใบแจ้งหนี้ <span className="text-destructive">*</span>
                    </Label>
                    <DatePickerBE
                      id="receivedDate"
                      name="receivedDate"
                      value={receivedDate}
                      onChange={(_, str) => setReceivedDate(str)}
                      required={true}
                      className={fieldErrors?.receivedDate ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                    />
                    <ErrorSpeechBubble message={fieldErrors?.receivedDate} />
                  </div>

                  {disbursingType === "หน่วยฝากเบิก" && (
                    <>
                      <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.sentToDisbursingDate}>
                        <Label htmlFor="sentToDisbursingDate">
                          วันที่หน่วยฝากเบิกส่งเอกสาร
                        </Label>
                        <DatePickerBE
                          id="sentToDisbursingDate"
                          name="sentToDisbursingDate"
                          value={sentToDisbursingDate}
                          onChange={(_, str) => setSentToDisbursingDate(str)}
                          required={false}
                          className={fieldErrors?.sentToDisbursingDate ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                        />
                        <ErrorSpeechBubble message={fieldErrors?.sentToDisbursingDate} />
                      </div>

                      <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.disbursingReceivedDate}>
                        <Label htmlFor="disbursingReceivedDate">
                          วันที่หน่วยเบิกจ่ายลงรับใบสำคัญ
                        </Label>
                        <DatePickerBE
                          id="disbursingReceivedDate"
                          name="disbursingReceivedDate"
                          value={disbursingReceivedDate}
                          onChange={(_, str) => setDisbursingReceivedDate(str)}
                          required={false}
                          className={fieldErrors?.disbursingReceivedDate ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                        />
                        <ErrorSpeechBubble message={fieldErrors?.disbursingReceivedDate} />
                      </div>
                    </>
                  )}

                  {/* Breakdown by Service Number */}
                  <div className="md:col-span-2 space-y-3 rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <Label className="font-semibold text-sm flex items-center gap-2">
                        <span>ระบุจำนวนเงินตามหมายเลขผู้ใช้ / รหัสเครื่องวัด</span>
                        <Badge
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          {selectedServiceNumbers.length} หมายเลข
                        </Badge>
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        ระบบจะรวมยอดเงินให้อัตโนมัติ
                      </span>
                    </div>

                    {selectedServiceNumbers.length === 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 py-1">
                        * กรุณาเลือกหมายเลขผู้ใช้ / รหัสเครื่องวัดในส่วนใบแจ้งหนี้ด้านบนก่อน
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {selectedServiceNumbers.map((sn, idx) => {
                          const svcInfo = utilityServices.find(
                            (s) => s.serviceNumber === sn,
                          );
                          const isOverLimit =
                            selectedUtility === "ค่าโทรศัพท์" &&
                            svcInfo?.phoneReimbursementLimit &&
                            parseFloat(serviceAmounts[sn] || "0") >
                              svcInfo.phoneReimbursementLimit;

                          return (
                            <div key={sn} className="grid gap-1.5">
                              <div className="flex items-center justify-between">
                                <Label
                                  htmlFor={`service_amount_${idx}`}
                                  className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 flex-wrap"
                                >
                                  <span>
                                    หมายเลข:{" "}
                                    <span className="font-semibold text-foreground">
                                      {sn}
                                    </span>
                                    {svcInfo?.phoneOwnerName && (
                                      <span className="text-muted-foreground ml-1 font-normal">
                                        ({svcInfo.phoneOwnerName})
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-destructive">*</span>
                                </Label>
                                {svcInfo?.phoneReimbursementLimit && (
                                  <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-normal">
                                    สิทธิ: ฿
                                    {svcInfo.phoneReimbursementLimit.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              <Input
                                type="number"
                                step="0.01"
                                id={`service_amount_${idx}`}
                                value={serviceAmounts[sn] || ""}
                                onChange={(e) =>
                                  handleServiceAmountChange(sn, e.target.value)
                                }
                                placeholder="0.00"
                                required
                                className={
                                  isOverLimit
                                    ? "border-amber-500 focus-visible:ring-amber-500"
                                    : ""
                                }
                              />
                              {isOverLimit && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                  ⚠️ เกินสิทธิเบิกจ่ายประจำเดือน (฿
                                  {svcInfo.phoneReimbursementLimit?.toLocaleString()}
                                  )
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.amountBaht}>
                    <Label htmlFor="amountBaht">
                      รวมเป็นจำนวนเงิน (บาท){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      id="amountBaht"
                      name="amountBaht"
                      value={displayTotalAmount}
                      readOnly
                      className={cn("bg-muted cursor-not-allowed font-medium", fieldErrors?.amountBaht ? "border-rose-500 ring-2 ring-rose-500/20" : "")}
                      placeholder="0.00"
                      required
                    />
                    <ErrorSpeechBubble message={fieldErrors?.amountBaht} />
                  </div>

                  {(selectedUtility === "ค่าไฟฟ้า" ||
                    selectedUtility === "ค่าประปา&น้ำบาดาล") && (
                    <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.unitsUsed}>
                      <Label htmlFor="unitsUsed">
                        ปริมาณการใช้ (หน่วย){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        id="unitsUsed"
                        name="unitsUsed"
                        value={unitsUsed}
                        onChange={(e) => setUnitsUsed(e.target.value)}
                        placeholder="0.00"
                        required
                        className={
                          fieldErrors?.unitsUsed
                            ? "border-rose-500 ring-2 ring-rose-500/20"
                            : ""
                        }
                      />
                      <ErrorSpeechBubble message={fieldErrors?.unitsUsed} />
                    </div>
                  )}

                  <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.documentRef}>
                    <Label htmlFor="documentRef">
                      เลขที่ใบแจ้งหนี้ (Invoice)
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="documentRef"
                      name="documentRef"
                      value={documentRef}
                      onChange={(e) => setDocumentRef(e.target.value)}
                      placeholder="เช่น 6811000709"
                      required
                      className={fieldErrors?.documentRef ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                    />
                    <ErrorSpeechBubble message={fieldErrors?.documentRef} />
                  </div>

                  <FileUploadDropzone
                    id="attachmentInvoice"
                    name="attachmentInvoice"
                    label="เอกสารใบแจ้งหนี้"
                    required
                    accept=".pdf,image/*"
                    value={selectedInvoiceFile}
                    onChange={setSelectedInvoiceFile}
                    existingUrl={initialData?.attachmentInvoice}
                    errorMessage={fieldErrors?.attachmentInvoice}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Group 4: การเบิกจ่ายค่าสาธารณูปโภค */}
          <div className="space-y-4 rounded-2xl border bg-card/50 p-4 shadow-xs">
            <div className="flex items-center gap-2 border-b pb-3">
              <Banknote className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg tracking-tight">
                การเบิกจ่ายค่าสาธารณูปโภค
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="grid gap-2">
                <Label>
                  สถานะการเบิกจ่าย <span className="text-destructive">*</span>
                </Label>
                <input
                  type="hidden"
                  name="paymentStatus"
                  value={paymentStatus}
                />
                <RadioGroup
                  value={paymentStatus}
                  onValueChange={(val) => {
                    setPaymentStatus(val);
                    if (val !== "PAID") {
                      setReceiptStatus("NOT_RECEIVED");
                      setSelectedReceiptFile(null);
                    }
                  }}
                  name="paymentStatus"
                  className="flex flex-col space-y-2 mt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PENDING" id="payment_pending" />
                    <Label
                      htmlFor="payment_pending"
                      className="font-normal cursor-pointer"
                    >
                      ยังไม่ได้เบิกจ่าย
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="PAID"
                      id="payment_paid"
                      disabled={invoiceStatus === "NOT_RECEIVED"}
                    />
                    <Label
                      htmlFor="payment_paid"
                      className={`font-normal cursor-pointer ${invoiceStatus === "NOT_RECEIVED" ? "text-muted-foreground opacity-50" : ""}`}
                    >
                      เบิกจ่ายแล้ว
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {paymentStatus === "PAID" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-dashed mt-2">
                    <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.paymentDate}>
                      <Label htmlFor="paymentDate">
                        วันที่เอกสาร <span className="text-destructive">*</span>
                      </Label>
                      <DatePickerBE
                        id="paymentDate"
                        name="paymentDate"
                        value={paymentDate}
                        onChange={(_, str) => setPaymentDate(str)}
                        required={true}
                        className={fieldErrors?.paymentDate ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                      />
                      <ErrorSpeechBubble message={fieldErrors?.paymentDate} />
                    </div>

                    <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.costCenterCode}>
                      <Label htmlFor="costCenterCode">
                        รหัสศูนย์ต้นทุน <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="costCenterCode"
                        name="costCenterCode"
                        value={costCenterCode || ""}
                        readOnly
                        className={cn("bg-muted cursor-not-allowed", fieldErrors?.costCenterCode ? "border-rose-500 ring-2 ring-rose-500/20" : "")}
                        placeholder="ดึงจากหน่วยงานอัตโนมัติ"
                      />
                      {!costCenterCode && paymentStatus === "PAID" && (
                        <p className="text-xs text-destructive">
                          * ไม่พบรหัสศูนย์ต้นทุน
                          กรุณาตรวจสอบข้อมูลหน่วยงานหรือระบุหน่วยงานที่รับฝากเบิก
                        </p>
                      )}
                      <ErrorSpeechBubble message={fieldErrors?.costCenterCode} />
                    </div>

                    <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.budgetCode}>
                      <Label htmlFor="budgetCode">
                        รหัสงบประมาณ <span className="text-destructive">*</span>
                      </Label>
                      {sortedBudgetCodes.length > 0 ? (
                        <>
                          <input
                            type="hidden"
                            name="budgetCode"
                            value={budgetCode}
                          />
                          <Select
                            value={budgetCode}
                            onValueChange={(val) => val && setBudgetCode(val)}
                          >
                            <SelectTrigger id="budgetCode" className={cn("w-full", fieldErrors?.budgetCode ? "border-rose-500 ring-2 ring-rose-500/20" : "")}>
                              <SelectValue placeholder="-- เลือกรหัสงบประมาณ --">
                                {budgetCode
                                  ? (() => {
                                      const match = sortedBudgetCodes.find(
                                        (b) => b.code === budgetCode,
                                      );
                                      return match
                                        ? `${match.code} (พ.ศ. ${match.fiscalYear})${match.description ? ` - ${match.description}` : ""}`
                                        : budgetCode;
                                    })()
                                  : "-- เลือกรหัสงบประมาณ --"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {sortedBudgetCodes.map((b) => (
                                <SelectItem key={b.id} value={b.code}>
                                  <span className="font-mono font-semibold mr-1.5">
                                    {b.code}
                                  </span>{" "}
                                  (พ.ศ. {b.fiscalYear})
                                  {b.description ? ` - ${b.description}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <Input
                          type="text"
                          id="budgetCode"
                          name="budgetCode"
                          value={budgetCode}
                          onChange={(e) => setBudgetCode(e.target.value)}
                          placeholder="เช่น 2800100000000000"
                          required={true}
                          className={fieldErrors?.budgetCode ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                        />
                      )}
                      <ErrorSpeechBubble message={fieldErrors?.budgetCode} />
                    </div>

                    <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.paymentDocNumber}>
                      <Label htmlFor="paymentDocNumber">
                        เลขเอกสาร <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="paymentDocNumber"
                        name="paymentDocNumber"
                        value={paymentDocNumber}
                        onChange={(e) => setPaymentDocNumber(e.target.value)}
                        placeholder="เช่น 3100011102"
                        required={true}
                        className={fieldErrors?.paymentDocNumber ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                      />
                      <ErrorSpeechBubble message={fieldErrors?.paymentDocNumber} />
                    </div>

                    <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.docType}>
                      <Label htmlFor="docType">
                        ประเภทเอกสาร <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={docType}
                        onValueChange={(val) => setDocType(val || "")}
                        name="docType"
                        required={true}
                      >
                        <SelectTrigger
                          id="docType"
                          className={fieldErrors?.docType ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
                        >
                          <SelectValue placeholder="เลือกประเภทเอกสาร..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KC" label="KC">
                            KC
                          </SelectItem>
                          <SelectItem value="KE" label="KE">
                            KE
                          </SelectItem>
                          <SelectItem value="KI" label="KI">
                            KI
                          </SelectItem>
                          <SelectItem value="KL" label="KL">
                            KL
                          </SelectItem>
                          <SelectItem value="KN" label="KN">
                            KN
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <ErrorSpeechBubble message={fieldErrors?.docType} />
                    </div>

                    <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.accountCode}>
                      <Label htmlFor="accountCode">
                        รหัสแยกประเภท<span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="accountCode"
                        name="accountCode"
                        placeholder="ขึ้นให้อัตโนมัตสอดคล้องกับประเภทสาธารณูปโภคที่เลือก"
                        required={true}
                        value={accountCode}
                        onChange={() => {}}
                        readOnly
                        className={cn("bg-muted cursor-not-allowed", fieldErrors?.accountCode ? "border-rose-500 ring-2 ring-rose-500/20" : "")}
                      />
                      <ErrorSpeechBubble message={fieldErrors?.accountCode} />
                    </div>

                    <div className="grid gap-2 relative" data-has-error={!!fieldErrors?.paidAmount}>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <Label htmlFor="paidAmount">
                          จำนวนเงินที่เบิกจ่าย (บาท){" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        {maxReimbursableAmount !== null &&
                          maxReimbursableAmount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPaidAmountVal(
                                  maxReimbursableAmount.toFixed(2),
                                )
                              }
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              ใช้ยอดสิทธิเบิกได้จริง (฿
                              {maxReimbursableAmount.toFixed(2)})
                            </button>
                          )}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        id="paidAmount"
                        name="paidAmount"
                        value={paidAmountVal}
                        onChange={(e) => setPaidAmountVal(e.target.value)}
                        placeholder="0.00"
                        required={true}
                        className={
                          isPaidOverLimit || fieldErrors?.paidAmount
                            ? "border-rose-500 ring-2 ring-rose-500/20"
                            : ""
                        }
                      />
                      {isPaidOverLimit && (
                        <p className="text-xs text-destructive font-medium">
                          ⚠️ เกินสิทธิที่เบิกจ่ายได้จริง (สูงสุด ฿
                          {maxReimbursableAmount?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          บาท)
                        </p>
                      )}
                      <ErrorSpeechBubble message={fieldErrors?.paidAmount} />
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-dashed">
                    <div className="flex items-center gap-2 mb-4">
                      <UploadCloud className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold text-md tracking-tight">
                        ไฟล์แนบหลักฐาน
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FileUploadDropzone
                        id="attachmentDirectPayment"
                        name="attachmentDirectPayment"
                        label="รายงานจ่ายตรง / รายงาน KTB"
                        required
                        accept="image/*,.pdf"
                        value={selectedDirectPaymentFile}
                        onChange={setSelectedDirectPaymentFile}
                        existingUrl={
                          initialData?.attachmentDirectPayment ||
                          initialData?.attachmentKtbReport
                        }
                        errorMessage={fieldErrors?.attachmentDirectPayment}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Group 5: ใบเสร็จชำระเงิน */}
          <div className="space-y-4 rounded-2xl border bg-card/50 p-4 shadow-xs">
            <div className="flex items-center gap-2 border-b pb-3">
              <Receipt className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg tracking-tight">
                ใบเสร็จชำระเงิน
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="grid gap-2">
                <Label>
                  สถานะใบเสร็จชำระเงิน <span className="text-destructive">*</span>
                </Label>
                <input
                  type="hidden"
                  name="receiptStatus"
                  value={receiptStatus}
                />
                <RadioGroup
                  value={receiptStatus}
                  onValueChange={(val) => {
                    setReceiptStatus(val);
                    if (val !== "RECEIVED") {
                      setSelectedReceiptFile(null);
                    }
                  }}
                  name="receiptStatus"
                  className="flex flex-col space-y-2 mt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="NOT_RECEIVED" id="receipt_not_received" />
                    <Label
                      htmlFor="receipt_not_received"
                      className="font-normal cursor-pointer"
                    >
                      ยังไม่ได้ใบเสร็จชำระเงิน
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="RECEIVED"
                      id="receipt_received"
                      disabled={paymentStatus !== "PAID"}
                    />
                    <Label
                      htmlFor="receipt_received"
                      className={`font-normal cursor-pointer ${paymentStatus !== "PAID" ? "text-muted-foreground opacity-50" : ""}`}
                    >
                      ได้ใบเสร็จชำระเงินแล้ว
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {receiptStatus === "RECEIVED" && (
                <div className="pt-4 border-t border-dashed mt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <UploadCloud className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-md tracking-tight">
                      ไฟล์แนบหลักฐาน
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FileUploadDropzone
                      id="attachmentReceipt"
                      name="attachmentReceipt"
                      label="ใบเสร็จรับเงิน"
                      required
                      accept="image/*,.pdf"
                      value={selectedReceiptFile}
                      onChange={setSelectedReceiptFile}
                      existingUrl={initialData?.attachmentReceipt}
                      errorMessage={fieldErrors?.attachmentReceipt}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 bg-muted/50 p-4 rounded-b-xl border-t mt-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => window.history.back()}
          >
            ยกเลิก
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "กำลังอัพเดท..." : "อัพเดทข้อมูล"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
