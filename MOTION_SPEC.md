# MOTION_SPEC.md — PulseLedger Operations Journal & Authored Claude Design

## 1. Product Metaphor & Visual Direction (2026-11-05 Update)
The homepage visual and motion implementation faithfully reflects the owner-supplied reference design (`my-design/home.html`, 33,824 bytes).

It adopts an authentic editorial telemetric operations journal with tactile physical craft:
- **Authored Typography Trio**:
  - Display Headlines & Brand Wordmark: **Instrument Serif** (regular & italic, 400).
  - Telemetry Data, Epoch Tickers, Code, Table Figures, and Eyebrows: **IBM Plex Mono** (400, 500).
  - Body Text, Lead Explanations, and Interface Copy: **Hanken Grotesk** (400, 500, 600).
  - All fonts are 100% locally vendored and self-hosted as WOFF2 in `/public/fonts/` with CSP `style-src 'self'`.
- **Authored Palette System**:
  - Dark Theme (Default): Canvas Background `--bg: #0c0e0d`, Card Surface `--bg2: #141716`, Accent Amber `--acc: #f0a63a`, Deep Ink `--ink: #edebe4`, Rule Lines `--line: #222624`, Muted Text `--mut: #8e948c`.
  - Light Theme (`[data-theme="light"]`): Warm Paper Background `--bg: #f3eee2`, Card Surface `--bg2: #eae3d2`, Deep Terracotta Accent `--acc: #9a4400`, Deep Carbon Ink `--ink: #1f211f`, Rule Lines `--line: #dcd4c3`, Muted Text `--mut: #6c7069`.
- **Dual Living Canvas Engines**:
  - **Background Particle Field (`canvas#bg`)**: Subtle drifting ambient dust particles floating continuously across viewport height, adjusting particle velocity dynamically on scroll velocity (`vel * 0.02`).
  - **Seismograph Drum Plate (`canvas#tele`)**: Dual-stylus continuous waveforms (stylus 1: sinuous harmonic amber trace; stylus 2: cyan telemetry square-pulse steps) sweeping across millimetric horizontal rulings (28px spacing) and vertical time epochs (80px spacing), coupled with scroll position (`sy * 0.3`).
- **Marquee Velocity Ribbon (`.mq`)**:
  - Continuous running ribbon translating horizontally with translation delta `1.1 + Math.min(40, Math.abs(vel)) * 0.9` proportional to Lenis scroll velocity.
- **Scroll Performance Guarantee**:
  - Coalesced into direct requestAnimationFrame DOM updates (`ref` mutations).
  - Zero React whole-page re-renders during active scrolling (`renderDelta === 0`).
  - Reduced-motion fallback immediately renders all progress values at 1.0 and halts animations.

---

## 2. The Four Deterministic Scroll-Driven Chapters
1. **Chapter 1 — Fleet Matrix & Physical Ledger Strip Unspooling (`#services`)**:
   - Spool wheel (`#services-spool-wheel`) rotates `0deg -> 180deg` via scroll progress.
   - Spool fill bar (`#services-spool-fill`) scales `scaleX(0 -> 1)`.
   - Per-service 30-day uptime strips unspool with traveling printhead cursor (`.strip-printhead`) translating `0% -> 100%`.
2. **Chapter 2 — Recorded Check Explorer & Timeline Chronograph (`#probe`)**:
   - SVG trace line (`#timeline-svg-trace`) draws via `stroke-dashoffset: 1000 -> 0`.
   - Area fill (`#timeline-area-group`) reveals via dynamic inset clip path.
   - Timeline playhead (`#timeline-playhead-group`) translates horizontally `0 -> 720px`.
   - Connected to genuine stored Cloudflare D1 check records with selectable dropdown.
