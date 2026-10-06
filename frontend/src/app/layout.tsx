import type { Metadata } from "next";
import { Inter, Prompt } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/lib/providers/query-provider";
import { SmoothScrollProvider } from "@/lib/providers/smooth-scroll-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const prompt = Prompt({
  variable: "--font-prompt",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "ระบบรายงานค่าสาธารณูปโภค - กรมประมง",
  description:
    "ระบบจัดการและรายงานค่าใช้จ่ายสาธารณูปโภค กรมประมง (Department of Fisheries)",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    shortcut: ["/logo.png"],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${inter.variable} ${prompt.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col font-prompt bg-background text-foreground"
        suppressHydrationWarning
      >
        <NextTopLoader color="#0071e3" showSpinner={false} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <SmoothScrollProvider>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster position="top-right" richColors />
            </SmoothScrollProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
