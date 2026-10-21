"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

export async function flagManualAnomaly(billId: string, reason: string) {
  try {
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

    const res = await fetch(`${BACKEND_URL}/api/audits/bills/${billId}/flag`, {
      method: "POST",
      headers: reqHeaders,
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

    const res = await fetch(`${BACKEND_URL}/api/audits/bills/${billId}/flag`, {
      method: "DELETE",
      headers: reqHeaders,
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

export async function resolveAudit(prevState: any, formData: FormData) {
  try {
    const cookieStore = await cookies();
    const authToken =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("better-auth.session_token")?.value ||
      cookieStore.get("__Secure-better-auth.session_token")?.value;

    const auditId = formData.get("auditId") as string;
    const remarks = formData.get("remarks") as string;

    if (!auditId) {
      return { success: false, error: "Audit ID is missing" };
    }

    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      reqHeaders["Authorization"] = `Bearer ${authToken}`;
      reqHeaders["Cookie"] = `auth_token=${authToken}; better-auth.session_token=${authToken}`;
    }

    const res = await fetch(`${BACKEND_URL}/api/audits/${auditId}/resolve`, {
      method: "PUT",
      headers: reqHeaders,
      body: JSON.stringify({ remarks: remarks || "" }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: err.detail || err.title || "ไม่สามารถบันทึกการแก้ไขได้",
      };
    }

    revalidatePath("/audits");
    revalidatePath("/bills");
    revalidatePath("/all-bills");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก",
    };
  }
}

export async function recheckAllAudits() {
  try {
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

    const res = await fetch(`${BACKEND_URL}/api/audits/recheck-all`, {
      method: "POST",
      headers: reqHeaders,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: err.detail || err.title || "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล",
      };
    }

    const data = await res.json();
    revalidatePath("/audits");
    revalidatePath("/bills");
    revalidatePath("/all-bills");
    return { success: true, count: data?.body?.count || 0 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
    };
  }
}
