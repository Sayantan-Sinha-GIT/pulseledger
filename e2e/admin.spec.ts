import { test, expect } from "@playwright/test";
import {
  OWNER_EMAIL,
  expectNoHorizontalOverflow,
  ownerPassword,
  signIn,
} from "./helpers";

test.describe("owner access", () => {
  test("rejects a wrong password, signs in, and signs out", async ({
    page,
  }) => {
    const password = ownerPassword();
    test.skip(!password, "Owner credentials file is not present.");

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Sign in to the operations desk." }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(OWNER_EMAIL);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Email or password is incorrect.",
    );

    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Operations at a glance." }),
    ).toBeVisible();
    await expect(page.locator(".admin-email")).toHaveText(OWNER_EMAIL);
    await expect(
      page.getByRole("link", { name: "Monitors", exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "Monitors", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Decide what gets checked." }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Sign in to the operations desk." }),
    ).toBeVisible();

    // The protected page must stay closed after a full reload.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Sign in to the operations desk." }),
    ).toBeVisible();
  });

  test("keeps the owner desk usable at the current viewport", async ({
    page,
  }) => {
    test.skip(!ownerPassword(), "Owner credentials file is not present.");
    await signIn(page);
    for (const path of [
      "/admin",
      "/admin/monitors",
      "/admin/incidents",
      "/admin/audit",
    ]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  });
});
