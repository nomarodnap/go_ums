import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "./page";

const signInSocialMock = vi.fn();
const signInEmailMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: (...args: unknown[]) => signInSocialMock(...args),
      email: (...args: unknown[]) => signInEmailMock(...args),
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/three/dof-gold-logo-3d", () => ({
  DofGoldLogo3D: () => <div data-testid="dof-logo-3d" />,
}));

vi.mock("@/components/announcement-popup", () => ({
  AnnouncementPopup: () => null,
}));

describe("SignInPage LINE Auth & Error Handling", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/sign-in");
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/sign-in");
  });

  function renderSignIn() {
    return render(
      <QueryClientProvider client={queryClient}>
        <SignInPage />
      </QueryClientProvider>,
    );
  }

  it("renders both Google Workspace and LINE sign-in buttons", () => {
    renderSignIn();

    expect(
      screen.getByRole("button", { name: /เข้าสู่ระบบด้วย Google Workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /เข้าสู่ระบบด้วย LINE/i })).toBeInTheDocument();
  });

  it("calls authClient.signIn.social with LINE provider and enters loading state", async () => {
    signInSocialMock.mockReturnValue(new Promise(() => {}));
    renderSignIn();

    const lineButton = screen.getByRole("button", { name: /เข้าสู่ระบบด้วย LINE/i });
    fireEvent.click(lineButton);

    await waitFor(() => {
      expect(signInSocialMock).toHaveBeenCalledWith({
        provider: "line",
        callbackURL: "/",
        errorCallbackURL: "/sign-in?provider=line",
      });
    });

    expect(screen.getByText(/กำลังเชื่อมต่อไปยัง LINE/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Google/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /ลงชื่อเข้าใช้งาน/i })).toBeDisabled();
  });

  it("shows error alert when authClient.signIn.social returns an error for LINE", async () => {
    signInSocialMock.mockResolvedValue({
      error: { message: "LINE config missing" },
    });
    renderSignIn();

    fireEvent.click(screen.getByRole("button", { name: /เข้าสู่ระบบด้วย LINE/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("LINE config missing");
  });

  it("shows unregistered user Thai error when LINE returns signup_disabled", async () => {
    window.history.replaceState({}, "", "/sign-in?provider=line&error=signup_disabled");
    renderSignIn();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "ไม่พบบัญชีผู้ใช้นี้ในระบบ (อนุญาตเฉพาะอีเมลเจ้าหน้าที่ที่ลงทะเบียนไว้ล่วงหน้าเท่านั้น กรุณาติดต่อกลุ่มตรวจสอบภายใน)",
    );
  });

  it("shows missing LINE email Thai error when LINE omits email (email_not_found)", async () => {
    window.history.replaceState({}, "", "/sign-in?provider=line&error=email_not_found");
    renderSignIn();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "ไม่พบข้อมูลอีเมลจากบัญชี LINE ของท่าน (กรุณาอนุญาตการแชร์อีเมลเมื่อเข้าสู่ระบบ หรือตรวจสอบว่าบัญชี LINE ได้ยืนยันอีเมลไว้แล้ว)",
    );
  });

  it("shows LINE cancellation message when user denies consent (access_denied)", async () => {
    window.history.replaceState({}, "", "/sign-in?provider=line&error=access_denied");
    renderSignIn();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ท่านได้ยกเลิกการเข้าสู่ระบบผ่านบัญชี LINE");
  });

  it("uses the latest error param if duplicate error params exist in URL", async () => {
    window.history.replaceState(
      {},
      "",
      "/sign-in?provider=line&error=user_not_found&error=email_not_found",
    );
    renderSignIn();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ไม่พบข้อมูลอีเมลจากบัญชี LINE ของท่าน");
  });

  it("shows banned message when BANNED_USER error is returned", async () => {
    window.history.replaceState({}, "", "/sign-in?provider=line&error=BANNED_USER");
    renderSignIn();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("บัญชีผู้ใช้งานนี้ถูกระงับการใช้งาน");
  });
});
