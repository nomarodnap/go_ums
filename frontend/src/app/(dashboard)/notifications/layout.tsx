import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "การแจ้งเตือนหน่วยงาน | UMS",
  description: "ระบบรายงานค่าสาธารณูปโภค",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
