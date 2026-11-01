import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("owner monitor and incident lifecycle", () => {
  test("creates, checks, edits, pauses, and removes a monitor", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One destructive flow is enough.");
    await signIn(page);

    await page.goto("/admin/monitors");
    await expect(
      page.getByRole("heading", { name: "Decide what gets checked." }),
    ).toBeVisible();

    const name = "[E2E] Example service";
    const renamed = "[E2E] Example service edited";

    const addPanel = page.locator("section[aria-labelledby='add-monitor']");
    await addPanel.getByLabel("Name").fill(name);
    await addPanel.getByLabel("URL").fill("https://example.com/");
    await addPanel.getByLabel("Success rule").selectOption("2xx_3xx");
    await addPanel.getByRole("button", { name: "Add monitor" }).click();
    await expect(page.getByRole("status")).toContainText("Monitor added");
    await expect(page.getByRole("heading", { name })).toBeVisible();

    const card = page
      .locator("article.monitor-card")
      .filter({ has: page.getByRole("heading", { name }) });

    // A manual check uses the same real check path as the scheduler.
    await card.getByRole("button", { name: "Check now" }).click();
    await expect(page.getByRole("status")).toContainText(`${name}:`, {
      timeout: 30_000,
    });

    await card.getByRole("button", { name: "Edit" }).click();
    const editForm = card.locator("form.inline-edit");
    await editForm.getByLabel("Name").fill(renamed);
    await editForm.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("Monitor updated.");
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();

    const editedCard = page
      .locator("article.monitor-card")
      .filter({ has: page.getByRole("heading", { name: renamed }) });

    await editedCard.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("status")).toContainText("paused.");
    await expect(editedCard.locator(".state")).toContainText("paused");
    await editedCard.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("status")).toContainText("resumed.");

    await editedCard.getByRole("button", { name: "Check log" }).click();
    await expect(editedCard.locator("table.data-table")).toBeVisible();
    await expect(editedCard.locator("table tbody tr").first()).toContainText("manual");

    // Destructive removal must be confirmed, and cancel must be safe.
    await editedCard.getByRole("button", { name: "Remove" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(renamed);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();

    await editedCard.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove monitor" }).click();
    await expect(page.getByRole("status")).toContainText("removed.");
    await expect(page.getByRole("heading", { name: renamed })).toBeHidden();
  });

  test("opens, updates, and resolves an incident visible to visitors", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One destructive flow is enough.");
    await signIn(page);

    const title = `[E2E] Verification incident ${Date.now()}`;
    await page.goto("/admin/incidents");
    const panel = page.locator("section[aria-labelledby='open-incident']");
    await panel.getByLabel("Title").fill(title);
    await panel.getByLabel("Severity").selectOption("major");
    await panel.getByLabel("Opening status").selectOption("investigating");
    await panel
      .getByLabel("Affected monitor (optional)")
      .selectOption({ label: "Haan API health" });
    await panel
      .getByLabel("First update")
      .fill("The E2E flow opened this incident to verify the public record.");
    await panel.getByRole("button", { name: "Open incident" }).click();
    await expect(page.getByRole("status")).toContainText("Incident opened");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    const incident = page
      .locator("article.incident")
      .filter({ has: page.getByRole("heading", { name: title }) });
    await expect(incident.locator(".incident-status").first()).toContainText(
      "investigating",
    );

    await incident.getByLabel("Status").selectOption("monitoring");
    await incident
      .getByLabel("Update")
      .fill("Monitoring the service after the first E2E update.");
    await incident.getByRole("button", { name: "Publish update" }).click();
    await expect(page.getByRole("status")).toContainText("Incident update published.");
    await expect(incident.locator(".incident-status").first()).toContainText("monitoring");

    const updated = page
      .locator("article.incident")
      .filter({ has: page.getByRole("heading", { name: title }) });
    await updated.getByLabel("Status").selectOption("resolved");
    await updated
      .getByLabel("Update")
      .fill("Resolved by the E2E verification flow. No production impact.");
    await updated.getByRole("button", { name: "Publish update" }).click();
    await expect(page.getByRole("status")).toContainText("Incident resolved.");

    // Visitors see the incident title, severity, resolution, and latest update.
    await page.goto("/");
    const publicIncident = page
      .locator("article.incident")
      .filter({ has: page.getByRole("heading", { name: title }) });
    await expect(publicIncident).toBeVisible();
    await expect(publicIncident.locator(".severity")).toHaveText("major");
    await expect(publicIncident.locator(".incident-status").first()).toHaveText(
      "resolved",
    );
    await expect(publicIncident).toContainText(
      "Resolved by the E2E verification flow. No production impact.",
    );
    await expect(publicIncident).toContainText("Haan API health");

    // The audit trail records the lifecycle without any secret material.
    await page.goto("/admin/audit");
    await expect(
      page.getByText("incident resolved", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("incident opened", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("monitor created", { exact: true }).first(),
    ).toBeVisible();
  });
});
