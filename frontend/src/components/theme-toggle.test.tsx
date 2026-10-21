import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

const mockSetTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: mockSetTheme,
  }),
}));

describe("ThemeToggle Component", () => {
  it("renders the theme toggle button with screen reader text", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /สลับโหมดสี/i });
    expect(button).toBeInTheDocument();
  });

  it("calls setTheme on click", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /สลับโหมดสี/i });
    await user.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
