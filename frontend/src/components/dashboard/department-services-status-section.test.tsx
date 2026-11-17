import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepartmentServicesStatusSection } from "./department-services-status-section";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BillTrackingItemDTO, BillTrackingSummaryDTO } from "@/lib/api/generated/model";

// Mock the API hooks
const mockTrackingItems: BillTrackingItemDTO[] = [
  {
    id: "item-1",
    departmentId: "dept-1",
    departmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
    serviceNumber: "PEA-50012345",
    utilityType: "ค่าไฟฟ้า",
    provider: "การไฟฟ้าส่วนภูมิภาค",
    status: "PAID",
    amount: 15400,
    paidAmount: 15400,
    paymentDocNumber: "DOC-2026-11-001",
    attachmentReceipt: "https://example.com/receipt.pdf",
    billId: "bill-1",
    isExpected: true,
  },
  {
    id: "item-2",
    departmentId: "dept-1",
    departmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
    serviceNumber: "MWA-10098765",
    utilityType: "ค่าประปา&น้ำบาดาล",
    provider: "การประปาส่วนภูมิภาค",
    status: "PENDING_PAYMENT",
    amount: 3200,
    invoiceNumber: "INV-998877",
    billId: "bill-2",
    isExpected: true,
  },
  {
    id: "item-3",
    departmentId: "dept-1",
    departmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
    serviceNumber: "TEL-053123456",
    utilityType: "ค่าโทรศัพท์",
    provider: "บมจ.โทรคมนาคมแห่งชาติ",
    status: "UNRECORDED",
    amount: 0,
    isExpected: true,
  },
];

const mockSummary: BillTrackingSummaryDTO = {
  total: 3,
  paid: 1,
  paidAmount: 15400,
  pending: 1,
  pendingAmount: 3200,
  notReceived: 0,
  unrecorded: 1,
  anomalyIssues: 0,
  corrected: 0,
  manualAnomaly: 0,
  normal: 2,
  reviewed: 1,
  unreviewed: 1,
};

vi.mock("@/lib/api/generated/bills/bills", () => ({
  useGetBillTracking: () => ({
    data: {
      status: 200,
      data: {
        summary: mockSummary,
        items: mockTrackingItems,
      },
    },
    isLoading: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
  getBill: vi.fn().mockResolvedValue({
    id: "bill-1",
    billCode: "BILL-001",
  }),
}));

describe("DepartmentServicesStatusSection Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DepartmentServicesStatusSection
          departmentId="dept-1"
          departmentName="ศูนย์วิจัยประมงน้ำจืดเชียงใหม่"
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it("renders the section title and all service numbers with their respective workflow stages", () => {
    renderComponent();

    // Title and department
    expect(
      screen.getByText("สถานะการดำเนินงานตามรหัสเครื่องวัด / หมายเลขผู้ใช้")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ศูนย์วิจัยประมงน้ำจืดเชียงใหม่/)
    ).toBeInTheDocument();

    // Service numbers
    expect(screen.getByText("PEA-50012345")).toBeInTheDocument();
    expect(screen.getByText("MWA-10098765")).toBeInTheDocument();
    expect(screen.getByText("TEL-053123456")).toBeInTheDocument();

    // Stages
    expect(screen.getAllByText("เบิกจ่ายแล้ว").length).toBeGreaterThan(0);
    expect(screen.getByText("รับบิลแล้ว (รอเบิกจ่าย)")).toBeInTheDocument();
    expect(screen.getAllByText("ยังไม่ได้บันทึก").length).toBeGreaterThan(0);
  });

  it("filters services when clicking on a summary status card", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Click on "ยังไม่ได้บันทึก" card button
    const unrecordedCards = screen.getAllByRole("button");
    const unrecordedCard = unrecordedCards.find((btn) =>
      btn.textContent?.includes("ยังไม่ได้บันทึก")
    );
    expect(unrecordedCard).toBeDefined();
    await user.click(unrecordedCard!);

    // Only unrecorded item should be visible in table
    expect(screen.getByText("TEL-053123456")).toBeInTheDocument();
    expect(screen.queryByText("PEA-50012345")).not.toBeInTheDocument();
    expect(screen.queryByText("MWA-10098765")).not.toBeInTheDocument();
  });

  it("filters services using the search input", async () => {
    const user = userEvent.setup();
    renderComponent();

    const searchInput = screen.getByPlaceholderText(/ค้นหารหัสเครื่องวัด/i);
    await user.type(searchInput, "MWA");

    expect(screen.getByText("MWA-10098765")).toBeInTheDocument();
    expect(screen.queryByText("PEA-50012345")).not.toBeInTheDocument();
    expect(screen.queryByText("TEL-053123456")).not.toBeInTheDocument();
  });

  it("passes service parameters in the 'บันทึกบิล' link for unrecorded services", () => {
    renderComponent();

    // The unrecorded item TEL-053123456 has a 'บันทึกบิล' link
    const newBillLink = screen.getByRole("link", { name: /บันทึกบิล/i });
    expect(newBillLink).toBeInTheDocument();

    const href = newBillLink.getAttribute("href");
    expect(href).toContain("/bills/new");
    expect(href).toContain("departmentId=dept-1");
    expect(href).toContain("serviceNumber=TEL-053123456");
    expect(decodeURIComponent(href || "")).toContain("utilityType=ค่าโทรศัพท์");
    expect(href).toContain("billingMonth=");
    expect(href).toContain("#utility-invoice-section");
  });
});