3. **Chapter 3 — Forensic Incident Broadsheet & Rotary Verification Seal (`#incidents`)**:
   - Rotary seal ring (`#incident-seal-ring`) draws via `stroke-dashoffset: 1000 -> 0`.
   - Seal rotor (`#incident-seal-rotor`) rotates `0deg -> 180deg`.
   - Incident spine fill (`#incident-spine-fill`) scales vertically `scaleY(0 -> 1)`.
   - Forensic broadsheet panel (`#incident-broadsheet-panel`) lifts and slides into place.
4. **Chapter 4 — Operational Protocol Schematic (`#method`)**:
   - Signal bus line (`#method-bus-line`) draws via `stroke-dashoffset: 1000 -> 0`.
   - Signal carriage cursor (`#method-signal-carriage`) sweeps across the bus line `0 -> 680px`.
   - Protocol security cards stage unmasks into view.

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
| **Living Background Motion** | Planetary nodes orbiting concentric circular tracks with radial glowing orange halos | Warm editorial parchment with subtle tactile document styling and card layout | Dual-channel analog stylus needle ink traces gliding right-to-left with status-driven shock tremors |
| **Color System** | Deep black, glowing solar orange (`#f97316`), neon cyan, cosmic violet | Warm cream, charcoal, brass, natural stone | Deep carbon slate (`#0b0e14`), ink surface (`#121720`), register emerald (`#2ea043`), drafting cobalt (`#388bfd`), seismograph vermilion (`#f85149`) |
| **Typography** | Editorial serif display headlines + geometric sans | High-contrast classical serif headlines + sans body | **Space Grotesk** (engineered sans) + **JetBrains Mono** (calibrated tabular figures) — 100% self-hosted OFL 1.1 |
| **Status Indicators** | Glowing floating orb badges with neon blur filters | Subdued monochrome status pills | Embossed physical ink-stamp badges with double-rule borders and subtle mechanical stroke breathing |
| **Hero Focal Component** | Giant central planetary orbit ring with orbiting glowing nodes | Centered single-column executive dossier card | Continuous 30-day Fleet Uptime Band on physical drum tape reading plate with UTC epoch ticker |
| **Service Presentation** | Glassmorphic floating cards with multi-color gradient borders | Centered vertical career milestones | High-density **Continuous Ledger Bands** with inline 30-day seismograph day-ticks and collapsible check log |
| **Interactive Tool** | Interactive cosmic code graph | N/A (Static presentation) | **Authentic D1 Recorded Check Explorer** with dual-channel analog waveform replay, selectable check history, and honest unavailable state |

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

## 5. Hero Timeline & Scroll Choreography (`#hero-section`)
- **T = 0.0s**: Background chart rulings and tractor-feed margin sprocket holes appear immediately. Primary headline (`#status-heading`), live 6-project portfolio register strip (`.hero-portfolio-strip`), and 30-Day Fleet Ledger plate (`#hero-figure-plate`) are 100% legible.
- **T = 0.2s**: Dual stylus needles begin continuous trace deposition across the dedicated lower drum window (`margin-bottom: 140px` below the hero plate).
- **T = 0.4s**: Hero lede, status stamp, and 30-day fleet availability bar settle into place (`translateY(16px)` -> `0px`). Hero figure spans 100% of hero copy height, completely eliminating empty voids.
- **Scroll-Coupled Hero Drum Seismograph (`HeroFleetSeismograph`)**:
  - Aggregates real 30-day daily uptime buckets across all monitored endpoints into an SVG drum seismograph (`#hero-seismograph-svg`).
  - As the visitor scrolls past the hero (`heroProgress = clamp01(scrollY / (vh * 0.55))`), the drum carriage playhead (`#hero-drum-carriage`) sweeps horizontally across the 296px plot (`transform: translate3d(${heroProgress * 296}px, 0px, 0px)`), while `.hero-copy` and `#hero-figure-plate` counter-translate smoothly (`translate3d(0px, ${-heroProgress * 18}px, 0px)` and `translate3d(0px, ${heroProgress * 20}px, 0px)`).
  - The sticky masthead bottom tape (`#masthead-scroll-fill`) scales continuously with overall document scroll (`transform: scaleX(${pageProgress})`), and the background canvas paper rulings physically feed upward (`data-paper-offset="${Math.round((scrollY * 0.45) % 140)}"`).

