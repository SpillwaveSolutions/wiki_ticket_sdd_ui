#!/usr/bin/env node
/**
 * Lightweight headless load + screenshot.
 * Exit 0 on success, 1 on navigation failure, 2 if console/page errors.
 *
 * Usage:
 *   node scripts/browser-smoke.mjs [url] [out.png]
 *   npm run smoke
 *
 * Default URL comes from scripts/dev-ports.mjs --peek --url.
 * Screenshots land under .artifacts/ (gitignored) so agents can Read them
 * without overwriting committed product art under docs/images/ or screenshots/.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function defaultUrl() {
  try {
    return execFileSync(process.execPath, [join(ROOT, "scripts/dev-ports.mjs"), "--peek", "--url"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "http://127.0.0.1:8080/";
  }
}

const url = process.argv[2] || defaultUrl();
const outPng = process.argv[3] || join(ROOT, ".artifacts/smoke.png");
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45000);

mkdirSync(dirname(outPng), { recursive: true });

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));

  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
  const status = resp?.status() ?? 0;
  await page.waitForTimeout(1000);

  const title = await page.title();
  const bodyTextLen = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).trim().length;

  await page.screenshot({ path: outPng, fullPage: false });

  console.log(
    JSON.stringify(
      {
        url,
        status,
        title,
        bodyTextLen,
        consoleErrors,
        pageErrors,
        screenshot: outPng,
      },
      null,
      2,
    ),
  );

  if (status >= 400 || status === 0) process.exit(1);
  if (pageErrors.length || consoleErrors.length) process.exit(2);
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ ok: false, url, error: String(err?.message || err) }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
