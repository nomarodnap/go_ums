"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const authToken =
    cookieStore.get("auth_token")?.value ||
    cookieStore.get("better-auth.session_token")?.value ||
    cookieStore.get("__Secure-better-auth.session_token")?.value;
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    reqHeaders["Authorization"] = `Bearer ${authToken}`;
    reqHeaders["Cookie"] = `auth_token=${authToken}; better-auth.session_token=${authToken}`;
  }
  return reqHeaders;
}

async function saveFile(file: File | null) {
  if (!file || file.size === 0) return null;

  const formData = new FormData();
  formData.append("file", file);

  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {};
  if (authHeaders["Authorization"]) {
    headers["Authorization"] = authHeaders["Authorization"];
  }
  if (authHeaders["Cookie"]) {
    headers["Cookie"] = authHeaders["Cookie"];
  }

  const res = await fetch(`${BACKEND_URL}/api/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to upload file to storage: ${errorText || res.statusText}`,
    );
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}

const createBillSchema = z
  .object({
    departmentId: z.string().min(1, "กรุณาเลือกหน่วยงาน"),
    utilityType: z.string().min(1, "กรุณาเลือกประเภทสาธารณูปโภค"),
    billingMonth: z.string().min(1, "กรุณาเลือกเดือนที่ออกบิล"),
    provider: z.string().optional(),
    serviceNumber: z
      .string()
      .min(
        1,
        "กรุณาเลือกหมายเลขผู้ใช้ / รหัสเครื่องวัดอย่างน้อย 1 หมายเลข\n(หากไม่มีหมายเลขที่ต้องการ ให้กดปุ่มจัดการรหัสเครื่องวัด)",
      ),
    serviceBreakdown: z.string().optional(),
    locationType: z.string().optional(),
    amountBaht: z.coerce.number().optional(),
    unitsUsed: z.coerce.number().optional(),
    estimatedAmount: z.coerce.number().optional(),
    documentRef: z.string().optional(),
    invoiceDate: z.string().optional(),
    receivedDate: z.string().optional(),
    invoiceStatus: z.enum(["RECEIVED", "NOT_RECEIVED"]).optional(),
    paymentStatus: z.enum(["PENDING", "PAID"]),
    paymentDate: z.string().optional(),
    receiptPaymentDate: z.string().optional(),
    sentToDisbursingDate: z.string().optional(),
    disbursingReceivedDate: z.string().optional(),
    paymentDocNumber: z.string().optional(),
    costCenterCode: z.string().optional(),
    docType: z.string().optional(),
    accountCode: z.string().optional(),
    budgetCode: z.string().optional(),
    paidAmount: z.coerce.number().optional(),
    disbursingType: z.string().optional(),
    depositUnitId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.disbursingType === "หน่วยงานฝากเบิก" && !data.depositUnitId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "กรุณาระบุหน่วยงานที่รับฝากเบิก",
        path: ["depositUnitId"],
      });
    }

    if (data.invoiceStatus === "RECEIVED") {
      if (!data.invoiceDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุวันที่ใบแจ้งหนี้",
          path: ["invoiceDate"],
        });
      }
      if (!data.receivedDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุวันที่ลงรับใบแจ้งหนี้",
          path: ["receivedDate"],
        });
      }
      if (!data.documentRef || data.documentRef.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุเลขที่ใบแจ้งหนี้ (Invoice)",
          path: ["documentRef"],
        });
      }
      if (
        data.amountBaht === undefined ||
        isNaN(data.amountBaht) ||
        data.amountBaht < 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุยอดรวมจำนวนเงิน (บาท)",
          path: ["amountBaht"],
        });
      }
      if (
        (data.utilityType === "ค่าไฟฟ้า" ||
          data.utilityType === "ค่าประปา&น้ำบาดาล") &&
        (data.unitsUsed === undefined || isNaN(data.unitsUsed))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุปริมาณการใช้ (kWh / m³)",
          path: ["unitsUsed"],
        });
      }
    }

    if (data.paymentStatus === "PAID") {
      if (!data.paymentDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุวันที่เอกสาร",
          path: ["paymentDate"],
        });
      }
      if (
        !data.costCenterCode ||
        data.costCenterCode.trim() === "" ||
        data.costCenterCode === "-"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "ไม่พบรหัสศูนย์ต้นทุนของหน่วยงานที่เบิกจ่าย (กรุณาตรวจสอบข้อมูลหน่วยงานหรือระบุหน่วยงานฝากเบิก)",
          path: ["costCenterCode"],
        });
      }
      if (!data.budgetCode || data.budgetCode.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุหรือเลือกรหัสงบประมาณ",
          path: ["budgetCode"],
        });
      }
      if (!data.paymentDocNumber || data.paymentDocNumber.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุเลขเอกสาร",
          path: ["paymentDocNumber"],
        });
      }
      if (!data.docType || data.docType.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุประเภทเอกสาร (เช่น KC)",
          path: ["docType"],
        });
      }
      if (!data.accountCode || data.accountCode.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุรหัสแยกประเภท",
          path: ["accountCode"],
        });
      }
      if (
        data.paidAmount === undefined ||
        isNaN(data.paidAmount) ||
        data.paidAmount <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุจำนวนเงินที่เบิกจ่าย",
          path: ["paidAmount"],
        });
      }
    }
  });

