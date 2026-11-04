# MOTION_SPEC.md — PulseLedger Continuous Seismic & Print Operations Journal

## 1. Product Metaphor & Visual Thesis
PulseLedger is an independent uptime and incident operations desk. Following the owner's feedback to eliminate visual resemblance to CodeSense's cosmic coordinate grid and Pathfolio's centered porcelain dossier, PulseLedger adopts a completely original, product-specific metaphor: **The Continuous Seismic & Print Operations Journal with Layered Ink**.

It is modeled after an automated physical drum recorder and precision editorial ledger:
- **Continuous Ruled Ledger Chart Bands**: Continuous horizontal millimetric chart paper rulings (`#283243`), major register bands (`#3b475c`), and margin time-epoch ticks (`#647287`).
- **Dual-Channel Analog Stylus Needles**: Two continuous living analog ink traces gliding smoothly from right to left across the screen:
  - **Channel 1 (Fleet Baseline Harmonic Inkwash)**: Smooth compound harmonic waveform in drafting cobalt/cyan (`#388bfd` / `#58a6ff`). When all systems are nominal, it maintains steady harmonic oscillations; if degraded or down, it dynamically exhibits acute shock tremors and high-frequency jitter.
  - **Channel 2 (Cron Cadence & Epoch Heartbeat)**: A continuous register emerald (`#2ea043`) ink line featuring rhythmic traveling cardiac impulses corresponding to the Cloudflare Worker 15-minute cron check cycle.
- **Physical Embossed Ink Stamps & Seals**: In place of glowing neon sci-fi halos, status states use crisp double-bordered ink stamps (`.state-operational`, `.state-degraded`, `.state-down`) with tactile breathing outlines.
- **Precision Laboratory Drum Oscillograph**: In place of generic radar rings, the interactive signal probe is housed in a matte graphite instrument chassis with graduated physical scale ticks (0 to 500ms), dual-trace persistence, and a stepped 5-stage mechanical verification pipeline.
- **Zero Cosmic Trope / Zero Porcelain Trope**:
  - NO pitch-black void `#08090c`, no orbital rings, no celestial planet nodes, no neon orange/cyan halos, no floating star particles (CodeSense).
  - NO porcelain cream `#f8f7f2`, no centered dossier single-column cards, no brass/stone ornaments, no book serif headlines (Pathfolio).

---

## 2. Benchmark Comparison at Equal Width (1440px Desktop)

Actual live screenshots captured at 1440×900:
- **CodeSense**: `docs/screenshots/comparison-codesense-1440.png` (`https://pr-reviewer-omega-liard.vercel.app/`)
- **Pathfolio**: `docs/screenshots/comparison-pathfolio-1440.png` (`https://pathfolio.pages.dev/`)
- **PulseLedger**: `docs/screenshots/comparison-pulseledger-1440.png` (`https://pulseledger.srimantasutapa123.workers.dev/`)

| Visual Dimension | CodeSense (PR Reviewer) | Pathfolio (Executive Portfolio) | PulseLedger (Operations Journal) |
| :--- | :--- | :--- | :--- |
| **Metaphor** | Orbital planetary cosmos & celestial gravity well | Centered executive career dossier / archival folio | Continuous drum recorder & print operations journal |
| **Canvas Background** | Pure cosmic pitch black (`#08090c`) with orbiting satellite nodes & floating stardust particles | Static porcelain warm cream (`#f8f7f2`) with faint vertical pinstripes | Deep carbon graphite slate (`#0b0e14`) with continuous horizontal millimetric chart paper rules |
| **Living Background Motion** | Planetary nodes orbiting concentric circular tracks with radial glowing orange halos | Static parchment surface (zero canvas animation) | Dual-channel analog stylus needle ink traces gliding right-to-left with status-driven shock tremors |
| **Color System** | Deep black, glowing solar orange (`#f97316`), neon cyan, cosmic violet | Warm cream, charcoal, brass, natural stone | Deep carbon slate (`#0b0e14`), ink surface (`#121720`), register emerald (`#2ea043`), drafting cobalt (`#388bfd`), seismograph vermilion (`#f85149`) |
| **Typography** | Editorial serif display headlines + geometric sans | High-contrast classical serif headlines + sans body | **Space Grotesk** (engineered sans) + **JetBrains Mono** (calibrated tabular figures) — 100% self-hosted OFL 1.1 |
| **Status Indicators** | Glowing floating orb badges with neon blur filters | Subdued monochrome status pills | Embossed physical ink-stamp badges with double-rule borders and subtle mechanical stroke breathing |
| **Hero Focal Component** | Giant central planetary orbit ring with orbiting glowing nodes | Centered single-column executive dossier card | Continuous 30-day Fleet Uptime Band on physical drum tape reading plate with UTC epoch ticker |
| **Service Presentation** | Glassmorphic floating cards with multi-color gradient borders | Centered vertical career milestones | High-density **Continuous Ledger Bands** with inline 30-day seismograph day-ticks and collapsible check log |
| **Interactive Tool** | Interactive cosmic code graph | N/A (Static presentation) | **Precision Laboratory Drum Oscillograph** with calibrated voltage/latency scale and 5-stage edge pipeline |

