import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AllAIAssistantPage from "./page";

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

let mockCurrentUser: {
  status: number;
  data: {
    user: {
      id: string;
      name: string;
      role: string;
      departmentName: string;
    };
  };
} = {
  status: 200,
  data: {
    user: {
      id: "u-admin",
      name: "Admin User",
      role: "admin",
      departmentName: "ภาพรวมทั้งกรมประมง (292 หน่วยงาน)",
    },
  },
};

vi.mock("@/lib/api/generated/auth/auth", () => ({
  useGetCurrentUser: () => ({
    data: mockCurrentUser,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/lib/api/ai-hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/ai-hooks")>();
  return {
    ...actual,
    useAIStatus: () => mockStatusResult,
    useAIChat: (scope: string) => ({
      mutate: (messages: any[], options: any) => mockMutate(messages, options, scope),
      isPending: false,
    }),
  };
});

describe("AllAIAssistantPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    if (typeof window !== "undefined") {
      window.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-audio");
      window.URL.revokeObjectURL = vi.fn();
    }
    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/tts")) {
        return Promise.resolve(new Response(new Blob(["mock-audio"]), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
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
    mockCurrentUser = {
      status: 200,
      data: {
        user: {
          id: "u-admin",
          name: "Admin User",
          role: "admin",
          departmentName: "ภาพรวมทั้งกรมประมง (292 หน่วยงาน)",
        },
      },
    };
  });

  it("renders the Whole-Department AI page header and 4 featured prompts for central staff", () => {
    render(<AllAIAssistantPage />);

    expect(screen.getByRole("heading", { level: 1, name: /ผู้ช่วย AI ภาพรวมทั้งกรม \(292 หน่วยงาน\)/ })).toBeInTheDocument();
    expect(screen.getByText("สิทธิ์ส่วนกลาง")).toBeInTheDocument();
    expect(screen.getByText("สรุปภาพรวมทั้งกรม")).toBeInTheDocument();
    expect(screen.getByText("หน่วยงานค้างชำระสูงสุด")).toBeInTheDocument();
    expect(screen.getByText("แนวโน้มค่าไฟฟ้า 6 เดือน")).toBeInTheDocument();
    expect(screen.getByText("ตรวจจับความผิดปกติ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2D Live: เปิด/ })).toBeInTheDocument();
  });

  it("switches Live 2D model to static portrait while keeping Face Call interface when toggled off", async () => {
    const user = userEvent.setup();
    render(<AllAIAssistantPage />);

    expect(screen.getByText("FACE CALL LIVE")).toBeInTheDocument();
    expect(screen.getByText("Live2D ขยับตามเมาส์")).toBeInTheDocument();

    const live2dBtn = screen.getByRole("button", { name: /2D Live: เปิด/ });
    await user.click(live2dBtn);

    expect(screen.getByRole("button", { name: /2D Live: ปิด/ })).toBeInTheDocument();
    // Face Call interface remains visible with static portrait image
    expect(screen.getByText("FACE CALL LIVE")).toBeInTheDocument();
    expect(screen.getByText("2D Live ปิดอยู่ (ภาพนิ่ง)")).toBeInTheDocument();
    expect(screen.getByAltText(/น้องธาร่า/)).toBeInTheDocument();

    // Turning back on restores Live 2D active state
    await user.click(screen.getByRole("button", { name: /2D Live: ปิด/ }));
    expect(screen.getByRole("button", { name: /2D Live: เปิด/ })).toBeInTheDocument();
    expect(screen.getByText("Live2D ขยับตามเมาส์")).toBeInTheDocument();
  });

  it("sends whole-department prompt with scope 'all' when clicking a featured card", async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_messages, options) => {
      options?.onSuccess?.({
        reply: "สรุปภาพรวม 292 หน่วยงานประจำเดือนนี้ มียอดรวม 2,450,000.00 บาท",
        toolsUsed: ["get_utility_summary"],
        model: "gemini-2.5-flash",
      });
    });

    render(<AllAIAssistantPage />);

    await user.click(screen.getByRole("button", { name: /สรุปภาพรวมทั้งกรม/ }));

    expect(mockMutate).toHaveBeenCalledWith(
      [{ role: "user", content: "สรุปภาพรวมค่าสาธารณูปโภคทั้งกรมประมงประจำเดือนนี้" }],
      expect.any(Object),
      "all",
    );

    expect(screen.getByText("สรุปยอดค่าสาธารณูปโภค")).toBeInTheDocument();
    expect(screen.getAllByText(/สรุปภาพรวม 292 หน่วยงานประจำเดือนนี้/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/น้องธาร่า/).length).toBeGreaterThanOrEqual(1);
  });

  it("blocks non-central user with permission notice", () => {
    mockCurrentUser = {
      status: 200,
      data: {
        user: {
          id: "u-normal",
          name: "Normal Officer",
          role: "user",
          departmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
        },
      },
    };
    mockStatusResult.data.isAdmin = false;

    render(<AllAIAssistantPage />);

    expect(screen.getByText("เฉพาะเจ้าหน้าที่ส่วนกลางและผู้ดูแลระบบ")).toBeInTheDocument();
    expect(screen.getByText("กลับสู่แดชบอร์ดหน่วยงาน")).toBeInTheDocument();
  });

  it("renders Tara avatar with live Face Call HUD and emotion testing buttons", async () => {
    const user = userEvent.setup();
    render(<AllAIAssistantPage />);

    expect(screen.getByText("FACE CALL LIVE")).toBeInTheDocument();
    expect(screen.getAllByText(/น้องธาร่า/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /ยิ้มแย้ม/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ครุ่นคิด/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /รับฟัง/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ข้อสังเกต/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ครุ่นคิด/ }));
    expect(screen.getByText(/กำลังค้นหาและประมวลผลข้อมูล 292 หน่วยงาน/)).toBeInTheDocument();
  });
});

