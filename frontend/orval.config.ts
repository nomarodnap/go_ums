import { defineConfig } from "orval";

export default defineConfig({
  umsApi: {
    input: {
      target: "../backend/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "src/lib/api/generated",
      schemas: "src/lib/api/generated/model",
      client: "react-query",
      mock: false,
      override: {
        mutator: {
          path: "src/lib/api/custom-instance.ts",
          name: "customInstance",
        },
      },
    },
  },
});
