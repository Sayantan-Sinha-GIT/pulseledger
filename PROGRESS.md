# Progress — PulseLedger

Last updated: 2026-11-04

## Decisions & Direction

- **Seismic & Print Operations Journal Redesign**: In response to owner feedback that PulseLedger remained visually too close to CodeSense (near-black coordinate grid, glowing cyan packets, radial orbit/sonar rings), redesigned the entire visual identity around an authentic **Continuous Seismic & Print Operations Journal with Layered Ink**:
  - Replaced coordinate grid with continuous horizontal millimetric chart paper rules (`#283243`), major register bands (`#3b475c`), and vertical timecode ticks.
  - Replaced floating packets and sonar circles with **dual-channel analog stylus needle ink traces**:
    - **Channel 1 (Fleet Baseline Harmonic Inkwash)**: Continuous drafting cobalt ink trace (`#388bfd` / `#58a6ff`), driven by live fleet operational health (steady harmonic oscillations when nominal; dynamic shock tremors and spike frequency jitter if degraded or down).
    - **Channel 2 (Cron Cadence & Epoch Pulse)**: Continuous register emerald ink trace (`#2ea043`) with moving rhythmic cardiac impulse deflections tracking the 15-minute cron check cycle.
  - Replaced glowing neon halos with **physical double-bordered ink stamps** with mechanical stroke breathing.
  - Upgraded `#probe` into a **Precision Laboratory Drum Oscillograph** featuring a heavy matte graphite instrument chassis, graduated physical scale ticks (0 to 400ms), dual-trace analog persistence, and selectable inspection of genuine Cloudflare D1 check records.
  - Preserved self-hosted font pair (Space Grotesk + JetBrains Mono) preloaded with WOFF2 under SIL OFL 1.1.
  - Unified the private owner desk (`/admin`, monitors, incidents, audit) into the same calm, dense, high-contrast carbon ink operations aesthetic.
  - Inspected actual live CodeSense (`https://pr-reviewer-omega-liard.vercel.app/`), Pathfolio (`https://pathfolio.pages.dev/`), and PulseLedger at equal 1440px width; documented concrete structural differences in `MOTION_SPEC.md` and `UI_REVIEW.md`.
  - Maintained zero horizontal overflow on both 1440px desktop and 390px mobile viewports.

## Phases

