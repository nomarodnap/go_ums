"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateBudgetCode,
  useUpdateBudgetCode,
  getListBudgetCodesQueryKey,
} from "@/lib/api/generated/budgets/budgets";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type BudgetCodeItem = {
  id: string;
  code: string;
  name: string;
  fiscalYear: number;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
};

export function BudgetCodeDialog({
  open,
  onOpenChange,
  budgetCodeToEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetCodeToEdit?: BudgetCodeItem | null;
}) {
  const queryClient = useQueryClient();
  const currentBE = new Date().getFullYear() + 543;
  const currentFiscalYear =
    new Date().getMonth() >= 9 ? currentBE + 1 : currentBE;

  const [fiscalYear, setFiscalYear] = useState<string>(
    String(budgetCodeToEdit?.fiscalYear || currentFiscalYear),
  );
  const [code, setCode] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useCreateBudgetCode();
  const updateMutation = useUpdateBudgetCode();
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      if (budgetCodeToEdit) {
        setFiscalYear(String(budgetCodeToEdit.fiscalYear));
        setCode(budgetCodeToEdit.code);
        setDescription(budgetCodeToEdit.description || "");
        setIsActive(budgetCodeToEdit.isActive);
      } else {
        setFiscalYear(String(currentFiscalYear));
        setCode("");
        setDescription("");
        setIsActive(true);
      }
      setErrors({});
    }
  }, [budgetCodeToEdit, open, currentFiscalYear]);

  const yearOptions = [
    currentFiscalYear + 1,
    currentFiscalYear,
    currentFiscalYear - 1,
    currentFiscalYear - 2,
    currentFiscalYear - 3,
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!code.trim()) {
      newErrors.code = "กรุณาระบุรหัสงบประมาณ";
    }
    if (!fiscalYear) {
      newErrors.fiscalYear = "กรุณาเลือกปีงบประมาณ";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      if (budgetCodeToEdit) {
        await updateMutation.mutateAsync({
          id: budgetCodeToEdit.id,
          data: {
            code: code.trim(),
            name: code.trim(),
            fiscalYear: parseInt(fiscalYear, 10),
            description: description.trim() || undefined,
            isActive,
          },
        });
        toast.success("แก้ไขรหัสงบประมาณเรียบร้อยแล้ว");
      } else {
        await createMutation.mutateAsync({
          data: {
            code: code.trim(),
            name: code.trim(),
            fiscalYear: parseInt(fiscalYear, 10),
            description: description.trim() || undefined,
            isActive,
          },
        });
        toast.success("บันทึกรหัสงบประมาณเรียบร้อยแล้ว");
      }

      await queryClient.invalidateQueries({
        queryKey: getListBudgetCodesQueryKey(),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {budgetCodeToEdit ? "แก้ไขรหัสงบประมาณ" : "เพิ่มรหัสงบประมาณใหม่"}
          </DialogTitle>
          <DialogDescription>
            กำหนดรหัสงบประมาณประจำปี สำหรับใช้ในระบบเบิกจ่ายค่าสาธารณูปโภค
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fiscalYear">
                ปีงบประมาณ (พ.ศ.) <span className="text-destructive">*</span>
              </Label>
              <Select
                value={fiscalYear}
                onValueChange={(val) => {
                  if (val) setFiscalYear(val);
                }}
              >
                <SelectTrigger
                  id="fiscalYear"
                  className={errors.fiscalYear ? "w-full border-rose-500 ring-2 ring-rose-500/20" : "w-full"}
                >
                  <SelectValue placeholder="เลือกปีงบประมาณ">
                    {fiscalYear ? `พ.ศ. ${fiscalYear}` : "เลือกปีงบประมาณ"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((yr) => (
                    <SelectItem key={yr} value={String(yr)}>
                      พ.ศ. {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fiscalYear && (
                <p className="text-xs text-rose-500 font-medium">{errors.fiscalYear}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">
                รหัสงบประมาณ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (errors.code) setErrors((prev) => ({ ...prev, code: "" }));
                }}
                placeholder="เช่น 2800100000000000"
                className={errors.code ? "border-rose-500 ring-2 ring-rose-500/20" : ""}
              />
              {errors.code && (
                <p className="text-xs text-rose-500 font-medium">{errors.code}</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">คำอธิบายเพิ่มเติม / หมายเหตุ</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
            <div>
              <Label className="text-sm font-medium">สถานะการใช้งาน</Label>
              <p className="text-xs text-muted-foreground">
                เปิดเพื่อให้สามารถเลือกใช้งานในแบบฟอร์มบันทึกค่าใช้จ่ายได้
              </p>
            </div>
            <Button
              type="button"
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setIsActive(!isActive)}
            >
              {isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </Button>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "กำลังบันทึก..."
                : budgetCodeToEdit
                  ? "บันทึกการแก้ไข"
                  : "เพิ่มรหัสงบประมาณ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
