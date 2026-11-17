import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DepartmentFormSheet } from "./department-form-sheet";

const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("@/lib/api/generated/departments/departments", () => ({
  useCreateDepartment: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateDepartment: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DepartmentFormSheet - Unit Type and Dynamic Fields", () => {
  const sampleDepartments: any[] = [
    {
      id: "dept-disbursing-1",
      fullName: "กองบริหารจัดการด้านการประมง",
      shortName: "กบจ.",
      costCenterCode: "0700400001",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "dept-deposit-1",
      fullName: "หน่วยตรวจประมงเกาะสมุย",
      shortName: "นตป.สมุย",
      costCenterCode: undefined,
      createdAt: "",
      updatedAt: "",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires unit type before submission", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
      />
    );

    const fullNameInput = screen.getByLabelText(/ชื่อหน่วยงาน \(เต็ม\)/i);
    await user.type(fullNameInput, "กองตรวจการประมง");

    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    await user.click(submitBtn);

    expect(screen.getByText("กรุณาเลือกประเภทหน่วยงาน")).toBeInTheDocument();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it("loads existing disbursing department and enforces 10-digit cost center code", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentFormSheet
        open={true}
        onOpenChange={vi.fn()}
        department={{
          id: "dept-1",
          fullName: "กองตรวจการประมง",
          costCenterCode: "0700400001",
          disbursingUnit: "หน่วยเบิกจ่าย",
          createdAt: "",
          updatedAt: "",
        }}
        departments={sampleDepartments}
      />
    );

    // Cost center input should already be visible for disbursing department
    const costCenterInput = screen.getByLabelText(/รหัสศูนย์ต้นทุน/i) as HTMLInputElement;
    expect(costCenterInput.value).toBe("0700400001");

    // Clear cost center
    await user.clear(costCenterInput);

    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    await user.click(submitBtn);

    expect(screen.getByText("กรุณาระบุรหัสศูนย์ต้นทุน 10 หลัก")).toBeInTheDocument();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();

    // Type 8 digits
    await user.type(costCenterInput, "12345678");
    await user.click(submitBtn);

    expect(screen.getByText("รหัสศูนย์ต้นทุนต้องเป็นตัวเลข 10 หลัก")).toBeInTheDocument();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();

    // Complete to 10 digits
    await user.type(costCenterInput, "90");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "dept-1",
        data: expect.objectContaining({
          fullName: "กองตรวจการประมง",
          costCenterCode: "1234567890",
          disbursingUnit: "หน่วยเบิกจ่าย",
        }),
      });
    });
  });

  it("loads existing deposit department and displays deposit unit", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentFormSheet
        open={true}
        onOpenChange={vi.fn()}
        department={{
          id: "dept-deposit-1",
          fullName: "หน่วยตรวจประมงเกาะสมุย",
          depositUnit: "dept-disbursing-1",
          disbursingUnit: "หน่วยฝากเบิก",
          createdAt: "",
          updatedAt: "",
        }}
        departments={sampleDepartments}
      />
    );

    // Cost center should NOT be visible
    expect(screen.queryByLabelText(/รหัสศูนย์ต้นทุน/i)).not.toBeInTheDocument();

    // Deposit unit should be visible
    expect(screen.getByText("กองบริหารจัดการด้านการประมง")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "dept-deposit-1",
        data: expect.objectContaining({
          fullName: "หน่วยตรวจประมงเกาะสมุย",
          costCenterCode: undefined,
          disbursingUnit: "หน่วยฝากเบิก",
          depositUnit: "dept-disbursing-1",
        }),
      });
    });
  });

  it("filters out departments without cost center from deposit unit dropdown", () => {
    render(
      <DepartmentFormSheet
        open={true}
        onOpenChange={vi.fn()}
        department={{
          id: "new-dept",
          fullName: "หน่วยตรวจ",
          depositUnit: "",
          disbursingUnit: "หน่วยฝากเบิก",
          createdAt: "",
          updatedAt: "",
        }}
        departments={sampleDepartments}
      />
    );

    const comboboxTrigger = screen.getByText("เลือกหน่วยงานที่ต้องการฝากเบิก...");
    fireEvent.click(comboboxTrigger);

    // Only departments with costCenterCode should be present
    expect(screen.getByText("กองบริหารจัดการด้านการประมง")).toBeInTheDocument();
    expect(screen.queryByText("หน่วยตรวจประมงเกาะสมุย")).not.toBeInTheDocument();
  });

  it("renders province dropdown with placeholder", () => {
    render(
      <DepartmentFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={[]}
      />
    );

    expect(screen.getByText("-- เลือกจังหวัด --")).toBeInTheDocument();
  });

  it("validates email format and submits division and email successfully", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentFormSheet
        open={true}
        onOpenChange={vi.fn()}
        department={{
          id: "dept-1",
          fullName: "กองตรวจการประมง",
          costCenterCode: "0700400001",
          disbursingUnit: "หน่วยเบิกจ่าย",
          createdAt: "",
          updatedAt: "",
        }}
        departments={sampleDepartments}
      />
    );

    const divisionInput = screen.getByLabelText(/สังกัดกอง/i);
    const emailInput = screen.getByLabelText(/อีเมลหน่วยงาน/i);
    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });

    // Enter division
    await user.type(divisionInput, "กองวิจัยและพัฒนาการเพาะเลี้ยงสัตว์น้ำจืด");

    // Enter invalid email
    await user.type(emailInput, "invalid-email-format");
    await user.click(submitBtn);

    expect(
      screen.getByText("รูปแบบอีเมลไม่ถูกต้อง (เช่น example@fisheries.go.th)")
    ).toBeInTheDocument();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();

    // Fix email to valid format
    await user.clear(emailInput);
    await user.type(emailInput, "test@fisheries.go.th");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "dept-1",
        data: expect.objectContaining({
          division: "กองวิจัยและพัฒนาการเพาะเลี้ยงสัตว์น้ำจืด",
          email: "test@fisheries.go.th",
        }),
      });
    });
  });
});
