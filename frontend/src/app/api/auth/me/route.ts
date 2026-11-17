import { auth, pool } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

function decodeIdTokenPayload(
  idToken?: string | null
): { picture?: string; email?: string; name?: string } | null {
  if (!idToken) return null;
  try {
    const parts = idToken.split(".");
    if (parts[1]) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      if (payload && typeof payload === "object") {
        return {
          picture: typeof payload.picture === "string" && payload.picture ? payload.picture : undefined,
          email: typeof payload.email === "string" && payload.email ? payload.email : undefined,
          name: typeof payload.name === "string" && payload.name ? payload.name : undefined,
        };
      }
    }
  } catch (err) {
    console.warn("Failed to decode id_token payload:", err);
  }
  return null;
}

function extractPictureFromIdToken(idToken?: string | null): string | null {
  return decodeIdTokenPayload(idToken)?.picture || null;
}

async function resolveAuthenticatedUser(reqHeaders: Headers) {
  const authHeader = reqHeaders.get("authorization");
  const cookieHeader = reqHeaders.get("cookie") || "";
  let userId: string | null = null;
  let sessionUser: any = null;

  // 1. Explicit Bearer token takes top priority (active client session)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
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

  // 2. If no Bearer token or invalid, fallback to Better-Auth getSession
  if (!userId) {
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });
    if (session?.user?.id) {
      userId = session.user.id;
      sessionUser = session.user;
    } else {
      // 3. Fallback to cookie matching
      const match =
        cookieHeader.match(/auth_token=([^;]+)/) ||
        cookieHeader.match(/better-auth\.session_token=([^;]+)/);
      if (match) {
        const token = decodeURIComponent(match[1]).split(".")[0].replace(/^s:/, "");
        const { rows: sessionRows } = await pool.query(
          `SELECT user_id FROM "session" WHERE token = $1 AND expires_at > NOW() LIMIT 1`,
          [token]
        );
        if (sessionRows.length > 0) {
          userId = sessionRows[0].user_id;
        }
      }
    }
  }

  return { userId, sessionUser };
}

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { userId, sessionUser } = await resolveAuthenticatedUser(reqHeaders);

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
        u.image,
        u.role, 
        u.department_id, 
        d.full_name AS department_name, 
        u.phone, 
        u.created_at,
        (
          SELECT a.id_token FROM "account" a
          WHERE a.user_id = u.id AND a.provider_id = 'google'
          ORDER BY a.updated_at DESC
          LIMIT 1
        ) AS google_id_token,
        EXISTS (
          SELECT 1 FROM "account" a
          WHERE a.user_id = u.id AND a.provider_id = 'google'
        ) AS is_google,
        (
          SELECT a.id_token FROM "account" a
          WHERE a.user_id = u.id AND a.provider_id = 'line'
          ORDER BY a.updated_at DESC
          LIMIT 1
        ) AS line_id_token,
        EXISTS (
          SELECT 1 FROM "account" a
          WHERE a.user_id = u.id AND a.provider_id = 'line'
        ) AS is_line,
        r.name AS role_name,
        COALESCE(r.permissions, '[]'::jsonb) AS role_permissions,
        COALESCE(r.default_path, '/dashboard') AS default_path
      FROM "user" u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN "roles" r ON r.id = u.role
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: "user not found" }, { status: 404 });
    }

    const u = rows[0];
    const googleClaims = u.is_google ? decodeIdTokenPayload(u.google_id_token) : null;
    const lineClaims = u.is_line ? decodeIdTokenPayload(u.line_id_token) : null;

    // ONLY use session image if session user ID matches this specific user
    let userImage = u.image || (sessionUser?.id === u.id ? sessionUser?.image : null) || null;

    // Fallback: If user.image is empty but THIS user has a linked OAuth account, extract picture from id_token
    if (!userImage) {
      const tokenPicture = googleClaims?.picture || lineClaims?.picture || extractPictureFromIdToken(u.google_id_token);
      if (tokenPicture) {
        userImage = tokenPicture;
        pool.query(`UPDATE "user" SET image = $1 WHERE id = $2`, [userImage, u.id]).catch(() => {});
      }
    }

    const permissions = Array.isArray(u.role_permissions) ? u.role_permissions : [];
    return NextResponse.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        image: userImage,
        role: u.role,
        roleName: u.role_name || null,
        permissions: permissions,
        defaultPath: u.default_path || "/dashboard",
        departmentId: u.department_id,
        departmentName: u.department_name,
        phone: u.phone,
        createdAt: u.created_at,
        isGoogle: Boolean(u.is_google),
        isLine: Boolean(u.is_line),
        googleEmail: googleClaims?.email || null,
        lineName: lineClaims?.name || null,
        lineEmail: lineClaims?.email || null,
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
    const { userId, sessionUser } = await resolveAuthenticatedUser(reqHeaders);

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
        u.image,
        u.role, 
        u.department_id, 
        d.full_name AS department_name, 
        u.phone, 
        u.created_at,
        EXISTS (
          SELECT 1 FROM "account" a 
          WHERE a.user_id = u.id AND a.provider_id = 'google'
        ) AS is_google,
        EXISTS (
          SELECT 1 FROM "account" a 
          WHERE a.user_id = u.id AND a.provider_id = 'line'
        ) AS is_line
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
        image: u.image || (sessionUser?.id === u.id ? sessionUser?.image : null) || null,
        role: u.role,
        departmentId: u.department_id,
        departmentName: u.department_name,
        phone: u.phone,
        createdAt: u.created_at,
        isGoogle: Boolean(u.is_google),
        isLine: Boolean(u.is_line),
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

export async function DELETE(req: Request) {
  try {
    const reqHeaders = await headers();
    const { userId } = await resolveAuthenticatedUser(reqHeaders);

    if (!userId) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider")?.trim().toLowerCase();
    if (provider !== "line" && provider !== "google") {
      return NextResponse.json(
        { message: "รองรับเฉพาะผู้ให้บริการ line หรือ google เท่านั้น" },
        { status: 400 }
      );
    }

    const { rows: accountRows } = await pool.query<{ provider_id: string }>(
      `SELECT provider_id FROM "account" WHERE user_id = $1`,
      [userId]
    );
    const hasProvider = accountRows.some((row) => row.provider_id === provider);
    if (hasProvider && accountRows.length <= 1) {
      return NextResponse.json(
        {
          code: "LAST_ACCOUNT",
          message: "ไม่สามารถยกเลิกบัญชีเข้าสู่ระบบสุดท้ายได้",
        },
        { status: 400 }
      );
    }

    await pool.query(
      `DELETE FROM "account" WHERE user_id = $1 AND provider_id = $2`,
      [userId, provider]
    );

    return NextResponse.json({ status: true, provider });
  } catch (error) {
    console.error("Error in /api/auth/me DELETE:", error);
    return NextResponse.json(
      { message: "ไม่สามารถยกเลิกการเชื่อมต่อบัญชีได้" },
      { status: 500 }
    );
  }
}
