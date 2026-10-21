import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

// Start MSW mock server before all tests
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});

// Reset handlers and cleanup DOM after each test
afterEach(() => {
  server.resetHandlers();
  cleanup();
});

// Close MSW mock server after all tests
afterAll(() => {
  server.close();
});
