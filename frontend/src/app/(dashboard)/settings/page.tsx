"use client";

import { useListBudgetCodes } from "@/lib/api/generated/budgets/budgets";
import { BudgetCodesTable } from "./budget-codes-table";
import { Settings, Coins } from "lucide-react";
import { LoadingEffect } from "@/components/ui/loading-effect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  const { data: budgetCodesRes, isLoading, error } = useListBudgetCodes();
  const rawList = Array.isArray(budgetCodesRes?.data) ? budgetCodesRes.data : [];
  const allBudgetCodes = rawList.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    fiscalYear: item.fiscalYear,
    description: item.description,
    isActive: item.isActive,
    createdAt: item.createdAt,
  }));

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">ตั้งค่าระบบ</h2>
        </div>
        <p className="text-muted-foreground mt-1">
          จัดการข้อมูลการตั้งค่าพื้นฐานของระบบและรหัสงบประมาณประจำปี
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="budget-codes" className="w-full">
        <TabsList className="grid w-full sm:w-[320px] grid-cols-1">
          <TabsTrigger value="budget-codes" className="gap-2">
            <Coins className="h-4 w-4" />
            <span>รหัสงบประมาณ</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budget-codes" className="mt-6 space-y-4">
          {isLoading ? (
            <LoadingEffect message="กำลังโหลดข้อมูลรหัสงบประมาณ..." />
          ) : error ? (
            <Card className="border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20">
              <CardContent className="flex flex-col items-center justify-center py-12 text-rose-600 dark:text-rose-400 gap-2">
                <p className="font-semibold text-sm">ไม่สามารถโหลดข้อมูลรหัสงบประมาณได้</p>
                <p className="text-xs text-muted-foreground">กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ</p>
              </CardContent>
            </Card>
          ) : (
            <BudgetCodesTable initialData={allBudgetCodes} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
