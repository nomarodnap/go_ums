import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateBillForm } from "./create-bill-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockExistingBills: any[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/api/generated/bills/bills", () => ({
  useListBills: () => ({
    data: {
      status: 200,
      data: mockExistingBills,
    },
    isLoading: false,
  }),
}));

vi.mock("@/server/actions/bills", () => ({
  createBill: vi.fn(),
  getLatestEstimatedAmount: vi.fn().mockResolvedValue(1500),
}));

const mockDepartments = [
  {
    id: "dept-1",
    fullName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
    shortName: "ศพจ.ชม.",
    type: "regional",
    costCenterCode: "0700300100",
  },
  {
    id: "dept-no-cc",
    fullName: "สถานีประมงน้ำจืดแม่ฮ่องสอน",
    shortName: "สพจ.มส.",
    type: "regional",
    costCenterCode: null,
    depositUnit: "dept-1",
  },
];

const mockServices = [
  {
    id: "svc-1",
    departmentId: "dept-1",
    serviceNumber: "053-123-456",
    utilityType: "ค่าโทรศัพท์",
    provider: "บมจ.โทรคมนาคมแห่งชาติ",
    locationType: "อาคารอำนวยการ",
  },
  {
    id: "svc-2",
    departmentId: "dept-1",
    serviceNumber: "053-999-888",
    utilityType: "ค่าโทรศัพท์",
    provider: "บมจ.โทรคมนาคมแห่งชาติ",
    locationType: "ห้องปฏิบัติการ",
  },
  {
    id: "svc-3",
    departmentId: "dept-no-cc",
    serviceNumber: "053-000-111",
    utilityType: "ค่าไฟฟ้า",
    provider: "กฟภ.",
    locationType: "อาคารสถานี",
  },
];

const mockBudgetCodes = [
  {
    id: "bg-1",
    code: "BG-2026-001",
    name: "งบดำเนินงาน",
    fiscalYear: 2569,
  },
];

