import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationList } from "./notification-list";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { NotificationDTO } from "@/lib/api/generated/model";

// Mock the API hooks
const mutateMock = vi.fn();
const mutateAllMock = vi.fn();
vi.mock("@/lib/api/generated/notifications/notifications", () => ({
  useMarkNotificationRead: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutate: mutateAllMock,
    isPending: false,
  }),
  getListNotificationsQueryKey: () => ["/api/notifications"],
  getGetNotificationCountsQueryKey: () => ["/api/notifications/counts"],
}));

const mockNotifications: NotificationDTO[] = [
  {
    id: "notif-1",
    title: "แจ้งเตือนหนี้ค้างชำระ",
    message: "บิลค่าไฟฟ้าประจำเดือนตุลาคมยังไม่ได้ชำระเงิน",
    severity: "URGENT",
    isRead: false,
    createdAt: "2026-10-25T10:00:00Z",
    type: "PENDING_BILL",
  },
  {
    id: "notif-2",
    title: "บิลค่าน้ำประปาเกินกำหนด",
    message: "กรุณาตรวจสอบการเบิกจ่าย",
    severity: "WARNING",
    isRead: true,
    createdAt: "2026-10-20T10:00:00Z",
    type: "LATE_PAYMENT",
  },
  {
    id: "notif-3",
    title: "บิลที่พบข้อสังเกตได้รับการแก้ไขแล้ว (รอตรวจสอบใหม่)",
    message: "บิลได้รับการแก้ไขแล้ว กรุณาตรวจสอบใหม่",
    severity: "INFO",
    isRead: false,
    createdAt: "2026-10-26T10:00:00Z",
    type: "MANUAL_ANOMALY_EDITED",
  },
  {
    id: "notif-4",
    title: "บิลที่พบข้อสังเกตได้รับการแก้ไขแล้ว (รอตรวจสอบใหม่)",
    message: "บิลได้รับการแก้ไขแล้ว",
    severity: "INFO",
    isRead: true,
    createdAt: "2026-10-26T11:00:00Z",
    type: "MANUAL_ANOMALY_EDITED",
    acknowledgedBy: "สมชาย ผู้ตรวจสอบ",
  },
];

describe("NotificationList Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <NotificationList
          notifications={mockNotifications}
          showAcknowledgeButton={true}
          showDepartmentBadge={true}
          {...props}
        />
      </QueryClientProvider>,
    );
  };

  it("renders notifications and displays read status correctly", () => {
    renderComponent();

    expect(screen.getByText("แจ้งเตือนหนี้ค้างชำระ")).toBeInTheDocument();
    expect(screen.getByText("บิลค่าน้ำประปาเกินกำหนด")).toBeInTheDocument();
    expect(screen.getByText("อ่านแล้ว")).toBeInTheDocument();
    expect(screen.getByText("รับทราบแล้ว โดย สมชาย ผู้ตรวจสอบ")).toBeInTheDocument();
  });

  it("calls mutate with id when clicking รับทราบ directly", async () => {
    const user = userEvent.setup();
    renderComponent({ showAcknowledgeButton: true });

    // Buttons with "รับทราบ"
    const ackButtons = screen.getAllByRole("button", { name: "รับทราบ" });
    expect(ackButtons.length).toBeGreaterThan(0);

    await user.click(ackButtons[0]);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith({ id: "notif-1" });
  });

  it("in all-notifications (showAcknowledgeButton=false), only MANUAL_ANOMALY_EDITED has the รับทราบ button", async () => {
    const user = userEvent.setup();
    renderComponent({ showAcknowledgeButton: false, scope: "all" });

    // Only 1 unread MANUAL_ANOMALY_EDITED (notif-3) should have the "รับทราบ" button
    const ackButtons = screen.getAllByRole("button", { name: "รับทราบ" });
    expect(ackButtons.length).toBe(1);

    await user.click(ackButtons[0]);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith({ id: "notif-3" });
  });
});
