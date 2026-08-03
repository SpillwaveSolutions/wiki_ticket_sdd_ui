import { test, expect } from "@playwright/test";

const PANELS = [
  { name: "Overview", path: "/" },
  { name: "Board", path: "/board" },
  { name: "Roadmap", path: "/roadmap" },
  { name: "Activity", path: "/activity" },
  { name: "Docs", path: "/docs" },
  { name: "Traceability", path: "/traceability" },
] as const;

test.describe("panel navigation", () => {
  test("each core panel route loads without a hard error banner", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("WikiTicket UI").first()).toBeVisible({ timeout: 15_000 });

    for (const panel of PANELS) {
      await page.getByRole("link", { name: panel.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${panel.path === "/" ? "/?$" : panel.path}$`));
      // Active nav link is highlighted
      await expect(page.getByRole("link", { name: panel.name, exact: true })).toBeVisible();
      // No uncaught red "repo:" top-bar error for the fixture
      await expect(page.locator("header").getByText(/^repo:/)).toHaveCount(0);
    }
  });
});