describe("CreateBillForm - Pre-filling and Duplicate Verification", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockExistingBills = [];
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("pre-fills department, utilityType, serviceNumber and billingMonth when initialValues are provided", async () => {
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <CreateBillForm
            departments={mockDepartments}
            services={mockServices}
            budgetCodes={mockBudgetCodes}
            initialValues={{
              departmentId: "dept-1",
              utilityType: "ค่าโทรศัพท์",
              serviceNumber: "053-123-456",
              billingMonth: "2026-05",
            }}
          />
        </QueryClientProvider>
      );
    });

    // Section Badge for auto-filled data
    expect(
      screen.getByText("กรอกข้อมูลอัตโนมัติจากสถานะเครื่องวัด")
    ).toBeInTheDocument();

    // Utility Type selected
    expect(screen.getByText("ค่าโทรศัพท์")).toBeInTheDocument();

    // Service number chip
    expect(screen.getByText("053-123-456")).toBeInTheDocument();

    // Provider auto-detected and displayed in chip and summary
    expect(
      screen.getAllByText(/บมจ.โทรคมนาคมแห่งชาติ/).length
    ).toBeGreaterThanOrEqual(2);

    // Hidden inputs properly populated
    const serviceInput = document.querySelector('input[name="serviceNumber"]') as HTMLInputElement;
    expect(serviceInput?.value).toBe("053-123-456");

    const monthInput = document.querySelector('input[name="billingMonth"]') as HTMLInputElement;
    expect(monthInput?.value).toBe("2026-05");

    // Submit button should be enabled when no duplicates
    const submitBtn = screen.getByRole("button", { name: "บันทึกข้อมูล" });
    expect(submitBtn).toBeEnabled();
  });

  it("detects when a service number has already been billed for that month and blocks submission", async () => {
    mockExistingBills = [
      {
        id: "bill-existing-1",
        billCode: "BILL-2026-05-001",
        serviceNumber: "053-123-456",
        billingMonth: 5,
        billingYear: 2026,
        departmentId: "dept-1",
      },
    ];

    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <CreateBillForm
            departments={mockDepartments}
            services={mockServices}
            budgetCodes={mockBudgetCodes}
            initialValues={{
              departmentId: "dept-1",
              utilityType: "ค่าโทรศัพท์",
              serviceNumber: "053-123-456",
              billingMonth: "2026-05",
            }}
          />
        </QueryClientProvider>
      );
    });

    // Duplicate alert banner should be visible
    expect(
      screen.getByText(/ไม่อนุญาตให้บันทึกซ้ำ: พบหมายเลขที่บันทึกบิลในรอบบิลประจำเดือน พฤษภาคม 2569 แล้ว/)
    ).toBeInTheDocument();

    // Chip should show badge that it has already been recorded
    expect(screen.getByText("บันทึกแล้วในรอบนี้")).toBeInTheDocument();

    // Submit button should be disabled with warning text
    const disabledBtn = screen.getByRole("button", {
      name: /ไม่อนุญาตให้บันทึก \(มีหมายเลขซ้ำ\)/i,
    });
    expect(disabledBtn).toBeInTheDocument();
    expect(disabledBtn).toBeDisabled();
  });

  it("displays costCenterCode, deptType, and ประเภทหน่วยงาน with 'หน่วยเบิกจ่าย' when department HAS costCenterCode, and hides depositUnit", async () => {
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <CreateBillForm
            departments={mockDepartments}
            services={mockServices}
            budgetCodes={mockBudgetCodes}
            defaultDepartmentId="dept-1"
          />
        </QueryClientProvider>
      );
    });

    // Should display costCenterCode and deptType
    expect(screen.getByLabelText("รหัสศูนย์ต้นทุน")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0700300100")).toBeInTheDocument();
    expect(screen.getByLabelText("ระดับหน่วยงาน")).toBeInTheDocument();

    // Should display "ประเภทหน่วยงาน" with value "หน่วยเบิกจ่าย" and be disabled
    const disbursingTypeInput = screen.getByLabelText("ประเภทหน่วยงาน");
    expect(disbursingTypeInput).toBeInTheDocument();
    expect(disbursingTypeInput).toHaveValue("หน่วยเบิกจ่าย");
    expect(disbursingTypeInput).toBeDisabled();

    // Should NOT display "ฝากเบิกกับหน่วยงาน"
    expect(screen.queryByLabelText("ฝากเบิกกับหน่วยงาน")).not.toBeInTheDocument();

    // Hidden disbursingType should be "หน่วยเบิกจ่าย"
    const disbursingInput = document.querySelector('input[name="disbursingType"]') as HTMLInputElement;
    expect(disbursingInput?.value).toBe("หน่วยเบิกจ่าย");
  });

  it("displays locked deposit unit with notice, forces หน่วยฝากเบิก in ประเภทหน่วยงาน, and displays deposit unit cost center when department DOES NOT HAVE costCenterCode", async () => {
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <CreateBillForm
            departments={mockDepartments}
            services={mockServices}
            budgetCodes={mockBudgetCodes}
            defaultDepartmentId="dept-no-cc"
          />
        </QueryClientProvider>
      );
    });

    // Should NOT display own "รหัสศูนย์ต้นทุน"
    expect(screen.queryByLabelText("รหัสศูนย์ต้นทุน")).not.toBeInTheDocument();

    // Should display "ประเภทหน่วยงาน" with value "หน่วยฝากเบิก" and be disabled
    const disbursingTypeInput = screen.getByLabelText("ประเภทหน่วยงาน");
    expect(disbursingTypeInput).toBeInTheDocument();
    expect(disbursingTypeInput).toHaveValue("หน่วยฝากเบิก");
    expect(disbursingTypeInput).toBeDisabled();

    // Should display "ฝากเบิกกับหน่วยงาน" as locked/disabled with notice text
    const depositUnitInput = screen.getByLabelText("ฝากเบิกกับหน่วยงาน");
    expect(depositUnitInput).toBeInTheDocument();
    expect(depositUnitInput).toBeDisabled();
    expect(
      screen.getByText("* กรณีประสงค์เปลี่ยนแปลงหน่วยงานที่รับฝากเบิกจ่าย กรุณาติดต่อกลุ่มตรวจสอบภายใน (กตน.)")
    ).toBeInTheDocument();

    // Should display "รหัสศูนย์ต้นทุนของหน่วยงานที่ฝากให้เบิกจ่าย"
    expect(screen.getByLabelText("รหัสศูนย์ต้นทุนของหน่วยงานที่ฝากให้เบิกจ่าย")).toBeInTheDocument();

    // Hidden disbursingType should be "หน่วยฝากเบิก"
    const disbursingInput = document.querySelector('input[name="disbursingType"]') as HTMLInputElement;
    expect(disbursingInput?.value).toBe("หน่วยฝากเบิก");
  });

  it("displays KC, KE, KI, KL, and KN options in ประเภทเอกสาร dropdown when paymentStatus is PAID", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <CreateBillForm
            departments={mockDepartments}
            services={mockServices}
            budgetCodes={mockBudgetCodes}
            defaultDepartmentId="dept-1"
          />
        </QueryClientProvider>
      );
    });

    // Enable payment_paid by selecting "ได้รับใบแจ้งหนี้แล้ว"
    await user.click(screen.getByText("ได้รับใบแจ้งหนี้แล้ว"));
    // Select "เบิกจ่ายแล้ว"
    await user.click(screen.getByText("เบิกจ่ายแล้ว"));

    // Open ประเภทเอกสาร dropdown
    const docTypeTrigger = document.getElementById("docType");
    expect(docTypeTrigger).toBeInTheDocument();
    await user.click(docTypeTrigger!);

    // Check all expected docType options are rendered
    for (const code of ["KC", "KE", "KI", "KL", "KN"]) {
      expect(await screen.findByRole("option", { name: code })).toBeInTheDocument();
    }
  });
});
