import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const refUrl = pathToFileURL(resolve(process.cwd(), "my-design/home-working.html")).href;

test.describe("Fidelity side-by-side verification", () => {
  test("captures side-by-side evidence at 1440, 1024, 390, and 320 viewports across dark and light themes", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const refPage = await page.context().newPage();

    // 1. Desktop 1440 Dark Theme
    await page.setViewportSize({ width: 1440, height: 900 });
    await refPage.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/");
    await refPage.goto(refUrl);
    await page.waitForSelector(".service");
    await page.waitForTimeout(1000);
    await refPage.waitForTimeout(1000);

    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-hero.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-hero.png" });

    // Mid-scroll Chapter 1 (#services)
    const servicesTop = await page.evaluate(() => {
      const el = document.getElementById("services");
      return el ? el.getBoundingClientRect().top + window.scrollY : 1200;
    });
    await page.evaluate((y) => window.scrollTo(0, y - 100), servicesTop);
    await refPage.evaluate((y) => window.scrollTo(0, y - 100), servicesTop);
    await page.waitForTimeout(600);
    await refPage.waitForTimeout(600);

    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-services.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-services.png" });

    // Chapter 2 (#probe)
    const probeTop = await page.evaluate(() => {
      const el = document.getElementById("probe");
      return el ? el.getBoundingClientRect().top + window.scrollY : 2800;
    });
    await page.evaluate((y) => window.scrollTo(0, y - 50), probeTop);
    await refPage.evaluate((y) => window.scrollTo(0, y - 50), probeTop);
    await page.waitForTimeout(600);
    await refPage.waitForTimeout(600);

    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-probe.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-probe.png" });

    // Chapter 3 (#incidents)
    const incidentsTop = await page.evaluate(() => {
      const el = document.getElementById("incidents");
      return el ? el.getBoundingClientRect().top + window.scrollY : 4200;
    });
    await page.evaluate((y) => window.scrollTo(0, y - 50), incidentsTop);
    await refPage.evaluate((y) => window.scrollTo(0, y - 50), incidentsTop);
    await page.waitForTimeout(600);
    await refPage.waitForTimeout(600);

    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-incidents.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-incidents.png" });

    // Light Theme Desktop 1440
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await refPage.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.evaluate(() => window.scrollTo(0, 0));
    await refPage.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await refPage.waitForTimeout(600);

    await page.screenshot({ path: "docs/motion-review/impl-1440-light-hero.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-light-hero.png" });

    // 2. Mobile 390 Viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await refPage.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await refPage.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.evaluate(() => window.scrollTo(0, 0));
    await refPage.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await refPage.waitForTimeout(600);

    await page.screenshot({ path: "docs/motion-review/impl-390-dark-hero.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-390-dark-hero.png" });

    // Mobile light
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await refPage.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.waitForTimeout(400);
    await refPage.waitForTimeout(400);

    await page.screenshot({ path: "docs/motion-review/impl-390-light-hero.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-390-light-hero.png" });

    // 3. Tablet 1024 Viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "docs/motion-review/impl-1024-dark-hero.png" });

    // 4. Compact 320 Viewport
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "docs/motion-review/impl-320-dark-hero.png" });

    // Check 320 overflow
    const overflow320 = await page.evaluate(() => {
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    });
    expect(overflow320.scrollWidth).toBeLessThanOrEqual(overflow320.clientWidth + 1);
    expect(overflow320.bodyScrollWidth).toBeLessThanOrEqual(overflow320.clientWidth + 1);

    await refPage.close();
  });
});
