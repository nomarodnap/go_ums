"use client";

import { useState, useTransition, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteBill,
  markBillAsReviewed,
  getBillLogs,
} from "@/server/actions/bills";
import {
  flagManualAnomaly,
  unflagManualAnomaly,
} from "@/server/actions/audits";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Zap,
  Droplet,
  Phone,
  Wifi,
  Mail,
  MoreHorizontal,
  Search,
  Eye,
  RefreshCw,
  Trash2,
  FileText,
  Building2,
  Receipt,
  CalendarClock,
  Wallet,
  Banknote,
  Flag,
  CheckCircle2,
  Clock,
  RotateCcw,
  X,
  Sparkles,
} from "lucide-react";
import {
  type AISearchBillHit,
  type AISearchResponse,
  extractAIErrorMessage,
  searchAI,
} from "@/lib/api/ai-hooks";
import { cn } from "@/lib/utils";
import { SortableHeader, useTableSort } from "@/components/ui/sortable-header";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { exportToExcel } from "@/lib/excel-export";
import { canReviewBills, canFlagAnomaly } from "@/lib/permissions";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { BillQuickViewDrawer } from "@/components/bills/bill-quick-view-drawer";
type Bill = {
  id: string;
  billCode: string | null;
  departmentId?: string | null;
  utilityType: string;
  billingMonth: number;
  billingYear: number;
  invoiceAmount: string | null;
  paymentStatus: string;
  auditStatus: string | null;
  departmentName: string | null;
  departmentShortName: string | null;
  departmentCostCenter: string | null;
  departmentType: string | null;
  provider: string | null;
  serviceNumber: string | null;
  serviceBreakdown?: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  receivedDate: Date | null;
  paymentDate: Date | null;
  receiptPaymentDate: Date | null;
  sentToDisbursingDate: Date | null;
  disbursingReceivedDate: Date | null;
  invoiceStatus: string | null;
  paidAmount: string | null;
  paymentDocNumber: string | null;
  docType: string | null;
  accountCode: string | null;
  budgetCode: string | null;
  locationType: string | null;
  attachmentInvoice: string | null;
  attachmentReceipt: string | null;
  attachmentDirectPayment: string | null;
  attachmentKtbReport: string | null;
  isLateReceive?: boolean | null;
  isIncompleteReceiveDate?: boolean | null;
  isLatePayment?: boolean | null;
  isOverdueMoreThan2Months?: boolean | null;
  isDisbursementOver2Months?: boolean | null;
  isWrongMonth?: boolean | null;
  isPhoneOverLimit?: boolean | null;
  isPhoneUsageOverLimit?: boolean | null;
  isWrongBudget?: boolean | null;
  isDuplicate?: boolean | null;
  isAnomalyExpense?: boolean | null;
  isManualAnomaly?: boolean | null;
  manualAnomalyReason?: string | null;
  manualAnomalyDetail?: string | null;
  isReviewed?: boolean | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  usageAmount?: string | null;
  isPendingBillOnly?: boolean;
  depositUnitId?: string | null;
  depositUnitName?: string | null;
};