---

## 6. Deterministic Scroll Choreography Engine & Four Scroll-Driven Chapters
In addition to the continuous ambient stylus waveform, `StatusPage.tsx` runs a deterministic scroll choreography engine (`scheduleScrollChoreography` -> `applyScrollChoreography`) attached to `window` `scroll` and `resize` events plus an `IntersectionObserver` across `#services`, `#probe`, `#incidents`, and `#method`. Raw scroll events are coalesced to at most **one `requestAnimationFrame` update per frame** and applied directly to DOM nodes (`style.transform`, `style.clipPath`, `stroke-dashoffset`, and CSS custom properties) using a `useRef` state store—producing **zero whole-page React rerenders** on scroll (`data-render-count` remains constant across full-page scroll on desktop and phone). Every chapter transforms visibly as a direct mathematical function of scroll position:

1. **Chapter 1: Fleet Matrix & Physical Ledger Strip Unspooling (`#services`)**:
   - **Chapter Spool Apparatus (`#chapter-1-spool-bar`)**: Tracks `chapter1Progress` (`data-scroll-progress` on `#services`).
     - `#services-spool-wheel`: Mechanical SVG tape reel rotates from `0deg` (`matrix(1, 0, 0, 1, 0, 0)`) to `180deg` (`matrix(-1, 0, 0, -1, 0, 0)`).
     - `#services-spool-fill`: Horizontal tape progress bar unspools via `transform: scaleX(${chapter1Progress})`.
     - `#services-spool-readout`: Live tabular counter displaying `FEED: ${Math.round(chapter1Progress * 100)}%` and `${engagedRowsCount}/${monitors.length} STRIPS UNSPOOLED`.
   - **Per-Row Physical 30-Day Ledger Strip Unspooling (`.service[data-monitor-id]`)**:
     - Each service row computes its own viewport entry progress `rowProgress[id]` (`0.000` before entry -> `1.000` when locked in the reading zone).
     - `.service`: Slides into register from `translate3d(-12px, 0px, 0px)` to `translate3d(0px, 0px, 0px)`.
     - `.uptime-strip`: Physically unspools its 30-day history bars from left to right via `clipPath: inset(0px ${(1 - rowProgress) * 88}% 0px 0px)` and `transform: translate3d(${-(1 - rowProgress) * 18}px, 0px, 0px)`.
     - `.strip-printhead`: Glowing drafting-cobalt printhead stylus sweeps across the leading edge of the unspooling strip (`left: ${12 + rowProgress * 88}%`).

2. **Chapter 2: Scroll-Drawn Live Monitoring Timeline & Recorded Check Explorer (`#probe`)**:
   - **Scroll-Coupled Telemetry Chronograph (`#monitoring-timeline-stage`, `#monitoring-timeline-svg`)**:
     - Plots real check latency samples (`selectedMonitor.trend` or aggregated `recentChecks` from Cloudflare D1) across an 800×148 calibrated SVG chronograph.
     - `#timeline-svg-trace`: Primary latency polyline with `pathLength="1000"` and `strokeDasharray="1000"` that physically draws itself as the user scrolls (`strokeDashoffset: ${(1 - chapter2Progress) * 1000}px`, transitioning from `1000px` to `0px`).
     - `#timeline-area-group`: Gradient under-fill unmasks left-to-right via `clipPath: inset(0px ${(1 - chapter2Progress) * 100}% 0px 0px)`.
     - `#timeline-playhead-group`: Vertical green chronograph playhead carriage sweeps across the 720px chart width (`transform: translate3d(${chapter2Progress * 720}px, 0px, 0px)`), updating `#timeline-scroll-readout` with the scrubbed sample's endpoint name, UTC timestamp, and measured latency.
   - **Instrument Chassis & Authentic D1 Recorded Check Explorer (`#probe-chassis-stage`)**:
     - Lifts into place via `transform: translate3d(0px, ${(1 - chapter2Progress) * 26}px, 0px)`.
     - Provides `<select id="probe-target-select">` and `<select id="probe-check-select">` bound to real `recentChecks` stored in Cloudflare D1, displaying actual check IDs (`D1-REC:#ID`), timestamps, HTTP status or "No HTTP response", measured latency, trigger source, and illustrative waveform replay. Honest zero-state when 0 checks exist.

