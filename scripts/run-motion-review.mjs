#!/usr/bin/env node
/**
 * Executes the 6-Round Visual and Motion Review loop for PulseLedger
 * observing initial/later frames, scroll journey (25/50/75%), interactive probe,
 * mobile viewport, and reduced motion.
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8787";
const outDir = resolve(root, "docs", "motion-review");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function runReviews() {
  console.log("=== STARTING 6-ROUND VISUAL & MOTION REVIEW ===");

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

  // Initial frame at t = 0s
  await page.screenshot({ path: resolve(outDir, "round1-desktop-initial-t0.png") });

  // Later frame at t = 1.8s (verifying continuous living canvas animation)
  await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-later-t18.png") });

  // Scroll chapters: 25%, 50%, 75%
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`Document scroll height: ${scrollHeight}px`);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.25));
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-scroll-25pct.png") });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.50));
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-scroll-50pct.png") });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.75));
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(outDir, "round1-desktop-scroll-75pct.png") });

  // Round 2 — Interaction & Interactive Probe Demonstration
  console.log("-> Round 2: Interaction & Interactive Probe");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // Jump to probe
  const probeBtn = page.locator(".jump-probe-btn");
  await probeBtn.click();
  await page.waitForTimeout(600);

  // Select a different monitor in probe
  const selectElem = page.locator("#probe-target-select");
  await selectElem.selectOption({ index: 3 }); // e.g. CodeSense review service
  await page.waitForTimeout(300);

  // Fire Edge Probe
  const fireBtn = page.locator(".probe-button");
  await fireBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(outDir, "round2-probe-in-flight.png") });

  // Wait for probe to complete
  await page.waitForSelector(".stage-telemetry-breakdown", { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(outDir, "round2-probe-completed.png") });

  // Toggle waveform mode to pulse
  const pulseChip = page.getByRole("button", { name: "Pulse Stream" });
  await pulseChip.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(outDir, "round2-oscilloscope-pulse-wave.png") });

  // Test project filters
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

  // Expand first service details
  const detailsBtn = page.locator(".service-toggle").first();
  await detailsBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(outDir, "round2-service-details-expanded.png") });

  await desktopCtx.close();

  // Round 3 & 4 — Mobile & Release Responsive Audit
  console.log("-> Round 3 & 4: Mobile Viewport (390px) & Breakpoints");
  const mobileCtx = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(baseURL, { waitUntil: "networkidle" });
  await mobilePage.waitForSelector(".service");

  // Mobile initial frame
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-initial-t0.png") });

  // Mobile scroll 25%, 50%, 75%
  await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.25));
  await mobilePage.waitForTimeout(400);
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-scroll-25pct.png") });

  await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.50));
  await mobilePage.waitForTimeout(400);
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-scroll-50pct.png") });

  await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.75));
  await mobilePage.waitForTimeout(400);
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-scroll-75pct.png") });

  // Test mobile interactive probe
  const mobileFireBtn = mobilePage.locator(".probe-button");
  await mobilePage.evaluate(() => {
    document.querySelector("#probe")?.scrollIntoView();
  });
  await mobilePage.waitForTimeout(300);
  await mobileFireBtn.click();
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: resolve(outDir, "round4-mobile-probe-completed.png") });

  // Test mobile horizontal overflow check
  const hasHorizontalScroll = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`Mobile horizontal overflow detected: ${hasHorizontalScroll}`);

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

  // Round 6 — Final Visual Comparison & Verification
  console.log("-> Round 6: Final Visual Comparison Verification");
  const finalCtx = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  });
  const finalPage = await finalCtx.newPage();
  await finalPage.goto(baseURL, { waitUntil: "networkidle" });
  await finalPage.waitForSelector(".service");
  await finalPage.screenshot({ path: resolve(root, "docs", "screenshots", "public-status-desktop.png"), fullPage: true });

  const finalMobileCtx = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
  });
  const finalMobilePage = await finalMobileCtx.newPage();
  await finalMobilePage.goto(baseURL, { waitUntil: "networkidle" });
  await finalMobilePage.waitForSelector(".service");
  await finalMobilePage.screenshot({ path: resolve(root, "docs", "screenshots", "public-status-mobile.png"), fullPage: true });

  await finalCtx.close();
  await finalMobileCtx.close();

  await browser.close();
  console.log("=== ALL 6 ROUNDS RECORDED SUCCESSFULLY ===");
}

await runReviews();
