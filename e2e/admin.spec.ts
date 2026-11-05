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

  test("maintains readable responsive layout on /admin across viewports without heading collisions or strip wrapping", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1440, height: 900, name: "desktop" },
      { width: 390, height: 844, name: "phone-390" },
      { width: 320, height: 568, name: "phone-320" },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/admin");

      const intro = page.locator(".login-intro");
      const h1 = page.locator(".login-intro h1");
      const eyebrow = page.locator(".login-intro .eyebrow");
      const wordmark = page.locator(".wordmark");
      const badge = page.locator(".telemetry-badge");
      const form = page.locator(".login-form");

      await expect(intro).toBeVisible();
      await expect(h1).toBeVisible();
      await expect(eyebrow).toBeVisible();
      await expect(wordmark).toBeVisible();
      await expect(badge).toBeVisible();
      await expect(form).toBeVisible();

      const introBox = (await intro.boundingBox())!;
      const h1Box = (await h1.boundingBox())!;
      const eyebrowBox = (await eyebrow.boundingBox())!;
      const wordmarkBox = (await wordmark.boundingBox())!;
      const badgeBox = (await badge.boundingBox())!;

      // Intro and heading must have readable width, never squished into a 0px or 20px character strip
      const minExpectedWidth = viewport.width <= 360 ? 250 : viewport.width <= 420 ? 300 : 450;
      expect(introBox.width).toBeGreaterThanOrEqual(minExpectedWidth);
      expect(h1Box.width).toBeGreaterThanOrEqual(minExpectedWidth - 30);
      expect(eyebrowBox.width).toBeGreaterThanOrEqual(140);

      // Height should reflect readable 2-4 lines of text, not a 1000px+ vertical single-character column
      expect(h1Box.height).toBeLessThan(250);
      expect(eyebrowBox.height).toBeLessThan(60);

      // Wordmark and telemetry badge must not overlap
      const hasHorizontalGap =
        badgeBox.x >= wordmarkBox.x + wordmarkBox.width - 1 ||
        wordmarkBox.x >= badgeBox.x + badgeBox.width - 1;
      const hasVerticalSeparation =
        badgeBox.y >= wordmarkBox.y + wordmarkBox.height - 1 ||
        wordmarkBox.y >= badgeBox.y + badgeBox.height - 1;
      expect(
        hasHorizontalGap || hasVerticalSeparation,
        `Wordmark (${wordmarkBox.x}, ${wordmarkBox.y}, ${wordmarkBox.width}x${wordmarkBox.height}) and telemetry badge (${badgeBox.x}, ${badgeBox.y}, ${badgeBox.width}x${badgeBox.height}) must not collide`,
      ).toBe(true);

      await expectNoHorizontalOverflow(page);
    }
  });

  test("audits authenticated owner routes for no unscoped public style leakage", async ({
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
      await expect(page.locator(".admin-header")).toBeVisible();
      await expect(page.locator(".admin-page")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Verify that sections do NOT have the unscoped public padding (clamp(80px, 12vw, 160px))
      const sectionStyles = await page.evaluate(() => {
        const adminPage = document.querySelector(".admin-page");
        const panel = document.querySelector(".panel");
        const header = document.querySelector(".admin-header");
        return {
          adminPagePaddingTop: adminPage ? window.getComputedStyle(adminPage).paddingTop : null,
          panelPaddingTop: panel ? window.getComputedStyle(panel).paddingTop : null,
          headerPosition: header ? window.getComputedStyle(header).position : null,
        };
      });

      // Admin header should be sticky, NOT fixed from public header rule
      expect(sectionStyles.headerPosition).toBe("sticky");

      // Panels should have their own compact padding (<= 32px), not public clamp(80px-160px)
      if (sectionStyles.panelPaddingTop) {
        const topPx = parseFloat(sectionStyles.panelPaddingTop);
        expect(topPx).toBeLessThanOrEqual(40);
      }
    }
  });
});
