import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ServicesTable } from "./services-table";
import type { DepartmentDTO, DepartmentServiceDTO } from "@/lib/api/generated/model";

// Mock @tanstack/react-query
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

// Mock departments mutation
vi.mock("@lib/api/generated/departments/departments", () => ({
  useToggleDepartmentServiceStatus: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateDepartmentService: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateDepartmentService: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/lib/api/generated/departments/departments", () => ({
  useToggleDepartmentServiceStatus: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateDepartmentService: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateDepartmentService: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const mockDepartments: DepartmentDTO[] = [
  { id: "dept-1", costCenterCode: "D1", fullName: "กองบริหารงานทั่วไป", shortName: "กบท.", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "dept-2", costCenterCode: "D2", fullName: "กองยุทธศาสตร์และแผนงาน", shortName: "กผง.", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

const mockServices: DepartmentServiceDTO[] = [
  {
    id: "svc-1",
    departmentId: "dept-1",
    departmentName: "กองบริหารงานทั่วไป",
    utilityType: "ค่าไฟฟ้า",
    provider: "การไฟฟ้านครหลวง",
    serviceNumber: "MEA-12345",
    locationType: "สำนักงาน",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

describe("ServicesTable Component", () => {
  it("renders read-only view for scope='my_dept' without 'จัดการ', 'เพิ่มรายการใหม่', or department filter badge", () => {
    render(
      <ServicesTable
        services={mockServices}
        departments={mockDepartments}
        userRole="user"
        userDepartmentId="dept-1"
        scope="my_dept"
      />
    );

    // Should NOT have 'จัดการ' in the headers
    expect(screen.queryByRole("columnheader", { name: "จัดการ" })).not.toBeInTheDocument();
    expect(screen.queryByText("จัดการ")).not.toBeInTheDocument();

    // Should NOT have 'เพิ่มรายการใหม่' button
    expect(screen.queryByRole("button", { name: /เพิ่มรายการใหม่/i })).not.toBeInTheDocument();

    // Should NOT have 'กรองตามหน่วยงาน:'
    expect(screen.queryByText(/กรองตามหน่วยงาน:/)).not.toBeInTheDocument();

    // Should NOT have 'หน่วยงาน' column header
    expect(screen.queryByRole("columnheader", { name: "หน่วยงาน" })).not.toBeInTheDocument();

    // Should have own service data
    expect(screen.getByText("MEA-12345")).toBeInTheDocument();
    expect(screen.getByText("ค่าไฟฟ้า")).toBeInTheDocument();
    expect(screen.getByText("ใช้งานอยู่")).toBeInTheDocument();
  });

  it("renders management controls for scope='all' including 'จัดการ' and 'เพิ่มรายการใหม่'", () => {
    render(
      <ServicesTable
        services={mockServices}
        departments={mockDepartments}
        userRole="admin"
        userDepartmentId={null}
        scope="all"
      />
    );

    // Should have 'จัดการ' column header
    expect(screen.getByRole("columnheader", { name: "จัดการ" })).toBeInTheDocument();

    // Should have 'เพิ่มรายการใหม่' button
    expect(screen.getByRole("button", { name: /เพิ่มรายการใหม่/i })).toBeInTheDocument();

    // Should have 'หน่วยงาน' column header
    expect(screen.getByRole("columnheader", { name: "หน่วยงาน" })).toBeInTheDocument();

    // Should have action buttons (e.g. edit / suspend buttons)
    expect(screen.getByTitle("แก้ไข")).toBeInTheDocument();
    expect(screen.getByTitle("ระงับการใช้งาน")).toBeInTheDocument();
  });

  it("renders suspended status and suspendedAt timestamp when a service is deactivated", () => {
    const inactiveServices: DepartmentServiceDTO[] = [
      {
        id: "svc-inactive",
        departmentId: "dept-1",
        departmentName: "กองบริหารงานทั่วไป",
        utilityType: "ค่าไฟฟ้า",
        provider: "การไฟฟ้านครหลวง",
        serviceNumber: "MEA-99999",
        locationType: "สำนักงาน",
        isActive: false,
        suspendedAt: "2026-10-29T10:30:00Z",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    render(
      <ServicesTable
        services={inactiveServices}
        departments={mockDepartments}
        userRole="admin"
        userDepartmentId={null}
        scope="all"
      />
    );

    expect(screen.getByText("ระงับการใช้งาน")).toBeInTheDocument();
    expect(screen.getByText(/ระงับเมื่อ:/)).toBeInTheDocument();
  });
});

