import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "รหัสเครื่องวัด / เบอร์โทร",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
