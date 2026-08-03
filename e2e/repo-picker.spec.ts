import { test, expect } from "@playwright/test";

test.describe("repo picker (web mode)", () => {
  test("Repo button opens a modal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("WikiTicket UI").first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Repo" }).click();
    // Modal has no role=dialog yet — assert on its heading + Recent section.
    await expect(page.getByRole("heading", { name: "Repo" })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Recent")).toBeVisible();
    await expect(page.getByText(/Active repo is set at server launch/i)).toBeVisible();
  });
});
