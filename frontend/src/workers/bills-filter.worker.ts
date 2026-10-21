import * as Comlink from "comlink";

export interface BillItem {
  id: string;
  billCode: string | null;
  departmentName: string | null;
  utilityType: string;
  billingMonth: number;
  billingYear: number;
  invoiceAmount: string | null;
  paidAmount: string | null;
  paymentStatus: string;
  auditStatus: string | null;
  serviceNumber: string | null;
  invoiceNumber: string | null;
  isAnomalyExpense?: boolean | null;
  isManualAnomaly?: boolean | null;
  isLatePayment?: boolean | null;
  isLateReceive?: boolean | null;
  isReviewed?: boolean | null;
}

export interface FilterOptions {
  searchTerm?: string;
  utilityType?: string;
  month?: string;
  year?: string;
  status?: string;
  anomaly?: string;
  review?: string;
}

export interface WorkerSummary {
  totalCount: number;
  totalAmount: number;
  paidAmount: number;
  anomalyCount: number;
  byUtility: Record<string, number>;
}

export const billsWorkerApi = {
  filterBills(bills: BillItem[], options: FilterOptions): BillItem[] {
    const term = (options.searchTerm || "").trim().toLowerCase();
    const utility = options.utilityType || "ทุกประเภท";
    const month = options.month || "ทุกเดือน";
    const year = options.year || "ทุกปี";
    const status = options.status || "ทุกสถานะ";
    const anomaly = options.anomaly || "ทั้งหมด";
    const review = options.review || "ทั้งหมด";

    return bills.filter((b) => {
      // Search term
      if (term) {
        const matchesTerm =
          (b.billCode && b.billCode.toLowerCase().includes(term)) ||
          (b.departmentName && b.departmentName.toLowerCase().includes(term)) ||
          (b.serviceNumber && b.serviceNumber.toLowerCase().includes(term)) ||
          (b.invoiceNumber && b.invoiceNumber.toLowerCase().includes(term));
        if (!matchesTerm) return false;
      }

      // Utility
      if (utility !== "ทุกประเภท" && b.utilityType !== utility) {
        return false;
      }

      // Month
      if (month !== "ทุกเดือน" && String(b.billingMonth) !== month) {
        return false;
      }

      // Year
      if (year !== "ทุกปี" && String(b.billingYear) !== year) {
        return false;
      }

      // Status
      if (status !== "ทุกสถานะ") {
        if (status === "เบิกจ่ายแล้ว" && b.paymentStatus !== "PAID") return false;
        if (status === "ยังไม่ได้รับใบแจ้งหนี้" && b.paymentStatus !== "WAITING") return false;
        if (status === "ยังไม่ได้เบิกจ่าย" && b.paymentStatus !== "UNPAID") return false;
      }

      // Anomaly
      if (anomaly !== "ทั้งหมด") {
        const hasAnomaly =
          b.isAnomalyExpense ||
          b.isManualAnomaly ||
          b.isLatePayment ||
          b.isLateReceive;
        if (anomaly === "พบความผิดปกติ" && !hasAnomaly) return false;
        if (anomaly === "ปกติ" && hasAnomaly) return false;
      }

      // Review
      if (review !== "ทั้งหมด") {
        if (review === "ตรวจเรียบร้อยแล้ว" && !b.isReviewed) return false;
        if (review === "ยังไม่ตรวจ" && b.isReviewed) return false;
      }

      return true;
    });
  },

  calculateSummary(bills: BillItem[]): WorkerSummary {
    let totalAmount = 0;
    let paidAmount = 0;
    let anomalyCount = 0;
    const byUtility: Record<string, number> = {};

    for (let i = 0; i < bills.length; i++) {
      const b = bills[i];
      const inv = parseFloat(b.invoiceAmount || "0") || 0;
      const paid = parseFloat(b.paidAmount || "0") || 0;

      totalAmount += inv;
      paidAmount += paid;

      if (b.isAnomalyExpense || b.isManualAnomaly || b.isLatePayment || b.isLateReceive) {
        anomalyCount++;
      }

      byUtility[b.utilityType] = (byUtility[b.utilityType] || 0) + inv;
    }

    return {
      totalCount: bills.length,
      totalAmount,
      paidAmount,
      anomalyCount,
      byUtility,
    };
  },
};

Comlink.expose(billsWorkerApi);