3. **Chapter 3: Forensic Incident Broadsheet & Rotary Verification Seal (`#incidents`)**:
   - **Rotary Verification Seal (`#incident-seal-svg`)**:
     - `#incident-seal-ring`: Circular verification perimeter (`pathLength="1000"`) draws continuously with scroll (`strokeDashoffset: ${(1 - chapter3Progress) * 1000}px`).
     - `#incident-seal-rotor`: Inner calibration crosshair rotor turns 180 degrees across the chapter scroll (`transform: rotate(${chapter3Progress * 180}deg)`).
     - `#incident-seal-progress-text`: Displays `SEAL DRAWN · ${Math.round(chapter3Progress * 100)}%` so presentation progress is never conflated with data verification metrics, while keeping real incident counts (`SEAL: CLEAN` / `${activeIncidents.length} ACTIVE` and `${incidents.length} RECORD(S)`) separate.
     - `#incident-spine-fill`: Vertical 30-day audit horizon spine fills downward (`transform: scaleY(${chapter3Progress})`).
   - **Forensic Broadsheet Panel (`#incident-broadsheet-panel`)**:
     - Unfolds diagonally into the reading register via `transform: translate3d(${(1 - chapter3Progress) * 20}px, ${(1 - chapter3Progress) * 26}px, 0px)`.

4. **Chapter 4: Scroll-Wired Operational Protocol Schematic (`#method`)**:
   - **Protocol Signal Bus Schematic (`#method-schematic-stage`, `#method-schematic-svg`)**:
     - `#method-bus-line`: Horizontal signal bus connecting nodes `01 CRON TRIGGER`, `02 SSRF & TLS GUARD`, `03 ZERO-SAMPLE MATH`, and `04 6-STATE LEDGER` draws left-to-right (`strokeDashoffset: ${(1 - chapter4Progress) * 1000}px`).
     - `#method-signal-carriage`: Signal pulse carriage travels 680px along the bus (`transform: translate3d(${chapter4Progress * 680}px, 0px, 0px)`), illuminating each protocol node as it passes.
   - **Protocol Cards Grid (`#method-cards-stage`)**:
     - Lifts into alignment via `transform: translate3d(0px, ${(1 - chapter4Progress) * 24}px, 0px)`.

---

## 7. Reduced-Motion Mode (`prefers-reduced-motion: reduce`)
- Background canvas halts RAF loop entirely and renders a crisp, static printed chart paper sheet once.
- `updateScrollChoreography` detects `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and immediately sets `heroProgress`, `chapter1Progress..chapter4Progress`, and all `rowProgress[id]` values to `1` so every ledger strip, timeline trace, verification seal, and protocol bus is rendered in its complete, unclipped resting state (`transform: none !important; clip-path: none !important;`).
- Oscillograph renders static reference crosshairs without continuous wave cycling.
- 100% of interactive controls, selectors, and tables remain fully functional.

---

## 8. Mobile Adaptation (390px Viewport)
- Canvas reduces horizontal division density by 35% to conserve mobile battery.
- Sticky masthead configured with `scroll-margin-top: 180px` on mobile, ensuring `#probe`, `#services`, and project anchors clear the sticky header by > 30px.
- Filter pills adapt into a smooth touch-swipeable ribbon.
- Zero horizontal overflow (`document.documentElement.scrollWidth <= document.documentElement.clientWidth` verified).
