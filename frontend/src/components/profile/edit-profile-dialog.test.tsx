import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditProfileDialog } from "./edit-profile-dialog";

const linkSocialMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    linkSocial: (...args: unknown[]) => linkSocialMock(...args),
  },
}));

describe("EditProfileDialog LINE & Google badges & Connect Sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/dashboard");
  });

  it("displays LINE badge when user.isLine is true", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileDialog
          open={true}
          onOpenChange={vi.fn()}
          roleLabel="ผู้ใช้งาน"
          user={{
            name: "สมชาย ทดสอบ",
            email: "somchai@fisheries.go.th",
            role: "user",
            isLine: true,
          }}
        />
      </QueryClientProvider>,
    );

    const badges = Array.from(document.querySelectorAll('[data-slot="badge"]')).map((el) =>
      el.textContent?.trim(),
    );
    expect(badges).toContain("LINE");
    expect(badges).not.toContain("Google");
    expect(screen.getByRole("button", { name: /Resync LINE/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เชื่อมต่อ Google" })).toBeInTheDocument();
  });

  it("displays both Google and LINE badges when both accounts are linked", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileDialog
          open={true}
          onOpenChange={vi.fn()}
          roleLabel="ผู้ดูแลระบบ"
          user={{
            name: "สมหญิง ทดสอบ",
            email: "somying@fisheries.go.th",
            role: "admin",
            isGoogle: true,
            isLine: true,
          }}
        />
      </QueryClientProvider>,
    );

    const badges = Array.from(document.querySelectorAll('[data-slot="badge"]')).map((el) =>
      el.textContent?.trim(),
    );
    expect(badges).toContain("Google");
    expect(badges).toContain("LINE");
    expect(screen.getByRole("button", { name: /Resync LINE/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resync Google/i })).toBeInTheDocument();
  });

  it("triggers initial Connect & Sync via authClient.linkSocial without DELETE when not yet linked", async () => {
    linkSocialMock.mockReturnValue(new Promise(() => {}));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileDialog
          open={true}
          onOpenChange={vi.fn()}
          roleLabel="ผู้ใช้งาน"
          user={{
            name: "สมชาย ทดสอบ",
            email: "somchai@fisheries.go.th",
            role: "user",
            isGoogle: false,
            isLine: false,
          }}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "เชื่อมต่อ LINE" }));
    expect(screen.getByAltText("LINE OA QR Code")).toBeInTheDocument();
    expect(screen.getAllByText("@990ijmdu").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /ดำเนินการเชื่อมต่อ/i }));

    await waitFor(() => {
      expect(linkSocialMock).toHaveBeenCalledWith({
        provider: "line",
        callbackURL: "/dashboard?auth_linked=line",
        errorCallbackURL: "/dashboard?auth_link_error=line",
      });
    });

    expect(screen.getByRole("button", { name: /กำลังเชื่อมต่อ/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "เชื่อมต่อ Google" })).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resyncs LINE by deleting old link via DELETE /api/auth/me and re-linking with consent and bot_prompt", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: true, provider: "line" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    linkSocialMock.mockReturnValue(new Promise(() => {}));
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileDialog
          open={true}
          onOpenChange={vi.fn()}
          roleLabel="ผู้ใช้งาน"
          user={{
            name: "สมหญิง ทดสอบ",
            email: "somying@fisheries.go.th",
            role: "user",
            isGoogle: false,
            isLine: true,
            lineName: "Somying LINE",
          }}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Somying LINE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Resync LINE/i }));
    expect(screen.getByAltText("LINE OA QR Code")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ดำเนินการเชื่อมต่อ/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/me?provider=line", {
        method: "DELETE",
      });
    });
    await waitFor(() => {
      expect(linkSocialMock).toHaveBeenCalledWith({
        provider: "line",
        callbackURL: "/dashboard?auth_linked=line",
        errorCallbackURL: "/dashboard?auth_link_error=line",
        additionalParams: {
          prompt: "consent",
          bot_prompt: "aggressive",
        },
      });
    });
  });

  it("triggers Google Resync cleanly and surfaces linkSocial errors", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: true, provider: "google" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    linkSocialMock.mockResolvedValue({
      error: { message: "Google linking failed" },
    });
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileDialog
          open={true}
          onOpenChange={vi.fn()}
          roleLabel="ผู้ใช้งาน"
          user={{
            name: "สมหญิง ทดสอบ",
            email: "somying@fisheries.go.th",
            role: "user",
            isGoogle: true,
            isLine: true,
            googleEmail: "somying.gmail@gmail.com",
            lineName: "Somying LINE",
          }}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("somying.gmail@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Somying LINE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Resync Google/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/me?provider=google", {
        method: "DELETE",
      });
    });
    await waitFor(() => {
      expect(linkSocialMock).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/dashboard?auth_linked=google",
        errorCallbackURL: "/dashboard?auth_link_error=google",
        additionalParams: {
          prompt: "select_account consent",
        },
      });
    });
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Google linking failed");
    });
  });
});