export function BillsTable({
  initialData,
  services = [],
  showAuditStatus = false,
  userRole,
  userPermissions,
  pagePath = "/bills",
  initialSearchTerm,
  initialDepartmentId,
  initialStatusFilter,
  initialAnomalyFilter,
  disableDrawer = false,
}: {
  initialData: Bill[];
  services?: any[];
  showAuditStatus?: boolean;
  userRole?: string;
  userPermissions?: string[] | null;
  pagePath?: string;
  initialSearchTerm?: string | null;
  initialDepartmentId?: string | null;
  initialStatusFilter?: string | null;
  initialAnomalyFilter?: string | null;
  disableDrawer?: boolean;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || "");
  const [aiSearchMode, setAISearchMode] = useState(
    Boolean(initialSearchTerm?.trim()),
  );
  const [aiSearchLoading, setAISearchLoading] = useState(false);
  const [aiSearchError, setAISearchError] = useState<string | null>(null);
  const [aiSearchResult, setAISearchResult] =
    useState<AISearchResponse | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const lastInitialSearchRef = useRef<string>("");
  const [departmentFilter, setDepartmentFilter] = useState(initialDepartmentId || "all");
  const [statusFilter, setStatusFilter] = useState(() => {
    if (initialStatusFilter) {
      if (initialStatusFilter === "OVERDUE" || initialStatusFilter === "ค้างชำระ") {
        return "OVERDUE";
      }
      if (initialStatusFilter === "PAID" || initialStatusFilter === "เบิกจ่ายแล้ว" || initialStatusFilter === "ผลการเบิกจ่าย") {
        return "PAID";
      }
      return initialStatusFilter;
    }
    return "ทุกสถานะ";
  });
  const [utilityFilter, setUtilityFilter] = useState("ทุกประเภท");
  const [monthFilter, setMonthFilter] = useState("ทุกเดือน");
  const [yearFilter, setYearFilter] = useState("ทุกปี");
  const [anomalyFilter, setAnomalyFilter] = useState(() => {
    if (initialAnomalyFilter) {
      if (
        initialAnomalyFilter === "true" ||
        initialAnomalyFilter === "ANOMALY" ||
        initialAnomalyFilter === "พบความคลาดเคลื่อน" ||
        initialAnomalyFilter === "พบความผิดปกติ"
      ) {
        return "พบความคลาดเคลื่อน";
      }
      return initialAnomalyFilter;
    }
    return "ทั้งหมด";
  });
  const [reviewFilter, setReviewFilter] = useState("ทั้งหมด");

  useEffect(() => {
    if (initialDepartmentId) {
      setDepartmentFilter(initialDepartmentId);
    }
  }, [initialDepartmentId]);

  useEffect(() => {
    if (initialStatusFilter) {
      if (initialStatusFilter === "ค้างชำระ" || initialStatusFilter === "OVERDUE") {
        setStatusFilter("OVERDUE");
      } else if (initialStatusFilter === "เบิกจ่ายแล้ว" || initialStatusFilter === "PAID" || initialStatusFilter === "ผลการเบิกจ่าย") {
        setStatusFilter("PAID");
      } else {
        setStatusFilter(initialStatusFilter);
      }
    }
  }, [initialStatusFilter]);

  useEffect(() => {
    if (initialAnomalyFilter) {
      if (
        initialAnomalyFilter === "true" ||
        initialAnomalyFilter === "ANOMALY" ||
        initialAnomalyFilter === "พบความคลาดเคลื่อน" ||
        initialAnomalyFilter === "พบความผิดปกติ"
      ) {
        setAnomalyFilter("พบความคลาดเคลื่อน");
      } else {
        setAnomalyFilter(initialAnomalyFilter);
      }
    }
  }, [initialAnomalyFilter]);

  const selectedDeptName = useMemo(() => {
    if (departmentFilter === "all") return null;
    const match = initialData.find((b) => b.departmentId === departmentFilter);
    if (match) return match.departmentName || match.departmentShortName || departmentFilter;
    const serviceMatch = services.find((s) => s.departmentId === departmentFilter);
    if (serviceMatch) return serviceMatch.departmentName || departmentFilter;
    return departmentFilter;
  }, [departmentFilter, initialData, services]);

  const runAISearch = useCallback(async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) {
      aiAbortRef.current?.abort();
      setAISearchResult(null);
      setAISearchError(null);
      setAISearchLoading(false);
      return;
    }

    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAISearchLoading(true);
    setAISearchError(null);

    try {
      const res = await searchAI(
        { query: q, entityType: "bills", limit: 40 },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setAISearchResult(res);
      }
    } catch (err) {
      if (
        (err as { name?: string })?.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }
      setAISearchError(
        extractAIErrorMessage(
          err,
          "ไม่สามารถค้นหาข้อมูลด้วย AI ได้ กรุณาลองใหม่อีกครั้ง",
        ),
      );
    } finally {
      if (!controller.signal.aborted) {
        setAISearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      aiAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const q = (initialSearchTerm || "").trim();
    if (q && lastInitialSearchRef.current !== q) {
      lastInitialSearchRef.current = q;
      setSearchTerm(q);
      setAISearchMode(true);
      void runAISearch(q);
    }
  }, [initialSearchTerm, runAISearch]);

  const isFiltered =
    searchTerm !== "" ||
    aiSearchResult !== null ||
    departmentFilter !== "all" ||
    monthFilter !== "ทุกเดือน" ||
    yearFilter !== "ทุกปี" ||
    utilityFilter !== "ทุกประเภท" ||
    statusFilter !== "ทุกสถานะ" ||
    anomalyFilter !== "ทั้งหมด" ||
    reviewFilter !== "ทั้งหมด";

  const handleResetFilters = () => {
    aiAbortRef.current?.abort();
    setSearchTerm("");
    setAISearchMode(false);
    setAISearchLoading(false);
    setAISearchError(null);
    setAISearchResult(null);
    setDepartmentFilter("all");
    setMonthFilter("ทุกเดือน");
    setYearFilter("ทุกปี");
    setUtilityFilter("ทุกประเภท");
    setStatusFilter("ทุกสถานะ");
    setAnomalyFilter("ทั้งหมด");
    setReviewFilter("ทั้งหมด");
  };

  const canReview = canReviewBills(
    { role: userRole, permissions: userPermissions },
    pagePath,
  );

  const canFlag = canFlagAnomaly(
    { role: userRole, permissions: userPermissions },
    pagePath,
  );

  const [isPending, startTransition] = useTransition();
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [billToView, setBillToView] = useState<any>(null);
  const [billLogs, setBillLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [billToFlag, setBillToFlag] = useState<Bill | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagDetail, setFlagDetail] = useState("");
  const [billForDrawer, setBillForDrawer] = useState<Bill | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRowClick = (bill: Bill) => {
    setBillForDrawer(bill);
    setIsDrawerOpen(true);
  };

  const getAuditIssueTexts = useCallback((bill: Bill) => {
    const issues = [];
    if (bill.isLateReceive) issues.push("ลงรับใบแจ้งหนี้ล่าช้า");
    if (bill.isIncompleteReceiveDate) issues.push("วันที่รับใบแจ้งหนี้ไม่ครบถ้วน");
    if (bill.isLatePayment) issues.push("เบิกจ่ายล่าช้า");
    if (bill.isOverdueMoreThan2Months) issues.push("ค้างชำระเกิน 2 เดือน");
    if (bill.isWrongMonth) issues.push("เบิกจ่ายผิดเดือน");
    if (bill.isPhoneUsageOverLimit) issues.push("ใช้ค่าโทรศัพท์เกินเกณฑ์");
    if (bill.isPhoneOverLimit) issues.push("เบิกค่าโทรศัพท์เกินเกณฑ์");
    if (bill.isWrongBudget) issues.push("เบิกจ่ายผิดงบประมาณ");
    if (bill.isDuplicate) issues.push("เบิกจ่ายซ้ำซ้อน");
    if (bill.isAnomalyExpense) issues.push("ค่าใช้จ่ายสูงผิดปกติ");
    if (bill.isManualAnomaly)
      issues.push(bill.manualAnomalyReason || "ระบุว่าผิดปกติ");
    return issues;
  }, []);

  const handleView = async (bill: any) => {
    setBillToView(bill);
    setBillLogs([]);
    setIsViewDialogOpen(true);
    setIsLoadingLogs(true);
    try {
      const logs = await getBillLogs(bill.id);
      setBillLogs(logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleFlagManual = () => {
    if (!canFlag || !billToFlag || !flagReason.trim()) return;
    startTransition(async () => {
      const result = await flagManualAnomaly(billToFlag.id, flagReason, flagDetail);
      if (result.success) {
        toast.success("บันทึกความผิดปกติเรียบร้อยแล้ว (รีเฟรชเพื่อดูข้อมูลล่าสุด)");
        setBillToFlag(null);
        setFlagReason("");
        setFlagDetail("");
        setIsViewDialogOpen(false);
        setBillToView(null);
        router.refresh();
      } else {
        toast.error(result.error || "ไม่สามารถบันทึกได้");
      }
    });
  };

  const handleUnflagManual = () => {
    if (!canFlag || !billToView) return;
    startTransition(async () => {
      const result = await unflagManualAnomaly(billToView.id);
      if (result.success) {
        toast.success("ยกเลิกการปักธงเรียบร้อยแล้ว (รีเฟรชเพื่อดูข้อมูลล่าสุด)");
        setIsViewDialogOpen(false);
        setBillToView(null);
        router.refresh();
      } else {
        toast.error(result.error || "ไม่สามารถยกเลิกได้");
      }
    });
  };

  const handleReview = () => {
    if (!canReview || !billToView) return;
    startTransition(async () => {
      const result = await markBillAsReviewed(billToView.id, true);
      if (result.success) {
        toast.success("บันทึกการตรวจสอบเรียบร้อยแล้ว");
        setIsViewDialogOpen(false);
        setBillToView(null);
        router.refresh();
      } else {
        toast.error(result.error || "ไม่สามารถบันทึกได้");
      }
    });
  };

  const handleUnreview = () => {
    if (!canReview || !billToView) return;
    startTransition(async () => {
      const result = await markBillAsReviewed(billToView.id, false);
      if (result.success) {
        toast.success("ยกเลิกการตรวจรับรองเรียบร้อยแล้ว");
        setIsViewDialogOpen(false);
        setBillToView(null);
        router.refresh();
      } else {
        toast.error(result.error || "ไม่สามารถยกเลิกได้");
      }
    });
  };

  const handleDelete = () => {
    if (!billToDelete) return;
    if (!deleteReason.trim()) {
      toast.error("กรุณาระบุเหตุผลการลบรายการบิล");
      return;
    }
    startTransition(async () => {
      const result = await deleteBill(billToDelete, deleteReason.trim());
      if (result.success) {
        toast.success("ย้ายรายการบิลไปยังหน้า บิลที่เก็บถาวร (Archived) เรียบร้อยแล้ว");
        setBillToDelete(null);
        setDeleteReason("");
        router.refresh();
      } else {
        toast.error(result.error || "ไม่สามารถย้ายรายการไปเก็บถาวรได้");
      }
    });
  };

  const getUtilityIcon = (type: string) => {
    switch (type) {
      case "ค่าไฟฟ้า":
        return <Zap className="h-4 w-4 text-yellow-500" />;
      case "ค่าประปา&น้ำบาดาล":
        return <Droplet className="h-4 w-4 text-blue-500" />;
      case "ค่าโทรศัพท์":
        return <Phone className="h-4 w-4 text-green-500" />;
      case "ค่าสื่อสาร&โทรคมนาคม":
        return <Wifi className="h-4 w-4 text-purple-500" />;
      case "ค่าบริการไปรษณีย์":
        return <Mail className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMonthName = (monthNum: number) => {
    const d = new Date();
    d.setMonth(monthNum - 1);
    return format(d, "MMM", { locale: th });
  };

  const aiHitsMap = useMemo(() => {
    if (!aiSearchResult) return null;
    const map = new Map<string, AISearchBillHit>();
    for (const hit of aiSearchResult.bills || []) {
      map.set(hit.id, hit);
    }
    return map;
  }, [aiSearchResult]);

  const filteredData = useMemo(() => {
    const filtered = initialData.filter((bill) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = aiHitsMap
        ? aiHitsMap.has(bill.id)
        : !term ||
          bill.billCode?.toLowerCase().includes(term) ||
          bill.departmentName?.toLowerCase().includes(term) ||
          bill.departmentShortName?.toLowerCase().includes(term) ||
          bill.depositUnitName?.toLowerCase().includes(term) ||
          bill.serviceNumber?.toLowerCase().includes(term) ||
          bill.invoiceNumber?.toLowerCase().includes(term) ||
          bill.paymentDocNumber?.toLowerCase().includes(term) ||
          bill.provider?.toLowerCase().includes(term);

      let matchesStatus = true;
      if (statusFilter === "OVERDUE" || statusFilter === "ค้างชำระ") {
        matchesStatus = bill.paymentStatus === "PENDING";
      } else if (statusFilter === "NOT_RECEIVED") {
        matchesStatus = bill.invoiceStatus === "NOT_RECEIVED";
      } else if (statusFilter === "PENDING") {
        matchesStatus =
          bill.paymentStatus === "PENDING" &&
          bill.invoiceStatus !== "NOT_RECEIVED";
      } else if (statusFilter === "PAID" || statusFilter === "เบิกจ่ายแล้ว" || statusFilter === "ผลการเบิกจ่าย") {
        matchesStatus = bill.paymentStatus === "PAID";
      } else if (statusFilter === "RECEIPT_RECEIVED") {
        const hasReceipt = Boolean(bill.attachmentReceipt && bill.attachmentReceipt.trim() !== "");
        matchesStatus = bill.paymentStatus === "PAID" && hasReceipt;
      }

      const matchesUtility =
        utilityFilter === "ทุกประเภท" || bill.utilityType === utilityFilter;

      const matchesMonth =
        monthFilter === "ทุกเดือน" || bill.billingMonth.toString() === monthFilter;
      const matchesYear =
        yearFilter === "ทุกปี" || bill.billingYear.toString() === yearFilter;

      let matchesAnomaly = true;
      if (anomalyFilter === "พบความคลาดเคลื่อน" || anomalyFilter === "พบความผิดปกติ") {
        matchesAnomaly = getAuditIssueTexts(bill).length > 0;
      } else if (anomalyFilter === "ปกติ, แก้ไขแล้ว") {
        matchesAnomaly = getAuditIssueTexts(bill).length === 0;
      }

      let matchesReview = true;
      if (reviewFilter === "ยังไม่ได้ตรวจสอบ") {
        matchesReview = !bill.isReviewed;
      } else if (reviewFilter === "ตรวจสอบแล้ว") {
        matchesReview = !!bill.isReviewed;
      }

      const matchesDepartment =
        departmentFilter === "all" || bill.departmentId === departmentFilter;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesStatus &&
        matchesUtility &&
        matchesMonth &&
        matchesYear &&
        matchesAnomaly &&
        matchesReview
      );
    });

    if (aiHitsMap) {
      return [...filtered].sort(
        (a, b) => (aiHitsMap.get(b.id)?.score ?? 0) - (aiHitsMap.get(a.id)?.score ?? 0),
      );
    }
    return filtered;
  }, [
    initialData,
    searchTerm,
    aiHitsMap,
    statusFilter,
    utilityFilter,
    monthFilter,
    yearFilter,
    anomalyFilter,
    reviewFilter,
    departmentFilter,
    getAuditIssueTexts,
  ]);

  const { sortKey, sortOrder, handleSort, sortedData } = useTableSort(filteredData, {
    comparators: {
      department: (a, b) => {
        const nameA = `${a.departmentName || a.departmentShortName || ""} ${a.utilityType || ""}`;
        const nameB = `${b.departmentName || b.departmentShortName || ""} ${b.utilityType || ""}`;
        return nameA.localeCompare(nameB, "th");
      },
      billCode: (a, b) => {
        const codeA = `${a.billCode || ""} ${a.serviceNumber || ""}`;
        const codeB = `${b.billCode || ""} ${b.serviceNumber || ""}`;
        return codeA.localeCompare(codeB, "th", { numeric: true });
      },
      billingPeriod: (a, b) => {
        const periodA = (a.billingYear || 0) * 12 + (a.billingMonth || 0);
        const periodB = (b.billingYear || 0) * 12 + (b.billingMonth || 0);
        return periodA - periodB;
      },
      amount: (a, b) => {
        const valA =
          a.invoiceAmount !== undefined && a.invoiceAmount !== null
            ? Number(a.invoiceAmount)
            : a.paidAmount
              ? parseFloat(a.paidAmount)
              : 0;
        const valB =
          b.invoiceAmount !== undefined && b.invoiceAmount !== null
            ? Number(b.invoiceAmount)
            : b.paidAmount
              ? parseFloat(b.paidAmount)
              : 0;
        return valA - valB;
      },
      paymentStatus: (a, b) => {
        const getPriority = (item: Bill) => {
          if (item.invoiceStatus === "NOT_RECEIVED") return 0;
          if (item.paymentStatus === "PAID") {
            return (item.attachmentReceipt && item.attachmentReceipt.trim() !== "") ? 3 : 2;
          }
          return 1;
        };
        return getPriority(a) - getPriority(b);
      },
      auditStatus: (a, b) => {
        const issuesA = getAuditIssueTexts(a).length;
        const issuesB = getAuditIssueTexts(b).length;
        if (issuesA !== issuesB) return issuesA - issuesB;
        return (a.isReviewed ? 1 : 0) - (b.isReviewed ? 1 : 0);
      },
    },
  });

  const THAI_MONTHS = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const handleExportExcel = () => {
    exportToExcel({
      filename: `รายการใบแจ้งหนี้_${selectedDeptName !== "ทั้งหมด" ? selectedDeptName : "รวม"}`,
      sheetName: "ใบแจ้งหนี้",
      data: sortedData,
      columns: [
        { header: "ลำดับ", transform: (_, i) => i + 1, width: 8 },
        { header: "รหัสรายงาน", key: "billCode", width: 18 },
        { header: "หน่วยงาน", transform: (b) => b.departmentName || b.departmentShortName || "-", width: 28 },
        { header: "หน่วยเบิกจ่าย", transform: (b) => b.depositUnitName || "-", width: 26 },
        { header: "ประเภทสาธารณูปโภค", key: "utilityType", width: 20 },
        { header: "ผู้ให้บริการ", key: "provider", width: 18 },
        { header: "หมายเลขผู้ใช้/เครื่องวัด", key: "serviceNumber", width: 22 },
        { header: "เลขที่ใบแจ้งหนี้", key: "invoiceNumber", width: 18 },
        {
          header: "รอบบิล",
          transform: (b) =>
            b.billingMonth && b.billingYear
              ? `${THAI_MONTHS[b.billingMonth - 1]} ${b.billingYear + 543}`
              : "-",
          width: 18,
        },
        {
          header: "ยอดตามใบแจ้งหนี้ (บาท)",
          transform: (b) =>
            b.invoiceAmount !== undefined && b.invoiceAmount !== null
              ? Number(b.invoiceAmount)
              : "-",
          width: 22,
        },
        {
          header: "ยอดเบิกจ่ายจริง (บาท)",
          transform: (b) => (b.paidAmount ? parseFloat(b.paidAmount) : "-"),
          width: 22,
        },
        {
          header: "สถานะใบแจ้งหนี้",
          transform: (b) =>
            b.invoiceStatus === "NOT_RECEIVED" ? "ยังไม่ได้รับใบแจ้งหนี้" : "ได้รับแล้ว",
          width: 20,
        },
        {
          header: "สถานะการเบิกจ่าย",
          transform: (b) => {
            if (b.invoiceStatus === "NOT_RECEIVED") return "ยังไม่ได้รับใบแจ้งหนี้";
            if (b.paymentStatus === "PAID") {
              return b.attachmentReceipt && b.attachmentReceipt.trim() !== ""
                ? "ได้ใบเสร็จแล้ว"
                : "เบิกจ่ายแล้ว";
            }
            return "ยังไม่ได้เบิกจ่าย";
          },
          width: 20,
        },
        { header: "เลขที่เอกสารเบิกจ่าย", key: "paymentDocNumber", width: 20 },
        {
          header: "วันที่ลงรับ",
          transform: (b) =>
            b.receivedDate
              ? format(new Date(b.receivedDate), "dd/MM/yyyy", { locale: th })
              : "-",
          width: 16,
        },
        {
          header: "วันที่จ่ายเงิน",
          transform: (b) =>
            b.paymentDate
              ? format(new Date(b.paymentDate), "dd/MM/yyyy", { locale: th })
              : "-",
          width: 16,
        },
        {
          header: "สถานะการตรวจสอบ",
          transform: (b) =>
            b.auditStatus === "NORMAL"
              ? "ปกติ"
              : b.auditStatus === "PENDING_CORRECTION"
                ? "รอการแก้ไข"
                : b.auditStatus === "PENDING_RECHECK"
                  ? "รอตรวจสอบใหม่"
                  : b.auditStatus === "CORRECTED"
                    ? "แก้ไขแล้ว"
                    : b.auditStatus || "-",
          width: 18,
        },
        {
          header: "ข้อสังเกตความผิดปกติ",
          transform: (b) => {
            const issues = getAuditIssueTexts(b);
            return issues.length > 0 ? issues.join(", ") : "-";
          },
          width: 32,
        },
        {
          header: "การตรวจรับรอง",
          transform: (b) => (b.isReviewed ? "ตรวจสอบแล้ว" : "ยังไม่ได้ตรวจสอบ"),
          width: 16,
        },
        { header: "ผู้ตรวจรับรอง", key: "reviewedBy", width: 20 },
        {
          header: "วันที่ตรวจรับรอง",
          transform: (b) =>
            b.reviewedAt
              ? format(new Date(b.reviewedAt), "dd/MM/yyyy HH:mm", { locale: th })
              : "-",
          width: 20,
        },
      ],
    });
  };

  return (
    <div className="space-y-4">
      {/* Apple-style Filter Toolbar (semantic <search> landmark) */}
      <search
        aria-label="ค้นหาและกรองรายการค่าใช้จ่าย"
        className="p-4 rounded-2xl bg-card/85 dark:bg-card/70 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between"
      >
        <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={
                aiSearchMode
                  ? "ค้นหารหัสรายงาน หรือพิมพ์ประโยค AI เช่น บิลค่าไฟที่ยังไม่จ่ายภาคใต้..."
                  : "ค้นหารหัสรายงาน, หน่วยงาน, รหัสเครื่องวัด, เลขที่ใบแจ้งหนี้..."
              }
              enterKeyHint={aiSearchMode ? "search" : undefined}
              className={cn(
                "pl-9 pr-8 h-9.5 rounded-xl bg-background/60",
                aiSearchMode &&
                  "border-primary/40 focus-visible:ring-primary/30",
              )}
              value={searchTerm}
              onChange={(e) => {
                const next = e.target.value;
                setSearchTerm(next);
                if (aiSearchResult && next.trim() !== aiSearchResult.query) {
                  setAISearchResult(null);
                  setAISearchError(null);
                }
              }}
              onKeyDown={(e) => {
                if (
                  aiSearchMode &&
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void runAISearch(searchTerm);
                }
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  aiAbortRef.current?.abort();
                  setSearchTerm("");
                  setAISearchResult(null);
                  setAISearchError(null);
                  setAISearchLoading(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/80 transition-colors cursor-pointer"
                title="ล้างข้อความค้นหา"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Button
            type="button"
            variant={aiSearchMode ? "default" : "outline"}
            size="sm"
            aria-pressed={aiSearchMode}
            onClick={() => {
              if (aiSearchMode) {
                aiAbortRef.current?.abort();
                setAISearchMode(false);
                setAISearchLoading(false);
                setAISearchError(null);
                setAISearchResult(null);
              } else {
                setAISearchMode(true);
                if (searchTerm.trim()) {
                  void runAISearch(searchTerm);
                }
              }
            }}
            className="h-9.5 rounded-xl text-xs gap-1.5 shrink-0 cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            <span>ค้นหาอัจฉริยะ (AI)</span>
          </Button>

          {aiSearchMode && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!searchTerm.trim() || aiSearchLoading}
              onClick={() => void runAISearch(searchTerm)}
              className="h-9.5 rounded-xl text-xs shrink-0 cursor-pointer"
            >
              {aiSearchLoading ? "กำลังค้นหา..." : "ค้นหาด้วย AI"}
            </Button>
          )}
        </div>

        {departmentFilter !== "all" && (
          <Badge
            variant="secondary"
            className="gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary border border-primary/20 shrink-0 self-start lg:self-center"
          >
            <Building2 className="size-3.5" />
            <span>กรองตามหน่วยงาน: {selectedDeptName}</span>
            <button
              type="button"
              onClick={() => setDepartmentFilter("all")}
              className="ml-1 hover:text-destructive cursor-pointer inline-flex items-center"
              title="ล้างตัวกรองหน่วยงาน"
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={monthFilter}
            onValueChange={(v) => v && setMonthFilter(v)}
          >
            <SelectTrigger className="w-[125px] h-9.5 rounded-xl text-xs">
              <SelectValue placeholder="เดือน">
                {monthFilter === "ทุกเดือน"
                  ? "ทุกเดือน"
                  : THAI_MONTHS[parseInt(monthFilter) - 1]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ทุกเดือน">ทุกเดือน</SelectItem>
              {THAI_MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={yearFilter}
            onValueChange={(v) => v && setYearFilter(v)}
          >
            <SelectTrigger className="w-[105px] h-9.5 rounded-xl text-xs">
              <SelectValue placeholder="ปี">
                {yearFilter === "ทุกปี" ? "ทุกปี" : parseInt(yearFilter) + 543}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ทุกปี">ทุกปี</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y + 543}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={utilityFilter}
            onValueChange={(v) => v && setUtilityFilter(v)}
          >
            <SelectTrigger className="w-[155px] h-9.5 rounded-xl text-xs">
              <SelectValue placeholder="ประเภท">{utilityFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ทุกประเภท">ทุกประเภท</SelectItem>
              <SelectItem value="ค่าไฟฟ้า">ค่าไฟฟ้า</SelectItem>
              <SelectItem value="ค่าประปา&น้ำบาดาล">ค่าประปา&น้ำบาดาล</SelectItem>
              <SelectItem value="ค่าโทรศัพท์">ค่าโทรศัพท์</SelectItem>
              <SelectItem value="ค่าสื่อสาร&โทรคมนาคม">
                ค่าสื่อสาร&โทรคมนาคม
              </SelectItem>
              <SelectItem value="ค่าบริการไปรษณีย์">ค่าบริการไปรษณีย์</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v)}
          >
            <SelectTrigger className="w-[150px] h-9.5 rounded-xl text-xs">
              <SelectValue placeholder="สถานะ">
                {statusFilter === "ทุกสถานะ"
                  ? "ทุกสถานะ"
                  : statusFilter === "OVERDUE"
                    ? "ค้างชำระ"
                    : statusFilter === "NOT_RECEIVED"
                      ? "ยังไม่ได้รับใบแจ้งหนี้"
                      : statusFilter === "PENDING"
                        ? "ยังไม่ได้เบิกจ่าย"
                        : statusFilter === "PAID"
                          ? "เบิกจ่ายแล้ว"
                          : statusFilter === "RECEIPT_RECEIVED"
                            ? "ได้ใบเสร็จแล้ว"
                            : statusFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ทุกสถานะ">ทุกสถานะ</SelectItem>
              <SelectItem value="OVERDUE">ค้างชำระ</SelectItem>
              <SelectItem value="NOT_RECEIVED">ยังไม่ได้รับใบแจ้งหนี้</SelectItem>
              <SelectItem value="PENDING">ยังไม่ได้เบิกจ่าย</SelectItem>
              <SelectItem value="PAID">เบิกจ่ายแล้ว</SelectItem>
              <SelectItem value="RECEIPT_RECEIVED">ได้ใบเสร็จแล้ว</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={anomalyFilter}
            onValueChange={(v) => v && setAnomalyFilter(v)}
          >
            <SelectTrigger className="w-[155px] h-9.5 rounded-xl text-xs">
              <SelectValue placeholder="ความคลาดเคลื่อน">
                {anomalyFilter === "ทั้งหมด"
                  ? "สถานะความคลาดเคลื่อน"
                  : anomalyFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ทั้งหมด">ทั้งหมด (ความคลาดเคลื่อน)</SelectItem>
              <SelectItem value="พบความคลาดเคลื่อน">พบความคลาดเคลื่อน</SelectItem>
              <SelectItem value="ปกติ, แก้ไขแล้ว">ปกติ, แก้ไขแล้ว</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={reviewFilter}
            onValueChange={(v) => v && setReviewFilter(v)}
          >
            <SelectTrigger className="w-[145px] h-9.5 rounded-xl text-xs">
              <SelectValue placeholder="การตรวจสอบ">
                {reviewFilter === "ทั้งหมด" ? "สถานะการตรวจสอบ" : reviewFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ทั้งหมด">ทั้งหมด (การตรวจสอบ)</SelectItem>
              <SelectItem value="ยังไม่ได้ตรวจสอบ">ยังไม่ได้ตรวจสอบ</SelectItem>
              <SelectItem value="ตรวจสอบแล้ว">ตรวจสอบแล้ว</SelectItem>
            </SelectContent>
          </Select>

          <ExportExcelButton
            onExport={handleExportExcel}
            disabled={sortedData.length === 0}
          />

          <Button
            type="button"
            variant={isFiltered ? "outline" : "ghost"}
            size="sm"
            onClick={handleResetFilters}
            disabled={!isFiltered}
            className={cn(
              "h-9.5 rounded-xl text-xs gap-1.5 px-3 transition-all",
              isFiltered
                ? "border-rose-200/90 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800 shadow-xs cursor-pointer font-medium"
                : "text-muted-foreground/40 hover:bg-transparent cursor-not-allowed border-dashed border-border/40",
            )}
            title="ล้างค่าตัวกรองเป็นค่าเริ่มต้น"
          >
            <RotateCcw className="size-3.5" />
            ล้างตัวกรอง
          </Button>
        </div>
      </search>

      {aiSearchLoading && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-primary flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              กำลังค้นหาด้วย AI Hybrid Search (Semantic + Intent)...
            </span>
          </div>
          <progress aria-label="กำลังค้นหาด้วย AI" className="ai-progress" />
        </div>
      )}

      {aiSearchError && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between gap-2"
        >
          <span>{aiSearchError}</span>
          {searchTerm.trim() && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void runAISearch(searchTerm)}
              className="h-7 rounded-lg text-xs cursor-pointer"
            >
              ลองอีกครั้ง
            </Button>
          )}
        </div>
      )}

      {aiSearchResult && !aiSearchLoading && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-primary/15 text-primary border-primary/20 font-medium text-[11px]"
            >
              <Sparkles className="size-3 mr-1" />
              {aiSearchResult.mode === "hybrid"
                ? "AI Hybrid Search"
                : "Smart Intent Search"}
            </Badge>
            <span className="text-foreground font-medium">
              พบ {filteredData.length} รายการสำหรับ “{aiSearchResult.query}”
            </span>
            <span className="text-muted-foreground">
              (สแกน {aiSearchResult.totalScanned} รายการ • {aiSearchResult.tookMs} ms)
            </span>
            {aiSearchResult.warning && (
              <span className="text-amber-700 dark:text-amber-300">
                • {aiSearchResult.warning}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setAISearchResult(null);
              setAISearchError(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            แสดงทั้งหมดตามคำค้นปกติ
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-card/90 dark:bg-card/70 backdrop-blur-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                className="w-[220px]"
                sortKey="department"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                หน่วยงาน / ประเภท
              </SortableHeader>
              <SortableHeader
                sortKey="billCode"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                รหัสรายงาน / เครื่องวัด
              </SortableHeader>
              <SortableHeader
                sortKey="billingPeriod"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                รอบบิล
              </SortableHeader>
              <SortableHeader
                align="right"
                sortKey="amount"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                ยอดชำระ / เบิกจ่าย
              </SortableHeader>
              <SortableHeader
                align="center"
                sortKey="paymentStatus"
                currentSortKey={sortKey}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                สถานะการเบิกจ่าย
              </SortableHeader>
              {showAuditStatus && (
                <SortableHeader
                  align="center"
                  sortKey="auditStatus"
                  currentSortKey={sortKey}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                >
                  สถานะตรวจสอบ
                </SortableHeader>
              )}
              <TableHead className="w-[80px] text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showAuditStatus ? 7 : 6}
                  className="text-center h-36 text-muted-foreground text-sm"
                >
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <p>ไม่มีข้อมูลค่าใช้จ่ายที่ตรงกับเงื่อนไข</p>
                    {isFiltered && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="h-8 rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer border-border/80"
                      >
                        <RotateCcw className="size-3" />
                        ล้างตัวกรองทั้งหมด
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {sortedData.map((bill) => (
              <TableRow
                key={bill.id}
                className={cn(
                  "group transition-colors hover:bg-muted/40",
                  !disableDrawer && "cursor-pointer"
                )}
                onClick={disableDrawer ? undefined : () => handleRowClick(bill)}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span
                      className="font-medium text-foreground truncate max-w-[230px]"
                      title={bill.departmentName || "ไม่ระบุหน่วยงาน"}
                    >
                      {bill.departmentName || "ไม่ระบุหน่วยงาน"}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1.5">
                        {getUtilityIcon(bill.utilityType)}
                        <span>{bill.utilityType}</span>
                      </div>
                      {bill.isPendingBillOnly && (
                        <span
                          className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/40 font-medium truncate max-w-[150px]"
                          title={`ฝากเบิก: ${bill.depositUnitName || bill.depositUnitId || "-"}`}
                        >
                          ฝากเบิก:{" "}
                          {bill.depositUnitName || bill.depositUnitId || "-"}
                        </span>
                      )}
                    </div>
                    {aiHitsMap?.get(bill.id)?.matchReasons?.length ? (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[...new Set(aiHitsMap.get(bill.id)!.matchReasons)]
                          .slice(0, 3)
                          .map((reason) => (
                            <span
                              key={`${bill.id}-reason-${reason}`}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
                            >
                              {reason}
                            </span>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col space-y-1">
                    {bill.billCode && (
                      <span className="text-[11px] font-semibold text-primary mb-0.5 border border-primary/20 bg-primary/10 rounded-full px-2 py-0.5 w-fit">
                        {bill.billCode}
                      </span>
                    )}
                    {bill.serviceNumber ? (
                      <span className="text-sm font-medium text-foreground">
                        {bill.serviceNumber}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {bill.invoiceNumber && (
                        <span className="text-xs text-muted-foreground">
                          INV: {bill.invoiceNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col space-y-0.5">
                    <span className="font-medium text-foreground text-sm">
                      {getMonthName(bill.billingMonth)} {bill.billingYear + 543}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col space-y-1 items-end">
                    <span className="font-semibold text-sm text-foreground">
                      {bill.invoiceAmount
                        ? Number(bill.invoiceAmount).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "-"}
                    </span>
                    {bill.usageAmount && (
                      <span className="text-[11px] text-muted-foreground">
                        {Number(bill.usageAmount).toLocaleString("th-TH")} หน่วย
                      </span>
                    )}
                    {bill.paymentStatus === "PAID" && bill.paidAmount && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        จ่าย:{" "}
                        {Number(bill.paidAmount).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center space-y-1">
                    <Badge
                      variant={
                        bill.invoiceStatus === "NOT_RECEIVED"
                          ? "outline"
                          : bill.paymentStatus === "PAID"
                            ? (bill.attachmentReceipt && bill.attachmentReceipt.trim() !== "")
                              ? "success"
                              : "default"
                            : "warning"
                      }
                      className={cn(
                        "text-[11px] font-medium",
                        bill.paymentStatus === "PAID" &&
                          ((bill.attachmentReceipt && bill.attachmentReceipt.trim() !== "")
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white")
                      )}
                    >
                      {bill.invoiceStatus === "NOT_RECEIVED"
                        ? "ยังไม่ได้รับใบแจ้งหนี้"
                        : bill.paymentStatus === "PAID"
                          ? (bill.attachmentReceipt && bill.attachmentReceipt.trim() !== "")
                            ? "ได้ใบเสร็จแล้ว"
                            : "เบิกจ่ายแล้ว"
                          : "ยังไม่ได้เบิกจ่าย"}
                    </Badge>
                    {(bill.invoiceStatus === "NOT_RECEIVED" ||
                      bill.paymentStatus === "PENDING") && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] h-4.5 px-2 font-normal"
                      >
                        ค้างชำระ
                      </Badge>
                    )}
                    {bill.paymentStatus === "PAID" && bill.paymentDocNumber && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                        {bill.docType ? `${bill.docType} ` : ""}
                        {bill.paymentDocNumber}
                      </span>
                    )}
                  </div>
                </TableCell>
                {showAuditStatus && (
                  <TableCell className="text-center align-top pt-4">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      {bill.auditStatus === "PENDING_RECHECK" ? (
                        <>
                          <Badge
                            className="whitespace-nowrap text-[11px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium"
                          >
                            รอตรวจสอบใหม่
                          </Badge>
                          {getAuditIssueTexts(bill).length > 0 && (
                            <div className="flex flex-col text-[10px] text-blue-800 dark:text-blue-300 items-start text-left bg-blue-50/80 dark:bg-blue-950/40 p-2 rounded-xl w-full max-w-[140px] leading-tight border border-blue-200/60 dark:border-blue-800/40">
                              {getAuditIssueTexts(bill).map((issue, idx) => {
                                const isManualIssue =
                                  bill.isManualAnomaly &&
                                  issue === (bill.manualAnomalyReason || "ระบุว่าผิดปกติ");
                                if (isManualIssue && bill.manualAnomalyDetail) {
                                  return (
                                    <TooltipProvider key={idx}>
                                      <Tooltip>
                                        <TooltipTrigger render={<span className="cursor-help underline decoration-dotted underline-offset-2" />}>
                                          • {issue}
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs text-xs p-3 text-left">
                                          <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                            <Flag className="size-3.5 shrink-0" />
                                            {issue}
                                          </p>
                                          <p className="text-foreground whitespace-pre-line mt-1.5 leading-relaxed text-xs">
                                            {bill.manualAnomalyDetail}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                }
                                return <span key={idx}>• {issue}</span>;
                              })}
                            </div>
                          )}
                        </>
                      ) : bill.auditStatus === "PENDING_CORRECTION" ? (
                        <>
                          <Badge
                            variant="warning"
                            className="whitespace-nowrap text-[11px]"
                          >
                            พบข้อสังเกต
                          </Badge>
                          {getAuditIssueTexts(bill).length > 0 && (
                            <div className="flex flex-col text-[10px] text-amber-800 dark:text-amber-300 items-start text-left bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-xl w-full max-w-[140px] leading-tight border border-amber-200/60 dark:border-amber-800/40">
                              {getAuditIssueTexts(bill).map((issue, idx) => {
                                const isManualIssue =
                                  bill.isManualAnomaly &&
                                  issue === (bill.manualAnomalyReason || "ระบุว่าผิดปกติ");
                                if (isManualIssue && bill.manualAnomalyDetail) {
                                  return (
                                    <TooltipProvider key={idx}>
                                      <Tooltip>
                                        <TooltipTrigger render={<span className="cursor-help underline decoration-dotted underline-offset-2" />}>
                                          • {issue}
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs text-xs p-3 text-left">
                                          <p className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                            <Flag className="size-3.5 shrink-0" />
                                            {issue}
                                          </p>
                                          <p className="text-foreground whitespace-pre-line mt-1.5 leading-relaxed text-xs">
                                            {bill.manualAnomalyDetail}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                }
                                return <span key={idx}>• {issue}</span>;
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <Badge
                          variant={
                            !bill.auditStatus ||
                            bill.auditStatus === "CORRECTED"
                              ? "success"
                              : "secondary"
                          }
                          className="whitespace-nowrap text-[11px]"
                        >
                          {!bill.auditStatus ? "ปกติ" : "แก้ไขแล้ว"}
                        </Badge>
                      )}

                      {bill.isReviewed && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full"
                        >
                          ✓ ตรวจสอบแล้ว
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        />
                      }
                    >
                      <span className="sr-only">เปิดเมนู</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>การจัดการ</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleView(bill)}
                        >
                          <Eye className="mr-2 h-4 w-4" /> ดูรายละเอียด
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          render={<Link href={`/bills/${bill.id}/edit`} />}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" /> อัพเดทข้อมูล
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:text-destructive"
                          onClick={() => setBillToDelete(bill.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> ลบรายการ
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!billToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setBillToDelete(null);
            setDeleteReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ย้ายรายการบิลไปเก็บถาวร (Archived)?</AlertDialogTitle>
            <AlertDialogDescription>
              รายการบิลนี้จะถูกย้ายไปยังหน้า &quot;บิลที่เก็บถาวร (Archived)&quot; ก่อน
              พร้อมบันทึกประวัติการลบ โดยคุณสามารถกู้คืนหรือกดลบถาวรได้จากหน้านั้น
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-1">
            <label
              htmlFor="bill-archive-reason"
              className="text-xs font-medium text-foreground"
            >
              เหตุผลการลบ <span className="text-destructive">*</span>
            </label>
            <Input
              id="bill-archive-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="กรุณาระบุเหตุผลการลบ เช่น บันทึกข้อมูลผิดเดือน / บันทึกซ้ำ..."
              className="text-xs"
              required
              disabled={isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending || !deleteReason.trim()}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isPending ? "กำลังย้าย..." : "ย้ายไปเก็บถาวร"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-6 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              รายละเอียดรายการค่าใช้จ่าย
            </DialogTitle>
            <DialogDescription>
              ข้อมูลบิลประจำเดือน{" "}
              {billToView && getMonthName(billToView.billingMonth)}{" "}
              {billToView && billToView.billingYear + 543}
            </DialogDescription>
          </DialogHeader>

          {billToView && (
            <Tabs defaultValue="details" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">รายละเอียด</TabsTrigger>
                <TabsTrigger value="history">ประวัติการทำรายการ</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4">
                <div className="space-y-6">
                  {/* Group 1: ข้อมูลทั่วไป */}
                  <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg tracking-tight">
                        ข้อมูลทั่วไป
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          รหัสรายงาน
                        </p>
                        <p className="bg-primary/10 text-primary p-2 rounded-md font-semibold font-mono">
                          {billToView.billCode || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          หน่วยงาน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {billToView.departmentName || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          อักษรย่อ
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {billToView.departmentShortName || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          รหัสศูนย์ต้นทุน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {billToView.departmentCostCenter || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          ระดับหน่วยงาน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {billToView.departmentType === "central"
                            ? "ส่วนกลาง"
                            : billToView.departmentType === "regional_central"
                              ? "ส่วนภูมิภาค (ส่วนกลาง)"
                              : billToView.departmentType === "regional"
                                ? "ส่วนภูมิภาค"
                                : billToView.departmentType || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          ประเภทหน่วยงาน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {billToView.isPendingBillOnly
                            ? "หน่วยฝากเบิก"
                            : "หน่วยเบิกจ่าย"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          ฝากเบิกกับหน่วยงาน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {billToView.isPendingBillOnly
                            ? billToView.depositUnitName ||
                              billToView.depositUnitId ||
                              "-"
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Group 2: ใบแจ้งหนี้ค่าสาธารณูปโภค */}
                  <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <Receipt className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg tracking-tight">
                        ใบแจ้งหนี้ค่าสาธารณูปโภค
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          ประเภทสาธารณูปโภค
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md flex items-center gap-1.5">
                          {getUtilityIcon(billToView.utilityType)}
                          {billToView.utilityType || "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          หมายเลขผู้ใช้ / รหัสเครื่องวัด
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {billToView.serviceNumber ? (
                            billToView.serviceNumber
                              .split(",")
                              .map((s: string) => s.trim())
                              .filter(Boolean)
                              .map((sn: string) => (
                                <Badge
                                  key={sn}
                                  variant="secondary"
                                  className="px-3 py-1 text-sm bg-muted text-foreground"
                                >
                                  {sn}
                                </Badge>
                              ))
                          ) : (
                            <p className="bg-muted/50 p-2 rounded-md w-full">
                              -
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          ผู้ให้บริการ
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {billToView.provider || "-"}
                        </p>
                      </div>
                      {(billToView.utilityType === "ค่าไฟฟ้า" ||
                        billToView.utilityType === "ค่าประปา&น้ำบาดาล") && (
                        <div className="grid gap-1">
                          <p className="text-muted-foreground text-sm font-medium">
                            ที่ตั้ง
                          </p>
                          <p className="bg-muted/50 p-2 rounded-md">
                            {billToView.locationType || "-"}
                          </p>
                        </div>
                      )}
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          รอบบิลประจำเดือน
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md">
                          {billToView.billingMonth && billToView.billingYear
                            ? `${getMonthName(billToView.billingMonth)} ${billToView.billingYear + 543}`
                            : "-"}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          ค่าใช้จ่ายโดยประมาณการ
                        </p>
                        <p className="bg-muted/50 p-2 rounded-md text-muted-foreground italic">
                          (คำนวณอัตโนมัติในฟอร์ม)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Group 3: การรับใบแจ้งหนี้ */}
                  <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <CalendarClock className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg tracking-tight">
                        การรับใบแจ้งหนี้
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                      <div className="grid gap-1 md:col-span-2">
                        <p className="text-muted-foreground text-sm font-medium">
                          สถานะใบแจ้งหนี้
                        </p>
                        <Badge
                          variant={
                            billToView.invoiceStatus === "RECEIVED"
                              ? "default"
                              : "outline"
                          }
                          className="mt-1 w-fit"
                        >
                          {billToView.invoiceStatus === "RECEIVED"
                            ? "ได้รับใบแจ้งหนี้แล้ว"
                            : "ยังไม่ได้รับใบแจ้งหนี้"}
                        </Badge>
                      </div>

                      {billToView.invoiceStatus === "RECEIVED" && (
                        <>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              วันที่ใบแจ้งหนี้
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.invoiceDate
                                ? format(
                                    new Date(billToView.invoiceDate),
                                    "dd/MM/yyyy",
                                  )
                                : "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              วันที่ลงรับใบแจ้งหนี้
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.receivedDate
                                ? format(
                                    new Date(billToView.receivedDate),
                                    "dd/MM/yyyy",
                                  )
                                : "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              วันที่หน่วยฝากเบิกส่งเอกสาร
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.sentToDisbursingDate
                                ? format(
                                    new Date(billToView.sentToDisbursingDate),
                                    "dd/MM/yyyy",
                                  )
                                : "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              วันที่หน่วยเบิกจ่ายลงรับใบสำคัญ
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.disbursingReceivedDate
                                ? format(
                                    new Date(billToView.disbursingReceivedDate),
                                    "dd/MM/yyyy",
                                  )
                                : "-"}
                            </p>
                          </div>
                          {/* Service Breakdown */}
                          {(() => {
                            if (!billToView.serviceBreakdown) return null;
                            try {
                              const breakdown =
                                typeof billToView.serviceBreakdown === "string"
                                  ? JSON.parse(billToView.serviceBreakdown)
                                  : billToView.serviceBreakdown;
                              if (!breakdown || typeof breakdown !== "object")
                                return null;
                              const entries = Object.entries(breakdown);
                              if (entries.length === 0) return null;

                              return (
                                <div className="grid gap-2 md:col-span-2 rounded-lg border bg-muted/20 p-3.5 mt-1">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                      <span>
                                        รายละเอียดจำนวนเงินแยกรายหมายเลข (Service
                                        Breakdown)
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] font-normal py-0 px-1.5"
                                      >
                                        {entries.length} หมายเลข
                                      </Badge>
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                                    {entries.map(([num, amt]) => {
                                      const numVal = parseFloat(String(amt));
                                      const svcInfo =
                                        services?.find(
                                          (s) =>
                                            s.serviceNumber === num &&
                                            (!billToView.departmentId ||
                                              s.departmentId ===
                                                billToView.departmentId),
                                        ) ||
                                        services?.find(
                                          (s) => s.serviceNumber === num,
                                        );

                                      const isItemOverLimit =
                                        billToView.utilityType === "ค่าโทรศัพท์" &&
                                        svcInfo?.phoneReimbursementLimit &&
                                        !isNaN(numVal) &&
                                        numVal >
                                          svcInfo.phoneReimbursementLimit;

                                      return (
                                        <div
                                          key={num}
                                          className={`bg-background p-2.5 rounded-md border text-xs flex flex-col justify-between shadow-2xs ${isItemOverLimit ? "border-amber-500/60 bg-amber-50/20 dark:bg-amber-950/10" : ""}`}
                                        >
                                          <div>
                                            <div className="flex items-center justify-between gap-1 mb-1">
                                              <span className="text-muted-foreground font-medium truncate">
                                                หมายเลข:{" "}
                                                <span className="text-foreground font-semibold">
                                                  {num}
                                                </span>
                                                {svcInfo?.phoneOwnerName && (
                                                  <span className="text-muted-foreground ml-1 font-normal">
                                                    ({svcInfo.phoneOwnerName})
                                                  </span>
                                                )}
                                              </span>
                                              {svcInfo?.phoneReimbursementLimit && (
                                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-normal shrink-0">
                                                  สิทธิ: ฿
                                                  {svcInfo.phoneReimbursementLimit.toLocaleString()}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="mt-1">
                                            <div className="flex items-baseline justify-between">
                                              <span className="text-[11px] text-muted-foreground">
                                                ยอดตามบิล:
                                              </span>
                                              <span className="text-primary font-semibold text-sm">
                                                {!isNaN(numVal)
                                                  ? `฿${numVal.toLocaleString(
                                                      "th-TH",
                                                      {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                      },
                                                    )}`
                                                  : "-"}
                                              </span>
                                            </div>
                                            {isItemOverLimit && (
                                              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 pt-1 border-t border-dashed border-amber-300 dark:border-amber-800">
                                                ⚠️ เกินสิทธิเบิกจ่ายประจำเดือน (฿
                                                {svcInfo.phoneReimbursementLimit?.toLocaleString()}
                                                )
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            } catch (e) {
                              return null;
                            }
                          })()}

                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              รวมเป็นจำนวนเงิน (บาท)
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md text-primary font-semibold text-lg">
                              {billToView.invoiceAmount
                                ? Number(
                                    billToView.invoiceAmount,
                                  ).toLocaleString("th-TH", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              ปริมาณการใช้
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.usageAmount
                                ? Number(billToView.usageAmount).toLocaleString(
                                    "th-TH",
                                  )
                                : "-"}
                            </p>
                          </div>
                          <div className="grid gap-1 md:col-span-2">
                            <p className="text-muted-foreground text-sm font-medium">
                              เลขที่ใบแจ้งหนี้ (Invoice)
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.invoiceNumber || "-"}
                            </p>
                          </div>
                          <div className="grid gap-1 md:col-span-2">
                            <p className="text-muted-foreground text-sm font-medium">
                              เอกสารใบแจ้งหนี้
                            </p>
                            {billToView.attachmentInvoice ? (
                              <a
                                href={billToView.attachmentInvoice}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-blue-600"
                              >
                                <FileText className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  ดูไฟล์เอกสาร
                                </span>
                              </a>
                            ) : (
                              <p className="bg-muted/50 p-2 rounded-md text-muted-foreground">
                                -
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Group 4: การเบิกจ่ายค่าสาธารณูปโภค */}
                  <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <Banknote className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg tracking-tight">
                        การเบิกจ่ายค่าสาธารณูปโภค
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                      <div className="grid gap-1 md:col-span-2">
                        <p className="text-muted-foreground text-sm font-medium">
                          สถานะการเบิกจ่าย
                        </p>
                        <Badge
                          variant={
                            billToView.paymentStatus === "PAID"
                              ? "default"
                              : "secondary"
                          }
                          className={`mt-1 w-fit ${billToView.paymentStatus === "PAID" ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          {billToView.paymentStatus === "PAID"
                            ? "เบิกจ่ายแล้ว"
                            : "ยังไม่ได้เบิกจ่าย"}
                        </Badge>
                      </div>

                      {billToView.paymentStatus === "PAID" && (
                        <>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              วันที่เอกสาร
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.paymentDate
                                ? format(
                                    new Date(billToView.paymentDate),
                                    "dd/MM/yyyy",
                                  )
                                : "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              รหัสงบประมาณ
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.budgetCode || "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              เลขเอกสาร
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.paymentDocNumber || "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              ประเภทเอกสาร
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.docType || "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              รหัสแยกประเภท
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md">
                              {billToView.accountCode || "-"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              จำนวนเงินที่เบิกจ่าย (บาท)
                            </p>
                            <p className="bg-muted/50 p-2 rounded-md text-green-600 font-semibold text-lg">
                              {billToView.paidAmount
                                ? Number(billToView.paidAmount).toLocaleString(
                                    "th-TH",
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )
                                : "-"}
                            </p>
                          </div>

                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              ใบเสร็จรับเงิน
                            </p>
                            {billToView.attachmentReceipt ? (
                              <a
                                href={billToView.attachmentReceipt}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-green-600"
                              >
                                <FileText className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  ดูไฟล์เอกสาร
                                </span>
                              </a>
                            ) : (
                              <p className="bg-muted/50 p-2 rounded-md text-muted-foreground">
                                -
                              </p>
                            )}
                          </div>
                          <div className="grid gap-1">
                            <p className="text-muted-foreground text-sm font-medium">
                              รายงานจ่ายตรง / รายงาน KTB
                            </p>
                            {billToView.attachmentDirectPayment ||
                            billToView.attachmentKtbReport ? (
                              <a
                                href={
                                  billToView.attachmentDirectPayment ||
                                  billToView.attachmentKtbReport ||
                                  undefined
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 w-fit text-orange-600"
                              >
                                <FileText className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  ดูไฟล์เอกสาร
                                </span>
                              </a>
                            ) : (
                              <p className="bg-muted/50 p-2 rounded-md text-muted-foreground">
                                -
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-xl border bg-card/50 p-4 shadow-sm">
                    <h4 className="font-semibold text-lg tracking-tight flex items-center gap-2 border-b pb-3 text-primary">
                      <CalendarClock className="h-5 w-5" /> สถานะปัจจุบันจากระบบ
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                      <div className="grid gap-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          สถานะตรวจสอบ (กตน.)
                        </p>
                        {billToView.auditStatus === "PENDING_RECHECK" ? (
                          <div className="flex flex-col gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 w-fit text-sm font-medium"
                            >
                              รอตรวจสอบใหม่
                            </Badge>
                            <div className="bg-blue-50/70 dark:bg-blue-950/30 p-3 rounded-md border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 mt-1">
                              <p className="font-semibold text-sm mb-1.5 opacity-90">
                                ข้อสังเกตความผิดปกติที่หน่วยงานได้แก้ไขแล้ว:
                              </p>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                {getAuditIssueTexts(billToView).length > 0 ? (
                                  getAuditIssueTexts(billToView).map(
                                    (issue, idx) => <li key={idx}>{issue}</li>,
                                  )
                                ) : (
                                  <li>ไม่ระบุสาเหตุ</li>
                                )}
                              </ul>
                              {billToView.manualAnomalyDetail && (
                                <p className="text-xs text-muted-foreground mt-2 border-t pt-1.5 whitespace-pre-line">
                                  {billToView.manualAnomalyDetail}
                                </p>
                              )}
                            </div>
                            {billToView.isReviewed && (
                              <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> ตรวจสอบแล้ว
                              </div>
                            )}
                          </div>
                        ) : billToView.auditStatus === "PENDING_CORRECTION" ? (
                          <div className="flex flex-col gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className="bg-amber-100 text-amber-700 w-fit text-sm"
                            >
                              พบข้อสังเกต (รอแก้ไข)
                            </Badge>
                            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-amber-900 mt-1">
                              <p className="font-semibold text-sm mb-1.5 opacity-80">
                                สาเหตุที่พบ:
                              </p>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                {getAuditIssueTexts(billToView).length > 0 ? (
                                  getAuditIssueTexts(billToView).map(
                                    (issue, idx) => <li key={idx}>{issue}</li>,
                                  )
                                ) : (
                                  <li>ไม่ระบุสาเหตุ</li>
                                )}
                              </ul>
                            </div>
                            {billToView.isReviewed && (
                              <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                                ตรวจสอบแล้ว
                                {billToView.reviewedBy
                                  ? ` โดย ${billToView.reviewedBy}`
                                  : ""}
                                {billToView.reviewedAt &&
                                  ` เมื่อ ${format(
                                    new Date(billToView.reviewedAt),
                                    "dd MMM yy HH:mm",
                                    { locale: th },
                                  )}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-start mt-1">
                            <Badge
                              variant={
                                !billToView.auditStatus ||
                                billToView.auditStatus === "CORRECTED"
                                  ? "secondary"
                                  : "outline"
                              }
                              className={`w-fit text-sm ${
                                !billToView.auditStatus
                                  ? "bg-green-100 text-green-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {!billToView.auditStatus ? "ปกติ" : "แก้ไขแล้ว"}
                            </Badge>
                            {billToView.isReviewed && (
                              <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                                ตรวจสอบแล้ว
                                {billToView.reviewedBy
                                  ? ` โดย ${billToView.reviewedBy}`
                                  : ""}
                                {billToView.reviewedAt &&
                                  ` เมื่อ ${format(
                                    new Date(billToView.reviewedAt),
                                    "dd MMM yy HH:mm",
                                    { locale: th },
                                  )}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <div className="space-y-4 rounded-xl border bg-card/50 p-6 shadow-sm min-h-[400px]">
                  <h3 className="font-semibold text-lg tracking-tight flex items-center gap-2 border-b pb-3 mb-4">
                    <Clock className="h-5 w-5 text-primary" /> ประวัติการทำรายการ
                  </h3>

                  {isLoadingLogs ? (
                    <div className="flex justify-center items-center h-32">
                      <p className="text-muted-foreground animate-pulse">
                        กำลังโหลดข้อมูล...
                      </p>
                    </div>
                  ) : billLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <Clock className="h-8 w-8 mb-2 opacity-20" />
                      <p>ไม่มีประวัติการทำรายการ</p>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-muted ml-3 space-y-6">
                      {billLogs.map((log) => (
                        <div key={log.id} className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background bg-primary"></div>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <div>
                              <p className="font-medium text-sm">
                                {log.action === "CREATED" && "สร้างรายการบิล"}
                                {log.action === "UPDATED" && "แก้ไขข้อมูลบิล"}
                                {log.action === "AUDITED" && "ตรวจสอบ/ประเมินบิล"}
                                {log.action === "ARCHIVED" && "ย้ายไปเก็บถาวร"}
                                {log.action === "RESTORED" && "กู้คืนเข้าสู่ระบบ"}
                                {!["CREATED", "UPDATED", "AUDITED", "ARCHIVED", "RESTORED"].includes(
                                  log.action,
                                ) && log.action}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {log.details}
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap text-right">
                              <p>
                                {format(
                                  new Date(log.createdAt),
                                  "dd/MM/yyyy HH:mm",
                                )}
                              </p>
                              <p className="mt-1 font-medium">
                                {log.userName || "ไม่ทราบชื่อผู้ใช้"}
                              </p>
                              {log.departmentName && (
                                <p className="opacity-80">
                                  {log.departmentName}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex gap-2 justify-end pt-4 border-t mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsViewDialogOpen(false);
                setBillToView(null);
              }}
            >
              ปิดหน้าต่าง
            </Button>

            {billToView &&
              canReview &&
              (billToView.isReviewed ? (
                <Button
                  variant="outline"
                  onClick={handleUnreview}
                  disabled={isPending}
                  className="border-emerald-600/30 text-emerald-700 hover:bg-emerald-50"
                >
                  ยกเลิกการตรวจรับรอง
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleReview}
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> ตรวจสอบแล้ว
                </Button>
              ))}

            {billToView &&
              canFlag &&
              (billToView.isManualAnomaly ? (
                <Button
                  variant="outline"
                  onClick={handleUnflagManual}
                  disabled={isPending}
                  className="border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                >
                  <Flag className="mr-2 h-4 w-4" /> ยกเลิกการปักธง
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setBillToFlag(billToView);
                    setFlagReason(billToView?.manualAnomalyReason || "");
                    setFlagDetail(billToView?.manualAnomalyDetail || "");
                  }}
                  disabled={isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Flag className="mr-2 h-4 w-4" /> ระบุว่าผิดปกติ
                </Button>
              ))}
            {billToView && (
              <Link
                href={`/bills/${billToView.id}/edit`}
                className={buttonVariants({ variant: "default" })}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> อัพเดทข้อมูลบิลนี้
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!billToFlag}
        onOpenChange={(open) => {
          if (!open) {
            setBillToFlag(null);
            setFlagReason("");
            setFlagDetail("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Flag className="h-5 w-5" /> ระบุว่ารายการผิดปกติ
            </DialogTitle>
            <DialogDescription>
              กรุณาระบุเหตุผลและคำแนะนำ เพื่อให้หน่วยงานตรวจสอบและดำเนินการแก้ไข
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                หัวข้อ / ข้อสังเกตหลัก <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="เช่น เอกสารไม่ครบถ้วน, ยอดเงินไม่ถูกต้อง..."
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                รายละเอียดเพิ่มเติม / คำแนะนำในการแก้ไข
              </Label>
              <Textarea
                rows={4}
                placeholder="ระบุรายละเอียดเพิ่มเติม เช่น เอกสารส่วนใดหายไป หรือแนวทางแก้ไขที่ต้องการ..."
                value={flagDetail}
                onChange={(e) => setFlagDetail(e.target.value)}
                disabled={isPending}
                className="resize-none text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBillToFlag(null);
                setFlagReason("");
                setFlagDetail("");
              }}
              disabled={isPending}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleFlagManual}
              disabled={isPending || !flagReason.trim()}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {isPending ? "กำลังบันทึก..." : "ยืนยันการปักธง"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!disableDrawer && (
        <BillQuickViewDrawer
          bill={billForDrawer}
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          userRole={userRole}
          userPermissions={userPermissions}
          pagePath={pagePath}
          onReview={
            canReview
              ? () => {
                  if (!billForDrawer) return;
                  startTransition(async () => {
                    const nextState = !billForDrawer.isReviewed;
                    const res = await markBillAsReviewed(billForDrawer.id, nextState);
                    if (res.success) {
                      toast.success(nextState ? "บันทึกการตรวจสอบเรียบร้อยแล้ว" : "ยกเลิกการตรวจรับรองเรียบร้อยแล้ว");
                      setIsDrawerOpen(false);
                      router.refresh();
                    } else {
                      toast.error(res.error || "ไม่สามารถทำรายการได้");
                    }
                  });
                }
              : undefined
          }
          onFlag={
            canFlag
              ? () => {
                  if (!billForDrawer) return;
                  setBillToFlag(billForDrawer);
                  setFlagReason(billForDrawer.manualAnomalyReason || "");
                  setFlagDetail(billForDrawer.manualAnomalyDetail || "");
                  setIsDrawerOpen(false);
                }
              : undefined
          }
          isPending={isPending}
        />
      )}
    </div>
  );
}
