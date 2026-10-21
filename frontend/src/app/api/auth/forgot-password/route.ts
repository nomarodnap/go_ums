import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error in /api/auth/forgot-password route:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", detail: "ไม่สามารถเชื่อมต่อระบบหลังบ้านได้" },
      { status: 500 }
    );
  }
}