1. Specification: Created `MOTION_SPEC.md`, updated `PROGRESS.md`, defined test ledger in `QUALITY_CASES.md` and `REGRESSION_RUNS.md` — complete
2. Implementation: Living background canvas, choreographed hero, interactive probe sandbox, redesigned fleet matrix and incident ledger — complete
3. Six visual & motion review rounds (Composition, Interaction, Craft, Release, Motion Performance, Final Visual Comparison) documented in `UI_REVIEW.md` and `MOTION_REVIEW.md` — complete
4. Bounded testing loop: Executed 3 iterations with frozen CORE suite in `QUALITY_CASES.md` and `REGRESSION_RUNS.md`, validated with `CHECK_QUALITY_CASES.ps1` — complete (QUALITY GATE: READY, 41 cases)
5. Production verification & deployment: Deploy to Cloudflare Workers, verify live public endpoint, run secret scan, commit and push to GitHub — complete
6. Live QA Navigation Fix: Corrected anchor offsets (`scroll-margin-top: 104px` desktop, `180px` mobile) for `#probe`, `#services`, `#project-*`, `#incidents`, `#method`; added automated Playwright regression test; redeployed and verified live — complete
7. Visual Identity & Admin Flow Unification: Self-hosted Space Grotesk + JetBrains Mono font pair, redesigned `/admin` sign-in console and owner desk into restrained telemetric operations language, audited 1440px and 390px viewports, passed test suites, redeployed live worker, and captured 12 live screenshots — complete
8. Seismic & Print Operations Journal Redesign: Completely overhauled visual world and background engine to eliminate CodeSense/Pathfolio resemblance; captured equal-width 1440px benchmark comparisons; re-ran all 6 motion rounds and 12 public/admin view screenshots; verified 66 Vitest tests, 16 Playwright tests, zero secret findings, and quality gate — complete
9. Blocker Corrections & Provenance Audit: Relocated Channel 1 waveform to lower margin band with 414px clearance from headline (zero text collision); rebalanced hero grid into 1.22fr / 1fr with full-height 30-Day Fleet Ledger Plate (zero empty gap); replaced fabricated probe metrics with authentic Recorded Check Telemetry Inspector replaying actual Cloudflare D1 check records with illustrative response waveforms; audited UI and README claims; passed 66 Vitest tests, 16 Playwright tests, anchor checks, and secret scans — complete
10. Final Provenance Purge & Authentic Check Explorer: Replaced remaining probe fallback simulation with selectable recentChecks explorer and honest unavailable state; renamed navigation to "Recorded Checks" and CTA to "Inspect Recorded Checks"; removed unsupported APAC geography; set empty uptime bar to 0% width; updated UI_REVIEW.md/MOTION_REVIEW.md to label historical 5-stage simulation superseded; verified real-data and no-data branches (70 Vitest tests pass, 16 Playwright tests pass); captured 1440px/390px screenshots; 0 secret scan findings — complete
11. Operations-Journal Scroll Choreography & Six-Round Verification: Implemented deterministic scroll choreography engine (`applyScrollChoreography` via `window.scrollY`/`resize` + `IntersectionObserver`, coalesced to one animation frame) driving Hero 30D Drum Seismograph carriage (`#hero-drum-carriage`) and four distinct scroll-driven chapters (`#services` physical ledger strip unspooling, `#probe` scroll-drawn monitoring latency timeline, `#incidents` rotary seal & broadsheet unfold, `#method` scroll-wired protocol bus schematic); wrote automated Playwright scroll-delta test in `e2e/public.spec.ts` measuring before/after computed CSS/SVG states across desktop (1440×900) and mobile (390×844); executed 6 visual/motion review-and-fix rounds; verified 0 text collisions and 0 horizontal overflow. Combined with D1 read-budget work: 73 Vitest tests and 18 Playwright E2E tests passed (2 mobile owner mutations intentionally skipped), with 0 secret findings. Deployed after the quota reset on 5 November at 00:31 UTC: health, 11 monitors and stable persisted snapshot verified; production snapshot lookup read exactly one row. See docs/D1_READ_BUDGET.md for recovery evidence.
12. Owner-Supplied Claude Homepage Design Integration (2026-11-05): Faithfully implemented the exact Claude HTML (`my-design/home.html`, 33,824 bytes) into PulseLedger. Self-hosted the complete font trio (`Instrument Serif`, `IBM Plex Mono`, `Hanken Grotesk`) locally in `public/fonts/`; merged authored CSS tokens and styles for both Dark (`--bg: #0c0e0d`, `--acc: #f0a63a`) and Light (`--bg: #f3eee2`, `--acc: #9a4400`) themes; wired live Cloudflare D1 data, 5-minute refresh timer, dual living canvas engines (`#bg` and `#tele`), Lenis smooth scrolling, GSAP split reveals and scroll triggers. Fixed root cause of scroll re-render loop by removing `lastUpdated` from timer effect dependencies (0 scroll re-renders verified via `renderDelta === 0`), wrapped check tables in horizontal scroll containers, and optimized mobile header flex layout (0 horizontal overflow on 390px and 320px viewports). Passed 73 Vitest tests, 12 Playwright public tests, and 0 secret scan findings. Preserved D1 single-row read-budget architecture. Side-by-side screenshots captured across 1440, 1024, 390, 320 viewports and both themes in `docs/motion-review/`.
13. Release-Blocking Regressions Fix (2026-11-05): Resolved the 6 regressions identified during review of commit `5515209`:
   - Scoped legacy admin typography strictly to `.admin-shell, .login-shell` and removed global h1/h2 overrides around `styles.css:1090`. Verified root public typography computed at 1440x900: `h1` = `Instrument Serif 400 144px` (matching reference `144px`), `h2` = `Instrument Serif 400 92.16px` (matching reference `92.16px`).
   - Eliminated hardcoded false "every project is operational" health copy by implementing `deriveStatusClaim(data, error)` in `StatusPage.tsx`. Truthfully derives status state and exact counts (e.g. `Partial degradation · 2 degraded, 9 operational`, `Major outage`, `System status unavailable`) across nominal, degraded, down, and incident conditions.
   - Standardized project group anchors with `slugifyProject(name)` producing destinations `#project-haan`, `#project-styleshopz`, `#project-codesense`, `#project-grepless`, `#project-arthasetu`, `#project-dispatch` alongside numeric aliases. Configured `scroll-margin-top: 96px` ensuring targets rest >16px below sticky masthead.
   - Restored desktop `#pipe` GSAP pinning (`pin: true, end: '+=2200'`) via GSAP `matchMedia('(min-width: 861px)')` driving `pipe(progress)` (progress 0..1) updating the timeline trace, playhead, clip-rect, and stages 01-04. Adapted `#pipe .in` with responsive wrap gutters (`width: min(1240px, 100% - 48px); margin: 0 auto; padding: 0 clamp(16px, 2.5vw, 40px)`). Natural mobile flow on `<=860px`. Removed competing rAF style transforms.
   - Replaced row of minuscule 9px links on mobile with an accessible touch drawer menu with touch targets >= 44px, keyboard/escape/focus handling, tested at 320px and 390px.
   - Overhauled `e2e/fidelity-side-by-side.spec.ts` to test matched before/mid/after scene phases for Chapters 1-4 on desktop (1440) and phone (390) in both dark and light themes, plus tablet (1024) and compact (320), asserting computed font styles and scene deltas.

