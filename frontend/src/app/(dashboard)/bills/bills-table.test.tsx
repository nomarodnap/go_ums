import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillsTable } from "./bills-table";

const customInstanceMock = vi.fn();

vi.mock("@/lib/api/custom-instance", () => ({
  customInstance: (...args: unknown[]) => customInstanceMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/server/actions/bills", () => ({
  deleteBill: vi.fn(),
  markBillAsReviewed: vi.fn(),
  getBillLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/server/actions/audits", () => ({
  flagManualAnomaly: vi.fn(),
  unflagManualAnomaly: vi.fn(),
}));

const sampleBills = [
  {
    id: "bill-1",
    departmentId: "dept-1",
    billCode: "BILL-001",
    utilityType: "ค่าไฟฟ้า",
    billingMonth: 10,
    billingYear: 2026,
    invoiceAmount: "1500.00",
    paymentStatus: "PAID",
    invoiceStatus: "RECEIVED",
    departmentName: "กองบริหารการคลัง",
    departmentShortName: "กบค.",
    departmentCostCenter: "1234567890",
    departmentType: "ส่วนกลาง",
    provider: "กฟภ.",
    serviceNumber: "METER001",
    invoiceNumber: "INV-12345",
    invoiceDate: new Date("2026-10-10"),
    receivedDate: new Date("2026-10-12"),
    paymentDate: new Date("2026-10-20"),
    receiptPaymentDate: null,
    sentToDisbursingDate: null,
    disbursingReceivedDate: null,
    paidAmount: "1500.00",
    paymentDocNumber: "DOC-99",
    docType: "ขบ",
    accountCode: null,
    budgetCode: null,
    locationType: "สำนักงาน",
    attachmentInvoice: null,
    attachmentReceipt: null,
    attachmentDirectPayment: null,
    attachmentKtbReport: null,
    auditStatus: null,
  },
  {
    id: "bill-2",
    departmentId: "dept-2",
    billCode: "BILL-002",
    utilityType: "ค่าน้ำประปา",
    billingMonth: 9,
    billingYear: 2026,
    invoiceAmount: "800.00",
    paymentStatus: "PENDING",
    invoiceStatus: "RECEIVED",
    departmentName: "ศูนย์วิจัยประมงน้ำจืด",
    departmentShortName: "ศพจ.",
    departmentCostCenter: "0987654321",
    departmentType: "ส่วนภูมิภาค",
    provider: "กปภ.",
    serviceNumber: "WATER002",
    invoiceNumber: "INV-999",
    invoiceDate: new Date("2026-09-10"),
    receivedDate: null,
    paymentDate: null,
    receiptPaymentDate: null,
    sentToDisbursingDate: null,
    disbursingReceivedDate: null,
    paidAmount: null,
    paymentDocNumber: null,
    docType: null,
    accountCode: null,
    budgetCode: null,
    locationType: "บ่อเพาะ",
    attachmentInvoice: null,
    attachmentReceipt: null,
    attachmentDirectPayment: null,
    attachmentKtbReport: null,
    auditStatus: null,
  },
];

