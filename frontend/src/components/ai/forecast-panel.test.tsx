import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIForecastResponse } from "@/lib/api/ai-hooks";
import { ForecastPanel } from "./forecast-panel";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 640, height: 270 }}>{children}</div>
    ),
  };
});

const mockGenerateMutate = vi.fn();
const mockGenerateReset = vi.fn();
const mockUseAIForecast = vi.fn();

let mockGenerateState: {
  mutate: typeof mockGenerateMutate;
  reset: typeof mockGenerateReset;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: AIForecastResponse | undefined;
};

vi.mock("@/lib/api/ai-hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/ai-hooks")>();
  return {
    ...actual,
    useAIForecast: (params: unknown) => mockUseAIForecast(params),
    useGenerateAIForecastInsights: () => mockGenerateState,
  };
});

const baseForecastData: AIForecastResponse = {
  enabled: true,
  scope: "all",
  departmentName: "ภาพรวมทั้งกรมประมง (292 หน่วยงาน)",
  horizon: 6,
  sampleMonths: 14,
  confidenceLevel: "HIGH",
  confidenceLabel: "ความเชื่อมั่นสูง (ข้อมูลประวัติ 14 เดือน ครบฤดูกาล)",
  method: "Seasonally Adjusted Damped Linear Trend",
  nextMonthLabel: "เดือนธันวาคม พ.ศ. 2569",
  nextMonthPredicted: 125000,
  nextMonthLowerBound: 112000,
  nextMonthUpperBound: 138000,
  latestMonthLabel: "เดือนพฤศจิกายน พ.ศ. 2569",
  latestMonthActual: 118000,
  moMForecastChangePct: 5.9,
  historicalAvgMonthly: 110000,
  series: [
    {
      month: 10,
      yearCE: 2026,
      yearBE: 2569,
      label: "ต.ค. 69",
      fullLabel: "เดือนตุลาคม พ.ศ. 2569",
      actualAmount: 115000,
      predictedAmount: 0,
      lowerBound: 0,
      upperBound: 0,
      billCount: 25,
      isForecast: false,
      seasonalIndex: 1.0,
    },
    {
      month: 11,
      yearCE: 2026,
      yearBE: 2569,
      label: "พ.ย. 69",
      fullLabel: "เดือนพฤศจิกายน พ.ศ. 2569",
      actualAmount: 118000,
      predictedAmount: 0,
      lowerBound: 0,
      upperBound: 0,
      billCount: 26,
      isForecast: false,
      seasonalIndex: 0.98,
    },
    {
      month: 12,
      yearCE: 2026,
      yearBE: 2569,
      label: "ธ.ค. 69",
      fullLabel: "เดือนธันวาคม พ.ศ. 2569",
      actualAmount: 0,
      predictedAmount: 125000,
      lowerBound: 112000,
      upperBound: 138000,
      billCount: 0,
      isForecast: true,
      seasonalIndex: 1.04,
    },
  ],
  utilityBreakdown: [
    {
      utilityType: "ค่าไฟฟ้า",
      latestActual: 82000,
      avgRecent3Months: 80000,
      nextMonthPredicted: 87500,
      moMChangePct: 6.7,
      sharePct: 70,
    },
    {
      utilityType: "ค่าประปา&น้ำบาดาล",
      latestActual: 18000,
      avgRecent3Months: 17500,
      nextMonthPredicted: 18750,
      moMChangePct: 4.2,
      sharePct: 15,
    },
  ],
  budgetPlan: {
    fiscalYearCE: 2027,
    fiscalYearBE: 2570,
    fiscalYearLabel: "ปีงบประมาณ พ.ศ. 2570",
    availableFiscalYearsBE: [2570, 2569],
    netBudget: 1200000,
    allocatedAmount: 1200000,
    transferredAmount: 0,
    ytdSpent: 233000,
    ytdPaid: 200000,
    ytdPending: 33000,
    projectedRemainingSpend: 1150000,
    projectedTotalSpend: 1383000,
    projectedBalance: -183000,
    utilizationPct: 19.4,
    projectedUtilizationPct: 115.3,
    monthsElapsed: 2,
    monthsRemaining: 10,
    recommendedAdditional: 192150,
    status: "DEFICIT",
    departmentPlans: [
      {
        departmentId: "dept-risk-1",
        departmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
        allocatedAmount: 300000,
        transferredAmount: 0,
        netBudget: 300000,
        ytdSpent: 90000,
        projectedTotalSpend: 390000,
        projectedBalance: -90000,
        projectedUtilizationPct: 130,
        recommendedAdjustment: 94500,
        status: "DEFICIT",
      },
      {
        departmentId: "dept-ok-2",
        departmentName: "กองบริหารการคลัง",
        allocatedAmount: 400000,
        transferredAmount: 0,
        netBudget: 400000,
        ytdSpent: 40000,
        projectedTotalSpend: 210000,
        projectedBalance: 190000,
        projectedUtilizationPct: 52.5,
        recommendedAdjustment: -170000,
        status: "HEALTHY",
      },
    ],
  },
  alertPredictions: [
    {
      departmentId: "dept-risk-1",
      departmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
      utilityType: "ค่าไฟฟ้า",
      riskScore: 86,
      severity: "HIGH",
      riskCategories: ["BUDGET_OVERRUN", "EXPENSE_SPIKE"],
      title: "เสี่ยงใช้งบเกินและยอดค่าไฟฟ้าพุ่งสูงกว่าฐาน",
      reason: "ยอดล่าสุดขยับเข้าใกล้กรอบบนทางสถิติและแนวโน้มทั้งปีอาจเกินงบจัดสรร",
      recommendedAction: "ตรวจสอบมิเตอร์ไฟฟ้าและเตรียมขอรับโอนถัวจ่ายงบประมาณ",
      predictedAmount: 42000,
      baselineAmount: 29000,
      budgetUtilizationPct: 130,
      recentIncidentCount: 2,
    },
  ],
  insights: {
    hasInsights: false,
    executiveSummary: "",
    budgetRecommendations: [],
    preventiveActions: [],
    model: "gemini-3.5-flash",
    cached: false,
  },
};

