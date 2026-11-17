import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserFormSheet } from "./user-form-sheet";
import type { DepartmentDTO, ManageUserDTO } from "@/lib/api/generated/model";

const mockUpdateMutateAsync = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  useQuery: () => ({
    data: { status: 200, data: [] },
  }),
}));

vi.mock("@/lib/api/generated/roles/roles", () => ({
  useListRoles: () => ({
    data: { status: 200, data: [] },
  }),
}));

vi.mock("@/lib/api/generated/users/users", () => ({
  useUpdateUser: () => ({
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

describe("UserFormSheet - Email Editing for Pending Verification Users", () => {
  const sampleDept: DepartmentDTO = {
    id: "dept-1",
    fullName: "สำนักบริหารกลาง",
    createdAt: "",
    updatedAt: "",
  };

  const pendingUser: ManageUserDTO = {
    id: "user-pending",
    name: "สมชาย รักชาติ",
    email: "somchai@fisheries.go.th",
    emailVerified: false,
    role: "user",
    banned: false,
    departmentId: "dept-1",
    hasPassword: false, // รอยืนยันอีเมล
    createdAt: "2026-01-01T00:00:00Z",
  };

  const activeUser: ManageUserDTO = {
    id: "user-active",
    name: "สมหญิง จริงใจ",
    email: "somying@fisheries.go.th",
    emailVerified: true,
    role: "admin",
    banned: false,
    departmentId: "dept-1",
    hasPassword: true, // ตั้งรหัสผ่านแล้ว
    createdAt: "2026-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows editing email when user has not set password (pending verification)", async () => {
    const user = userEvent.setup();
    render(
      <UserFormSheet
        user={pendingUser}
        department={sampleDept}
        departments={[sampleDept]}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText("รอยืนยันอีเมล (แก้ไขได้)")).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/อีเมล/i) as HTMLInputElement;
    expect(emailInput).toBeEnabled();
    expect(emailInput.value).toBe("somchai@fisheries.go.th");

    // Clear and enter invalid email
    await user.clear(emailInput);
    await user.type(emailInput, "invalid-format");

    const submitBtn = screen.getByRole("button", { name: /บันทึกข้อมูล/i });
    await user.click(submitBtn);

    expect(
      screen.getByText("รูปแบบอีเมลไม่ถูกต้อง (เช่น example@fisheries.go.th)")
    ).toBeInTheDocument();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();

    // Fix to valid email
    await user.clear(emailInput);
    await user.type(emailInput, "new.email@fisheries.go.th");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "user-pending",
        data: expect.objectContaining({
          email: "new.email@fisheries.go.th",
        }),
      });
    });
  });

  it("disables email input when user already has password set", () => {
    render(
      <UserFormSheet
        user={activeUser}
        department={sampleDept}
        departments={[sampleDept]}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText("ตั้งรหัสผ่านแล้ว")).toBeInTheDocument();
    expect(
      screen.getByText("ไม่สามารถแก้ไขอีเมลได้หลังจากผู้ใช้งานตั้งรหัสผ่านเรียบร้อยแล้ว")
    ).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/อีเมล/i) as HTMLInputElement;
    expect(emailInput).toBeDisabled();
    expect(emailInput.value).toBe("somying@fisheries.go.th");
  });
});