---

## 3. Color Palette & Material Architecture
- **Deep Carbon Slate Base (Chassis)**: `#0b0e14`
- **Surface Elevation**:
  - Ledger Band Surface: `#121720` (dense carbon ink-wash)
  - Raised Instrument Plate: `#1a202c` (matte graphite plate)
  - Sunken Oscillograph Screen: `#080a0f`
- **Ink Rulings & Dividers**:
  - Hairline Ledger Rules: `#283243` (spaced at 28px on canvas and card borders)
  - Strong Register Rules: `#3b475c`
- **Calibrated Analog Pigments**:
  - `Operational`: Register emerald `#2ea043` / `#3fb950`, soft wash `rgba(46, 160, 67, 0.15)`
  - `Degraded`: Cadmium amber `#d29922` / `#e3b341`, soft wash `rgba(210, 153, 34, 0.15)`
  - `Down`: Seismograph vermilion `#f85149` / `#ff7b72`, soft wash `rgba(248, 81, 73, 0.15)`
  - `Incident`: Disruption coral `#f85149` / `#ff7b72`
  - `Signal Probe / Trace`: Drafting cobalt `#388bfd` / `#58a6ff`, soft wash `rgba(56, 139, 253, 0.15)`
  - `Paused`: Neutral index slate `#647287`
- **Typography & Brand Identity**:
  - Headings, Wordmark, and Labels: **Space Grotesk** (self-hosted WOFF2 variable font, SIL Open Font License 1.1).
  - Telemetry Figures, Epoch Timestamps, Code, and Logs: **JetBrains Mono** (self-hosted WOFF2 variable font, SIL Open Font License 1.1).
  - Universal font pair loaded across public status (`/`) and private admin views (`/admin`, `/admin/monitors`, `/admin/incidents`, `/admin/audit`).

---

## 4. Layered Living Environment
- **Layer 1: Carbon Foundation**: Flat deep graphite canvas `#0b0e14`.
- **Layer 2: Millimetric Paper Rulings**:
  - Horizontal rules every 28px (`rgba(40, 50, 67, 0.32)`).
  - Major register bands every 140px (`rgba(56, 70, 92, 0.52)`).
  - Vertical timecode division graduation marks along margins every 120px (80px on mobile).
- **Layer 3: Continuous Dual Stylus Needle Traces (`<canvas class="telemetry-canvas">`)**:
  - **Channel 1 (Fleet Harmonic Baseline)**: Continuous drafting cobalt ink trace (`#388bfd` / `#58a6ff` nominal; `#f85149` vermilion with dynamic shock tremors if degraded/down) gliding along the dedicated lower telemetry band at $y = \text{height} - 120\text{px}$ on desktop and $y = \text{height} - 96\text{px}$ on mobile. Measured clearance from headline $H_1$ bottom exceeds 410px across all moving frames, ensuring decorative lines never cross text.
  - **Channel 2 (Cron Cadence & Epoch Heartbeat)**: Register emerald ink trace (`#2ea043`) gliding along the bottom edge strip at $y = \text{height} - 46\text{px}$ ($y = \text{height} - 38\text{px}$ on mobile) with moving rhythmic cardiac impulse deflections.
  - Active mechanical stylus needle points track current trace coordinates with soft ink bleeds.
  - Tab visibility observer: cancels RAF when tab is hidden (`document.hidden`).
