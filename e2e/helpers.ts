import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

export const OWNER_EMAIL = "srimantasutapa123@gmail.com";

/** Reads the generated owner password without ever logging it. */
export function ownerPassword(): string | null {
  if (process.env.E2E_OWNER_PASSWORD) return process.env.E2E_OWNER_PASSWORD;
  try {
    const text = readFileSync(
      resolve(process.cwd(), "secrets/owner-credentials.txt"),
      "utf8",
    );
    const match = text.match(/^Password:\s*(.+)$/m);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function signIn(page: Page): Promise<void> {
  const password = ownerPassword();
  if (!password) throw new Error("Owner credentials are unavailable.");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Sign in to the operations desk." }),
  ).toBeVisible();
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Operations at a glance." }),
  ).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(
    sizes.scrollWidth,
    `document scrollWidth ${sizes.scrollWidth} should fit clientWidth ${sizes.clientWidth}`,
  ).toBeLessThanOrEqual(sizes.clientWidth + 1);
  expect(sizes.bodyScrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
}

/** Saves a real, full-page screenshot used by the README. */
export async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (process.env.E2E_SKIP_SCREENSHOTS === "1") return;
  const path = resolve(
    process.cwd(),
    "docs",
    "screenshots",
    `${name}-${testInfo.project.name}.png`,
  );
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: true });
}

/** Local-only: ask the dev server to run the real scheduled handler once. */
export async function triggerLocalSchedule(page: Page): Promise<void> {
  if (process.env.E2E_BASE_URL) return;
  const response = await page.request.get("/cdn-cgi/local/scheduled");
  expect(response.ok()).toBe(true);
}
