import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIAnomalyExplanationResponse, AISummaryResponse } from "@/lib/api/ai-hooks";
import { AnomalyExplainDialog } from "./anomaly-explain-dialog";
import { DashboardAIInsights } from "./dashboard-ai-insights";

const mockRefreshMutate = vi.fn();
const mockRefreshReset = vi.fn();
const mockExplainMutate = vi.fn();

let mockSummaryQuery: {
  data: AISummaryResponse | undefined;
  isLoading: boolean;
  error: Error | null;
};

let mockRefreshState: {
  mutate: typeof mockRefreshMutate;
  reset: typeof mockRefreshReset;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: AISummaryResponse | undefined;
};

let mockExplainState: {
  mutate: typeof mockExplainMutate;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: AIAnomalyExplanationResponse | undefined;
};

vi.mock("@/lib/api/ai-hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/ai-hooks")>();
  return {
    ...actual,
    useAISummary: () => mockSummaryQuery,
    useRefreshAISummary: () => mockRefreshState,
    useExplainBillAnomaly: () => mockExplainState,
  };
});

const baseMetrics = {
  totalBills: 18,
  paidBills: 15,
  paidAmount: 98500,
  pendingBills: 3,
  pendingAmount: 14200,
  combinedTotal: 112700,
  prevMonthTotal: 100000,
  moMChangePct: 12.7,
  totalAnomalies: 2,
  unrecordedServices: 1,
  recordedServices: 9,
};

