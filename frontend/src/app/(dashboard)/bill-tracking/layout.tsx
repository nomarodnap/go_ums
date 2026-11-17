import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ติดตามความคืบหน้า | ระบบจัดการสาธารณูปโภค",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
