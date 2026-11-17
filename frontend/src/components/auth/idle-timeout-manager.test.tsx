import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IdleTimeoutManager } from "./idle-timeout-manager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock authClient
const signOutMock = vi.fn().mockResolvedValue({});
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: () => signOutMock(),
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

const LAST_ACTIVITY_KEY = "dof_last_activity_time";

describe("IdleTimeoutManager Component", () => {
  let queryClient: QueryClient;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    vi.clearAllMocks();
    localStorage.clear();

    // Mock window.location
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: "",
      assign: vi.fn(),
      replace: vi.fn(),
    } as any;

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    (window as any).location = originalLocation;
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <IdleTimeoutManager {...props} />
      </QueryClientProvider>
    );
  };

  it("immediately logs out if browser was closed and reopened after timeout (e.g. > 30 minutes)", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    // Stored activity from 35 minutes ago
    const thirtyFiveMinutesAgo = now - 35 * 60 * 1000;
    localStorage.setItem(LAST_ACTIVITY_KEY, thirtyFiveMinutesAgo.toString());
    localStorage.setItem("auth_token", "fake-token");

    await act(async () => {
      renderComponent({ timeoutMs: 30 * 60 * 1000 });
    });

    expect(window.location.href).toContain("/sign-in?reason=timeout");
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
  });

  it("does not log out if reopened within timeout and refreshes activity timestamp", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    // Stored activity from 10 minutes ago (< 30 minutes)
    const tenMinutesAgo = now - 10 * 60 * 1000;
    localStorage.setItem(LAST_ACTIVITY_KEY, tenMinutesAgo.toString());
    localStorage.setItem("auth_token", "valid-token");

    await act(async () => {
      renderComponent({ timeoutMs: 30 * 60 * 1000 });
    });

    expect(window.location.href).toBe("");
    expect(localStorage.getItem("auth_token")).toBe("valid-token");
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(now.toString());
  });

  it("shows warning dialog when approaching timeout limit while user is idle", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());

    renderComponent({
      timeoutMs: 30 * 60 * 1000, // 30 mins
      warningMs: 60 * 1000,       // 60 secs
    });

    // Advance time by 29 minutes and 5 seconds
    act(() => {
      vi.advanceTimersByTime(29 * 60 * 1000 + 5000);
    });

    expect(screen.getByText("ไม่มีการใช้งานระบบเป็นเวลานาน")).toBeInTheDocument();
    expect(screen.getByText("ยังคงใช้งานต่อ")).toBeInTheDocument();
  });

  it("resets timeout and closes warning dialog when clicking 'ยังคงใช้งานต่อ'", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());

    renderComponent({
      timeoutMs: 30 * 60 * 1000,
      warningMs: 60 * 1000,
    });

    // Advance time into warning zone (29 mins)
    act(() => {
      vi.advanceTimersByTime(29 * 60 * 1000 + 5000);
    });

    expect(screen.getByText("ไม่มีการใช้งานระบบเป็นเวลานาน")).toBeInTheDocument();

    const stayBtn = screen.getByRole("button", { name: /ยังคงใช้งานต่อ/i });
    fireEvent.click(stayBtn);

    expect(screen.queryByText("ไม่มีการใช้งานระบบเป็นเวลานาน")).not.toBeInTheDocument();
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe((now + 29 * 60 * 1000 + 5000).toString());
  });

  it("auto-logs out if countdown expires without user action", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());

    renderComponent({
      timeoutMs: 30 * 60 * 1000,
      warningMs: 60 * 1000,
    });

    // Advance full 30 minutes
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000 + 1000);
    });

    expect(window.location.href).toContain("/sign-in?reason=timeout");
  });
});
