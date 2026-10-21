import { describe, expect, it } from "vitest";

describe("MSW Mock Service Worker Integration", () => {
  it("intercepts GET /api/health and returns mocked status", async () => {
    const res = await fetch("http://localhost:8080/api/health");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.time).toBeDefined();
  });

  it("intercepts GET /api/departments and returns mock department list", async () => {
    const res = await fetch("http://localhost:8080/api/departments");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("สำนักบริหารกลาง");
  });
});
