import { expect, test } from "@playwright/test";

test.describe("Smoke Test - UMS Frontend", () => {
  test("navigates to sign-in or main page", async ({ page }) => {
    const response = await page.goto("/sign-in");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });
});
