import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "การแจ้งเตือนทุกหน่วยงานในระบบ | UMS",
  description: "ระบบรายงานค่าสาธารณูปโภค",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
