"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Comlink from "comlink";
import type { BillItem, FilterOptions, WorkerSummary } from "@/workers/bills-filter.worker";

export function useBillsWorker() {
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const worker = new Worker(
        new URL("../workers/bills-filter.worker.ts", import.meta.url),
        { type: "module" },
      );
      const api = Comlink.wrap(worker);
      workerRef.current = worker;
      apiRef.current = api;
      setIsReady(true);
    } catch (err) {
      console.warn("Web worker init failed, fallback to main thread", err);
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      apiRef.current = null;
    };
  }, []);

  const filterBills = useCallback(
    async (bills: BillItem[], options: FilterOptions): Promise<BillItem[]> => {
      if (apiRef.current) {
        try {
          return await apiRef.current.filterBills(bills, options);
        } catch (e) {
          console.error("Worker error, fallback to synchronous filter", e);
        }
      }
      // Fallback
      const term = (options.searchTerm || "").trim().toLowerCase();
      return bills.filter((b) => {
        if (term) {
          const match =
            (b.billCode && b.billCode.toLowerCase().includes(term)) ||
            (b.departmentName && b.departmentName.toLowerCase().includes(term)) ||
            (b.serviceNumber && b.serviceNumber.toLowerCase().includes(term)) ||
            (b.invoiceNumber && b.invoiceNumber.toLowerCase().includes(term));
          if (!match) return false;
        }
        if (options.utilityType && options.utilityType !== "ทุกประเภท" && b.utilityType !== options.utilityType) return false;
        if (options.month && options.month !== "ทุกเดือน" && String(b.billingMonth) !== options.month) return false;
        if (options.year && options.year !== "ทุกปี" && String(b.billingYear) !== options.year) return false;
        return true;
      });
    },
    [],
  );

  const calculateSummary = useCallback(
    async (bills: BillItem[]): Promise<WorkerSummary> => {
      if (apiRef.current) {
        try {
          return await apiRef.current.calculateSummary(bills);
        } catch (e) {
          console.error("Worker summary error", e);
        }
      }
      let totalAmount = 0;
      let paidAmount = 0;
      let anomalyCount = 0;
      const byUtility: Record<string, number> = {};
      for (const b of bills) {
        const inv = parseFloat(b.invoiceAmount || "0") || 0;
        totalAmount += inv;
        paidAmount += parseFloat(b.paidAmount || "0") || 0;
        if (b.isAnomalyExpense || b.isManualAnomaly || b.isLatePayment || b.isLateReceive) anomalyCount++;
        byUtility[b.utilityType] = (byUtility[b.utilityType] || 0) + inv;
      }
      return { totalCount: bills.length, totalAmount, paidAmount, anomalyCount, byUtility };
    },
    [],
  );

  return { isReady, filterBills, calculateSummary };
}