describe("BillsTable - Clear Filter Button", () => {
  it("renders clear filter button as disabled initially when filters are at default and displays 'จัดการ' header", () => {
    render(<BillsTable initialData={sampleBills as any} />);

    expect(screen.getByRole("columnheader", { name: "จัดการ" })).toBeInTheDocument();
    const clearButton = screen.getByRole("button", { name: /ล้างตัวกรอง/i });
    expect(clearButton).toBeDisabled();
  });

  it("enables clear filter button when search term is typed and resets on click", async () => {
    const user = userEvent.setup();
    render(<BillsTable initialData={sampleBills as any} />);

    const searchInput = screen.getByPlaceholderText(/ค้นหารหัสรายงาน/) as HTMLInputElement;
    const clearButton = screen.getByRole("button", { name: /ล้างตัวกรอง/i });

    // Initially disabled
    expect(clearButton).toBeDisabled();

    // Type in search box
    await user.type(searchInput, "WATER002");
    expect(searchInput.value).toBe("WATER002");

    // Button should now be enabled
    expect(clearButton).toBeEnabled();

    // Table should filter to bill-2
    expect(screen.getByText("WATER002")).toBeInTheDocument();
    expect(screen.queryByText("METER001")).not.toBeInTheDocument();

    // Click clear button
    await user.click(clearButton);

    // Search input should be cleared
    expect(searchInput.value).toBe("");
    expect(clearButton).toBeDisabled();

    // Both bills should be back
    expect(screen.getByText("WATER002")).toBeInTheDocument();
    expect(screen.getByText("METER001")).toBeInTheDocument();
  });

  it("clears search input via dedicated X button", async () => {
    const user = userEvent.setup();
    render(<BillsTable initialData={sampleBills as any} />);

    const searchInput = screen.getByPlaceholderText(/ค้นหารหัสรายงาน/) as HTMLInputElement;
    await user.type(searchInput, "BILL-001");

    const clearSearchX = screen.getByTitle("ล้างข้อความค้นหา");
    await user.click(clearSearchX);

    expect(searchInput.value).toBe("");
    expect(screen.getByRole("button", { name: /ล้างตัวกรอง/i })).toBeDisabled();
  });

  it("filters by initialDepartmentId and shows department badge with clear button", async () => {
    const user = userEvent.setup();
    render(<BillsTable initialData={sampleBills as any} initialDepartmentId="dept-1" />);

    // Table should filter to bill-1 only
    expect(screen.getByText("METER001")).toBeInTheDocument();
    expect(screen.queryByText("WATER002")).not.toBeInTheDocument();

    // Should show active filter badge
    expect(screen.getByText(/กรองตามหน่วยงาน: กองบริหารการคลัง/i)).toBeInTheDocument();

    // Clear filter button should be enabled
    const clearButton = screen.getByRole("button", { name: /^ล้างตัวกรอง$/ });
    expect(clearButton).toBeEnabled();

    // Clear filter via badge X
    const clearDeptX = screen.getByTitle("ล้างตัวกรองหน่วยงาน");
    await user.click(clearDeptX);

    // Both bills should now be displayed
    expect(screen.getByText("METER001")).toBeInTheDocument();
    expect(screen.getByText("WATER002")).toBeInTheDocument();
  });

  it("does not attach cursor-pointer class to rows when disableDrawer is true", () => {
    const { container } = render(<BillsTable initialData={sampleBills as any} disableDrawer={true} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.className).not.toContain("cursor-pointer");
    });
  });

  it("renders 'รอตรวจสอบใหม่' badge when bill has auditStatus 'PENDING_RECHECK'", () => {
    const recheckBills = [
      {
        ...sampleBills[0],
        id: "bill-recheck",
        auditStatus: "PENDING_RECHECK",
        isManualAnomaly: true,
        manualAnomalyReason: "ยอดเงินไม่ตรงเอกสาร",
      },
    ];

    render(<BillsTable initialData={recheckBills as any} showAuditStatus={true} />);
    expect(screen.getByText("รอตรวจสอบใหม่")).toBeInTheDocument();
    expect(screen.getByText(/ยอดเงินไม่ตรงเอกสาร/)).toBeInTheDocument();
  });

  it("filters by initialStatusFilter='OVERDUE' and displays only pending bills", () => {
    render(<BillsTable initialData={sampleBills as any} initialStatusFilter="OVERDUE" />);

    // Table should filter out PAID bill-1 (METER001) and show PENDING bill-2 (WATER002)
    expect(screen.queryByText("METER001")).not.toBeInTheDocument();
    expect(screen.getByText("WATER002")).toBeInTheDocument();

    // Clear filter button should be enabled
    expect(screen.getByRole("button", { name: /^ล้างตัวกรอง$/ })).toBeEnabled();
  });

  it("filters by initialStatusFilter='PAID' and displays only paid bills", () => {
    render(<BillsTable initialData={sampleBills as any} initialStatusFilter="PAID" />);

    // Table should show PAID bill-1 (METER001) and filter out PENDING bill-2 (WATER002)
    expect(screen.getByText("METER001")).toBeInTheDocument();
    expect(screen.queryByText("WATER002")).not.toBeInTheDocument();

    // Clear filter button should be enabled
    expect(screen.getByRole("button", { name: /^ล้างตัวกรอง$/ })).toBeEnabled();
  });

  it("filters by initialAnomalyFilter='true' and displays only bills with anomalies", () => {
    const mixedBills = [
      sampleBills[0],
      {
        ...sampleBills[1],
        id: "bill-anomaly",
        serviceNumber: "ANOMALY001",
        isManualAnomaly: true,
        manualAnomalyReason: "ค่าใช้จ่ายสูงผิดปกติ",
      },
    ];

    render(<BillsTable initialData={mixedBills as any} initialAnomalyFilter="true" />);

    // Table should filter out normal bill-1 (METER001) and show anomaly bill (ANOMALY001)
    expect(screen.queryByText("METER001")).not.toBeInTheDocument();
    expect(screen.getByText("ANOMALY001")).toBeInTheDocument();

    // Clear filter button should be enabled
    expect(screen.getByRole("button", { name: /^ล้างตัวกรอง$/ })).toBeEnabled();
  });
});