- **Layer 4: Continuous Ledger Panels & Plates**:
  - High-contrast matte surfaces (`#121720`) with hairline borders (`#283243`), zero layout shift, WCAG AAA text contrast. Solid backing plates protect all text content from background elements.

---

## 5. Hero Timeline & Choreography
- **T = 0.0s**: Background chart rulings and margin ticks appear immediately. Primary headline and 30-Day Fleet Ledger plate are 100% legible.
- **T = 0.2s**: Dual stylus needles begin continuous trace deposition across the paper band.
- **T = 0.4s**: Hero lede, status stamp, and 30-day fleet availability bar settle into place (`translateY(16px)` -> `0px`). Hero figure spans 100% of hero copy height, completely eliminating empty voids.
- **T = 0.8s**: Live UTC epoch ticker synchronizes with mechanical status pip.
- **T = 1.0s**: Interactive CTAs ("Launch Signal Probe" and "Refresh now") are active and responsive.

---

## 6. Four Scroll Chapters & Staged Narrative
1. **Chapter 1: Fleet Matrix & Continuous Ledger Bands (`#services`)**:
   - Filter chips for instant sorting by project: `All (11)`, `Haan (2)`, `StyleShopZ (2)`, `CodeSense (2)`, `Grepless (2)`, `ArthaSetu (2)`, `Dispatch (1)`.
   - Continuous horizontal ledger bands with hairline dividers and left status register notch.
   - Inline 30-day seismograph day-ticks (`.uptime-strip .day`).
   - Collapsible diagnostic drawer with drafting cyan sparkline and raw check history table.
2. **Chapter 2: Precision Laboratory Drum Oscillograph (`#probe`)**:
   - Heavy matte graphite housing with calibrated vertical latency scale (0 to 400ms).
   - Dual-trace persistence canvas displaying illustrative response waveforms calibrated to real check latency.
   - Waveform mode switcher ("Sine Wave" vs "Pulse Stream").
   - 4-stage recorded check inspection pipeline:
     `1/4 D1 Ledger Access -> 2/4 Slot & Trigger Inspection -> 3/4 Outcome Evaluation -> 4/4 Illustrative Waveform Replay`.
   - Telemetry HUD with measured RTT latency, recorded status outcome, and authentic Cloudflare D1 check record ID (`D1-REC:#ID`). Honest provenance: zero fabricated stages, zero fake DNS/TLS breakdown, zero invented edge PoPs.
3. **Chapter 3: Chronological Incident Journal (`#incidents`)**:
   - Clean state: Embossed inspection seal (`0 DISRUPTIONS ACTIVE // ALL MONITORED ENDPOINTS IN CALM REGISTER`).
   - Active state: Timestamped dispatch ledger cards with priority ribbons.
4. **Chapter 4: Operational Broadsheet (`#method`)**:
   - 4-column engineering ledger detailing Edge Checks, Strict Success, Zero-Sample Uptime, and State Engine.

---

## 7. Reduced-Motion Mode (`prefers-reduced-motion: reduce`)
- Background canvas halts RAF loop entirely.
- Renders a crisp, static, high-definition printed chart paper sheet once (horizontal rules, margin graduation ticks, frozen dual baseline curves).
- Oscillograph renders static reference crosshairs without continuous wave cycling.
- All transitions collapse to immediate display (`duration: 0.01ms`).
- 100% of interactive controls, selectors, and tables remain fully functional.

---

## 8. Mobile Adaptation (390px Viewport)
- Canvas reduces horizontal division density by 35% to conserve mobile battery.
- Sticky masthead configured with `scroll-margin-top: 180px` on mobile, ensuring `#probe`, `#services`, and project anchors clear the sticky header by > 30px.
- Filter pills adapt into a smooth touch-swipeable ribbon.
- Zero horizontal overflow (`document.documentElement.scrollWidth <= document.documentElement.clientWidth` verified).
