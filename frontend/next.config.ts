import type { NextConfig } from "next";

const backendUrl =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/auth/forgot-password",
          destination: `${backendUrl}/api/auth/forgot-password`,
        },
        {
          source: "/api/auth/reset-password",
          destination: `${backendUrl}/api/auth/reset-password`,
        },
      ],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
        {
          source: "/uploads/:path*",
          destination: `${backendUrl}/uploads/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
