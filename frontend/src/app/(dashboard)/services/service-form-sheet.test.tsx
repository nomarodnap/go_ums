import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ServiceFormSheet,
  getPhoneReimbursementLimit,
  getProvidersForUtility,
  sanitizeServiceNumber,
} from "./service-form-sheet";
import type { DepartmentDTO, DepartmentServiceDTO } from "@/lib/api/generated/model";

const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("@/lib/api/generated/departments/departments", () => ({
  useCreateDepartmentService: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateDepartmentService: () => ({
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

describe("ServiceFormSheet - Mobile Phone Holder Fields", () => {
  const sampleDepartments: DepartmentDTO[] = [
    {
      id: "dept-1",
      fullName: "สำนักงานประมงจังหวัดเชียงใหม่",
      shortName: "สปจ.เชียงใหม่",
      createdAt: "",
      updatedAt: "",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'ชื่อ-สกุล ผู้ถือครอง', 'ประเภทและระดับตำแหน่ง', and 'ตำแหน่ง / สังกัด' when utility is mobile phone", async () => {
    const user = userEvent.setup();

    render(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        serviceToEdit={{
          id: "svc-1",
          departmentId: "dept-1",
          utilityType: "ค่าโทรศัพท์",
          provider: "AIS",
          serviceNumber: "0812345678",
          phoneOwnerName: "นายสมชาย ประมงดี",
          phoneOwnerPosition: "วิชาการชำนาญการ",
          phoneOwnerDivision: "กองตรวจประมง",
          phoneReimbursementLimit: 1000,
          isActive: true,
          createdAt: "",
        }}
      />,
    );

    // Verify Labels
    expect(screen.getByText(/ชื่อ-สกุล ผู้ถือครอง/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ประเภทและระดับตำแหน่ง/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/ตำแหน่ง \/ สังกัด/i)).toBeInTheDocument();

    // Verify populated values
    const nameInput = screen.getByDisplayValue("นายสมชาย ประมงดี");
    const divInput = screen.getByDisplayValue("กองตรวจประมง");

    expect(nameInput).toBeInTheDocument();
    expect(screen.getByText("วิชาการชำนาญการ")).toBeInTheDocument();
    expect(divInput).toBeInTheDocument();
  });

  it("validates mobile fields on submission and sends phoneOwnerDivision payload", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ServiceFormSheet
        open={true}
        onOpenChange={onOpenChange}
        departments={sampleDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        serviceToEdit={null}
      />,
    );
  });

  it("submits updated mobile fields including phoneOwnerDivision successfully", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ServiceFormSheet
        open={true}
        onOpenChange={onOpenChange}
        departments={sampleDepartments}
        userRole="admin"
        userDepartmentId="dept-1"
        serviceToEdit={{
          id: "svc-edit-1",
          departmentId: "dept-1",
          utilityType: "ค่าโทรศัพท์",
          provider: "True",
          serviceNumber: "0899999999",
          phoneOwnerName: "นางสมศรี รักษ์ดี",
          phoneOwnerPosition: "ชำนาญการพิเศษ",
          phoneOwnerDivision: "กลุ่มงานวิจัยและพัฒนา",
          phoneReimbursementLimit: 1000,
          isActive: true,
          createdAt: "",
        }}
      />,
    );

    const nameInput = screen.getByDisplayValue("นางสมศรี รักษ์ดี");
    const divInput = screen.getByDisplayValue("กลุ่มงานวิจัยและพัฒนา");

    // Clear and change values
    await user.clear(nameInput);
    await user.type(nameInput, "นางสาวกานดา ประมงสยาม");

    await user.clear(divInput);
    await user.type(divInput, "สำนักงานประมงจังหวัดเชียงใหม่");

    // Click submit
    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "svc-edit-1",
        data: expect.objectContaining({
          departmentId: "dept-1",
          utilityType: "ค่าโทรศัพท์",
          provider: "True",
          serviceNumber: "0899999999",
          phoneOwnerName: "นางสาวกานดา ประมงสยาม",
          phoneOwnerPosition: "ชำนาญการพิเศษ",
          phoneOwnerDivision: "สำนักงานประมงจังหวัดเชียงใหม่",
          phoneReimbursementLimit: 1000,
        }),
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render 'ประเภทสถานที่ / ที่ตั้ง' for office phone and telecom", () => {
    const { rerender } = render(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        serviceToEdit={{
          id: "svc-office-phone",
          departmentId: "dept-1",
          utilityType: "ค่าโทรศัพท์",
          provider: "TOT",
          serviceNumber: "053123456",
          isActive: true,
          createdAt: "",
        }}
      />,
    );

    // Office phone (no phoneOwnerName)
    expect(screen.queryByText(/ประเภทสถานที่ \/ ที่ตั้ง/i)).not.toBeInTheDocument();

    // Telecom
    rerender(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        serviceToEdit={{
          id: "svc-telecom",
          departmentId: "dept-1",
          utilityType: "ค่าสื่อสาร&โทรคมนาคม",
          provider: "NT",
          serviceNumber: "inet-001",
          isActive: true,
          createdAt: "",
        }}
      />,
    );

    expect(screen.queryByText(/ประเภทสถานที่ \/ ที่ตั้ง/i)).not.toBeInTheDocument();
  });

  it("renders 'ประเภทสถานที่ / ที่ตั้ง' for electricity and water services", () => {
    const { rerender } = render(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        serviceToEdit={{
          id: "svc-electricity",
          departmentId: "dept-1",
          utilityType: "ค่าไฟฟ้า",
          provider: "กฟภ.",
          serviceNumber: "meter-123",
          locationType: "สำนักงาน",
          isActive: true,
          createdAt: "",
        }}
      />,
    );

    expect(screen.getByText(/ประเภทสถานที่ \/ ที่ตั้ง/i)).toBeInTheDocument();

    // Water
    rerender(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        serviceToEdit={{
          id: "svc-water",
          departmentId: "dept-1",
          utilityType: "ค่าประปา&น้ำบาดาล",
          provider: "กปภ.",
          serviceNumber: "water-123",
          locationType: "บ่อเพาะ",
          isActive: true,
          createdAt: "",
        }}
      />,
    );

    expect(screen.getByText(/ประเภทสถานที่ \/ ที่ตั้ง/i)).toBeInTheDocument();
  });

  it("calculates reimbursement ceiling correctly based on position level", () => {
    // 4,000 THB: บริหารระดับสูง, บริหารระดับทรงคุณวุฒิ
    expect(getPhoneReimbursementLimit("บริหารระดับสูง")).toBe(4000);
    expect(getPhoneReimbursementLimit("บริหารระดับทรงคุณวุฒิ")).toBe(4000);

    // 2,000 THB: บริหารระดับต้น, อำนวยการระดับสูง, วิชาการระดับเชี่ยวชาญ
    expect(getPhoneReimbursementLimit("บริหารระดับต้น")).toBe(2000);
    expect(getPhoneReimbursementLimit("อำนวยการระดับสูง")).toBe(2000);
    expect(getPhoneReimbursementLimit("วิชาการระดับเชี่ยวชาญ")).toBe(2000);

    // 1,000 THB: All others
    expect(getPhoneReimbursementLimit("อำนวยการระดับต้น")).toBe(1000);
    expect(getPhoneReimbursementLimit("ชำนาญการพิเศษ")).toBe(1000);
    expect(getPhoneReimbursementLimit("ทั่วไประดับอาวุโส")).toBe(1000);
    expect(getPhoneReimbursementLimit("")).toBe(1000);
    expect(getPhoneReimbursementLimit(undefined)).toBe(1000);
    expect(getPhoneReimbursementLimit(null)).toBe(1000);
  });

  it("renders non-selectable read-only ceiling input matching position and sends calculated limit", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ServiceFormSheet
        open={true}
        onOpenChange={onOpenChange}
        departments={sampleDepartments}
        userRole="admin"
        userDepartmentId={null}
        serviceToEdit={{
          id: "svc-high-exec",
          departmentId: "dept-1",
          utilityType: "ค่าโทรศัพท์",
          provider: "AIS",
          serviceNumber: "0819998888",
          phoneOwnerName: "นายอธิบดี กรมประมง",
          phoneOwnerPosition: "บริหารระดับสูง",
          phoneOwnerDivision: "สำนักผู้บริหาร",
          phoneReimbursementLimit: 4000,
          isActive: true,
          createdAt: "",
        }}
      />,
    );

    // Check ceiling input is rendered with 4,000 บาท and is disabled / readonly
    const ceilingInput = screen.getByDisplayValue("4,000 บาท");
    expect(ceilingInput).toBeInTheDocument();
    expect(ceilingInput).toBeDisabled();
    expect(ceilingInput).toHaveAttribute("readonly");

    // Click submit
    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "svc-high-exec",
        data: expect.objectContaining({
          phoneOwnerPosition: "บริหารระดับสูง",
          phoneReimbursementLimit: 4000,
        }),
      });
    });
  });

  it("provides correct provider options for each utility type", () => {
    // ค่าไฟฟ้า
    expect(getProvidersForUtility("ค่าไฟฟ้า")).toEqual([
      "การไฟฟ้านครหลวง",
      "การไฟฟ้าส่วนภูมิภาค",
    ]);

    // ค่าประปา&น้ำบาดาล
    expect(getProvidersForUtility("ค่าประปา&น้ำบาดาล")).toEqual([
      "การประปานครหลวง",
      "การประปาเทศบาลตำบล",
      "การประปาส่วนภูมิภาค",
      "ประปาหมู่บ้าน",
      "องค์การบริหารส่วนตำบล",
    ]);

    // ค่าโทรศัพท์
    expect(getProvidersForUtility("ค่าโทรศัพท์")).toEqual([
      "บริษัท ทรู มูฟ เอช ยูนิเวอร์แซล คอมมิวนิเคชั่น จำกัด",
      "บริษัท โทรคมนาคมแห่งชาติ จำกัด (มหาชน)",
      "บริษัท แอดวานซ์ ไวร์เลส เน็ทเวอร์ค จำกัด",
    ]);

    // ค่าสื่อสาร&โทรคมนาคม
    expect(getProvidersForUtility("ค่าสื่อสาร&โทรคมนาคม")).toEqual([
      "บริษัท ทริปเปิลที บรอดแบนด์ จำกัด (มหาชน)",
      "บริษัท ทรู อินเทอร์เน็ต คอร์ปอเรชั่น จำกัด",
      "บริษัท โทรคมนาคมแห่งชาติ จำกัด (มหาชน)",
    ]);

    // ค่าบริการไปรษณีย์
    expect(getProvidersForUtility("ค่าบริการไปรษณีย์")).toEqual([
      "บริษัท ไปรษณีย์ไทย จำกัด",
    ]);

    // Empty / null
    expect(getProvidersForUtility("")).toEqual([]);
    expect(getProvidersForUtility(null)).toEqual([]);
  });

  it("sanitizes serviceNumber to uppercase alphanumeric only", () => {
    expect(sanitizeServiceNumber("abc123xyz")).toBe("ABC123XYZ");
    expect(sanitizeServiceNumber("meter-01 #2")).toBe("METER012");
    expect(sanitizeServiceNumber("กฟภ1234กขค")).toBe("1234");
    expect(sanitizeServiceNumber("tel-081-234-5678")).toBe("TEL0812345678");
    expect(sanitizeServiceNumber("")).toBe("");
  });

  it("filters out invalid characters and auto-uppercases when typing in serviceNumber input", async () => {
    const user = userEvent.setup();

    render(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="admin"
        userDepartmentId={null}
        serviceToEdit={null}
      />,
    );

    const serviceInput = screen.getByPlaceholderText(/เฉพาะตัวเลขและภาษาอังกฤษ/) as HTMLInputElement;
    await user.type(serviceInput, "meter-01กข");

    // "meter-01กข" should become "METER01" (lowercase to uppercase, dashes and Thai removed)
    expect(serviceInput.value).toBe("METER01");
  });

  it("shows error and prevents submission when serviceNumber is duplicate of existingServices", async () => {
    const user = userEvent.setup();
    const existingServices = [
      {
        id: "svc-exist-1",
        departmentId: "dept-1",
        utilityType: "ค่าไฟฟ้า",
        provider: "กฟภ.",
        serviceNumber: "METER999",
        isActive: true,
        createdAt: "",
      },
    ];

    render(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="admin"
        userDepartmentId={null}
        serviceToEdit={null}
        existingServices={existingServices}
      />,
    );

    const serviceInput = screen.getByPlaceholderText(/เฉพาะตัวเลขและภาษาอังกฤษ/);
    await user.type(serviceInput, "meter999");

    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    await user.click(submitBtn);

    expect(screen.getByText(/รหัสเครื่องวัด \/ หมายเลขผู้ใช้ นี้ถูกบันทึกในระบบแล้ว/i)).toBeInTheDocument();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it("allows submitting same serviceNumber when editing the same service", async () => {
    const user = userEvent.setup();
    const currentService = {
      id: "svc-exist-1",
      departmentId: "dept-1",
      utilityType: "ค่าไฟฟ้า",
      provider: "กฟภ.",
      serviceNumber: "METER999",
      isActive: true,
      createdAt: "",
    };

    render(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="admin"
        userDepartmentId="dept-1"
        serviceToEdit={currentService}
        existingServices={[currentService]}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    await user.click(submitBtn);

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "svc-exist-1",
        data: expect.objectContaining({
          serviceNumber: "METER999",
        }),
      }),
    );
  });

  it("enables submit button and allows non-admin to add or edit service for their own department", () => {
    const { rerender } = render(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        serviceToEdit={null}
        scope="my_dept"
      />,
    );

    expect(
      screen.queryByText(/เฉพาะผู้ดูแลระบบ \(Admin\) เท่านั้นที่สามารถเพิ่มหรือแก้ไขข้อมูลได้/i),
    ).not.toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    expect(submitBtn).not.toBeDisabled();

    // Also verify when editing
    rerender(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        serviceToEdit={{
          id: "svc-exist-1",
          departmentId: "dept-1",
          utilityType: "ค่าไฟฟ้า",
          provider: "กฟภ.",
          serviceNumber: "METER999",
          isActive: true,
          createdAt: "",
        }}
        scope="my_dept"
      />,
    );

    expect(
      screen.queryByText(/เฉพาะผู้ดูแลระบบ \(Admin\) เท่านั้นที่สามารถเพิ่มหรือแก้ไขข้อมูลได้/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /บันทึกข้อมูล/i })).not.toBeDisabled();
  });

  it("enables submit button and does not show warning when admin adds or edits service in all-services", () => {
    render(
      <ServiceFormSheet
        open={true}
        onOpenChange={vi.fn()}
        departments={sampleDepartments}
        userRole="admin"
        userDepartmentId="dept-1"
        serviceToEdit={null}
        scope="all"
      />,
    );

    expect(
      screen.queryByText(/เฉพาะผู้ดูแลระบบ \(Admin\) เท่านั้นที่สามารถเพิ่มหรือแก้ไขข้อมูลได้/i),
    ).not.toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    expect(submitBtn).not.toBeDisabled();
  });
});