describe("BillsTable - Phase 3 AI Semantic Search", () => {
  beforeEach(() => {
    customInstanceMock.mockReset();
  });

  it("runs semantic AI search without QueryClientProvider, shows match reason badges, and resets cleanly", async () => {
    const user = userEvent.setup();
    customInstanceMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      data: {
        query: "ค่าน้ำค้างจ่าย",
        mode: "hybrid",
        model: "gemini-embedding-001",
        bills: [
          {
            id: "bill-2",
            billCode: "BILL-002",
            departmentId: "dept-2",
            departmentName: "ศูนย์วิจัยประมงน้ำจืด",
            utilityType: "ค่าน้ำประปา",
            billingMonth: 9,
            billingYearCE: 2026,
            billingYearBE: 2569,
            serviceNumber: "WATER002",
            invoiceAmount: 800,
            paymentStatus: "PENDING",
            invoiceStatus: "RECEIVED",
            hasAnomaly: false,
            score: 0.91,
            semanticScore: 0.88,
            keywordScore: 0.95,
            matchReasons: ["ตรงตามความหมาย (88%)", "ยังไม่ได้เบิกจ่าย"],
          },
        ],
        departments: [],
        indexedCount: 2,
        totalScanned: 2,
        tookMs: 42,
      },
    });

    render(<BillsTable initialData={sampleBills as any} />);

    const searchInput = screen.getByPlaceholderText(/ค้นหารหัสรายงาน/);
    const aiToggleBtn = screen.getByRole("button", {
      name: /ค้นหาอัจฉริยะ \(AI\)/i,
    });

    expect(aiToggleBtn).toHaveAttribute("aria-pressed", "false");
    await user.click(aiToggleBtn);
    expect(aiToggleBtn).toHaveAttribute("aria-pressed", "true");

    await user.type(searchInput, "ค่าน้ำค้างจ่าย");
    const runSearchBtn = screen.getByRole("button", { name: "ค้นหาด้วย AI" });
    await user.click(runSearchBtn);

    await waitFor(() => {
      expect(customInstanceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "/api/ai/search",
          method: "POST",
          data: { query: "ค่าน้ำค้างจ่าย", entityType: "bills", limit: 40 },
        }),
      );
    });

    expect(await screen.findByText("AI Hybrid Search")).toBeInTheDocument();
    expect(screen.getByText("WATER002")).toBeInTheDocument();
    expect(screen.queryByText("METER001")).not.toBeInTheDocument();
    expect(screen.getByText("ตรงตามความหมาย (88%)")).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: /^ล้างตัวกรอง$/ });
    expect(clearButton).toBeEnabled();
    await user.click(clearButton);

    expect(screen.getByText("METER001")).toBeInTheDocument();
    expect(screen.getByText("WATER002")).toBeInTheDocument();
    expect(aiToggleBtn).toHaveAttribute("aria-pressed", "false");
  });
});
