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
    console.error("Error in /api/auth/me GET:", error);
    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    let userId: string | null = null;

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      const authHeader = reqHeaders.get("authorization");
      const cookieHeader = reqHeaders.get("cookie") || "";
      let token = "";

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      } else {
        const match =
          cookieHeader.match(/better-auth\.session_token=([^;]+)/) ||
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

    const body = await req.json();
    const { name, phone, currentPassword, newPassword } = body;

    // 1. Update basic profile info (name, phone)
    if (name !== undefined || phone !== undefined) {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (typeof name === "string" && name.trim()) {
        updates.push(`name = $${idx++}`);
        values.push(name.trim());
      }
      if (typeof phone === "string") {
        updates.push(`phone = $${idx++}`);
        values.push(phone.trim() || null);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(userId);
        await pool.query(
          `UPDATE "user" SET ${updates.join(", ")} WHERE id = $${idx}`,
          values
        );
      }
    }

    // 2. Change password if requested
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { message: "กรุณาระบุรหัสผ่านปัจจุบันเพื่อเปลี่ยนรหัสผ่าน" },
          { status: 400 }
        );
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return NextResponse.json(
          { message: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร" },
          { status: 400 }
        );
      }

      // Check current password from account table
      const { rows: accRows } = await pool.query(
        `SELECT id, password FROM "account" WHERE user_id = $1 AND provider_id = 'credential' LIMIT 1`,
        [userId]
      );

      const { verifyPassword, hashPassword } = await import("@/lib/auth");

      if (accRows.length === 0 || !accRows[0].password) {
        // If user doesn't have a credential account row yet, create one
        const newHash = await hashPassword(newPassword);
        const accId = (await import("crypto")).randomUUID();
        await pool.query(
          `INSERT INTO "account" (id, user_id, account_id, provider_id, password, created_at, updated_at)
           VALUES ($1, $2, $2, 'credential', $3, NOW(), NOW())`,
          [accId, userId, newHash]
        );
      } else {
        const isMatch = await verifyPassword(currentPassword, accRows[0].password);
        if (!isMatch) {
          return NextResponse.json(
            { message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        const newHash = await hashPassword(newPassword);
        await pool.query(
          `UPDATE "account" SET password = $1, updated_at = NOW() WHERE id = $2`,
          [newHash, accRows[0].id]
        );
      }
    }

    // Query updated user data
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

    const u = rows[0];
    return NextResponse.json({
      message: "บันทึกข้อมูลเรียบร้อยแล้ว",
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
    console.error("Error in /api/auth/me PATCH:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
      { status: 500 }
    );
  }
}
