"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { hasPageAccess } from "@/lib/permissions";
import {
  getArchivedBills,
  getBillDeletionLogs,
  type ArchivedBillItem,
  type BillDeletionLogItem,
} from "@/server/actions/bills";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { ArchivedBillsClient } from "./archived-bills-client";
import { toast } from "sonner";

export default function ArchivedBillsPage() {
  const router = useRouter();
  const { data: meRes, isLoading: loadingMe } = useGetCurrentUser();
  const me = meRes?.status === 200 ? meRes.data.user : null;

  const [archivedBills, setArchivedBills] = useState<ArchivedBillItem[]>([]);
  const [deletionLogs, setDeletionLogs] = useState<BillDeletionLogItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoadingData(true);
    } else {
      setRefreshing(true);
    }
    try {
      const [archivedRes, logsRes] = await Promise.all([
        getArchivedBills(),
        getBillDeletionLogs(),
      ]);
      if (archivedRes.success) {
        setArchivedBills(archivedRes.data);
      } else if (archivedRes.error) {
        toast.error(archivedRes.error);
      }
      if (logsRes.success) {
        setDeletionLogs(logsRes.data);
      }
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!loadingMe && me && !hasPageAccess(me, "/archived-bills")) {
      router.replace("/unauthorized");
    }
  }, [loadingMe, me, router]);

  useEffect(() => {
    if (!loadingMe && me && hasPageAccess(me, "/archived-bills")) {
      void loadData(true);
    }
  }, [loadingMe, me, loadData]);

  if (loadingMe || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingEffect />
      </div>
    );
  }

  const canManage = ["admin", "central_staff", "regional_staff"].includes(
    me?.role || "",
  );

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
      <ArchivedBillsClient
        archivedBills={archivedBills}
        deletionLogs={deletionLogs}
        canManage={canManage}
        onRefresh={() => loadData(false)}
        isRefreshing={refreshing}
      />
    </div>
  );
}
