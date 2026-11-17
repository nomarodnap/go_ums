import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIChatWidget } from "./chat-widget";

const mockMutate = vi.fn();
let mockStatusResult: {
  data: {
    enabled: boolean;
    provider: string;
    model: string;
    isAdmin: boolean;
    departmentName: string;
  };
  isLoading: boolean;
  isError: boolean;
};

vi.mock("@/lib/api/ai-hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/ai-hooks")>();
  return {
    ...actual,
    useAIStatus: () => mockStatusResult,
    useAIChat: () => ({
      mutate: mockMutate,
      isPending: false,
    }),
  };
});

describe("AIChatWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatusResult = {
      data: {
        enabled: true,
        provider: "google-gemini",
        model: "gemini-2.5-flash",
        isAdmin: true,
        departmentName: "ภาพรวมทั้งกรมประมง (292 หน่วยงาน)",
      },
      isLoading: false,
      isError: false,
    };
  });

  it("opens and closes the non-modal AI chat dialog from the launcher button", async () => {
    const user = userEvent.setup();
    render(<AIChatWidget userDepartment="ศูนย์เทคโนโลยีสารสนเทศ" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "เปิดผู้ช่วย AI ค่าสาธารณูปโภค" }));

    const dialog = screen.getByRole("dialog", { name: "ผู้ช่วย AI ระดับหน่วยงาน" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("สังกัด: ศูนย์เทคโนโลยีสารสนเทศ")).toBeInTheDocument();
    expect(screen.getByText("เปิด AI ทั้งกรม")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ปิดหน้าต่างผู้ช่วย AI" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows missing API key notice and disables input when Gemini is not configured", async () => {
    const user = userEvent.setup();
    mockStatusResult = {
      data: {
        enabled: false,
        provider: "google-gemini",
        model: "gemini-2.5-flash",
        isAdmin: false,
        departmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
      },
      isLoading: false,
      isError: false,
    };

    render(<AIChatWidget />);
    await user.click(screen.getByRole("button", { name: "เปิดผู้ช่วย AI ค่าสาธารณูปโภค" }));

    expect(screen.getByText("ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ")).toBeInTheDocument();
    expect(screen.getByLabelText("ข้อความถึงผู้ช่วย AI")).toBeDisabled();
    expect(screen.getByRole("button", { name: "เดือนนี้ค่าสาธารณูปโภคทั้งหมดเท่าไหร่?" })).toBeDisabled();
  });

  it("sends a quick prompt and renders the AI reply with tool badges", async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_messages, options) => {
      options?.onSuccess?.({
        reply: "เดือนนี้มียอดค่าสาธารณูปโภครวม **125,400.00 บาท** ครับ",
        toolsUsed: ["get_utility_summary"],
        model: "gemini-2.5-flash",
      });
    });

    render(<AIChatWidget />);
    await user.click(screen.getByRole("button", { name: "เปิดผู้ช่วย AI ค่าสาธารณูปโภค" }));

    await user.click(screen.getByRole("button", { name: "เดือนนี้ค่าสาธารณูปโภคทั้งหมดเท่าไหร่?" }));

    expect(mockMutate).toHaveBeenCalledWith(
      [{ role: "user", content: "เดือนนี้ค่าสาธารณูปโภคทั้งหมดเท่าไหร่?" }],
      expect.any(Object),
    );
    expect(screen.getByText("สรุปยอดค่าสาธารณูปโภค")).toBeInTheDocument();
    expect(screen.getByText("125,400.00 บาท")).toBeInTheDocument();
  });

  it("submits custom questions and displays backend error messages when failed", async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_messages, options) => {
      options?.onError?.({ detail: "Gemini quota exceeded" });
    });

    render(<AIChatWidget />);
    await user.click(screen.getByRole("button", { name: "เปิดผู้ช่วย AI ค่าสาธารณูปโภค" }));

    const input = screen.getByLabelText("ข้อความถึงผู้ช่วย AI");
    await user.type(input, "สรุปค่าไฟฟ้าปี 2569 ให้หน่อย");
    await user.click(screen.getByRole("button", { name: "ส่งคำถาม" }));

    expect(input).toHaveValue("");
    expect(screen.getByText("สรุปค่าไฟฟ้าปี 2569 ให้หน่อย")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Gemini quota exceeded");
  });

  it("renders leading and adjacent bold markdown spans without duplicate React key warnings", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    mockMutate.mockImplementation((_messages, options) => {
      options?.onSuccess?.({
        reply: [
          "**สรุปข้อมูล:** รายการเดือนนี้",
          "* **รวมค่าใช้จ่ายทั้งหมด:** 0.00 บาท",
          "**ส่วนที่ 1****ส่วนที่ 2**",
        ].join("\n"),
        toolsUsed: ["get_utility_summary"],
        model: "gemini-3.5-flash",
      });
    });

    try {
      render(<AIChatWidget />);
      await user.click(screen.getByRole("button", { name: "เปิดผู้ช่วย AI ค่าสาธารณูปโภค" }));
      await user.click(screen.getByRole("button", { name: "เดือนนี้ค่าสาธารณูปโภคทั้งหมดเท่าไหร่?" }));

      expect(screen.getByText("สรุปข้อมูล:")).toBeInTheDocument();
      expect(screen.getByText("รวมค่าใช้จ่ายทั้งหมด:")).toBeInTheDocument();
      expect(screen.getByText("ส่วนที่ 1")).toBeInTheDocument();
      expect(screen.getByText("ส่วนที่ 2")).toBeInTheDocument();

      const keyWarnings = errorSpy.mock.calls.filter((args) =>
        args.some((arg) => String(arg).includes("same key")),
      );
      expect(keyWarnings).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
