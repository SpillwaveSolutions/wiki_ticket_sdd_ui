import { test, expect } from "@playwright/test";

/** Console noise that is expected in dev and would otherwise fail every run. */
const IGNORED = [/favicon/i, /\[vite\] connect/i, /Download the React DevTools/i];

function collectErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (!IGNORED.some((re) => re.test(text))) errors.push(`console: ${text}`);
  });
  return errors;
}

test.describe("WikiTicket UI web smoke", () => {
  test("shell renders with brand and nav", async ({ page }) => {
    const errors = collectErrors(page);

    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByText("WikiTicket UI").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Board" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Repo" })).toBeVisible();

    expect(errors, `console/page errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("fixture repo key appears in the top bar", async ({ page }) => {
    await page.goto("/");
    // Fixture project name from server/test/fixture.ts
    await expect(page.getByText("Fixture Project").or(page.getByText("FIX"))).toBeVisible({
      timeout: 15_000,
    });
  });
});
