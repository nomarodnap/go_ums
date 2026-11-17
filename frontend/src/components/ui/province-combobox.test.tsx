import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProvinceCombobox, THAI_PROVINCES } from "./province-combobox";

describe("ProvinceCombobox Component", () => {
  it("contains exactly 77 provinces of Thailand", () => {
    expect(THAI_PROVINCES).toHaveLength(77);
    expect(THAI_PROVINCES).toContain("กรุงเทพมหานคร");
    expect(THAI_PROVINCES).toContain("เชียงใหม่");
    expect(THAI_PROVINCES).toContain("ยะลา");
    expect(THAI_PROVINCES).toContain("บึงกาฬ");
    expect(THAI_PROVINCES).toContain("อุบลราชธานี");
  });

  it("renders with placeholder when no value is selected", () => {
    render(<ProvinceCombobox placeholder="-- เลือกจังหวัด --" />);
    expect(screen.getByText("-- เลือกจังหวัด --")).toBeInTheDocument();
  });

  it("renders selected province", () => {
    render(<ProvinceCombobox value="เชียงใหม่" />);
    expect(screen.getByText("เชียงใหม่")).toBeInTheDocument();
  });

  it("opens popover and allows selecting a province", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<ProvinceCombobox onValueChange={onValueChange} />);

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    expect(screen.getByPlaceholderText("พิมพ์เพื่อค้นหาจังหวัด...")).toBeInTheDocument();

    const option = screen.getByText("กรุงเทพมหานคร");
    await user.click(option);

    expect(onValueChange).toHaveBeenCalledWith("กรุงเทพมหานคร");
  });

  it("clears selection when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<ProvinceCombobox value="ภูเก็ต" onValueChange={onValueChange} />);

    const clearBtn = screen.getByTitle("ล้างจังหวัดที่เลือก");
    await user.click(clearBtn);

    expect(onValueChange).toHaveBeenCalledWith("");
  });
});
