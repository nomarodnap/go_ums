import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrackingDashboard } from "./tracking-dashboard";
import type { BillTrackingItemDTO } from "@/lib/api/generated/model";

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
}));

vi.mock("@/server/actions/audits", () => ({
  flagManualAnomaly: vi.fn(),
  unflagManualAnomaly: vi.fn(),
}));

vi.mock("@/lib/api/generated/auth/auth", () => ({
  useGetCurrentUser: () => ({
    data: {
      status: 200,
      data: {
        user: {
          id: "u-1",
          username: "admin",
          role: "ADMIN",
          permissions: ["all-bills:review", "all-bills:flag"],
        },
      },
    },
  }),
}));

vi.mock("@/lib/api/generated/departments/departments", () => ({
  useListDepartmentServices: () => ({
    data: { data: [] },
  }),
}));

vi.mock("recharts", async () => {
  const original = await vi.importActual<any>("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

const mockTrackingItems: BillTrackingItemDTO[] = [
  // Dept 1: 3 unrecorded
  {
    id: "item-1",
    departmentId: "dept-1",
    departmentName: "กองวิจัยและพัฒนาประมงน้ำจืด",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "E-001",
    provider: "กฟภ.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  {
    id: "item-2",
    departmentId: "dept-1",
    departmentName: "กองวิจัยและพัฒนาประมงน้ำจืด",
    utilityType: "ค่าประปา&น้ำบาดาล",
    serviceNumber: "W-001",
    provider: "กปภ.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  {
    id: "item-3",
    departmentId: "dept-1",
    departmentName: "กองวิจัยและพัฒนาประมงน้ำจืด",
    utilityType: "ค่าโทรศัพท์",
    serviceNumber: "T-001",
    provider: "NT",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  // Dept 2: 2 unrecorded
  {
    id: "item-4",
    departmentId: "dept-2",
    departmentName: "กองบริหารการคลัง",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "E-002",
    provider: "กฟภ.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  {
    id: "item-5",
    departmentId: "dept-2",
    departmentName: "กองบริหารการคลัง",
    utilityType: "ค่าประปา&น้ำบาดาล",
    serviceNumber: "W-002",
    provider: "กปภ.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  // Dept 3: 1 unrecorded, 1 paid
  {
    id: "item-6",
    departmentId: "dept-3",
    departmentName: "สำนักกฎหมาย",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "E-003",
    provider: "กฟน.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  {
    id: "item-7",
    departmentId: "dept-3",
    departmentName: "สำนักกฎหมาย",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "E-004",
    provider: "กฟน.",
    status: "PAID",
    isExpected: true,
    billId: "b-7",
    isReviewed: true,
    auditStatus: "NORMAL",
    amount: 2500,
  },
  // Add 4 more departments with unrecorded bills to test "othersCount > 0"
  {
    id: "item-8",
    departmentId: "dept-4",
    departmentName: "กองนโยบายและยุทธศาสตร์พัฒนาการประมง",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "E-008",
    provider: "กฟน.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  {
    id: "item-9",
    departmentId: "dept-5",
    departmentName: "กองตรวจสอบเรือประมง",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "E-009",
    provider: "กฟน.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  {
    id: "item-10",
    departmentId: "dept-6",
    departmentName: "กองพัฒนาระบบการบริหาร",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "E-010",
    provider: "กฟน.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
  {
    id: "item-11",
    departmentId: "dept-7",
    departmentName: "กลุ่มตรวจสอบภายใน",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "E-011",
    provider: "กฟน.",
    status: "UNRECORDED",
    isExpected: true,
    amount: 0,
  },
];

describe("TrackingDashboard - Department Breakdown Tooltips", () => {
  it("renders 10 summary cards properly", () => {
    renderWithClient(
      <TrackingDashboard
        items={mockTrackingItems}
        month={10}
        year={2026}
        onMonthChange={vi.fn()}
        onYearChange={vi.fn()}
      />
    );

    // Section 1: 4 cards
    expect(screen.getAllByText("ยังไม่ได้บันทึก")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ยังไม่ได้รับใบแจ้งหนี้")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ยังไม่ได้เบิกจ่าย")[0]).toBeInTheDocument();
    expect(screen.getAllByText("เบิกจ่ายแล้ว")[0]).toBeInTheDocument();

    // Section 2: 6 cards
    expect(screen.getAllByText("ตรวจสอบแล้ว")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ยังไม่ได้ตรวจสอบ")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ปกติ")[0]).toBeInTheDocument();
    expect(screen.getAllByText("พบข้อสังเกต")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ระบุว่าผิดปกติ")[0]).toBeInTheDocument();
    expect(screen.getAllByText("แก้ไขแล้ว")[0]).toBeInTheDocument();
  });

  it("calculates correct department counts and shows top 5 and others on hover", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <TrackingDashboard
        items={mockTrackingItems}
        month={10}
        year={2026}
        onMonthChange={vi.fn()}
        onYearChange={vi.fn()}
      />
    );

    // Find the "ยังไม่ได้บันทึก" card trigger element
    const cardTitle = screen.getAllByText("ยังไม่ได้บันทึก")[0];
    const trigger = cardTitle.closest("[data-slot='tooltip-trigger']") || cardTitle.closest(".apple-card-hover");
    expect(trigger).toBeInTheDocument();

    if (trigger) {
      await user.hover(trigger);
    }

    // Should display department breakdown in the tooltip popup
    await waitFor(() => {
      expect(screen.getByText("สัดส่วนตามหน่วยงาน (สูงสุด 5 อันดับแรก)")).toBeInTheDocument();
    }, { timeout: 3000 });

    // Total unrecorded: 10 items across 7 departments
    // Top 1: กองวิจัยและพัฒนาประมงน้ำจืด (3 items, 30.0%)
    // Top 2: กองบริหารการคลัง (2 items, 20.0%)
    // Beyond top 5: "หน่วยงานอื่นๆ"
    expect(screen.getByText(/1\. กองวิจัยและพัฒนาประมงน้ำจืด/)).toBeInTheDocument();
    expect(screen.getByText(/2\. กองบริหารการคลัง/)).toBeInTheDocument();
    expect(screen.getByText(/หน่วยงานอื่นๆ/)).toBeInTheDocument();
  });

  it("displays empty state in tooltip when a category has 0 items", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <TrackingDashboard
        items={mockTrackingItems}
        month={10}
        year={2026}
        onMonthChange={vi.fn()}
        onYearChange={vi.fn()}
      />
    );

    // "ยังไม่ได้รับใบแจ้งหนี้" has 0 items
    const cardTitle = screen.getAllByText("ยังไม่ได้รับใบแจ้งหนี้")[0];
    const trigger = cardTitle.closest("[data-slot='tooltip-trigger']") || cardTitle.closest(".apple-card-hover");
    expect(trigger).toBeInTheDocument();

    if (trigger) {
      await user.hover(trigger);
    }

    await waitFor(() => {
      expect(screen.getByText("ไม่พบรายการในสถานะนี้")).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
