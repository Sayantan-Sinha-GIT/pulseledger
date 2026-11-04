import { chromium, devices } from "@playwright/test";

const baseURL = process.argv[2] ?? process.env.E2E_BASE_URL ?? "https://pulseledger.srimantasutapa123.workers.dev";
const browser = await chromium.launch();

async function testAnchorArrival(viewportName, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForSelector(".service");

  const mastheadBox = await page.locator(".masthead").boundingBox();
  const mastheadHeight = mastheadBox?.height ?? 0;
  console.log(`\n=== VIEWPORT: ${viewportName} (${width}x${height}) ===`);
  console.log(`Masthead height: ${mastheadHeight.toFixed(1)}px`);

  const anchors = [
    { name: "Recorded Checks link -> #probe", trigger: ".masthead-nav a[href='#probe']", target: "#probe", kicker: "#probe .section-kicker", heading: "#probe-heading" },
    { name: "Inspect Recorded Checks CTA -> #probe", trigger: ".jump-probe-btn", target: "#probe", kicker: "#probe .section-kicker", heading: "#probe-heading" },
    { name: "Services link -> #services", trigger: ".masthead-nav a[href='#services']", target: "#services", kicker: "#services .section-kicker", heading: "#services-heading" },
    { name: "Project-0 link -> #project-0", trigger: "nav[aria-label='Jump to project'] a[href='#project-0']", target: "#project-0", kicker: null, heading: "#project-0 .project-heading h3" },
    { name: "Incidents link -> #incidents", trigger: ".masthead-nav a[href='#incidents']", target: "#incidents", kicker: "#incidents .section-kicker", heading: "#incidents-heading" },
    { name: "Method link -> #method", trigger: ".masthead-nav a[href='#method']", target: "#method", kicker: "#method .section-kicker", heading: "#method-heading" },
  ];

  for (const anchor of anchors) {
    // Scroll top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // Click link
    await page.locator(anchor.trigger).click();

    // Wait until scrolling settles
    await page.waitForFunction(() => {
      return new Promise((resolve) => {
        let lastPos = window.scrollY;
        const check = () => {
          setTimeout(() => {
            if (Math.abs(window.scrollY - lastPos) < 2) {
              resolve(true);
            } else {
              lastPos = window.scrollY;
              check();
            }
          }, 100);
        };
        check();
      });
    }, { timeout: 10000 });

    const targetBox = await page.locator(anchor.target).boundingBox();
    const targetY = targetBox?.y ?? 0;
    console.log(`\nAnchor [${anchor.name}] arrived at scrollY = ${(await page.evaluate(() => window.scrollY)).toFixed(0)}px:`);
    console.log(`  Target top Y: ${targetY.toFixed(1)}px (Masthead bottom: ${mastheadHeight.toFixed(1)}px)`);

    if (targetY < mastheadHeight) {
      console.log(`  >>> DEFECT: ${anchor.target} is COVERED by ${(mastheadHeight - targetY).toFixed(1)}px!`);
    } else {
      console.log(`  >>> Target is clear by ${(targetY - mastheadHeight).toFixed(1)}px.`);
    }

    if (anchor.kicker) {
      const kickerBox = await page.locator(anchor.kicker).boundingBox();
      const kickerY = kickerBox?.y ?? 0;
      console.log(`  Kicker top Y: ${kickerY.toFixed(1)}px`);
      if (kickerY < mastheadHeight) {
        console.log(`  >>> DEFECT: Kicker is COVERED by ${(mastheadHeight - kickerY).toFixed(1)}px!`);
      }
    }

    if (anchor.heading) {
      const headingBox = await page.locator(anchor.heading).boundingBox();
      const headingY = headingBox?.y ?? 0;
      console.log(`  Heading top Y: ${headingY.toFixed(1)}px`);
      if (headingY < mastheadHeight) {
        console.log(`  >>> DEFECT: Heading is COVERED by ${(mastheadHeight - headingY).toFixed(1)}px!`);
      }
    }
  }

  await context.close();
}

await testAnchorArrival("Desktop 1265px", 1265, 900);
await testAnchorArrival("Mobile 390px", 390, 844);
await browser.close();
