import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: any }) => <span>{String(value)}</span>,
}));

vi.mock("@/components/charts/lightweight-timeline", () => ({
  LightweightTimeline: () => <div data-testid="lightweight-timeline" />,
}));

vi.mock("@/components/dashboard/dashboard-charts", () => ({
  TrendChart: () => <div data-testid="trend-chart" />,
  StatusPieChart: () => <div data-testid="status-pie-chart" />,
  TrendFullscreenDialog: () => null,
  serviceStatusConfig: {},
}));

vi.mock("@/components/dashboard/recent-anomalies-table", () => ({
  RecentAnomaliesTable: () => <div data-testid="recent-anomalies-table" />,
}));

vi.mock("@/components/ai/dashboard-ai-insights", () => ({
  DashboardAIInsights: ({
    scope,
    departmentId,
    enabled,
  }: {
    scope?: string;
    departmentId?: string;
    enabled?: boolean;
  }) => (
    <div
      data-testid="dashboard-ai-insights"
      data-scope={scope}
      data-department-id={departmentId || ""}
      data-enabled={String(enabled)}
    />
  ),
}));

vi.mock("@/components/ai/forecast-panel", () => ({
  ForecastPanel: ({
    scope,
    departmentId,
    enabled,
  }: {
    scope?: string;
    departmentId?: string;
    enabled?: boolean;
  }) => (
    <div
      data-testid="forecast-panel"
      data-scope={scope}
      data-department-id={departmentId || ""}
      data-enabled={String(enabled)}
    />
  ),
}));

const mockDepartments = [
  {
    id: "dept-1",
    fullName: "กองบริหารจัดการทรัพยากรประมง",
    shortName: "กบท.",
    costCenterCode: "2500300055",
    disbursingUnit: "กองบริหารการคลัง",
    depositUnit: "dept-central",
    responsiblePerson: "นายสมชาย ใจดี",
    phone: "02-1234567",
    type: "central",
  },
  {
    id: "dept-central",
    fullName: "กองบริหารการคลัง",
    shortName: "กบค.",
    costCenterCode: "2500300010",
    disbursingUnit: "หน่วยเบิกจ่าย",
    depositUnit: "",
  },
  {
    id: "dept-2",
    fullName: "กองตรวจการประมง",
    shortName: "กตป.",
    costCenterCode: "2500300056",
    disbursingUnit: "กองบริหารการคลัง",
    depositUnit: "dept-central",
    responsiblePerson: "นางสาวสมหญิง มุ่งมั่น",
    phone: "02-7654321",
  },
];

let mockSummaryParams: any = null;

vi.mock("@/lib/api/generated/auth/auth", () => ({
  useGetCurrentUser: () => ({
    data: {
      status: 200,
      data: {
        user: {
          id: "user-admin",
          email: "admin@fisheries.go.th",
          name: "ผู้ดูแลระบบ",
          role: "admin",
          departmentId: "dept-1",
        },
      },
    },
    isLoading: false,
  }),
}));

vi.mock("@/lib/api/generated/departments/departments", () => ({
  useListDepartments: () => ({
    data: {
      status: 200,
      data: mockDepartments,
    },
    isLoading: false,
  }),
}));

vi.mock("@/lib/api/generated/dashboard/dashboard", () => ({
  useGetDashboardSummary: (params: any) => {
    mockSummaryParams = params;
    const isDept = params?.scope === "department";
    return {
      data: {
        status: 200,
        data: {
          scope: isDept ? "department" : "all",
          departmentName: isDept ? "กองบริหารจัดการทรัพยากรประมง" : "ภาพรวมทุกหน่วยงาน (292 หน่วยงาน)",
          departmentShortName: isDept ? "กบท." : "ภาพรวมทั้งกรม",
          totalInvoicesCurrentMonth: isDept ? 12 : 250,
          totalPaidCurrentMonth: isDept ? 45000 : 1200000,
          totalPendingBills: isDept ? 3 : 45,
          totalAnomalies: isDept ? 1 : 15,
          totalBills: isDept ? 120 : 3500,
          paidAmount: isDept ? 450000 : 14000000,
          pendingAmount: isDept ? 25000 : 350000,
          recentAnomalies: [],
          topDepartments: isDept
            ? []
            : [
                { name: "กองบริหารจัดการทรัพยากรประมง", amount: 450000 },
                { name: "กองตรวจการประมง", amount: 380000 },
              ],
          trendData: [
            { month: "ม.ค.", electricity: 1000, water: 500, phone: 200, telecom: 0, postal: 100 },
          ],
          statusData: [
            { name: "เบิกจ่ายแล้ว", value: 80, color: "#10b981" },
            { name: "ค้างชำระ", value: 20, color: "#f59e0b" },
          ],
        },
      },
      isLoading: false,
      isFetching: false,
    };
  },
}));

