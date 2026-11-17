import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../../tests/mocks/server";
import { RecentAnomaliesTable, type RecentAnomaly } from "./recent-anomalies-table";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("RecentAnomaliesTable", () => {
  const mockAnomalies: RecentAnomaly[] = [
    {
      id: "bill-101",
      billCode: "086-6809-3-01",
      departmentName: "ศูนย์บริหารจัดการด่านตรวจประมงเขต 1 (เชียงราย)",
      utilityType: "ค่าไฟฟ้า",
      billingMonth: 9,
      billingYear: 2025,
      provider: "การไฟฟ้านครหลวง",
      serviceNumber: "896541256",
      invoiceNumber: "INV-9988",
      invoiceAmount: "12000.00",
      paidAmount: "12000.00",
      paymentStatus: "PAID",
      invoiceStatus: "RECEIVED",
      attachmentReceipt: "/uploads/receipt.png",
      isLatePayment: true,
      isOverdueMoreThan2Months: true,
    },
    {
      id: "bill-102",
      billCode: "086-6809-3-02",
      departmentName: "กองบริหารการคลัง",
      utilityType: "ค่าน้ำประปา",
      billingMonth: 10,
      billingYear: 2025,
      serviceNumber: "123456789",
      invoiceAmount: "3500.00",
      paymentStatus: "PENDING",
      invoiceStatus: "RECEIVED",
      isManualAnomaly: true,
      manualAnomalyReason: "ตัวเลขมิเตอร์ไม่ตรงกับรอบก่อน",
    },
  ];

  it("renders empty state message when anomalies list is empty", () => {
    render(<RecentAnomaliesTable anomalies={[]} />);
    expect(screen.getByText("ไม่พบรายการผิดปกติในช่วงนี้")).toBeInTheDocument();
  });

  it("renders 7 table headers matching bills table structure", () => {
    render(<RecentAnomaliesTable anomalies={mockAnomalies} />);

    expect(screen.getByText("หน่วยงาน / ประเภท")).toBeInTheDocument();
    expect(screen.getByText("รหัสรายงาน / เครื่องวัด")).toBeInTheDocument();
    expect(screen.getByText("รอบบิล")).toBeInTheDocument();
    expect(screen.getByText("ยอดชำระ / เบิกจ่าย")).toBeInTheDocument();
    expect(screen.getByText("สถานะการเบิกจ่าย")).toBeInTheDocument();
    expect(screen.getByText("สถานะตรวจสอบ")).toBeInTheDocument();
    expect(screen.getByText("จัดการ")).toBeInTheDocument();
  });

  it("renders anomaly row items with correct badges and information", () => {
    render(<RecentAnomaliesTable anomalies={mockAnomalies} />);

    // Department & Utility
    expect(screen.getByText("ศูนย์บริหารจัดการด่านตรวจประมงเขต 1 (เชียงราย)")).toBeInTheDocument();
    expect(screen.getByText("ค่าไฟฟ้า")).toBeInTheDocument();

    // Bill Code & Service Number
    expect(screen.getByText("086-6809-3-01")).toBeInTheDocument();
    expect(screen.getByText("896541256")).toBeInTheDocument();
    expect(screen.getByText("INV: INV-9988")).toBeInTheDocument();

    // Billing period
    expect(screen.getByText("กันยายน 2568")).toBeInTheDocument();

    // Payment status badge
    expect(screen.getByText("ได้ใบเสร็จแล้ว")).toBeInTheDocument();

    // Audit anomalies
    expect(screen.getByText("• เบิกจ่ายล่าช้า")).toBeInTheDocument();
    expect(screen.getByText("• ค้างชำระเกิน 2 เดือน")).toBeInTheDocument();
  });

  it("renders action column with menu triggers for each row", () => {
    render(<RecentAnomaliesTable anomalies={mockAnomalies} />);

    const openMenuButtons = screen.getAllByRole("button", { name: "เปิดเมนู" });
    expect(openMenuButtons.length).toBe(2);
  });

  it("opens AI explanation modal when clicking AI analyze button on a row", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("*/api/ai/bills/:billId/explain", () =>
        HttpResponse.json({
          billId: "bill-101",
          billCode: "086-6809-3-01",
          departmentName: "ศูนย์บริหารจัดการด่านตรวจประมงเขต 1 (เชียงราย)",
          utilityType: "ค่าไฟฟ้า",
          billingMonth: 9,
          billingYearBE: 2568,
          serviceNumber: "896541256",
          invoiceAmount: 12000,
          severity: "MEDIUM",
          flags: ["เบิกจ่ายล่าช้า (> 15 วัน)"],
          summary: "สรุปผลการวิเคราะห์ตัวอย่างจาก MSW",
          reasons: ["พบการเบิกจ่ายเกินระยะเวลา 15 วัน"],
          actionItems: ["ตรวจสอบขั้นตอนอนุมัติเอกสาร"],
          model: "gemini-3.5-flash",
          cached: false,
          generatedAt: "2026-11-11T05:00:00Z",
        }),
      ),
    );
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <RecentAnomaliesTable anomalies={mockAnomalies} />
      </QueryClientProvider>,
    );

    const aiBtn = screen.getByRole("button", {
      name: "AI วิเคราะห์สาเหตุ 086-6809-3-01",
    });
    await user.click(aiBtn);

    expect(screen.getByText("AI วิเคราะห์สาเหตุความคลาดเคลื่อน")).toBeInTheDocument();
    expect(await screen.findByText("สรุปผลการวิเคราะห์ตัวอย่างจาก MSW")).toBeInTheDocument();
  });
});
