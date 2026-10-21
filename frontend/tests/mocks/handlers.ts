import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("*/api/health", () => {
    return HttpResponse.json({ status: "ok", time: new Date().toISOString() });
  }),
  http.get("*/api/departments", () => {
    return HttpResponse.json([
      {
        id: "dept-1",
        code: "D001",
        name: "สำนักบริหารกลาง",
        costCenterCode: "2500300055",
      },
    ]);
  }),
];