describe("OverviewPage - Scope Switcher & Department Dashboard", () => {
  beforeEach(() => {
    mockSummaryParams = null;
  });

  it("renders the default overview dashboard for whole department (ทั้งกรม)", () => {
    render(<OverviewPage />);

    expect(screen.getByText("แดชบอร์ดภาพรวมทั้งกรม")).toBeInTheDocument();
    expect(screen.getByText("ภาพรวมทั้งกรม (292 หน่วยงาน)")).toBeInTheDocument();
    expect(screen.getByText("เฉพาะหน่วยงาน / กอง")).toBeInTheDocument();
    expect(screen.getByText("การบันทึกเข้าระบบ (เดือนนี้)")).toBeInTheDocument();
    expect(screen.getByText("ผลการเบิกจ่าย (เดือนนี้)")).toBeInTheDocument();
    expect(screen.getByText("5 อันดับหน่วยงานที่เบิกจ่ายสูงสุด")).toBeInTheDocument();

    expect(mockSummaryParams).toEqual({ scope: "all", period: "1m" });
    expect(screen.getByTestId("dashboard-ai-insights")).toHaveAttribute("data-scope", "all");
    expect(screen.getByTestId("forecast-panel")).toHaveAttribute("data-scope", "all");
  });

  it("switches periods correctly when period buttons are clicked", async () => {
    const user = userEvent.setup();
    render(<OverviewPage />);

    expect(mockSummaryParams.period).toBe("1m");

    const threeMonthsBtn = screen.getByRole("button", { name: "3 เดือนล่าสุด" });
    await user.click(threeMonthsBtn);
    expect(mockSummaryParams.period).toBe("3m");
    expect(screen.getByText("การบันทึกเข้าระบบ (3 เดือนล่าสุด)")).toBeInTheDocument();

    const sixMonthsBtn = screen.getByRole("button", { name: "6 เดือนล่าสุด" });
    await user.click(sixMonthsBtn);
    expect(mockSummaryParams.period).toBe("6m");
    expect(screen.getByText("การบันทึกเข้าระบบ (6 เดือนล่าสุด)")).toBeInTheDocument();

    const twelveMonthsBtn = screen.getByRole("button", { name: "12 เดือนล่าสุด" });
    await user.click(twelveMonthsBtn);
    expect(mockSummaryParams.period).toBe("12m");
    expect(screen.getByText("การบันทึกเข้าระบบ (12 เดือนล่าสุด)")).toBeInTheDocument();
  });

  it("switches to department scope when 'เฉพาะหน่วยงาน / กอง' is clicked", async () => {
    const user = userEvent.setup();
    render(<OverviewPage />);

    const deptScopeBtn = screen.getByRole("button", { name: /เฉพาะหน่วยงาน \/ กอง/i });
    await user.click(deptScopeBtn);

    // Should now query for the department
    expect(mockSummaryParams.scope).toBe("department");
    expect(mockSummaryParams.departmentId).toBe("dept-1");
    expect(screen.getByTestId("dashboard-ai-insights")).toHaveAttribute(
      "data-scope",
      "department",
    );
    expect(screen.getByTestId("dashboard-ai-insights")).toHaveAttribute(
      "data-department-id",
      "dept-1",
    );
    expect(screen.getByTestId("forecast-panel")).toHaveAttribute("data-scope", "department");
    expect(screen.getByTestId("forecast-panel")).toHaveAttribute("data-department-id", "dept-1");

    // Check department specific UI elements
    expect(screen.getByText(/ข้อมูลและสรุปภาพรวมหน่วยงาน/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2500300055/)[0]).toBeInTheDocument();
    expect(screen.getByText(/การบันทึกเข้าระบบ \(เดือนนี้\)/i)).toBeInTheDocument();
    expect(screen.queryByText("dept-central")).not.toBeInTheDocument();
    expect(screen.getAllByText("กองบริหารการคลัง").length).toBeGreaterThan(0);
    expect(screen.getByText("ระดับหน่วยงาน")).toBeInTheDocument();
    expect(screen.getByText("ส่วนกลาง")).toBeInTheDocument();

    // Check that action buttons have pre-filtered department query parameter
    const allBillsBtn = screen.getByRole("button", { name: /ดูบิลทั้งหมด/i });
    expect(allBillsBtn).toHaveAttribute("href", "/all-bills?departmentId=dept-1");

    const servicesBtn = screen.getByRole("button", { name: /บริการมิเตอร์/i });
    expect(servicesBtn).toHaveAttribute("href", "/services?departmentId=dept-1");
  });
});
