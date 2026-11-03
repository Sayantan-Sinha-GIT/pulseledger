#!/usr/bin/env node
/**
 * Captures README screenshots from a running deployment.
 * Usage: node scripts/capture-screenshots.mjs [baseUrl]
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baseURL = process.argv[2] ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:8787";
const output = resolve(root, "docs", "screenshots");
mkdirSync(output, { recursive: true });

function ownerPassword() {
  if (process.env.E2E_OWNER_PASSWORD) return process.env.E2E_OWNER_PASSWORD;
  const text = readFileSync(resolve(root, "secrets/owner-credentials.txt"), "utf8");
  return text.match(/^Password:\s*(.+)$/m)?.[1]?.trim() ?? null;
}

const browser = await chromium.launch();

async function publicPage(name, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForSelector(".service");
  await page.screenshot({ path: resolve(output, `public-status-${name}.png`), fullPage: true });
  await context.close();
}

async function adminPage(name, contextOptions) {
  const password = ownerPassword();
  if (!password) {
    console.warn("Owner credentials unavailable; skipping admin screenshots.");
    return;
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  
  // 1. Capture Login Screen
  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
  await page.getByLabel("Password").waitFor();
  await page.screenshot({ path: resolve(output, `admin-login-${name}.png`), fullPage: true });

  // 2. Sign In to Overview
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { name: "Operations at a glance." }).waitFor();
  await page.getByRole("region", { name: "Owner summary" }).waitFor();
  await page.screenshot({ path: resolve(output, `admin-overview-${name}.png`), fullPage: true });

  // 3. Capture Monitors Screen
  await page.goto(`${baseURL}/admin/monitors`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Decide what gets checked." }).waitFor();
  await page.screenshot({ path: resolve(output, `admin-monitors-${name}.png`), fullPage: true });

  // 4. Capture Incidents Screen
  await page.goto(`${baseURL}/admin/incidents`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Write the record while it happens." }).waitFor();
  await page.screenshot({ path: resolve(output, `admin-incidents-${name}.png`), fullPage: true });

  // 5. Capture Activity Screen
  await page.goto(`${baseURL}/admin/audit`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Who changed what." }).waitFor();
  await page.screenshot({ path: resolve(output, `admin-audit-${name}.png`), fullPage: true });

  // Sign out cleanly
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Password").waitFor();
  await context.close();
}

await publicPage("desktop", {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
});
await publicPage("mobile", { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
await adminPage("desktop", {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
});
await adminPage("mobile", { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });

await browser.close();
console.log(`Screenshots written to ${output}`);
