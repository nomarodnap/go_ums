import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServiceNumberCombobox } from "./service-number-combobox";

describe("ServiceNumberCombobox Component", () => {
  const mockServices = [
    {
      id: "svc-1",
      serviceNumber: "021234567",
      provider: "TOT",
      locationType: "อาคาร 1 ชั้น 2",
    },
    {
      id: "svc-2",
      serviceNumber: "0891234567",
      provider: "AIS",
      locationType: "กองบริหาร",
    },
    {
      id: "svc-3",
      serviceNumber: "1100223344",
      provider: "MEA",
      locationType: "โรงสูบน้ำ",
    },
  ];

  it("renders with placeholder when services are available", () => {
    render(
      <ServiceNumberCombobox
        services={mockServices}
        selectedNumbers={[]}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByText("+ ค้นหาและคลิกเพื่อเลือกหมายเลขผู้ใช้ / รหัสเครื่องวัด..."),
    ).toBeInTheDocument();
  });

  it("renders disabled message when disabled", () => {
    render(
      <ServiceNumberCombobox
        services={[]}
        selectedNumbers={[]}
        onSelect={vi.fn()}
        disabled={true}
      />,
    );
    expect(
      screen.getByText("⚠️ กรุณาเลือกประเภทสาธารณูปโภคด้านบนก่อน"),
    ).toBeInTheDocument();
  });

  it("renders empty message when no services are available in system", () => {
    render(
      <ServiceNumberCombobox
        services={[]}
        selectedNumbers={[]}
        onSelect={vi.fn()}
        disabled={false}
      />,
    );
    expect(
      screen.getByText("ไม่พบหมายเลขผู้ใช้ในระบบ"),
    ).toBeInTheDocument();
  });

  it("renders all-selected message when all services are selected", () => {
    render(
      <ServiceNumberCombobox
        services={mockServices}
        selectedNumbers={["021234567", "0891234567", "1100223344"]}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByText("เลือกหมายเลขครบทุกรายการแล้ว"),
    ).toBeInTheDocument();
  });

  it("opens popover with search input and lists unselected items with provider and location", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ServiceNumberCombobox
        services={mockServices}
        selectedNumbers={["021234567"]}
        onSelect={onSelect}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    expect(
      screen.getByPlaceholderText(
        "พิมพ์เพื่อค้นหาหมายเลขผู้ใช้, รหัสเครื่องวัด, ผู้ให้บริการ, ที่ตั้ง...",
      ),
    ).toBeInTheDocument();

    // Already selected item should not appear in unselected list
    expect(screen.queryByText("021234567")).not.toBeInTheDocument();

    // Available items should be visible
    expect(screen.getByText("0891234567")).toBeInTheDocument();
    expect(screen.getByText("1100223344")).toBeInTheDocument();

    // Select an item
    await user.click(screen.getByText("0891234567"));
    expect(onSelect).toHaveBeenCalledWith("0891234567");
  });

  it("filters services when typing in search input", async () => {
    const user = userEvent.setup();

    render(
      <ServiceNumberCombobox
        services={mockServices}
        selectedNumbers={[]}
        onSelect={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText(
      "พิมพ์เพื่อค้นหาหมายเลขผู้ใช้, รหัสเครื่องวัด, ผู้ให้บริการ, ที่ตั้ง...",
    );
    await user.type(searchInput, "MEA");

    expect(screen.getByText("1100223344")).toBeInTheDocument();
    expect(screen.queryByText("021234567")).not.toBeInTheDocument();
  });
});

