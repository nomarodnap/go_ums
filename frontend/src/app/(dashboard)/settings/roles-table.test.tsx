import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { RolesTable } from "./roles-table";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the generated roles API
vi.mock("@/lib/api/generated/roles/roles", () => ({
  useListRoles: vi.fn(),
  useDeleteRole: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useCreateRole: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateRole: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  getListRolesQueryKey: vi.fn(() => ["roles"]),
}));

const mockRoles = [
  {
    id: "admin",
    name: "ผู้ดูแลระบบ",
    description: "สิทธิ์สูงสุด เข้าถึงและจัดการได้ทุกส่วนของระบบ",
    permissions: ["*"],
    isSystem: true,
    userCount: 2,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "finance_custom",
    name: "เจ้าหน้าที่การเงิน",
    description: "บันทึกและส่งเบิกจ่ายบิล",
    permissions: ["/dashboard", "/bills", "/services"],
    isSystem: false,
    userCount: 5,
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-02-01T00:00:00Z",
  },
];

describe("RolesTable Component", () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const { useListRoles } = await import("@/lib/api/generated/roles/roles");
    vi.mocked(useListRoles).mockReturnValue({
      data: { status: 200, data: mockRoles },
      isLoading: false,
      error: null,
    } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RolesTable />
      </QueryClientProvider>,
    );

  it("renders roles table with roles and system badge", () => {
    renderComponent();

    expect(screen.getByText("ผู้ดูแลระบบ")).toBeInTheDocument();
    expect(screen.getByText("เจ้าหน้าที่การเงิน")).toBeInTheDocument();
    expect(screen.getByText("ระบบ")).toBeInTheDocument(); // Badge for system role
    expect(screen.getByText("เข้าถึงทุกหน้า")).toBeInTheDocument();
    expect(screen.getByText("3 หน้า")).toBeInTheDocument();
  });

  it("filters roles when typing in search input", async () => {
    const user = userEvent.setup();
    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "ค้นหาชื่อบทบาท หรือคำอธิบาย...",
    );
    await user.type(searchInput, "การเงิน");

    expect(screen.getByText("เจ้าหน้าที่การเงิน")).toBeInTheDocument();
    expect(screen.queryByText("ผู้ดูแลระบบ")).not.toBeInTheDocument();
  });

  it("opens create role sheet when clicking 'สร้างบทบาทใหม่' button", async () => {
    const user = userEvent.setup();
    renderComponent();

    const createBtn = screen.getByRole("button", { name: /สร้างบทบาทใหม่/i });
    await user.click(createBtn);

    expect(
      screen.getByText("สร้างบทบาทใหม่ (Custom Role)"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/เช่น เจ้าหน้าที่การเงิน/i),
    ).toBeInTheDocument();
  });
});

