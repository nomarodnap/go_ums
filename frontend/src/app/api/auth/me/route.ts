import { auth, pool } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    let userId: string | null = null;

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      // Check Bearer Token or auth_token cookie fallback
      const authHeader = reqHeaders.get("authorization");
      const cookieHeader = reqHeaders.get("cookie") || "";
      let token = "";

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      } else {
        const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/) ||
                      cookieHeader.match(/auth_token=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }

      if (token) {
        const { rows: sessionRows } = await pool.query(
          `SELECT user_id FROM "session" WHERE token = $1 AND expires_at > NOW() LIMIT 1`,
          [token]
        );
        if (sessionRows.length > 0) {
          userId = sessionRows[0].user_id;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    // Query full user profile and associated department name
    const { rows } = await pool.query(
      `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.department_id, 
        d.full_name AS department_name, 
        u.phone, 
        u.created_at
      FROM "user" u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: "user not found" }, { status: 404 });
    }

    const u = rows[0];
    return NextResponse.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        departmentId: u.department_id,
        departmentName: u.department_name,
        phone: u.phone,
        createdAt: u.created_at,
      },
    });
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  }
}
