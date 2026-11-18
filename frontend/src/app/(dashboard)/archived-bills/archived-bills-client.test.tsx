import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArchivedBillsClient } from "./archived-bills-client";
import type {
  ArchivedBillItem,
  BillDeletionLogItem,
} from "@/server/actions/bills";

const restoreMock = vi.fn();
const purgeMock = vi.fn();

vi.mock("@/server/actions/bills", () => ({
  restoreArchivedBill: (...args: unknown[]) => restoreMock(...args),
  permanentlyDeleteArchivedBill: (...args: unknown[]) => purgeMock(...args),
}));

const mockArchived: ArchivedBillItem[] = [
  {
    id: "bill-arch-1",
    billCode: "BILL-2569-001",
    departmentId: "dept-1",
    departmentName: "กองบริหารการคลัง",
    departmentShortName: "กบค.",
    departmentCostCenter: "0700600001",
    departmentType: "central",
    utilityType: "ค่าไฟฟ้า",
    billingMonth: 10,
    billingYear: 2569,
    provider: "การไฟฟ้านครหลวง",
    serviceNumber: "02-562-0600",
    invoiceNumber: "INV-2569-888",
    invoiceAmount: 12500.5,
    paymentStatus: "PAID",
    billData: {
      invoice_status: "RECEIVED",
      invoice_number: "INV-2569-888",
      invoice_date: "2026-10-05T00:00:00Z",
      received_date: "2026-10-07T00:00:00Z",
      paid_amount: 12500.5,
      payment_doc_number: "PAY-69-009",
      attachment_invoice: "/uploads/invoice-2569-001.pdf",
      attachment_receipt: "/uploads/receipt-2569-001.pdf",
      service_breakdown: JSON.stringify({ "02-562-0600": 12500.5 }),
    },
    archivedBy: "u-1",
    archivedByName: "เจ้าหน้าที่ทดสอบ",
    archiveReason: "บันทึกข้อมูลผิดพลาด",
    archivedAt: "2026-11-18T08:00:00Z",
  },
];

const mockLogs: BillDeletionLogItem[] = [
  {
    id: "log-1",
    billId: "bill-arch-1",
    billCode: "BILL-2569-001",
    departmentId: "dept-1",
    departmentName: "กองบริหารการคลัง",
    utilityType: "ค่าไฟฟ้า",
    serviceNumber: "02-562-0600",
    billingMonth: 10,
    billingYear: 2569,
    invoiceAmount: 12500.5,
    action: "ARCHIVED",
    reason: "บันทึกข้อมูลผิดพลาด",
    performedBy: "u-1",
    performedByName: "เจ้าหน้าที่ทดสอบ",
    createdAt: "2026-11-18T08:00:00Z",
  },
];

describe("ArchivedBillsClient", () => {
  const onRefreshMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays duplicate conflict alert when restore returns 409 conflict error", async () => {
    const user = userEvent.setup();
    restoreMock.mockResolvedValue({
      success: false,
      error:
        "ไม่สามารถกู้คืนได้: หมายเลข 02-562-0600 ประจำเดือน 10/2569 มีบิลอยู่ในระบบปัจจุบันแล้ว (รหัสบิล: BILL-2569-099)",
    });

    render(
      <ArchivedBillsClient
        archivedBills={mockArchived}
        deletionLogs={mockLogs}
        canManage={true}
        onRefresh={onRefreshMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "กู้คืน" }));

    await waitFor(() => {
      expect(restoreMock).toHaveBeenCalledWith("bill-arch-1");
      expect(screen.getByRole("alert")).toHaveTextContent("BILL-2569-099");
    });
    expect(onRefreshMock).not.toHaveBeenCalled();
  });

  it("restores archived bill cleanly when no duplicate exists", async () => {
    const user = userEvent.setup();
    restoreMock.mockResolvedValue({ success: true, billCode: "BILL-2569-001" });

    render(
      <ArchivedBillsClient
        archivedBills={mockArchived}
        deletionLogs={mockLogs}
        canManage={true}
        onRefresh={onRefreshMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "กู้คืน" }));

    await waitFor(() => {
      expect(restoreMock).toHaveBeenCalledWith("bill-arch-1");
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it("opens permanent delete dialog, submits reason, and displays deletion logs tab", async () => {
    const user = userEvent.setup();
    purgeMock.mockResolvedValue({ success: true });

    render(
      <ArchivedBillsClient
        archivedBills={mockArchived}
        deletionLogs={mockLogs}
        canManage={true}
        onRefresh={onRefreshMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ลบถาวร" }));
    expect(
      screen.getByText("ยืนยันการลบรายการบิลถาวร?"),
    ).toBeInTheDocument();

    const reasonInput = screen.getByLabelText(/เหตุผลการลบถาวร/);
    await user.type(reasonInput, "ยืนยันลบบิลทดสอบ");
    await user.click(screen.getByRole("button", { name: "ยืนยันลบถาวร" }));

    await waitFor(() => {
      expect(purgeMock).toHaveBeenCalledWith(
        "bill-arch-1",
        "ยืนยันลบบิลทดสอบ",
      );
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });

    // Switch to deletion logs tab
    await user.click(screen.getByRole("button", { name: /ประวัติการลบ/ }));
    expect(screen.getByText("ย้ายไปเก็บถาวร")).toBeInTheDocument();
  });

  it("opens bill detail dialog and renders clickable attachment links even for view-only users", async () => {
    const user = userEvent.setup();

    render(
      <ArchivedBillsClient
        archivedBills={mockArchived}
        deletionLogs={mockLogs}
        canManage={false}
        onRefresh={onRefreshMock}
      />,
    );

    // View-only user should not see Restore / Permanent Delete buttons, but CAN view details
    expect(
      screen.queryByRole("button", { name: "กู้คืน" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ลบถาวร" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ดูรายละเอียด" }));

    expect(
      screen.getByText("รายละเอียดรายการค่าใช้จ่าย"),
    ).toBeInTheDocument();
    expect(screen.getByText("INV-2569-888")).toBeInTheDocument();
    expect(screen.getByText("PAY-69-009")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "รายละเอียด" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "ประวัติการทำรายการ" }),
    ).toBeInTheDocument();

    const fileLinks = screen.getAllByRole("link", { name: /ดูไฟล์เอกสาร/ });
    expect(fileLinks).toHaveLength(2);
    expect(fileLinks[0]).toHaveAttribute(
      "href",
      "/uploads/invoice-2569-001.pdf",
    );
    expect(fileLinks[0]).toHaveAttribute("target", "_blank");
    expect(fileLinks[1]).toHaveAttribute(
      "href",
      "/uploads/receipt-2569-001.pdf",
    );
    expect(fileLinks[1]).toHaveAttribute("target", "_blank");

    // Verify history tab inside modal
    await user.click(screen.getByRole("tab", { name: "ประวัติการทำรายการ" }));
    expect(screen.getByText("ย้ายไปเก็บถาวร")).toBeInTheDocument();
  });
});