describe("ForecastPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAIForecast.mockReturnValue({
      data: baseForecastData,
      isLoading: false,
      error: null,
    });
    mockGenerateState = {
      mutate: mockGenerateMutate,
      reset: mockGenerateReset,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
    };
  });

  it("renders forecast KPI summary, utility breakdown, and chart details table", () => {
    render(<ForecastPanel scope="all" />);

    expect(
      screen.getByRole("heading", { name: /การพยากรณ์ค่าใช้จ่ายและวางแผนงบประมาณ/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("฿125,000")).toBeInTheDocument();
    expect(screen.getByText("฿1,383,000")).toBeInTheDocument();
    expect(screen.getByText(/ขาดดุล -฿183,000/)).toBeInTheDocument();

    const activePanel = screen.getByRole("tabpanel", { name: "พยากรณ์ค่าใช้จ่าย" });
    expect(activePanel).not.toHaveAttribute("hidden");
    expect(within(activePanel).getByText("ค่าไฟฟ้า")).toBeInTheDocument();
    expect(within(activePanel).getByText("฿87,500")).toBeInTheDocument();
    expect(within(activePanel).getByText(/ตารางข้อมูลอนุกรมเวลา \(3 เดือน\)/)).toBeInTheDocument();
  });

  it("supports horizon/fiscal-year selectors and accessible WAI-ARIA tab keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<ForecastPanel scope="all" />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      expect(tab).not.toHaveAttribute("aria-controls");
    }
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");

    // Keyboard ArrowRight switches tab selection to Budget Planning
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveFocus();

    const budgetPanel = screen.getByRole("tabpanel", { name: "วางแผนงบประมาณ" });
    expect(budgetPanel).not.toHaveAttribute("hidden");
    expect(within(budgetPanel).getByText("ศูนย์วิจัยประมงน้ำจืดเชียงใหม่")).toBeInTheDocument();
    expect(
      within(budgetPanel).getByRole("region", {
        name: /ตารางวางแผนและแนวโน้มงบประมาณรายหน่วยงาน/i,
      }),
    ).toHaveAttribute("tabIndex", "0");

    // Keyboard End switches tab selection to Early Alerts
    await user.keyboard("{End}");
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    const alertsPanel = screen.getByRole("tabpanel", { name: /คาดการณ์ความเสี่ยงล่วงหน้า/i });
    expect(alertsPanel).not.toHaveAttribute("hidden");
    expect(within(alertsPanel).getByText("เสี่ยงใช้งบเกินและยอดค่าไฟฟ้าพุ่งสูงกว่าฐาน")).toBeInTheDocument();
    expect(within(alertsPanel).getByRole("link", { name: /ดูรายการบิล/i })).toHaveAttribute(
      "href",
      "/all-bills?departmentId=dept-risk-1",
    );

    // Change horizon & fiscal year selectors
    await user.selectOptions(screen.getByLabelText("ระยะพยากรณ์"), "12");
    await user.selectOptions(screen.getByLabelText("ปีงบประมาณ"), "2569");
    expect(mockUseAIForecast).toHaveBeenLastCalledWith(
      expect.objectContaining({ horizon: 12, fiscalYear: 2569 }),
    );
  });

  it("triggers AI strategic insights mutation and renders AI executive advice", async () => {
    const user = userEvent.setup();
    mockUseAIForecast.mockReturnValue({
      data: {
        ...baseForecastData,
        insights: {
          hasInsights: true,
          executiveSummary: "คาดการณ์งบปี 2570 ขาดดุล 183,000 บาท ควรโอนถัวจ่ายจากกองบริหารการคลัง",
          budgetRecommendations: ["ปรับโอนงบจากกองบริหารการคลัง 170,000 บาท"],
          preventiveActions: ["ตรวจสอบมิเตอร์ไฟฟ้าที่ศูนย์วิจัยประมงน้ำจืดเชียงใหม่"],
          model: "gemini-3.5-flash",
          cached: false,
        },
      },
      isLoading: false,
      error: null,
    });

    render(<ForecastPanel scope="all" defaultTab="budget" />);

    expect(screen.getByText(/คาดการณ์งบปี 2570 ขาดดุล 183,000 บาท/)).toBeInTheDocument();
    expect(screen.getByText("ปรับโอนงบจากกองบริหารการคลัง 170,000 บาท")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "อัปเดตคำแนะนำ AI" }));
    expect(mockGenerateMutate).toHaveBeenCalledWith({
      scope: "all",
      departmentId: undefined,
      horizon: 6,
      fiscalYear: 0,
      force: true,
    });
  });

  it("shows indeterminate progress bar while generating and role=alert on error", () => {
    mockGenerateState.isPending = true;
    mockGenerateState.isError = true;
    mockGenerateState.error = { status: 429, detail: "โควตา Gemini เต็มชั่วคราว" };

    render(<ForecastPanel scope="department" departmentId="dept-1" />);

    expect(
      screen.getByRole("progressbar", { name: "กำลังวิเคราะห์แผนงบประมาณด้วย Gemini AI" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("โควตา Gemini เต็มชั่วคราว");
  });

  it("renders nothing when enabled is false", () => {
    const { container } = render(
      <ForecastPanel scope="department" departmentId={undefined} enabled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
