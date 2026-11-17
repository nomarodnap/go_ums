import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MonthPickerBE } from "./month-picker-be";

describe("MonthPickerBE Component", () => {
  it("renders with placeholder when no value is set", () => {
    render(<MonthPickerBE name="billingMonth" />);
    expect(screen.getByText("เลือกเดือน")).toBeInTheDocument();
  });

  it("renders formatted Buddhist Era date when value is provided", () => {
    render(<MonthPickerBE name="billingMonth" value="2026-10" />);
    expect(screen.getByText("ตุลาคม 2569")).toBeInTheDocument();
  });

  it("allows navigating years and selecting a month when controlled value is already set", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <MonthPickerBE
        name="billingMonth"
        value="2026-10"
        onChange={onChange}
      />,
    );

    expect(screen.getByText("ตุลาคม 2569")).toBeInTheDocument();

    // Click trigger to open popover
    const trigger = screen.getByRole("button", { name: /ตุลาคม 2569/i });
    await user.click(trigger);

    // Should display current year header พ.ศ. 2569
    expect(screen.getByText("พ.ศ. 2569")).toBeInTheDocument();

    // Click previous year button (<)
    // There are ChevronLeft and ChevronRight buttons in the popover
    const prevYearBtn = screen.getAllByRole("button").find((btn) =>
      btn.querySelector("svg.lucide-chevron-left"),
    );
    expect(prevYearBtn).toBeDefined();

    await user.click(prevYearBtn!);

    // Should change view to พ.ศ. 2568 without being reverted back!
    expect(screen.getByText("พ.ศ. 2568")).toBeInTheDocument();

    // Click previous year again
    await user.click(prevYearBtn!);
    expect(screen.getByText("พ.ศ. 2567")).toBeInTheDocument();

    // Click next year button (>)
    const nextYearBtn = screen.getAllByRole("button").find((btn) =>
      btn.querySelector("svg.lucide-chevron-right"),
    );
    expect(nextYearBtn).toBeDefined();

    await user.click(nextYearBtn!);
    expect(screen.getByText("พ.ศ. 2568")).toBeInTheDocument();

    // Select "มกราคม" (January) in 2568 (2025)
    const janBtn = screen.getByRole("button", { name: "มกราคม" });
    await user.click(janBtn);

    // onChange should be called with 2025-01
    expect(onChange).toHaveBeenCalledWith("2025-01");
  });

  it("handles uncontrolled selection properly", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MonthPickerBE
        name="billingMonth"
        defaultValue="2024-03"
        onChange={onChange}
      />,
    );

    expect(screen.getByText("มีนาคม 2567")).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: /มีนาคม 2567/i });
    await user.click(trigger);

    expect(screen.getByText("พ.ศ. 2567")).toBeInTheDocument();

    const prevYearBtn = screen.getAllByRole("button").find((btn) =>
      btn.querySelector("svg.lucide-chevron-left"),
    );
    await user.click(prevYearBtn!);
    expect(screen.getByText("พ.ศ. 2566")).toBeInTheDocument();

    const decBtn = screen.getByRole("button", { name: "ธันวาคม" });
    await user.click(decBtn);

    expect(onChange).toHaveBeenCalledWith("2023-12");
  });
});

