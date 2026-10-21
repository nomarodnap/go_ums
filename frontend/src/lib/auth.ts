import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const isSupabase = connectionString?.includes("supabase.com") || connectionString?.includes("pooler");

export const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET || "super-secret-key-replace-me-in-production-1234567890",
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000", "http://localhost:3001", "https://ums.fisheries.go.th"],
  trustHost: true,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => {
        const salt = crypto.randomBytes(16).toString("hex");
        const key = await new Promise<Buffer>((resolve, reject) => {
          crypto.scrypt(
            password.normalize("NFKC"),
            salt,
            64,
            { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
            (err, derived) => (err ? reject(err) : resolve(derived as Buffer))
          );
        });
        return `${salt}:${key.toString("hex")}`;
      },
      verify: async ({ hash, password }: { hash: string; password: string }) => {
        if (!hash) return false;
        // 1. Support bcrypt hashes ($2a$, $2b$, $2y$)
        if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
          return bcrypt.compare(password, hash);
        }
        // 2. Support standard Better Auth scrypt format (salt:keyHex)
        if (hash.includes(":")) {
          const [salt, key] = hash.split(":");
          if (!salt || !key) return false;
          const targetKey = await new Promise<Buffer>((resolve, reject) => {
            crypto.scrypt(
              password.normalize("NFKC"),
              salt,
              64,
              { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
              (err, derived) => (err ? reject(err) : resolve(derived as Buffer))
            );
          });
          return targetKey.toString("hex") === key;
        }
        return false;
      },
    },
  },
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
      banReason: "ban_reason",
      banExpires: "ban_expires",
    },
    additionalFields: {
      departmentId: {
        type: "string",
        required: false,
        fieldName: "department_id",
      },
      phone: {
        type: "string",
        required: false,
      },
    },
  },
  session: {
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
    },
  },
  account: {
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  plugins: [admin()],
});
