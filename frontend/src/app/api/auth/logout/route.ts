import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const reqHeaders = await headers();
    await auth.api.signOut({
      headers: reqHeaders,
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set("better-auth.session_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("__Secure-better-auth.session_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
    return res;
  } catch (error) {
    console.error("Error in /api/auth/logout:", error);
    return NextResponse.json({ success: true });
  }
}
