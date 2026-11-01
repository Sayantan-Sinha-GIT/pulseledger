import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow, triggerLocalSchedule } from "./helpers";

test.describe("public status page", () => {
  test.beforeEach(async ({ page }) => {
    await triggerLocalSchedule(page);
  });

  test("shows real checks, uptime, and expandable check history", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/PulseLedger/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".service")).toHaveCount(2);
    await expect(
      page.getByRole("heading", { name: "Haan website", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Haan API health", exact: true }),
    ).toBeVisible();

    // Both seeded services answered their real check, so no state may be unknown.
    await expect(page.locator(".service .state-unknown")).toHaveCount(0);
    await expect(page.locator(".service-strip .day")).toHaveCount(60);

    // Last-check text must describe a recorded result, not a placeholder.
    const service = page.locator(".service").first();
    await expect(service.locator("dl.service-stats")).toContainText("Last check");
    await expect(service.locator("dl.service-stats")).not.toContainText(
      "No completed check yet",
    );

    await service.getByRole("button", { name: "Details" }).click();
    await expect(service.locator(".service-detail")).toBeVisible();
    await expect(service.getByRole("table")).toBeVisible();
    await expect(service.locator("table tbody tr").first()).toContainText(/Up|Down/);

    await expectNoHorizontalOverflow(page);
  });

  test("refreshes on demand and announces the update", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Refresh now" })).toBeVisible();
    await expect(page.locator(".updated-note")).not.toHaveText("Not updated yet");

    await page.getByRole("button", { name: "Refresh now" }).click();
    await expect(page.locator(".sr-only[aria-live='polite']")).toContainText(
      "Status updated at",
    );
  });

  test("keeps keyboard navigation and semantics usable", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to status" });
    await expect(skipLink).toBeFocused();

    await expect(page.locator("main#main")).toBeVisible();
    await expect(page.locator("nav[aria-label='Primary']")).toBeVisible();
    await expect(page.getByRole("link", { name: "Owner sign in" })).toBeVisible();

    // The method legend names all six distinct monitor states.
    const legend = page.locator(".state-legend");
    for (const label of [
      "Operational",
      "Degraded",
      "Down",
      "Incident active",
      "Paused",
      "Unknown",
    ]) {
      await expect(legend.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("fits the current viewport without horizontal scrolling", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".service")).toHaveCount(2);
    await expectNoHorizontalOverflow(page);

    const first = page.locator(".service").first();
    await first.getByRole("button", { name: "Details" }).click();
    await expect(first.locator(".service-detail")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
