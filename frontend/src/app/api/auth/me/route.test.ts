import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const getSessionMock = vi.fn();
const headersMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

vi.mock("@/lib/auth", () => ({
  pool: {
    query: (...args: unknown[]) => queryMock(...args),
  },
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
  },
}));

describe("DELETE /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("rejects unsupported provider names", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://localhost:3000/api/auth/me?provider=facebook", { method: "DELETE" }),
    );
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("refuses to delete the user's only remaining login account", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ provider_id: "line" }] });

    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://localhost:3000/api/auth/me?provider=line", { method: "DELETE" }),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe("LAST_ACCOUNT");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("deletes existing LINE link when user has another login account", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ provider_id: "credential" }, { provider_id: "line" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://localhost:3000/api/auth/me?provider=line", { method: "DELETE" }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ status: true, provider: "line" });
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      `DELETE FROM "account" WHERE user_id = $1 AND provider_id = $2`,
      ["user-1", "line"],
    );
  });
});
