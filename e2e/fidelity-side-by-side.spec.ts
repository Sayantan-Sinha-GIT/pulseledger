import { test, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const envRefPath = process.env.FIDELITY_REFERENCE_PATH;
const disableRef = /^(true|1|yes)$/i.test(process.env.SKIP_FIDELITY_REFERENCE?.trim() ?? "");
const workingRefPath = resolve(process.cwd(), "my-design/home-working.html");
const originalRefPath = resolve(process.cwd(), "my-design/home.html");

const resolvedRefPath = disableRef
  ? null
  : envRefPath
  ? existsSync(envRefPath)
    ? envRefPath
    : null
  : existsSync(workingRefPath)
  ? workingRefPath
  : existsSync(originalRefPath)
  ? originalRefPath
  : null;

const refUrl = resolvedRefPath ? pathToFileURL(resolvedRefPath).href : "";

interface ComputedMetrics {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  lineHeight: string;
  lineHeightPx: number;
  marginTop: number;
  marginBottom: number;
  paddingTop: number;
  paddingBottom: number;
  top: number;
  height: number;
}

async function getHeadingMetrics(page: Page, selector: string): Promise<ComputedMetrics | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      fontSize: parseFloat(s.fontSize),
      lineHeight: s.lineHeight,
      lineHeightPx: parseFloat(s.lineHeight) || parseFloat(s.fontSize),
      marginTop: parseFloat(s.marginTop || "0"),
      marginBottom: parseFloat(s.marginBottom || "0"),
      paddingTop: parseFloat(s.paddingTop || "0"),
      paddingBottom: parseFloat(s.paddingBottom || "0"),
      top: r.top,
      height: r.height,
    };
  }, selector);
}

async function getHeaderMetrics(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return null;
    const s = window.getComputedStyle(header);
    const r = header.getBoundingClientRect();
    return {
      height: r.height,
      paddingTop: parseFloat(s.paddingTop || "0"),
      paddingBottom: parseFloat(s.paddingBottom || "0"),
      borderBottomWidth: parseFloat(s.borderBottomWidth || "0"),
    };
  });
}

async function getKineticMetrics(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = window.getComputedStyle(el);
    return {
      transform: s.transform,
      clipPath: s.clipPath,
      strokeDashoffset: parseFloat(s.strokeDashoffset || "0"),
      cx: el.getAttribute("cx"),
      cy: el.getAttribute("cy"),
      x1: el.getAttribute("x1"),
      progress: el.getAttribute("data-scroll-progress"),
    };
  }, selector);
}

