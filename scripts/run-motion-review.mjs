#!/usr/bin/env node
/**
 * Executes the 6-Round Visual and Motion Review loop for PulseLedger
 * observing initial/later frames, scroll journey (25/50/75%), explicit two-position
 * scroll-delta measurements & screenshots for each chapter at 1440x900 and 390x844,
 * interactive check explorer, mobile viewport, and reduced motion.
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8787";
const outDir = resolve(root, "docs", "motion-review");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function scrollToY(page, y) {
  await page.evaluate((targetY) => {
    window.scrollTo({ top: targetY, behavior: "instant" });
    window.dispatchEvent(new Event("scroll"));
  }, y);
  await page.waitForTimeout(140);
}

async function measureSelector(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      selector: sel,
      scrollY: Math.round(window.scrollY),
      progress:
        el.getAttribute("data-scroll-progress") ??
        el.getAttribute("data-row-progress") ??
        style.getPropertyValue("--row-progress")?.trim() ??
        null,
      transform: style.transform,
      clipPath: style.clipPath,
      strokeDashoffset: style.strokeDashoffset,
      paperOffset: el.getAttribute("data-paper-offset"),
    };
  }, selector);
}

async function measureChaptersAtViewport(page, label) {
  const vh = await page.evaluate(() => window.innerHeight);
  const dims = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  const report = { viewport: label, dimensions: dims, chapters: {} };

  // Chapter 1: #services & physical ledger strip unspooling
  await scrollToY(page, 0);
  await page.screenshot({ path: resolve(outDir, `chapter1-${label}-before.png`) });
  const c1Before = {
    section: await measureSelector(page, "#services"),
    spoolFill: await measureSelector(page, "#services-spool-fill"),
    spoolWheel: await measureSelector(page, "#services-spool-wheel"),
    rowArticle: await measureSelector(page, "#project-2 .service:first-of-type"),
    rowStrip: await measureSelector(page, "#project-2 .service:first-of-type .uptime-strip"),
    heroCarriage: await measureSelector(page, "#hero-drum-carriage"),
    canvas: await measureSelector(page, ".telemetry-canvas"),
  };

  const rowDocTop = await page.evaluate(() => {
    const el = document.querySelector("#project-2 .service:first-of-type");
    return el ? el.getBoundingClientRect().top + window.scrollY : 900;
  });
  await scrollToY(page, Math.max(520, rowDocTop - 180));
  await page.screenshot({ path: resolve(outDir, `chapter1-${label}-after.png`) });
  const c1After = {
    section: await measureSelector(page, "#services"),
    spoolFill: await measureSelector(page, "#services-spool-fill"),
    spoolWheel: await measureSelector(page, "#services-spool-wheel"),
    rowArticle: await measureSelector(page, "#project-2 .service:first-of-type"),
    rowStrip: await measureSelector(page, "#project-2 .service:first-of-type .uptime-strip"),
    heroCarriage: await measureSelector(page, "#hero-drum-carriage"),
    canvas: await measureSelector(page, ".telemetry-canvas"),
  };
  report.chapters.chapter1_services = { before: c1Before, after: c1After };

  // Assert meaningful delta for Chapter 1
  if (
    Number(c1After.section.progress) - Number(c1Before.section.progress) <= 0.5 ||
    c1After.spoolFill.transform === c1Before.spoolFill.transform ||
    c1After.rowStrip.clipPath === c1Before.rowStrip.clipPath
  ) {
    throw new Error(`Chapter 1 scroll delta check failed on ${label}`);
  }

  // Chapter 2: #probe (Scroll-Drawn Monitoring Timeline)
  const probeDocTop = await page.evaluate(() => {
    const el = document.getElementById("probe");
    return el ? el.getBoundingClientRect().top + window.scrollY : 3000;
  });
  await scrollToY(page, Math.max(0, probeDocTop - vh * 0.96));
  await page.screenshot({ path: resolve(outDir, `chapter2-${label}-before.png`) });
  const c2Before = {
    section: await measureSelector(page, "#probe"),
    trace: await measureSelector(page, "#timeline-svg-trace"),
    area: await measureSelector(page, "#timeline-area-group"),
    playhead: await measureSelector(page, "#timeline-playhead-group"),
    chassis: await measureSelector(page, "#probe-chassis-stage"),
  };

  await scrollToY(page, probeDocTop - 110);
  await page.screenshot({ path: resolve(outDir, `chapter2-${label}-after.png`) });
  const c2After = {
    section: await measureSelector(page, "#probe"),
    trace: await measureSelector(page, "#timeline-svg-trace"),
    area: await measureSelector(page, "#timeline-area-group"),
    playhead: await measureSelector(page, "#timeline-playhead-group"),
    chassis: await measureSelector(page, "#probe-chassis-stage"),
  };
  report.chapters.chapter2_probe = { before: c2Before, after: c2After };

  if (
    Number(c2After.section.progress) - Number(c2Before.section.progress) <= 0.55 ||
    parseFloat(c2Before.trace.strokeDashoffset) - parseFloat(c2After.trace.strokeDashoffset) <= 550 ||
    c2After.playhead.transform === c2Before.playhead.transform
  ) {
    throw new Error(`Chapter 2 scroll delta check failed on ${label}`);
  }

  // Chapter 3: #incidents (Forensic Incident Broadsheet & Rotary Verification Seal)
  const incidentsDocTop = await page.evaluate(() => {
    const el = document.getElementById("incidents");
    return el ? el.getBoundingClientRect().top + window.scrollY : 4500;
  });
  await scrollToY(page, Math.max(0, incidentsDocTop - vh * 0.96));
  await page.screenshot({ path: resolve(outDir, `chapter3-${label}-before.png`) });
  const c3Before = {
    section: await measureSelector(page, "#incidents"),
    sealRing: await measureSelector(page, "#incident-seal-ring"),
    sealRotor: await measureSelector(page, "#incident-seal-rotor"),
    spineFill: await measureSelector(page, "#incident-spine-fill"),
    broadsheet: await measureSelector(page, "#incident-broadsheet-panel"),
  };

  await scrollToY(page, incidentsDocTop - 100);
  await page.screenshot({ path: resolve(outDir, `chapter3-${label}-after.png`) });
  const c3After = {
    section: await measureSelector(page, "#incidents"),
    sealRing: await measureSelector(page, "#incident-seal-ring"),
    sealRotor: await measureSelector(page, "#incident-seal-rotor"),
    spineFill: await measureSelector(page, "#incident-spine-fill"),
    broadsheet: await measureSelector(page, "#incident-broadsheet-panel"),
  };
  report.chapters.chapter3_incidents = { before: c3Before, after: c3After };

  if (
    Number(c3After.section.progress) - Number(c3Before.section.progress) <= 0.55 ||
    parseFloat(c3Before.sealRing.strokeDashoffset) - parseFloat(c3After.sealRing.strokeDashoffset) <= 550 ||
    c3After.sealRotor.transform === c3Before.sealRotor.transform
  ) {
    throw new Error(`Chapter 3 scroll delta check failed on ${label}`);
  }

  // Chapter 4: #method (Scroll-Wired Protocol Schematic)
  const methodDocTop = await page.evaluate(() => {
    const el = document.getElementById("method");
    return el ? el.getBoundingClientRect().top + window.scrollY : 5200;
  });
  await scrollToY(page, Math.max(0, methodDocTop - vh * 0.96));
  await page.screenshot({ path: resolve(outDir, `chapter4-${label}-before.png`) });
  const c4Before = {
    section: await measureSelector(page, "#method"),
    busLine: await measureSelector(page, "#method-bus-line"),
    carriage: await measureSelector(page, "#method-signal-carriage"),
    cardsStage: await measureSelector(page, "#method-cards-stage"),
  };

  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  await scrollToY(page, maxScroll);
  await page.screenshot({ path: resolve(outDir, `chapter4-${label}-after.png`) });
  const c4After = {
    section: await measureSelector(page, "#method"),
    busLine: await measureSelector(page, "#method-bus-line"),
    carriage: await measureSelector(page, "#method-signal-carriage"),
    cardsStage: await measureSelector(page, "#method-cards-stage"),
  };
  report.chapters.chapter4_method = { before: c4Before, after: c4After };

  if (
    Number(c4After.section.progress) - Number(c4Before.section.progress) <= 0.55 ||
    parseFloat(c4Before.busLine.strokeDashoffset) - parseFloat(c4After.busLine.strokeDashoffset) <= 550 ||
    c4After.carriage.transform === c4Before.carriage.transform
  ) {
    throw new Error(`Chapter 4 scroll delta check failed on ${label}`);
  }

  return report;
}

async function runReviews() {
  console.log("=== STARTING 6-ROUND VISUAL & MOTION REVIEW ===");

  // Trigger a local scheduled check so local D1 has real check records for timeline & inspector
  const seedCtx = await browser.newContext();
  const seedPage = await seedCtx.newPage();
  try {
    await seedPage.goto(`${baseURL}/cdn-cgi/local/scheduled`, { timeout: 15000 });
  } catch {
    // ignore if already seeded
  }
  await seedCtx.close();

  // Setup desktop context
  const desktopCtx = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopCtx.newPage();

  // Round 1 — Composition & Living Environment
  console.log("-> Round 1: Composition & Living Environment");
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForSelector(".service");

  await scrollToY(page, 0);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-initial-t0.png") });

  await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-later-t18.png") });

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`Desktop document scroll height: ${scrollHeight}px`);

  await scrollToY(page, scrollHeight * 0.25);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-scroll-25pct.png") });

  await scrollToY(page, scrollHeight * 0.50);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-scroll-50pct.png") });

  await scrollToY(page, scrollHeight * 0.75);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-scroll-75pct.png") });

  // Measure Desktop Scroll Chapters
  const desktopScrollReport = await measureChaptersAtViewport(page, "desktop-1440");

  // Round 2 — Interaction & Recorded Check Explorer
  console.log("-> Round 2: Interaction & Recorded Check Explorer");
  await scrollToY(page, 0);

  const probeBtn = page.locator(".jump-probe-btn");
  await probeBtn.click();
  await page.waitForTimeout(600);

  const selectElem = page.locator("#probe-target-select");
  await selectElem.selectOption({ index: 0 });
  await page.waitForTimeout(300);

  const fireBtn = page.locator(".probe-button");
  if (await fireBtn.isEnabled()) {
    await fireBtn.click();
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: resolve(outDir, "round2-probe-in-flight.png") });

  await page.waitForSelector(".stage-telemetry-breakdown", { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(outDir, "round2-probe-completed.png") });

  const pulseChip = page.getByRole("button", { name: "Pulse Stream" });
  if (await pulseChip.isEnabled()) {
    await pulseChip.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: resolve(outDir, "round2-oscilloscope-pulse-wave.png") });

  await page.evaluate(() => {
    document.querySelector("#services")?.scrollIntoView();
  });
  await page.waitForTimeout(400);

  const haanFilter = page.locator(".filter-pill", { hasText: "Haan" });
  await haanFilter.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(outDir, "round2-filter-haan-active.png") });

  const allFilter = page.locator(".filter-pill", { hasText: "All Projects" });
  await allFilter.click();
  await page.waitForTimeout(300);

  const detailsBtn = page.locator(".service-toggle").first();
  await detailsBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(outDir, "round2-service-details-expanded.png") });

  await desktopCtx.close();

  // Round 3 & 4 — Mobile & Release Responsive Audit (390px)
  console.log("-> Round 3 & 4: Mobile Viewport (390px) & Scroll Choreography");
  const mobileCtx = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(baseURL, { waitUntil: "networkidle" });
  await mobilePage.waitForSelector(".service");

  await scrollToY(mobilePage, 0);
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-initial-t0.png") });

  const mobileScrollHeight = await mobilePage.evaluate(() => document.body.scrollHeight);
  await scrollToY(mobilePage, mobileScrollHeight * 0.25);
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-scroll-25pct.png") });

  await scrollToY(mobilePage, mobileScrollHeight * 0.50);
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-scroll-50pct.png") });

  await scrollToY(mobilePage, mobileScrollHeight * 0.75);
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-scroll-75pct.png") });

  const mobileScrollReport = await measureChaptersAtViewport(mobilePage, "mobile-390");

  const mobileFireBtn = mobilePage.locator(".probe-button");
  await mobilePage.evaluate(() => {
    document.querySelector("#probe")?.scrollIntoView();
  });
  await mobilePage.waitForTimeout(300);
  if (await mobileFireBtn.isEnabled()) {
    await mobileFireBtn.click();
    await mobilePage.waitForTimeout(500);
  }
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-probe-completed.png") });

  const hasHorizontalScroll = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`Mobile horizontal overflow detected: ${hasHorizontalScroll}`);
  if (hasHorizontalScroll) {
    throw new Error("Mobile horizontal overflow detected!");
  }

  await mobileCtx.close();

  // Round 5 — Motion Performance & Reduced Motion
  console.log("-> Round 5: Reduced Motion & Performance Verification");
  const reducedMotionCtx = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedMotionCtx.newPage();
  await reducedPage.goto(baseURL, { waitUntil: "networkidle" });
  await reducedPage.waitForSelector(".service");
  await reducedPage.screenshot({ path: resolve(outDir, "round5-reduced-motion-desktop.png") });
  await reducedMotionCtx.close();

  // Round 6 — Final Visual Comparison & Full-Page Screenshots
  console.log("-> Round 6: Final Visual Comparison Verification");
  const finalCtx = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  });
  const finalPage = await finalCtx.newPage();
  await finalPage.goto(baseURL, { waitUntil: "networkidle" });
  await finalPage.waitForSelector(".service");
  await finalPage.screenshot({
    path: resolve(root, "docs", "screenshots", "public-status-desktop.png"),
    fullPage: true,
  });

  const finalMobileCtx = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
  });
  const finalMobilePage = await finalMobileCtx.newPage();
  await finalMobilePage.goto(baseURL, { waitUntil: "networkidle" });
  await finalMobilePage.waitForSelector(".service");
  await finalMobilePage.screenshot({
    path: resolve(root, "docs", "screenshots", "public-status-mobile.png"),
    fullPage: true,
  });

  await finalCtx.close();
  await finalMobileCtx.close();

  const combinedReport = {
    generatedAt: new Date().toISOString(),
    desktop: desktopScrollReport,
    mobile: mobileScrollReport,
  };
  writeFileSync(
    resolve(outDir, "scroll-measurements.json"),
    JSON.stringify(combinedReport, null, 2),
  );
  console.log("Scroll measurements saved to docs/motion-review/scroll-measurements.json");

  await browser.close();
  console.log("=== ALL 6 ROUNDS & SCROLL DELTA VERIFICATIONS RECORDED SUCCESSFULLY ===");
}

await runReviews();
