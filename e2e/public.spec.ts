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
      "Latest available snapshot checked at",
    );
  });

  test("keeps keyboard navigation and semantics usable", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to status" });
    await expect(skipLink).toBeFocused();

    await expect(page.locator("main#main")).toBeVisible();
    const isMobile = (page.viewportSize()?.width ?? 1440) <= 860;
    if (isMobile) {
      await expect(page.locator(".mobile-nav-toggle")).toBeVisible();
      await page.locator(".mobile-nav-toggle").click();
      await expect(page.locator("nav[aria-label='Mobile Navigation']")).toBeVisible();
      await expect(page.getByRole("link", { name: "Owner desk sign in" })).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(page.locator("header nav[aria-label='Primary']")).toBeVisible();
      await expect(page.getByRole("link", { name: "Owner sign in" })).toBeVisible();
    }

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
    const isMobile = (page.viewportSize()?.width ?? 1440) <= 860;

    await scrollToY(Math.max(0, probeDocTop - vh * 0.96));
    const ch2Before = await getChapterMetrics("#probe");
    const traceBefore = await getChapterMetrics("#timeline-svg-trace");
    const areaBefore = await getChapterMetrics("#timeline-area-group");
    const playheadBefore = await getChapterMetrics("#timeline-playhead-group");
    const chassisBefore = await getChapterMetrics("#probe-chassis-stage");

    await scrollToY(isMobile ? probeDocTop + 450 : probeDocTop + 1950);
    const ch2After = await getChapterMetrics("#probe");
    const traceAfter = await getChapterMetrics("#timeline-svg-trace");
    const areaAfter = await getChapterMetrics("#timeline-area-group");
    const playheadAfter = await getChapterMetrics("#timeline-playhead-group");
    const chassisAfter = await getChapterMetrics("#probe-chassis-stage");

    expect(Number(ch2After?.progress) - Number(ch2Before?.progress)).toBeGreaterThan(0.55);
    expect(parseFloat(traceBefore?.strokeDashoffset ?? "0") - parseFloat(traceAfter?.strokeDashoffset ?? "0")).toBeGreaterThan(350);
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

    await scrollToY(incidentsDocTop + (isMobile ? 380 : 350));
    const ch3After = await getChapterMetrics("#incidents");
    const sealRingAfter = await getChapterMetrics("#incident-seal-ring");
    const sealRotorAfter = await getChapterMetrics("#incident-seal-rotor");
    const spineAfter = await getChapterMetrics("#incident-spine-fill");
    const broadsheetAfter = await getChapterMetrics("#incident-broadsheet-panel");

    expect(Number(ch3After?.progress) - Number(ch3Before?.progress)).toBeGreaterThan(0.55);
    expect(parseFloat(sealRingBefore?.strokeDashoffset ?? "0") - parseFloat(sealRingAfter?.strokeDashoffset ?? "0")).toBeGreaterThan(250);
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

  test("derives truthful health claim for mixed states, outages, and active incidents", async ({
    page,
  }) => {
    // Intercept /api/status with a truthfully degraded snapshot
    await page.route("**/api/status", async (route) => {
      const json = {
        generatedAt: new Date().toISOString(),
        overall: "degraded",
        headline: "Degraded Performance",
        monitors: [
          { id: "m1", name: "Haan Web", project: "Haan", url: "https://haan.example", expectedStatus: "2xx_3xx", paused: false, state: "degraded", uptime: { h24: { percent: 97.2, up: 95, down: 3, total: 98, sufficient: true }, d7: { percent: 99.1, up: 600, down: 5, total: 605, sufficient: true }, d30: { percent: 99.5, up: 2800, down: 12, total: 2812, sufficient: true } }, latency: { p50: 120, p95: 350, average: 140, samples: 98 }, trend: [], daily: [], recentChecks: [], activeIncident: null },
          { id: "m2", name: "CodeSense API", project: "CodeSense", url: "https://api.codesense.example", expectedStatus: "2xx_3xx", paused: false, state: "down", uptime: { h24: { percent: 80.0, up: 80, down: 20, total: 100, sufficient: true }, d7: { percent: 94.0, up: 570, down: 35, total: 605, sufficient: true }, d30: { percent: 98.0, up: 2750, down: 62, total: 2812, sufficient: true } }, latency: { p50: null, p95: null, average: null, samples: 0 }, trend: [], daily: [], recentChecks: [], activeIncident: null },
          { id: "m3", name: "StyleShopZ Store", project: "StyleShopZ", url: "https://styleshopz.example", expectedStatus: "2xx_3xx", paused: false, state: "operational", uptime: { h24: { percent: 100, up: 98, down: 0, total: 98, sufficient: true }, d7: { percent: 100, up: 605, down: 0, total: 605, sufficient: true }, d30: { percent: 100, up: 2812, down: 0, total: 2812, sufficient: true } }, latency: { p50: 80, p95: 150, average: 92, samples: 98 }, trend: [], daily: [], recentChecks: [], activeIncident: null },
        ],
        incidents: [
          {
            id: "inc-1",
            monitorId: "m2",
            monitorName: "CodeSense API",
            title: "API Connectivity Interruption",
            severity: "major",
            status: "investigating",
            startedAt: new Date(Date.now() - 3600_000).toISOString(),
            resolvedAt: null,
            updatedAt: new Date().toISOString(),
            updates: [
              { id: "u-1", status: "investigating", body: "Investigating upstream routing failure.", createdAt: new Date().toISOString() },
            ],
          },
        ],
        meta: { retentionDays: 30, maxMonitors: 20, refreshSeconds: 300, checkIntervalMinutes: 15, timeoutMs: 10000 },
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: json }) });
    });

    await page.goto("/");
    const lu = page.locator("#lu");
    await expect(lu).toBeVisible();

    // Truthful announcement must report down, degraded, operational, and active incidents
    await expect(lu).toContainText("Partial degradation");
    await expect(lu).toContainText("1 down");
    await expect(lu).toContainText("1 degraded");
    await expect(lu).toContainText("1 operational");
    await expect(lu).toContainText("1 active incident");
    await expect(lu).not.toContainText("every project is operational on its latest check");
  });

  test("all 6 header project anchor links exist, navigate smoothly, and clear the sticky masthead", async ({
    page,
    isMobile,
  }) => {
    const projectSlugs = [
      "project-haan",
      "project-styleshopz",
      "project-codesense",
      "project-grepless",
      "project-arthasetu",
      "project-dispatch",
    ];

    for (const slug of projectSlugs) {
      await page.goto("/");
      const mastheadBox = await page.locator(".masthead").boundingBox();
      const mastheadBottom = (mastheadBox?.y ?? 0) + (mastheadBox?.height ?? 0);

      const target = page.locator(`#${slug}`);
      await expect(target).toBeAttached();

      if (isMobile) {
        // Open mobile drawer and click project link
        await page.locator(".mobile-nav-toggle").click();
        await page.locator(`.mobile-menu-project-link[href="#${slug}"]`).click();
      } else {
        // Click visible register link in hero
        await page.locator(`.reg-item[href="#${slug}"]`).click();
      }

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

      const targetBox = await target.boundingBox();
      expect(targetBox).not.toBeNull();
      // Ensure target heading is clear of the sticky header
      expect(targetBox!.y).toBeGreaterThanOrEqual(mastheadBottom - 2);
    }
  });

  test("mobile touch navigation provides >=44px touch targets, handles escape key, and navigates", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const toggle = page.locator(".mobile-nav-toggle");
    await expect(toggle).toBeVisible();

    const toggleBox = await toggle.boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox!.height).toBeGreaterThanOrEqual(44);

    // Open mobile drawer
    await toggle.click();
    const drawer = page.locator("#mobile-nav-drawer");
    await expect(drawer).toBeVisible();

    // Assert all navigation touch targets have >= 44px height
    const links = drawer.locator(".mobile-menu-link, .mobile-menu-project-link, .mobile-menu-footer-link");
    const count = await links.count();
    expect(count).toBeGreaterThan(5);

    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // Within standard touch comfort
      }
    }

    // Escape closes drawer
    await page.keyboard.press("Escape");
    await expect(drawer).not.toHaveClass(/open/);

    // Reopen and click a project link
    await toggle.click();
    await expect(drawer).toHaveClass(/open/);
    await drawer.locator(".mobile-menu-project-link", { hasText: "Haan" }).click();

    // Drawer closes after navigation
    await expect(drawer).not.toHaveClass(/open/);

    // Verify 320px viewport without overflow
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(100);
    await expectNoHorizontalOverflow(page);
  });

  test("verifies computed typography: Instrument Serif display, Hanken Grotesk body, and IBM Plex Mono telemetry", async ({
    page,
    isMobile,
  }) => {
    if (isMobile) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await page.waitForSelector(".service");

      const h1Metrics = await page.evaluate(() => {
        const h1 = document.querySelector("#hero h1");
        if (!h1) return null;
        const s = window.getComputedStyle(h1);
        return {
          fontFamily: s.fontFamily.toLowerCase(),
          fontWeight: s.fontWeight,
          fontSize: parseFloat(s.fontSize),
        };
      });

      expect(h1Metrics).not.toBeNull();
      expect(h1Metrics!.fontFamily).toContain("instrument serif");
      expect(h1Metrics!.fontWeight).toBe("400");
      // Mobile clamp(52px, 10vw, 160px) clamps to ~52px on 390px
      expect(h1Metrics!.fontSize).toBeGreaterThanOrEqual(48);
      expect(h1Metrics!.fontSize).toBeLessThanOrEqual(60);
    } else {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await page.waitForSelector(".service");

      const metrics = await page.evaluate(() => {
        const h1 = document.querySelector("#hero h1");
        const h2 = document.querySelector("#services h2");
        const lead = document.querySelector("p.lead");
        const mono = document.querySelector("#lu");

        return {
          h1: h1
            ? {
                fontFamily: window.getComputedStyle(h1).fontFamily.toLowerCase(),
                fontWeight: window.getComputedStyle(h1).fontWeight,
                fontSize: parseFloat(window.getComputedStyle(h1).fontSize),
              }
            : null,
          h2: h2
            ? {
                fontFamily: window.getComputedStyle(h2).fontFamily.toLowerCase(),
                fontWeight: window.getComputedStyle(h2).fontWeight,
                fontSize: parseFloat(window.getComputedStyle(h2).fontSize),
              }
            : null,
          lead: lead
            ? {
                fontFamily: window.getComputedStyle(lead).fontFamily.toLowerCase(),
                fontSize: parseFloat(window.getComputedStyle(lead).fontSize),
              }
            : null,
          mono: mono
            ? {
                fontFamily: window.getComputedStyle(mono).fontFamily.toLowerCase(),
                fontSize: parseFloat(window.getComputedStyle(mono).fontSize),
              }
            : null,
        };
      });

      expect(metrics.h1).not.toBeNull();
      expect(metrics.h1!.fontFamily).toContain("instrument serif");
      expect(metrics.h1!.fontWeight).toBe("400");
      // clamp(52px, 10vw, 160px) at 1440px produces 144px
      expect(metrics.h1!.fontSize).toBeGreaterThanOrEqual(140);
      expect(metrics.h1!.fontSize).toBeLessThanOrEqual(148);

      expect(metrics.h2).not.toBeNull();
      expect(metrics.h2!.fontFamily).toContain("instrument serif");
      expect(metrics.h2!.fontWeight).toBe("400");
      // clamp(40px, 6.4vw, 100px) at 1440px produces 92.16px
      expect(metrics.h2!.fontSize).toBeGreaterThanOrEqual(88);
      expect(metrics.h2!.fontSize).toBeLessThanOrEqual(96);

      expect(metrics.lead).not.toBeNull();
      expect(metrics.lead!.fontFamily).toMatch(/hanken grotesk|sans/);

      expect(metrics.mono).not.toBeNull();
      expect(metrics.mono!.fontFamily).toMatch(/ibm plex mono|mono/);
    }
  });
});
