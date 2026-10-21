import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ติดตามสถานะบิล | ระบบจัดการสาธารณูปโภค",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