describe("DashboardAIInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSummaryQuery = {
      data: {
        enabled: true,
        hasSummary: false,
        scope: "department",
        departmentId: "dept-1",
        departmentName: "ศูนย์เทคโนโลยีสารสนเทศ",
        billingMonth: 11,
        billingYearCE: 2026,
        billingYearBE: 2569,
        periodLabel: "เดือนพฤศจิกายน พ.ศ. 2569",
        headline: "",
        keyPoints: [],
        recommendations: [],
        metrics: baseMetrics,
        model: "gemini-3.5-flash",
        source: "none",
        cached: false,
      },
      isLoading: false,
      error: null,
    };
    mockRefreshState = {
      mutate: mockRefreshMutate,
      reset: mockRefreshReset,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
    };
  });

  it("renders cold state with live metrics strip and triggers AI summary generation", async () => {
    const user = userEvent.setup();
    render(<DashboardAIInsights scope="department" departmentId="dept-1" month={11} year={2026} />);

    expect(screen.getByRole("heading", { name: /สรุปและข้อเสนอแนะอัจฉริยะ/i })).toBeInTheDocument();
    expect(screen.getByText("฿112,700.00")).toBeInTheDocument();
    expect(screen.getByText("+12.7%")).toBeInTheDocument();
    expect(screen.getByText("3 รายการ")).toBeInTheDocument();
    expect(screen.getByText("2 รายการ")).toBeInTheDocument();

    const generateBtn = screen.getByRole("button", { name: "สร้างสรุปด้วย AI" });
    await user.click(generateBtn);

    expect(mockRefreshMutate).toHaveBeenCalledWith({
      scope: "department",
      departmentId: "dept-1",
      month: 11,
      year: 2026,
    });
  });

  it("renders summary headline, key points, and recommendations inside accessible native <details>", () => {
    mockSummaryQuery.data = {
      enabled: true,
      hasSummary: true,
      scope: "all",
      departmentName: "ภาพรวมทั้งกรมประมง (292 หน่วยงาน)",
      billingMonth: 11,
      billingYearCE: 2026,
      billingYearBE: 2569,
      periodLabel: "เดือนพฤศจิกายน พ.ศ. 2569",
      headline: "ยอดค่าสาธารณูปโภครวมอยู่ที่ 112,700.00 บาท เพิ่มขึ้น +12.7% จากเดือนก่อน",
      keyPoints: ["ค้างชำระคงเหลือ 3 รายการ", "พบความคลาดเคลื่อน 2 รายการ"],
      recommendations: ["เร่งติดตามใบเสร็จที่ค้างชำระ", "ตรวจสอบมิเตอร์ไฟฟ้าที่ยอดพุ่งสูง"],
      metrics: baseMetrics,
      model: "gemini-3.5-flash",
      source: "worker",
      cached: true,
      generatedAt: "2026-11-11T02:00:00Z",
    };

    const { container } = render(<DashboardAIInsights scope="all" />);

    expect(screen.getByText("อัปเดตอัตโนมัติประจำวัน")).toBeInTheDocument();
    expect(screen.getByText(/ยอดค่าสาธารณูปโภครวมอยู่ที่ 112,700\.00 บาท/)).toBeInTheDocument();
    expect(screen.getByText("ค้างชำระคงเหลือ 3 รายการ")).toBeInTheDocument();
    expect(screen.getByText("เร่งติดตามใบเสร็จที่ค้างชำระ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "วิเคราะห์ใหม่ด้วย AI" })).toBeInTheDocument();

    const details = container.querySelector("details.ai-disclosure");
    expect(details).toBeInTheDocument();
    expect(details?.querySelector("summary h1, summary h2, summary h3")).toBeNull();
  });

  it("renders accessible <progress> while generating and role=alert with Huma detail on error", () => {
    mockRefreshState.isPending = true;
    mockRefreshState.isError = true;
    mockRefreshState.error = { status: 429, detail: "โควตาการใช้งาน Gemini AI เต็มชั่วคราว" };

    render(<DashboardAIInsights scope="department" departmentId="dept-1" />);

    expect(
      screen.getByRole("progressbar", {
        name: "กำลังวิเคราะห์ข้อมูลประจำเดือนด้วย AI",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("โควตาการใช้งาน Gemini AI เต็มชั่วคราว");
  });

  it("renders nothing when enabled is false", () => {
    const { container } = render(
      <DashboardAIInsights scope="department" departmentId={undefined} enabled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AnomalyExplainDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });

    mockExplainState = {
      mutate: mockExplainMutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
    };
  });

  it("opens native modal dialog via showModal() and displays statistical Z-score/IQR explanation", async () => {
    const user = userEvent.setup();
    const explanation: AIAnomalyExplanationResponse = {
      billId: "bill-anom-1",
      billCode: "B-6911-01",
      departmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
      utilityType: "ค่าไฟฟ้า",
      billingMonth: 11,
      billingYearBE: 2569,
      serviceNumber: "PEA-001122",
      invoiceAmount: 42500,
      severity: "HIGH",
      flags: ["ค่าใช้จ่ายสูง/ต่ำผิดปกติทางสถิติ", "เบิกจ่ายล่าช้า (> 15 วัน)"],
      summary: "ยอดค่าไฟฟ้าสูงกว่าค่ากลางย้อนหลัง +112.5% และเกินกรอบ IQR Fence",
      reasons: ["ค่า Z-Score อยู่ที่ +3.42σ เกินเกณฑ์ 2.0"],
      actionItems: ["ตรวจสอบมิเตอร์ไฟฟ้าประจำเดือน พ.ย. 2569"],
      stats: {
        isAnomaly: true,
        method: "ZSCORE_IQR",
        sampleCount: 6,
        currentAmount: 42500,
        mean: 20500,
        stdDev: 6432.73,
        median: 20000,
        q1: 18500,
        q3: 22000,
        iqr: 3500,
        lowerFence: 13250,
        upperFence: 27250,
        zScore: 3.42,
        pctDiffFromBaseline: 112.5,
      },
      model: "gemini-3.5-flash",
      cached: false,
      generatedAt: "2026-11-11T05:00:00Z",
    };
    mockExplainState.data = explanation;

    render(
      <AnomalyExplainDialog
        billId="bill-anom-1"
        billCode="B-6911-01"
        departmentName="ศูนย์วิจัยประมงน้ำจืดเชียงใหม่"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    expect(mockExplainMutate).toHaveBeenCalledWith({
      billId: "bill-anom-1",
      force: false,
    });

    expect(screen.getByText("ระดับความเสี่ยง: HIGH")).toBeInTheDocument();
    expect(screen.getByText("+3.42σ (+112.5%)")).toBeInTheDocument();
    expect(screen.getByText("Z-Score + IQR (Outlier ชัดเจน)")).toBeInTheDocument();
    expect(screen.getByText("ค่า Z-Score อยู่ที่ +3.42σ เกินเกณฑ์ 2.0")).toBeInTheDocument();

    const dialogEl = document.querySelector("dialog.ai-modal-dialog");
    expect(dialogEl).not.toHaveAttribute("role");
    expect(dialogEl).not.toHaveAttribute("aria-modal");

    await user.click(screen.getByRole("button", { name: "วิเคราะห์ใหม่" }));
    expect(mockExplainMutate).toHaveBeenCalledWith({
      billId: "bill-anom-1",
      force: true,
    });
  });

  it("hides stale explanation belonging to a different billId and displays error alerts", () => {
    mockExplainState.data = {
      billId: "bill-old",
      billCode: "B-OLD",
      departmentName: "หน่วยงานเก่า",
      utilityType: "ค่าไฟฟ้า",
      billingMonth: 10,
      billingYearBE: 2569,
      serviceNumber: "PEA-OLD",
      invoiceAmount: 5000,
      severity: "LOW",
      flags: [],
      summary: "ข้อความเก่าที่ห้ามแสดงข้ามบิล",
      reasons: [],
      actionItems: [],
      model: "gemini-3.5-flash",
      cached: true,
      generatedAt: "2026-11-01T00:00:00Z",
    };
    mockExplainState.isPending = true;

    render(
      <AnomalyExplainDialog
        billId="bill-new"
        billCode="B-NEW"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("ข้อความเก่าที่ห้ามแสดงข้ามบิล")).not.toBeInTheDocument();
    expect(screen.queryByText("ระดับความเสี่ยง: LOW")).not.toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: "กำลังวิเคราะห์ความผิดปกติของบิลด้วย AI",
      }),
    ).toBeInTheDocument();
  });

  it("extracts Huma detail message in role=alert when explain fails", () => {
    mockExplainState.isError = true;
    mockExplainState.error = { status: 429, detail: "โควตาการใช้งาน AI เต็มชั่วคราว" };

    render(
      <AnomalyExplainDialog
        billId="bill-err-1"
        billCode="B-ERR-1"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("โควตาการใช้งาน AI เต็มชั่วคราว");
  });
});