test.describe("Fidelity side-by-side verification", () => {
  test("verifies typography, desktop pinning, and scene-phase motion deltas side-by-side", async ({
    page,
  }) => {
    test.skip(
      !resolvedRefPath,
      "Reference design file not found (clean checkout without ignored my-design/home-working.html or my-design/home.html). Set FIDELITY_REFERENCE_PATH or supply reference file to enable side-by-side fidelity comparison."
    );

    test.setTimeout(180_000);

    const refPage = await page.context().newPage();

    // =========================================================================
    // 1. DESKTOP 1440x900 DARK THEME: TYPOGRAPHY ASSERTIONS & HERO SCENE
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await refPage.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/");
    await refPage.goto(refUrl);
    await page.waitForSelector(".service");
    await page.waitForTimeout(1000);
    await refPage.waitForTimeout(1000);

    // Assert header metrics: 64px height + 1px border, 0 padding
    const implHeader = await getHeaderMetrics(page);
    const refHeader = await getHeaderMetrics(refPage);
    expect(implHeader).not.toBeNull();
    expect(refHeader).not.toBeNull();
    expect(implHeader!.height).toBeGreaterThanOrEqual(64);
    expect(implHeader!.height).toBeLessThanOrEqual(66);
    expect(Math.abs(implHeader!.height - refHeader!.height)).toBeLessThanOrEqual(2);
    expect(implHeader!.paddingTop).toBe(0);
    expect(implHeader!.paddingBottom).toBe(0);

    // Assert computed typography on implementation h1 and h2
    const implH1 = await getHeadingMetrics(page, "#hero h1");
    const refH1 = await getHeadingMetrics(refPage, "#hero h1");

    expect(implH1).not.toBeNull();
    expect(refH1).not.toBeNull();
    // Must be Instrument Serif normal 400
    expect(implH1!.fontFamily.toLowerCase()).toContain("instrument serif");
    expect(implH1!.fontWeight).toBe("400");
    // clamp(52px, 10vw, 160px) at 1440px is 144px
    expect(implH1!.fontSize).toBeGreaterThanOrEqual(135);
    expect(implH1!.fontSize).toBeLessThanOrEqual(155);
    // Compare directly with authored reference: must match within 2px
    expect(Math.abs(implH1!.fontSize - refH1!.fontSize)).toBeLessThanOrEqual(2);

    // Assert h1 margins, line-height, and layout bounds
    expect(implH1!.marginTop).toBe(0);
    expect(implH1!.marginBottom).toBe(0);
    expect(implH1!.paddingTop).toBe(0);
    expect(implH1!.paddingBottom).toBe(0);
    expect(implH1!.lineHeightPx).toBeGreaterThanOrEqual(140);
    expect(implH1!.lineHeightPx).toBeLessThanOrEqual(152);
    expect(Math.abs(implH1!.lineHeightPx - refH1!.lineHeightPx)).toBeLessThanOrEqual(2);
    // Heading top position matches source (~166px), not displaced (~262px)
    expect(implH1!.top).toBeGreaterThanOrEqual(155);
    expect(implH1!.top).toBeLessThanOrEqual(175);
    expect(Math.abs(implH1!.top - refH1!.top)).toBeLessThanOrEqual(5);

    const implH2 = await getHeadingMetrics(page, "#services h2");
    const refH2 = await getHeadingMetrics(refPage, "#services h2");

    expect(implH2).not.toBeNull();
    expect(refH2).not.toBeNull();
    expect(implH2!.fontFamily.toLowerCase()).toContain("instrument serif");
    expect(implH2!.fontWeight).toBe("400");
    // clamp(40px, 6.4vw, 100px) at 1440px is 92.16px
    expect(implH2!.fontSize).toBeGreaterThanOrEqual(85);
    expect(implH2!.fontSize).toBeLessThanOrEqual(100);
    expect(Math.abs(implH2!.fontSize - refH2!.fontSize)).toBeLessThanOrEqual(2);
    expect(Math.abs(implH2!.marginTop - refH2!.marginTop)).toBeLessThanOrEqual(2);
    expect(Math.abs(implH2!.marginBottom - refH2!.marginBottom)).toBeLessThanOrEqual(2);
    expect(implH2!.lineHeightPx).toBeGreaterThanOrEqual(90);
    expect(implH2!.lineHeightPx).toBeLessThanOrEqual(100);

    // Assert #numbers h2 has zero margin-bottom (eliminating ~76px blank space)
    const implNumbersH2 = await getHeadingMetrics(page, "#numbers h2");
    const refNumbersH2 = await getHeadingMetrics(refPage, "#numbers h2");
    expect(implNumbersH2).not.toBeNull();
    expect(refNumbersH2).not.toBeNull();
    expect(implNumbersH2!.marginBottom).toBe(0);
    expect(Math.abs(implNumbersH2!.marginTop - refNumbersH2!.marginTop)).toBeLessThanOrEqual(2);

    // Capture Hero evidence
    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-hero.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-hero.png" });

    // =========================================================================
    // 2. CHAPTER 1 (#services): MATCHED SCENE PHASES
    // =========================================================================
    const getDocTop = async (p: Page, id: string) => {
      return p.evaluate((targetId) => {
        const el = document.getElementById(targetId);
        return el ? el.getBoundingClientRect().top + window.scrollY : 1200;
      }, id);
    };

    const implServicesTop = await getDocTop(page, "services");
    const refServicesTop = await getDocTop(refPage, "services");

    // Scroll to mid Chapter 1 on each page's own trigger geometry
    await page.evaluate((y) => window.scrollTo({ top: y + 200, behavior: "instant" }), implServicesTop);
    await refPage.evaluate((y) => window.scrollTo({ top: y + 200, behavior: "instant" }), refServicesTop);
    await page.waitForTimeout(500);
    await refPage.waitForTimeout(500);

    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-ch1-mid.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-ch1-mid.png" });

    // =========================================================================
    // 3. CHAPTER 2 (#probe / #pipe): DESKTOP +=2200 PIN CHOREOGRAPHY EVIDENCE
    // =========================================================================
    const implPipeTop = await getDocTop(page, "pipe");
    const refPipeTop = await getDocTop(refPage, "pipe");

    // Phase Before Pin: approaching #pipe
    await page.evaluate((y) => window.scrollTo({ top: y - 400, behavior: "instant" }), implPipeTop);
    await refPage.evaluate((y) => window.scrollTo({ top: y - 400, behavior: "instant" }), refPipeTop);
    await page.waitForTimeout(400);
    await refPage.waitForTimeout(400);

    const implPipeBefore = await getKineticMetrics(page, "#timeline-svg-trace");
    const refPipeBefore = await getKineticMetrics(refPage, "#timeline-svg-trace");

    // Phase Mid Pin: pinned at top of viewport, midway through the +=2200 pin (+1100px)
    await page.evaluate((y) => window.scrollTo({ top: y + 1100, behavior: "instant" }), implPipeTop);
    await refPage.evaluate((y) => window.scrollTo({ top: y + 1100, behavior: "instant" }), refPipeTop);
    await page.waitForTimeout(600);
    await refPage.waitForTimeout(600);

    const implPipeMid = await getKineticMetrics(page, "#timeline-svg-trace");
    const refPipeMid = await getKineticMetrics(refPage, "#timeline-svg-trace");
    const implPlayheadMid = await getKineticMetrics(page, "#pc");
    const refPlayheadMid = await getKineticMetrics(refPage, "#pc");

    // Meaningful delta assertions: trace strokeDashoffset must have drawn significantly (> 300px on 629px total path)
    expect(implPipeBefore!.strokeDashoffset - implPipeMid!.strokeDashoffset).toBeGreaterThan(300);
    expect(refPipeBefore!.strokeDashoffset - refPipeMid!.strokeDashoffset).toBeGreaterThan(300);
    expect(
      Math.abs(
        (implPipeBefore!.strokeDashoffset - implPipeMid!.strokeDashoffset) -
          (refPipeBefore!.strokeDashoffset - refPipeMid!.strokeDashoffset),
      ),
    ).toBeLessThanOrEqual(5);

    // Playhead coordinate cx must have advanced past 200px
    expect(parseFloat(implPlayheadMid?.cx || "0")).toBeGreaterThan(200);
    expect(parseFloat(refPlayheadMid?.cx || "0")).toBeGreaterThan(200);

    // Verify stage highlights (stage 02 or 03 active at mid pin)
    const implActiveStages = await page.locator("#stg li.on").count();
    const refActiveStages = await refPage.locator("#stg li.on").count();
    expect(implActiveStages).toBeGreaterThanOrEqual(1);
    expect(refActiveStages).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-ch2-pin-mid.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-ch2-pin-mid.png" });

    // Phase After Pin: near end of pinned range (+2000px)
    await page.evaluate((y) => window.scrollTo({ top: y + 2050, behavior: "instant" }), implPipeTop);
    await refPage.evaluate((y) => window.scrollTo({ top: y + 2050, behavior: "instant" }), refPipeTop);
    await page.waitForTimeout(500);
    await refPage.waitForTimeout(500);

    const implPipeAfter = await getKineticMetrics(page, "#timeline-svg-trace");
    expect(implPipeAfter!.strokeDashoffset).toBeLessThan(implPipeMid!.strokeDashoffset);

    // =========================================================================
    // 4. CHAPTER 3 (#incidents): ROTARY VERIFICATION SEAL & BROADSHEET EVIDENCE
    // =========================================================================
    const implIncidentsTop = await getDocTop(page, "incidents");
    const refIncidentsTop = await getDocTop(refPage, "incidents");

    await page.evaluate((y) => window.scrollTo({ top: y - 200, behavior: "instant" }), implIncidentsTop);
    await refPage.evaluate((y) => window.scrollTo({ top: y - 200, behavior: "instant" }), refIncidentsTop);
    await page.waitForTimeout(500);
    await refPage.waitForTimeout(500);

    const implSealMid = await getKineticMetrics(page, "#incident-seal-ring");
    const refSealMid = await getKineticMetrics(refPage, "#incident-seal-ring");

    expect(implSealMid).not.toBeNull();
    expect(refSealMid).not.toBeNull();

    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-ch3-seal-mid.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-ch3-seal-mid.png" });

    // =========================================================================
    // 5. CHAPTER 4 (#method): SIGNAL BUS & PROTOCOL SCHEMATIC
    // =========================================================================
    const implMethodTop = await getDocTop(page, "method");
    const refMethodTop = await getDocTop(refPage, "method");

    await page.evaluate((y) => window.scrollTo({ top: y - 100, behavior: "instant" }), implMethodTop);
    await refPage.evaluate((y) => window.scrollTo({ top: y - 100, behavior: "instant" }), refMethodTop);
    await page.waitForTimeout(500);
    await refPage.waitForTimeout(500);

    await page.screenshot({ path: "docs/motion-review/impl-1440-dark-ch4-mid.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-dark-ch4-mid.png" });

    // =========================================================================
    // 6. LIGHT THEME FIDELITY AT 1440
    // =========================================================================
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await refPage.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.evaluate(() => window.scrollTo(0, 0));
    await refPage.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await refPage.waitForTimeout(600);

    await page.screenshot({ path: "docs/motion-review/impl-1440-light-hero.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-1440-light-hero.png" });

    // =========================================================================
    // 7. MOBILE 390 VIEWPORT: FLOW, TOUCH MENU, & CHAPTER DELTAS
    // =========================================================================
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

    // Test mobile chapter 2 natural flow
    const implMobilePipeTop = await getDocTop(page, "pipe");
    const refMobilePipeTop = await getDocTop(refPage, "pipe");

    await page.evaluate((y) => window.scrollTo({ top: y - 50, behavior: "instant" }), implMobilePipeTop);
    await refPage.evaluate((y) => window.scrollTo({ top: y - 50, behavior: "instant" }), refMobilePipeTop);
    await page.waitForTimeout(500);
    await refPage.waitForTimeout(500);

    await page.screenshot({ path: "docs/motion-review/impl-390-dark-ch2-mid.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-390-dark-ch2-mid.png" });

    // Mobile light
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await refPage.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.evaluate(() => window.scrollTo(0, 0));
    await refPage.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await refPage.waitForTimeout(500);

    await page.screenshot({ path: "docs/motion-review/impl-390-light-hero.png" });
    await refPage.screenshot({ path: "docs/motion-review/ref-390-light-hero.png" });

    // =========================================================================
    // 8. TABLET 1024 & COMPACT 320 VIEWPORTS (OVERFLOW & RESPONSIVENESS)
    // =========================================================================
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "docs/motion-review/impl-1024-dark-hero.png" });

    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "docs/motion-review/impl-320-dark-hero.png" });

    // Strict no horizontal overflow check at 320
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
