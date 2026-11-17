import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateBillForm } from "./create-bill-form";

const customInstanceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/api/custom-instance", () => ({
  customInstance: (...args: unknown[]) => customInstanceMock(...args),
}));

vi.mock("@/lib/api/generated/bills/bills", () => ({
  useListBills: () => ({
    data: { status: 200, data: [] },
    isLoading: false,
  }),
}));

vi.mock("@/server/actions/bills", () => ({
  createBill: vi.fn(),
  getLatestEstimatedAmount: vi.fn().mockResolvedValue(null),
}));

const mockDepartments = [
  {
    id: "dept-1",
    fullName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
    shortName: "ศพจ.ชม.",
    type: "regional",
    costCenterCode: "0700300100",
  },
];

const mockServices = [
  {
    id: "svc-1",
    departmentId: "dept-1",
    serviceNumber: "053-123-456",
    utilityType: "ค่าไฟฟ้า",
    provider: "กฟภ.",
    locationType: "อาคารอำนวยการ",
  },
];

const mockBudgetCodes = [
  {
    id: "bg-1",
    code: "BG-2026-001",
    name: "งบดำเนินงาน ค่าสาธารณูปโภค",
    fiscalYear: 2569,
  },
];

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateBillForm
        departments={mockDepartments}
        services={mockServices}
        budgetCodes={mockBudgetCodes}
        defaultDepartmentId="dept-1"
      />
    </QueryClientProvider>,
  );
}

describe("CreateBillForm + Phase 3 AI OCR & Categorizer", () => {
  beforeEach(() => {
    customInstanceMock.mockReset();
  });

  it("uploads invoice PDF for OCR and pre-fills CreateBillForm fields including attachment and invoice status", async () => {
    const user = userEvent.setup();
    customInstanceMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      data: {
        utilityType: "ค่าไฟฟ้า",
        accountCode: "5104020101",
        provider: "กฟภ.",
        serviceNumber: "053123456",
        matchedServiceNumber: "053-123-456",
        invoiceNumber: "INV-2569-09",
        invoiceDate: "2026-10-15",
        invoiceDateRaw: "15 ต.ค. 2569",
        billingMonth: 10,
        billingYearCE: 2026,
        billingYearBE: 2569,
        billingMonthStr: "2026-10",
        usageAmount: 350.5,
        invoiceAmount: 1850.5,
        budgetCode: "BG-2026-001",
        budgetCodeName: "งบดำเนินงาน ค่าสาธารณูปโภค",
        budgetFiscalYear: 2569,
        confidence: 0.94,
        notes: "พบใบแจ้งหนี้ค่าไฟฟ้าประจำเดือนตุลาคม",
        warnings: [],
        model: "gemini-3-flash-preview",
      },
    });

    await act(async () => {
      renderForm();
    });

    const fileInput = screen.getByLabelText("อัปโหลดไฟล์ใบแจ้งหนี้สำหรับ AI OCR") as HTMLInputElement;
    const pdfFile = new File(["%PDF-1.4\n%test"], "electric-bill-oct.pdf", {
      type: "application/pdf",
    });

    await user.upload(fileInput, pdfFile);

    await waitFor(() => {
      expect(customInstanceMock).toHaveBeenCalledTimes(1);
    });

    const callArg = customInstanceMock.mock.calls[0][0] as {
      url: string;
      method: string;
      data: FormData;
    };
    expect(callArg.url).toBe("/api/ai/bills/extract-document");
    expect(callArg.method).toBe("POST");
    expect(callArg.data).toBeInstanceOf(FormData);
    expect(callArg.data.get("departmentId")).toBe("dept-1");
    expect(callArg.data.get("file")).toBe(pdfFile);

    expect(await screen.findByText(/นำข้อมูลจากเอกสารกรอกลงฟอร์มแล้ว/)).toBeInTheDocument();

    // Form fields pre-filled cleanly
    expect((document.querySelector('input[name="serviceNumber"]') as HTMLInputElement)?.value).toBe(
      "053-123-456",
    );
    expect((document.querySelector('input[name="billingMonth"]') as HTMLInputElement)?.value).toBe(
      "2026-10",
    );
    expect((document.getElementById("documentRef") as HTMLInputElement)?.value).toBe("INV-2569-09");
    expect((document.getElementById("amountBaht") as HTMLInputElement)?.value).toBe("1850.50");
    expect((document.getElementById("unitsUsed") as HTMLInputElement)?.value).toBe("350.5");
    expect(screen.getAllByText("electric-bill-oct.pdf").length).toBeGreaterThanOrEqual(2);
  });

  it("calls AI bill categorizer, shows reasoning, and applies suggestion to form", async () => {
    const user = userEvent.setup();
    customInstanceMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      data: {
        utilityType: "ค่าไฟฟ้า",
        accountCode: "5104020101",
        budgetCode: "BG-2026-001",
        budgetCodeName: "งบดำเนินงาน ค่าสาธารณูปโภค",
        budgetFiscalYear: 2569,
        matchedServiceNumber: "053-123-456",
        provider: "กฟภ.",
        confidence: 0.96,
        reasoning: "ผู้ให้บริการ กฟภ. และรหัสเครื่องวัดตรงกับหมวดค่าไฟฟ้า 5104020101",
        warnings: [],
        model: "gemini-3-flash-preview",
      },
    });

    await act(async () => {
      renderForm();
    });

    const suggestBtn = screen.getByRole("button", {
      name: /แนะนำหมวดหมู่ \(AI\)/i,
    });
    await user.click(suggestBtn);

    await waitFor(() => {
      expect(customInstanceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "/api/ai/bills/categorize",
          method: "POST",
        }),
      );
    });

    expect(await screen.findByText(/คำแนะนำการจัดหมวดหมู่ \(AI\)/)).toBeInTheDocument();
    expect(screen.getByText(/ผู้ให้บริการ กฟภ\. และรหัสเครื่องวัดตรงกับหมวดค่าไฟฟ้า/)).toBeInTheDocument();
    expect(screen.getByText("5104020101")).toBeInTheDocument();
  });

  it("shows accessible error alert when OCR endpoint fails", async () => {
    const user = userEvent.setup();
    customInstanceMock.mockRejectedValueOnce({
      detail: "โควตาการใช้งาน Gemini AI เต็มชั่วคราว",
    });

    await act(async () => {
      renderForm();
    });

    const fileInput = screen.getByLabelText("อัปโหลดไฟล์ใบแจ้งหนี้สำหรับ AI OCR") as HTMLInputElement;
    const pngFile = new File([new Uint8Array([137, 80, 78, 71])], "bill.png", {
      type: "image/png",
    });

    await user.upload(fileInput, pngFile);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("โควตาการใช้งาน Gemini AI เต็มชั่วคราว");
  });
});