const updateBillSchema = createBillSchema.extend({
  billId: z.string().min(1, "ไม่พบรหัสบิลที่ต้องการแก้ไข"),
});

export async function createBill(prevState: unknown, formData: FormData) {
  try {
    const rawData = {
      departmentId: (formData.get("departmentId") as string) || "",
      utilityType: (formData.get("utilityType") as string) || "",
      billingMonth: (formData.get("billingMonth") as string) || "",
      provider: formData.get("provider") || undefined,
      serviceNumber: formData.get("serviceNumber")?.toString() || "",
      serviceBreakdown:
        formData.get("serviceBreakdown")?.toString() || undefined,
      locationType: formData.get("locationType") || undefined,
      amountBaht: formData.get("amountBaht") || undefined,
      estimatedAmount: formData.get("estimatedAmount") || undefined,
      unitsUsed: formData.get("unitsUsed") || undefined,
      documentRef: formData.get("documentRef") || undefined,
      invoiceDate: formData.get("invoiceDate") || undefined,
      receivedDate: formData.get("receivedDate") || undefined,
      invoiceStatus: formData.get("invoiceStatus") || undefined,
      paymentStatus: formData.get("paymentStatus"),
      paymentDate: formData.get("paymentDate") || undefined,
      receiptPaymentDate: formData.get("receiptPaymentDate") || undefined,
      sentToDisbursingDate: formData.get("sentToDisbursingDate") || undefined,
      disbursingReceivedDate:
        formData.get("disbursingReceivedDate") || undefined,
      paymentDocNumber: formData.get("paymentDocNumber") || undefined,
      costCenterCode: formData.get("costCenterCode") || undefined,
      docType: formData.get("docType") || undefined,
      accountCode: formData.get("accountCode") || undefined,
      budgetCode: formData.get("budgetCode") || undefined,
      paidAmount: formData.get("paidAmount") || undefined,
      disbursingType: formData.get("disbursingType") || undefined,
      depositUnitId:
        formData.get("depositUnit") ||
        formData.get("depositUnitId") ||
        undefined,
    };

    const parsed = createBillSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors,
      };
    }

    const invoiceFile = formData.get("attachmentInvoice") as File | null;
    const receiptFile = formData.get("attachmentReceipt") as File | null;
    const directPaymentFile = formData.get(
      "attachmentDirectPayment",
    ) as File | null;
    const ktbReportFile = formData.get("attachmentKtbReport") as File | null;

    const fileErrors: Record<string, string[]> = {};
    if (
      parsed.data.invoiceStatus === "RECEIVED" &&
      (!invoiceFile || invoiceFile.size === 0)
    ) {
      fileErrors.attachmentInvoice = ["กรุณาแนบไฟล์เอกสารใบแจ้งหนี้"];
    }

    if (parsed.data.paymentStatus === "PAID") {
      if (!receiptFile || receiptFile.size === 0) {
        fileErrors.attachmentReceipt = ["กรุณาแนบไฟล์ใบเสร็จรับเงิน"];
      }
      if (
        (!directPaymentFile || directPaymentFile.size === 0) &&
        (!ktbReportFile || ktbReportFile.size === 0)
      ) {
        fileErrors.attachmentDirectPayment = [
          "กรุณาแนบไฟล์รายงานจ่ายตรง / รายงาน KTB",
        ];
      }
    }

    if (Object.keys(fileErrors).length > 0) {
      return {
        success: false,
        error: fileErrors,
      };
    }

    const [invoicePath, receiptPath, directPaymentPath, ktbReportPath] =
      await Promise.all([
        saveFile(invoiceFile),
        saveFile(receiptFile),
        saveFile(directPaymentFile),
        saveFile(ktbReportFile),
      ]);

    const [yearStr, monthStr] = (parsed.data.billingMonth || "").split("-");
    const billingYear = parseInt(yearStr, 10) || new Date().getFullYear();
    const billingMonth = parseInt(monthStr, 10) || new Date().getMonth() + 1;

    const payload = {
      departmentId: parsed.data.departmentId,
      utilityType: parsed.data.utilityType,
      billingMonth,
      billingYear,
      provider: parsed.data.provider || undefined,
      serviceNumber: parsed.data.serviceNumber || undefined,
      serviceBreakdown: parsed.data.serviceBreakdown || undefined,
      invoiceNumber: parsed.data.documentRef || undefined,
      invoiceDate: parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate).toISOString() : undefined,
      locationType: parsed.data.locationType || undefined,
      usageAmount: parsed.data.unitsUsed !== undefined ? Number(parsed.data.unitsUsed) : undefined,
      invoiceAmount:
        parsed.data.amountBaht !== undefined
          ? Number(parsed.data.amountBaht)
          : parsed.data.estimatedAmount !== undefined
            ? Number(parsed.data.estimatedAmount)
            : undefined,
      estimatedAmount: parsed.data.estimatedAmount !== undefined ? Number(parsed.data.estimatedAmount) : undefined,
      receivedDate: parsed.data.receivedDate ? new Date(parsed.data.receivedDate).toISOString() : undefined,
      sentToDisbursingDate: parsed.data.sentToDisbursingDate ? new Date(parsed.data.sentToDisbursingDate).toISOString() : undefined,
      disbursingReceivedDate: parsed.data.disbursingReceivedDate ? new Date(parsed.data.disbursingReceivedDate).toISOString() : undefined,
      paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate).toISOString() : undefined,
      paymentDocNumber: parsed.data.paymentDocNumber || undefined,
      docType: parsed.data.docType || undefined,
      accountCode: parsed.data.accountCode || undefined,
      budgetCode: parsed.data.budgetCode || undefined,
      paidAmount: parsed.data.paidAmount !== undefined ? Number(parsed.data.paidAmount) : undefined,
      paymentStatus: parsed.data.paymentStatus,
      invoiceStatus: parsed.data.invoiceStatus || "RECEIVED",
      attachmentInvoice: invoicePath || undefined,
      attachmentReceipt: receiptPath || undefined,
      attachmentDirectPayment: directPaymentPath || undefined,
      attachmentKtbReport: ktbReportPath || undefined,
      isPendingBillOnly: false,
      depositUnitId: parsed.data.disbursingType === "หน่วยงานฝากเบิก" ? parsed.data.depositUnitId : undefined,
    };

    const reqHeaders = await getAuthHeaders();

    const res = await fetch(`${BACKEND_URL}/api/bills`, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.detail || errJson.title || "ไม่สามารถบันทึกค่าใช้จ่ายได้",
      };
    }

    revalidatePath("/bills");
    revalidatePath("/all-bills");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error creating bill:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก",
    };
  }
}

