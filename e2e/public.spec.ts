import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow, triggerLocalSchedule } from "./helpers";

test.describe("public status page", () => {
  test.beforeEach(async ({ page }) => {
    await triggerLocalSchedule(page);
  });

  test("shows real checks, uptime, and expandable check history", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");

    await expect(page).toHaveTitle(/PulseLedger/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".service")).toHaveCount(11);
    await expect(page.locator(".project-group")).toHaveCount(6);
    await expect(page.getByRole("navigation", { name: "Jump to project" }).getByRole("link")).toHaveCount(6);
    await expect(page.getByRole("heading", { name: "CodeSense", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "StyleShopZ", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Haan website", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Haan API health", exact: true }),
    ).toBeVisible();

    // Both seeded services answered their real check, so no state may be unknown.
    await expect(page.locator(".service .state-unknown")).toHaveCount(0);
    await expect(page.locator(".service-strip .day")).toHaveCount(330);

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
    await expect(page.locator(".service")).toHaveCount(11);
    await expectNoHorizontalOverflow(page);

    const first = page.locator(".service").first();
    await first.getByRole("button", { name: "Details" }).click();
    await expect(first.locator(".service-detail")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("preserves anchor navigation offsets clear of the sticky masthead", async ({
    page,
  }) => {
    await page.goto("/");
    const mastheadBox = await page.locator(".masthead").boundingBox();
    const mastheadBottom = (mastheadBox?.y ?? 0) + (mastheadBox?.height ?? 0);

    // Test Launch Signal Probe CTA
    await page.locator(".jump-probe-btn").click();
    await page.waitForFunction(() => {
      return new Promise((resolve) => {
        let lastPos = window.scrollY;
        const check = () => {
          setTimeout(() => {
            if (Math.abs(window.scrollY - lastPos) < 2) resolve(true);
            else { lastPos = window.scrollY; check(); }
          }, 80);
        };
        check();
      });
    }, { timeout: 10000 });

    const probeBox = await page.locator("#probe").boundingBox();
    expect(probeBox).not.toBeNull();
    expect(probeBox!.y).toBeGreaterThanOrEqual(mastheadBottom);

    const headingBox = await page.locator("#probe-heading").boundingBox();
    expect(headingBox).not.toBeNull();
    expect(headingBox!.y).toBeGreaterThan(mastheadBottom + 10);
  });

  test("scroll choreography visibly transforms all chapters across scroll positions", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".service")).toHaveCount(11);

    const scrollToY = async (y: number) => {
      await page.evaluate((targetY) => {
        window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
        window.dispatchEvent(new Event("scroll"));
      }, y);
      await page.waitForTimeout(120);
    };

    const getChapterMetrics = async (selector: string) => {
      return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const style = window.getComputedStyle(el);
        return {
          progress: el.getAttribute("data-scroll-progress") ?? el.getAttribute("data-row-progress"),
          transform: style.transform,
          clipPath: style.clipPath,
          strokeDashoffset: style.strokeDashoffset,
          paperOffset: el.getAttribute("data-paper-offset"),
        };
      }, selector);
    };

    // 1. Hero & Chapter 1 (#services & .service row physical ledger strip unspooling)
    await scrollToY(0);
    const renderCountBefore = await page.evaluate(() =>
      Number(document.querySelector(".public-shell")?.getAttribute("data-render-count") ?? "0"),
    );

    // Verify bursting 10 raw scroll events in a single frame coalesces to 1 rAF update and 0 React rerenders
    const burstStats = await page.evaluate(async () => {
      const shell = document.querySelector(".public-shell");
      const beforeRaf = Number(shell?.getAttribute("data-raf-updates") ?? "0");
      const beforeRenders = Number(shell?.getAttribute("data-render-count") ?? "0");
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(new Event("scroll"));
      }
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(true)));
      const afterRaf = Number(shell?.getAttribute("data-raf-updates") ?? "0");
      const afterRenders = Number(shell?.getAttribute("data-render-count") ?? "0");
      return {
        rafDelta: afterRaf - beforeRaf,
        renderDelta: afterRenders - beforeRenders,
      };
    });
    expect(burstStats.rafDelta).toBe(1);
    expect(burstStats.renderDelta).toBe(0);

    const ch1Before = await getChapterMetrics("#services");
    const spoolFillBefore = await getChapterMetrics("#services-spool-fill");
    const spoolWheelBefore = await getChapterMetrics("#services-spool-wheel");
    const row4StripBefore = await getChapterMetrics(".service:nth-of-type(2) .uptime-strip");
    const targetRowSelector = "#project-2 .service:first-of-type .uptime-strip";
    const targetRowArticle = "#project-2 .service:first-of-type";
    const rowBefore = await getChapterMetrics(targetRowArticle);
    const stripBefore = await getChapterMetrics(targetRowSelector);
    const heroCarriageBefore = await getChapterMetrics("#hero-drum-carriage");

    const rowDocTop = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().top + window.scrollY : 900;
    }, targetRowArticle);

    await scrollToY(Math.max(500, rowDocTop - 180));

    const ch1After = await getChapterMetrics("#services");
    const spoolFillAfter = await getChapterMetrics("#services-spool-fill");
    const spoolWheelAfter = await getChapterMetrics("#services-spool-wheel");
    const rowAfter = await getChapterMetrics(targetRowArticle);
    const stripAfter = await getChapterMetrics(targetRowSelector);
    const heroCarriageAfter = await getChapterMetrics("#hero-drum-carriage");
    void row4StripBefore;

    expect(Number(ch1After?.progress) - Number(ch1Before?.progress)).toBeGreaterThan(0.5);
    expect(spoolFillAfter?.transform).not.toBe(spoolFillBefore?.transform);
    expect(spoolWheelAfter?.transform).not.toBe(spoolWheelBefore?.transform);
    expect(Number(rowAfter?.progress) - Number(rowBefore?.progress)).toBeGreaterThan(0.5);
    expect(stripAfter?.clipPath).not.toBe(stripBefore?.clipPath);
    expect(heroCarriageAfter?.transform).not.toBe(heroCarriageBefore?.transform);

    // 2. Chapter 2 (#probe — Scroll-Drawn Live Monitoring Timeline)
    const probeDocTop = await page.evaluate(() => {
      const el = document.getElementById("probe");
      return el ? el.getBoundingClientRect().top + window.scrollY : 3000;
    });
    const vh = await page.evaluate(() => window.innerHeight);

    await scrollToY(Math.max(0, probeDocTop - vh * 0.96));
    const ch2Before = await getChapterMetrics("#probe");
    const traceBefore = await getChapterMetrics("#timeline-svg-trace");
    const areaBefore = await getChapterMetrics("#timeline-area-group");
    const playheadBefore = await getChapterMetrics("#timeline-playhead-group");
    const chassisBefore = await getChapterMetrics("#probe-chassis-stage");

    await scrollToY(probeDocTop - 110);
    const ch2After = await getChapterMetrics("#probe");
    const traceAfter = await getChapterMetrics("#timeline-svg-trace");
    const areaAfter = await getChapterMetrics("#timeline-area-group");
    const playheadAfter = await getChapterMetrics("#timeline-playhead-group");
    const chassisAfter = await getChapterMetrics("#probe-chassis-stage");

    expect(Number(ch2After?.progress) - Number(ch2Before?.progress)).toBeGreaterThan(0.55);
    expect(parseFloat(traceBefore?.strokeDashoffset ?? "0") - parseFloat(traceAfter?.strokeDashoffset ?? "0")).toBeGreaterThan(550);
    expect(areaAfter?.clipPath).not.toBe(areaBefore?.clipPath);
    expect(playheadAfter?.transform).not.toBe(playheadBefore?.transform);
    expect(chassisAfter?.transform).not.toBe(chassisBefore?.transform);

    // 3. Chapter 3 (#incidents — Forensic Incident Broadsheet & Rotary Verification Seal)
    const incidentsDocTop = await page.evaluate(() => {
      const el = document.getElementById("incidents");
      return el ? el.getBoundingClientRect().top + window.scrollY : 4500;
    });

    await scrollToY(Math.max(0, incidentsDocTop - vh * 0.96));
    const ch3Before = await getChapterMetrics("#incidents");
    const sealRingBefore = await getChapterMetrics("#incident-seal-ring");
    const sealRotorBefore = await getChapterMetrics("#incident-seal-rotor");
    const spineBefore = await getChapterMetrics("#incident-spine-fill");
    const broadsheetBefore = await getChapterMetrics("#incident-broadsheet-panel");

    await scrollToY(incidentsDocTop - 100);
    const ch3After = await getChapterMetrics("#incidents");
    const sealRingAfter = await getChapterMetrics("#incident-seal-ring");
    const sealRotorAfter = await getChapterMetrics("#incident-seal-rotor");
    const spineAfter = await getChapterMetrics("#incident-spine-fill");
    const broadsheetAfter = await getChapterMetrics("#incident-broadsheet-panel");

    expect(Number(ch3After?.progress) - Number(ch3Before?.progress)).toBeGreaterThan(0.55);
    expect(parseFloat(sealRingBefore?.strokeDashoffset ?? "0") - parseFloat(sealRingAfter?.strokeDashoffset ?? "0")).toBeGreaterThan(550);
    expect(sealRotorAfter?.transform).not.toBe(sealRotorBefore?.transform);
    expect(spineAfter?.transform).not.toBe(spineBefore?.transform);
    expect(broadsheetAfter?.transform).not.toBe(broadsheetBefore?.transform);

    const sealProgressLabel = await page.locator("#incident-seal-progress-text").textContent();
    expect(sealProgressLabel).toMatch(/^SEAL DRAWN · \d+%$/);
    expect(sealProgressLabel).not.toContain("D1 VERIFIED");

    // 4. Chapter 4 (#method — Scroll-Wired Protocol Schematic)
    const methodDocTop = await page.evaluate(() => {
      const el = document.getElementById("method");
      return el ? el.getBoundingClientRect().top + window.scrollY : 5200;
    });

    await scrollToY(Math.max(0, methodDocTop - vh * 0.96));
    const ch4Before = await getChapterMetrics("#method");
    const busBefore = await getChapterMetrics("#method-bus-line");
    const carriageBefore = await getChapterMetrics("#method-signal-carriage");

    const maxScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    await scrollToY(maxScroll);
    const ch4After = await getChapterMetrics("#method");
    const busAfter = await getChapterMetrics("#method-bus-line");
    const carriageAfter = await getChapterMetrics("#method-signal-carriage");

    expect(Number(ch4After?.progress) - Number(ch4Before?.progress)).toBeGreaterThan(0.55);
    expect(parseFloat(busBefore?.strokeDashoffset ?? "0") - parseFloat(busAfter?.strokeDashoffset ?? "0")).toBeGreaterThan(550);
    expect(carriageAfter?.transform).not.toBe(carriageBefore?.transform);

    // Verify scrolling across the entire page caused 0 whole-page React rerenders
    const renderCountAfter = await page.evaluate(() =>
      Number(document.querySelector(".public-shell")?.getAttribute("data-render-count") ?? "0"),
    );
    expect(renderCountAfter).toBe(renderCountBefore);

    await expectNoHorizontalOverflow(page);
  });
});
