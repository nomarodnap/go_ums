import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DepartmentCombobox } from "./department-combobox";

describe("DepartmentCombobox Component", () => {
  const mockDepartments = [
    {
      id: "dept-1",
      fullName: "กองบริหารจัดการด้านการประมง",
      shortName: "กบจ.",
      costCenterCode: "2500300001",
    },
    {
      id: "dept-2",
      fullName: "สำนักงานเลขานุการกรม กรมประมง",
      shortName: "สลก.",
      costCenterCode: "2500300002",
    },
    {
      id: "dept-3",
      fullName: "กองตรวจการประมง",
      shortName: "กตป.",
      costCenterCode: "2500300003",
    },
  ];

  it("renders with placeholder when no department is selected", () => {
    render(
      <DepartmentCombobox
        departments={mockDepartments}
        placeholder="เลือกหน่วยงาน..."
      />,
    );
    expect(screen.getByText("เลือกหน่วยงาน...")).toBeInTheDocument();
  });

  it("renders selected department full name", () => {
    render(
      <DepartmentCombobox
        departments={mockDepartments}
        value="dept-2"
      />,
    );
    expect(
      screen.getByText("สำนักงานเลขานุการกรม กรมประมง"),
    ).toBeInTheDocument();
  });

  it("opens popover with search input and displays full department names with details", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <DepartmentCombobox
        departments={mockDepartments}
        onValueChange={onValueChange}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    expect(
      screen.getByPlaceholderText(
        "พิมพ์เพื่อค้นหาชื่อหน่วยงาน, ชื่อย่อ, รหัสเบิกจ่าย...",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("กองบริหารจัดการด้านการประมง"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("สำนักงานเลขานุการกรม กรมประมง"),
    ).toBeInTheDocument();

    const targetOption = screen.getByText("กองบริหารจัดการด้านการประมง");
    await user.click(targetOption);

    expect(onValueChange).toHaveBeenCalledWith("dept-1");
  });

  it("filters departments when typing in search input", async () => {
    const user = userEvent.setup();

    render(
      <DepartmentCombobox
        departments={mockDepartments}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText(
      "พิมพ์เพื่อค้นหาชื่อหน่วยงาน, ชื่อย่อ, รหัสเบิกจ่าย...",
    );
    await user.type(searchInput, "สลก");

    expect(
      screen.getByText("สำนักงานเลขานุการกรม กรมประมง"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("กองบริหารจัดการด้านการประมง"),
    ).not.toBeInTheDocument();
  });
});