export async function updateBill(prevState: unknown, formData: FormData) {
  try {
    const rawData = {
      billId: formData.get("billId")?.toString() || "",
      departmentId: (formData.get("departmentId") as string) || "",
      utilityType: (formData.get("utilityType") as string) || "",
      billingMonth: (formData.get("billingMonth") as string) || "",
      provider: formData.get("provider") || undefined,
      serviceNumber: formData.get("serviceNumber")?.toString() || "",
      serviceBreakdown:
        formData.get("serviceBreakdown")?.toString() || undefined,
      locationType: formData.get("locationType") || undefined,
      amountBaht: formData.get("amountBaht") || undefined,
      estimatedAmount: formData.get("estimatedAmount") || undefined,
      unitsUsed: formData.get("unitsUsed") || undefined,
      documentRef: formData.get("documentRef") || undefined,
      invoiceDate: formData.get("invoiceDate") || undefined,
      receivedDate: formData.get("receivedDate") || undefined,
      invoiceStatus: formData.get("invoiceStatus") || undefined,
      paymentStatus: formData.get("paymentStatus"),
      paymentDate: formData.get("paymentDate") || undefined,
      receiptPaymentDate: formData.get("receiptPaymentDate") || undefined,
      sentToDisbursingDate: formData.get("sentToDisbursingDate") || undefined,
      disbursingReceivedDate:
        formData.get("disbursingReceivedDate") || undefined,
      paymentDocNumber: formData.get("paymentDocNumber") || undefined,
      costCenterCode: formData.get("costCenterCode") || undefined,
      docType: formData.get("docType") || undefined,
      accountCode: formData.get("accountCode") || undefined,
      budgetCode: formData.get("budgetCode") || undefined,
      paidAmount: formData.get("paidAmount") || undefined,
      disbursingType: formData.get("disbursingType") || undefined,
      depositUnitId:
        formData.get("depositUnit") ||
        formData.get("depositUnitId") ||
        undefined,
    };

    const parsed = updateBillSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors,
      };
    }

    const reqHeaders = await getAuthHeaders();

    const existingRes = await fetch(
      `${BACKEND_URL}/api/bills/${parsed.data.billId}`,
      {
        headers: reqHeaders,
        cache: "no-store",
      },
    );
    const existingJson = existingRes.ok
      ? await existingRes.json().catch(() => ({}))
      : {};
    const existingBill = existingJson?.body || existingJson;

    const invoiceFile = formData.get("attachmentInvoice") as File | null;
    const receiptFile = formData.get("attachmentReceipt") as File | null;
    const directPaymentFile = formData.get(
      "attachmentDirectPayment",
    ) as File | null;
    const ktbReportFile = formData.get("attachmentKtbReport") as File | null;

    const fileErrors: Record<string, string[]> = {};
    if (
      parsed.data.invoiceStatus === "RECEIVED" &&
      !existingBill?.attachmentInvoice &&
      (!invoiceFile || invoiceFile.size === 0)
    ) {
      fileErrors.attachmentInvoice = ["กรุณาแนบไฟล์เอกสารใบแจ้งหนี้"];
    }

    if (parsed.data.paymentStatus === "PAID") {
      if (
        !existingBill?.attachmentReceipt &&
        (!receiptFile || receiptFile.size === 0)
      ) {
        fileErrors.attachmentReceipt = ["กรุณาแนบไฟล์ใบเสร็จรับเงิน"];
      }
      if (
        !existingBill?.attachmentDirectPayment &&
        !existingBill?.attachmentKtbReport &&
        (!directPaymentFile || directPaymentFile.size === 0) &&
        (!ktbReportFile || ktbReportFile.size === 0)
      ) {
        fileErrors.attachmentDirectPayment = [
          "กรุณาแนบไฟล์รายงานจ่ายตรง / รายงาน KTB",
        ];
      }
    }

    if (Object.keys(fileErrors).length > 0) {
      return {
        success: false,
        error: fileErrors,
      };
    }

    const [invoicePath, receiptPath, directPaymentPath, ktbReportPath] =
      await Promise.all([
        saveFile(invoiceFile),
        saveFile(receiptFile),
        saveFile(directPaymentFile),
        saveFile(ktbReportFile),
      ]);

    const [yearStr, monthStr] = (parsed.data.billingMonth || "").split("-");
    const billingYear = parseInt(yearStr, 10) || new Date().getFullYear();
    const billingMonth = parseInt(monthStr, 10) || new Date().getMonth() + 1;

    const payload = {
      departmentId: parsed.data.departmentId,
      utilityType: parsed.data.utilityType,
      billingMonth,
      billingYear,
      provider: parsed.data.provider || undefined,
      serviceNumber: parsed.data.serviceNumber || undefined,
      serviceBreakdown: parsed.data.serviceBreakdown || undefined,
      invoiceNumber: parsed.data.documentRef || undefined,
      invoiceDate: parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate).toISOString() : undefined,
      locationType: parsed.data.locationType || undefined,
      usageAmount: parsed.data.unitsUsed !== undefined ? Number(parsed.data.unitsUsed) : undefined,
      invoiceAmount:
        parsed.data.amountBaht !== undefined
          ? Number(parsed.data.amountBaht)
          : parsed.data.estimatedAmount !== undefined
            ? Number(parsed.data.estimatedAmount)
            : undefined,
      estimatedAmount: parsed.data.estimatedAmount !== undefined ? Number(parsed.data.estimatedAmount) : undefined,
      receivedDate: parsed.data.receivedDate ? new Date(parsed.data.receivedDate).toISOString() : undefined,
      sentToDisbursingDate: parsed.data.sentToDisbursingDate ? new Date(parsed.data.sentToDisbursingDate).toISOString() : undefined,
      disbursingReceivedDate: parsed.data.disbursingReceivedDate ? new Date(parsed.data.disbursingReceivedDate).toISOString() : undefined,
      paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate).toISOString() : undefined,
      paymentDocNumber: parsed.data.paymentDocNumber || undefined,
      docType: parsed.data.docType || undefined,
      accountCode: parsed.data.accountCode || undefined,
      budgetCode: parsed.data.budgetCode || undefined,
      paidAmount: parsed.data.paidAmount !== undefined ? Number(parsed.data.paidAmount) : undefined,
      paymentStatus: parsed.data.paymentStatus,
      invoiceStatus: parsed.data.invoiceStatus || "RECEIVED",
      attachmentInvoice: invoicePath || undefined,
      attachmentReceipt: receiptPath || undefined,
      attachmentDirectPayment: directPaymentPath || undefined,
      attachmentKtbReport: ktbReportPath || undefined,
      isPendingBillOnly: parsed.data.disbursingType === "หน่วยงานฝากเบิก",
      depositUnitId: parsed.data.disbursingType === "หน่วยงานฝากเบิก" ? parsed.data.depositUnitId : undefined,
    };

    const res = await fetch(`${BACKEND_URL}/api/bills/${parsed.data.billId}`, {
      method: "PUT",
      headers: reqHeaders,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.detail || errJson.title || "ไม่สามารถอัปเดตบิลค่าใช้จ่ายได้",
      };
    }

    revalidatePath("/bills");
    revalidatePath("/all-bills");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating bill:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอัปเดต",
    };
  }
}

