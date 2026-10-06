"use server";

import { revalidatePath } from "next/cache";

const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

export async function flagManualAnomaly(billId: string, reason: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/audits/bills/${billId}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: err.detail || err.title || "ไม่สามารถบันทึกความผิดปกติได้",
      };
    }

    revalidatePath("/bills");
    revalidatePath("/all-bills");
    revalidatePath("/audits");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก",
    };
  }
}

export async function unflagManualAnomaly(billId: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/audits/bills/${billId}/flag`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: err.detail || err.title || "ไม่สามารถยกเลิกความผิดปกติได้",
      };
    }

    revalidatePath("/bills");
    revalidatePath("/all-bills");
    revalidatePath("/audits");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการยกเลิก",
    };
  }
}