## Feature Ledger

| ID | Behavior | Status | Evidence |
| --- | --- | --- | --- |
| SCROLL-CHOREO-1 | Hero 30D Drum Seismograph carriage (`#hero-drum-carriage`) and Chapter 1 (`#services`) physical 30-day ledger strip unspooling (`clip-path`, `#services-spool-fill`, `#services-spool-wheel`) driven by scroll position | verified | `e2e/public.spec.ts:128`, `docs/motion-review/chapter1-*`, `docs/motion-review/scroll-measurements.json` |
| SCROLL-CHOREO-2 | Chapter 2 (`#probe`) scroll-drawn SVG monitoring latency chronograph (`#timeline-svg-trace` `stroke-dashoffset`, `#timeline-area-group` `clip-path`, `#timeline-playhead-group` carriage) plotted from real D1 checks | verified | `e2e/public.spec.ts:191`, `docs/motion-review/chapter2-*`, `docs/motion-review/scroll-measurements.json` |
| SCROLL-CHOREO-3 | Chapter 3 (`#incidents`) scroll-driven rotary verification seal (`#incident-seal-ring` `stroke-dashoffset`, `#incident-seal-rotor` rotation, `#incident-spine-fill` scaleY) and broadsheet unfold | verified | `e2e/public.spec.ts:218`, `docs/motion-review/chapter3-*`, `docs/motion-review/scroll-measurements.json` |
| SCROLL-CHOREO-4 | Chapter 4 (`#method`) scroll-wired protocol signal bus (`#method-bus-line` `stroke-dashoffset`, `#method-signal-carriage` sweep) and opaque backing plates preventing waveform-to-text collisions | verified | `e2e/public.spec.ts:244`, `docs/motion-review/chapter4-*`, `docs/motion-review/scroll-measurements.json` |
| PROVENANCE-FINAL | Selectable recentChecks explorer with honest unavailable state, 'Recorded Checks' nav link and CTA, 0% empty uptime bar, 'JOURNAL: CLOUDFLARE D1' badge, zero synthetic fallback data | verified | `src/client/public/StatusPage.tsx`, `tests/status.test.ts`, `docs/screenshots/public-status-*.png` |
| BLOCKER-1 | Waveform relocated to dedicated lower margin band with 414px clearance from headline; hero grid rebalanced into full-height 30-Day Fleet Ledger Plate with zero empty gap | verified | `docs/screenshots/public-status-desktop.png`, `public-status-mobile.png`, `scripts/run-motion-review.mjs` |
| BLOCKER-2 | Removed all `Math.random()` and fake stages/PoPs/hashes; replaced with genuine Recorded Check Telemetry Inspector replaying actual D1 check records with illustrative response waveforms and explicit disclaimer | verified | `src/client/public/StatusPage.tsx`, `round2-probe-completed.png` |
| SEISMIC-1 | Dual-channel analog stylus needle ink traces gliding continuously across millimetric ledger paper rules | verified | `docs/motion-review/round1-desktop-initial-t0.png` vs `round1-desktop-later-t18.png` |
| SEISMIC-2 | Real-data driven health dynamics: smooth harmonic waves during nominal state; shock tremors during degraded/down states | verified | `src/client/public/StatusPage.tsx` state-driven canvas engine |
| SEISMIC-3 | Precision Laboratory Drum Oscillograph with physical scale markings and 5-stage mechanical pipeline | verified | `docs/motion-review/round2-probe-completed.png` |
| SEISMIC-4 | High-density Continuous Ledger Bands for services with inline 30-day seismograph day-ticks | verified | `docs/screenshots/public-status-desktop.png` |
| SEISMIC-5 | Physical embossed double-rule ink stamp status seals (zero sci-fi neon halos) | verified | `docs/motion-review/round1-desktop-initial-t0.png` |
| SEISMIC-6 | Equal-width 1440px benchmark comparison documenting visual divergence from CodeSense and Pathfolio | verified | `docs/screenshots/comparison-*.png` & `UI_REVIEW.md` |
| TYPOGRAPHY-1 | Self-hosted Space Grotesk variable font for all headings, brand, and UI | verified | `dist/fonts/space-grotesk-latin.woff2` (HTTP 200) |
| TYPOGRAPHY-2 | Self-hosted JetBrains Mono variable font for metrics, code, timestamps | verified | `dist/fonts/jetbrains-mono-latin.woff2` (HTTP 200) |
| ADMIN-UNIFY-1 | Private sign-in console sharing carbon slate ink theme | verified | `docs/screenshots/admin-login-desktop.png` & `admin-login-mobile.png` |
| ADMIN-UNIFY-2 | Authenticated owner desk unified with calm, dense, high-contrast operations journal language | verified | `docs/screenshots/admin-overview-desktop.png` & `admin-overview-mobile.png` |
| ADMIN-UNIFY-3 | Monitor manager, incident logger, and audit screens audited at 1440px and 390px | verified | `docs/screenshots/admin-monitors-*.png`, `admin-incidents-*.png`, `admin-audit-*.png` |
| CORE-1 | Public status overview displays real checks, latency, and uptime | verified | Playwright desktop flow (TC-PUB-01) |
| CORE-2 | Six distinct monitor states correctly rendered without unknown states | verified | Vitest status test (TC-STA-01) |
| CORE-3 | Manual and auto-refresh with aria-live announcements | verified | Playwright refresh test (TC-PUB-03) |
| CORE-4 | Expandable check history and response time sparkline | verified | Playwright drawer check (TC-PUB-02) |
| CORE-5 | No horizontal overflow on 1440px desktop and 390px mobile | verified | Playwright overflow check (TC-ACC-02) |
| CORE-6 | Admin area authentication, CSRF, and monitor management intact | verified | Vitest 66/66 & Playwright admin pass |

## Bounded Test Loop Summary

| Iteration | New Cases Executed | Failures Fixed | CORE Rerun Result | Open / Blocked | Next Action |
| --- | --- | --- | --- | --- | --- |
| 1 | 15 | 0 | passed (9 cases) | 0 | Adversarial testing |
| 2 | 13 | 0 | passed (9 cases) | 0 | Combinations & Release |
| 3 | 13 | 0 | passed (9 cases) | 0 | Final quality gate check passed |
| 4 | 6 (Seismic Redesign) | 0 | passed (9 cases) | 0 | Production Deployment & Verification |
| 5 | 4 (Blocker Fixes) | 0 | passed (9 cases) | 0 | GitHub Commit & Push (Visual Changes Only) |