export async function getLatestEstimatedAmount(
  serviceNumber: string,
  currentMonth: string,
) {
  try {
    if (!serviceNumber || !currentMonth) return null;

    const [yearStr, monthStr] = currentMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (!year || !month) return null;

    const res = await fetch(
      `${BACKEND_URL}/api/bills/estimated-amount?serviceNumber=${encodeURIComponent(
        serviceNumber,
      )}&month=${month}&year=${year}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.body !== undefined ? json.body : null;
  } catch (err) {
    console.error("Failed to get latest estimated amount:", err);
    return null;
  }
}

export async function deleteBill(billId: string) {
  try {
    const reqHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/bills/${billId}`, {
      method: "DELETE",
      headers: reqHeaders,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || err.title || "ไม่สามารถลบรายการได้" };
    }
    revalidatePath("/bills");
    revalidatePath("/all-bills");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการลบ",
    };
  }
}

export async function markBillAsReviewed(billId: string, isReviewed: boolean) {
  try {
    const reqHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/bills/${billId}/review`, {
      method: "PUT",
      headers: reqHeaders,
      body: JSON.stringify({ isReviewed }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || err.title || "ไม่สามารถบันทึกการตรวจสอบได้" };
    }
    revalidatePath("/bills");
    revalidatePath("/all-bills");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการตรวจสอบ",
    };
  }
}

export async function getBillLogs(billId: string) {
  try {
    const reqHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/bills/${billId}/logs`, {
      headers: reqHeaders,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.body)) return json.body;
    return [];
  } catch {
    return [];
  }
}

