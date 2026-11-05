# MOTION_SPEC.md — PulseLedger Operations Journal & Authored Claude Design

## 1. Product Metaphor & Visual Direction
The homepage visual and motion implementation faithfully reflects the owner-supplied reference design (`my-design/home.html`, 33,824 bytes).

It adopts an authentic editorial telemetric operations journal with tactile physical craft:
- **Authored Typography Trio**:
  - Display Headlines & Brand Wordmark: **Instrument Serif** (normal 400).
    - `h1`: `clamp(52px, 10vw, 160px)` (computed size at 1440px desktop: `144px`, identical to reference `144px`).
    - `h2`: `clamp(40px, 6.4vw, 100px)` (computed size at 1440px desktop: `92.16px`, identical to reference `92.16px`).
    - `h3`: `clamp(26px, 3vw, 40px)`.
    - `p.lead`: `clamp(18px, 1.6vw, 22px)`.
  - Telemetry Data, Epoch Tickers, Code, Table Figures, and Eyebrows: **IBM Plex Mono** (400, 500).
  - Body Text, Lead Explanations, and Interface Copy: **Hanken Grotesk** (400, 500, 600).
  - All fonts are 100% locally vendored and self-hosted as WOFF2 in `/public/fonts/` with CSP `style-src 'self'`.
  - Legacy admin typography is strictly scoped to `.admin-shell, .login-shell` with zero cascade collision on public routes.
- **Authored Palette System**:
  - Dark Theme (Default): Canvas Background `--bg: #0c0e0d`, Card Surface `--bg2: #141716`, Accent Amber `--acc: #f0a63a`, Deep Ink `--ink: #edebe4`, Rule Lines `--line: #222624`, Muted Text `--mut: #8e948c`.
  - Light Theme (`[data-theme="light"]`): Warm Paper Background `--bg: #f3eee2`, Card Surface `--bg2: #eae3d2`, Deep Terracotta Accent `--acc: #9a4400`, Deep Carbon Ink `--ink: #1f211f`, Rule Lines `--line: #dcd4c3`, Muted Text `--mut: #6c7069`.
- **Dual Living Canvas Engines**:
  - **Background Particle Field (`canvas#bg`)**: Subtle drifting ambient dust particles floating continuously across viewport height, adjusting particle velocity dynamically on scroll velocity (`vel * 0.02`).
  - **Seismograph Drum Plate (`canvas#tele`)**: Dual-stylus continuous waveforms (stylus 1: sinuous harmonic amber trace; stylus 2: cyan telemetry square-pulse steps) sweeping across millimetric horizontal rulings (28px spacing) and vertical time epochs (80px spacing), coupled with scroll position (`sy * 0.3`).
- **Marquee Velocity Ribbon (`.mq`)**:
  - Continuous running ribbon translating horizontally with translation delta `1.1 + Math.min(40, Math.abs(vel)) * 0.9` proportional to Lenis scroll velocity.
- **Scroll Performance Guarantee**:
  - Direct requestAnimationFrame updates via direct ref mutations.
  - Zero React whole-page re-renders during active scrolling (`renderDelta === 0`).
  - Reduced-motion fallback immediately renders all progress values at 1.0 and halts animation loops.

---

## 2. Desktop Pinned Check Explorer (`#pipe`) & GSAP MatchMedia
On screens with viewport width $\ge 861\text{px}$, the `#pipe` telemetry section pins to the viewport for `+=2200px` of scroll using GSAP ScrollTrigger:
- **GSAP Configuration**:
  ```ts
  ScrollTrigger.matchMedia({
    '(min-width: 861px)': () => {
      ScrollTrigger.create({
        trigger: '#pipe',
        start: 'top top',
        end: '+=2200',
        pin: true,
        scrub: 0.6,
        onUpdate: (self) => pipe(self.progress),
      });
    },
    '(max-width: 860px)': () => {
      // Natural document flow on phone/mobile without pin
      pipe(1);
    }
  });
  ```
- **Driver Function `pipe(progress: 0..1)`**:
  - `#timeline-svg-trace`: Polyline path length is $629\text{px}$. Progress linearly decreases `stroke-dashoffset` from $629\text{px}$ (at progress 0) to $0\text{px}$ (at progress 1).
  - `#probe-playhead`: Sweeps carriage horizontally across the graph from $0\%$ to $100\%$.
  - `#probe-clip-rect`: Expands clip path horizontally `width: 0% -> 100%`.
  - Stages 01 to 04 (`#pipe-stage-1` to `#pipe-stage-4`): Sequentially activate with glowing accent borders and live telemetry readouts.
- **Wrap Gutters Adaptation**:
  - Authored `#pipe .in` in `my-design/home.html` had `width: 100%` which caused text on the left edge to sit flush or clip against the viewport edge.
  - Adapted with responsive wrap gutters: `width: min(1240px, 100% - 48px); margin: 0 auto; padding: 0 clamp(16px, 2.5vw, 40px);` ensuring clean, readable margins across all screen widths.
- **Elimination of Competing Transforms**:
  - GSAP ScrollTrigger exclusively controls `#timeline-svg-trace` and stages.
  - Removed competing `applyScrollChoreography` style overrides to avoid rAF/GSAP jitter.

---

## 3. The Four Deterministic Scroll-Driven Chapters
1. **Chapter 1 — Fleet Matrix & Live Mesh (`#services`)**:
   - 11 monitored endpoints grouped across 6 projects (`haan`, `styleshopz`, `codesense`, `grepless`, `arthasetu`, `dispatch`).
   - Project anchors standardized as `#project-<slug>` with alias `#project-<index>`.
   - `scroll-margin-top: 96px` guarantees all anchor jump targets rest with comfortable $>16\text{px}$ clearance beneath the 64px sticky masthead.
   - Interactive 30-day health strip and expandable recent check log drawer.
2. **Chapter 2 — Recorded Check Telemetry & Signal Explorer (`#probe`)**:
   - Desktop pinned GSAP explorer (`#pipe`) sweeping latency chronograph and authentic D1 check records.
   - Selectable `<select id="probe-check-select">` bound to genuine D1 check records from status API (`recentChecks`).
   - Honest unavailable zero-state with disabled controls when zero checks are stored.
   - Oscilloscope tagged with explicit illustrative waveform disclaimer and real D1 integer check primary key (`D1-REC:#ID`).
3. **Chapter 3 — Forensic Incident Stream & Verification Seal (`#incidents`)**:
   - Rotary verification seal SVG (`#incident-seal-ring`) with circumference $2 \times \pi \times 70 \approx 440\text{px}$ drawing dynamically via `stroke-dashoffset`.
   - Inner rotor rotates $180^\circ$ across scroll.
   - Forensic broadsheet panel unfolds with incident status, impact timeline, and updates.
   - Cryptographic zero-incident seal displayed when fleet is fully operational.
4. **Chapter 4 — Zero-Sample Method & Operational Protocol (`#method`)**:
   - Signal bus line SVG (`#method-bus-line`, length $1000\text{px}$) draws via `stroke-dashoffset: 1000 -> 0`.
   - Signal carriage sweeps across the bus line.
   - Four numbered protocol cards explaining Cloudflare Workers cron execution, SSRF validation, mathematical state rules, and complete 6-state status legend.

---

## 4. Mobile Navigation & Touch Experience
- **Touch Target Floor**: All interactive navigation buttons and menu items meet the $\ge 44\text{px} \times 44\text{px}$ touch target requirement.
- **Drawer Menu Architecture**:
  - Mobile masthead displays compact `.mobile-nav-toggle` button.
  - Clicking toggle opens full-height accessible navigation drawer (`.mobile-menu-panel`) over darkened backdrop (`.mobile-menu-backdrop`).
  - Provides direct touch-friendly links to all chapters (`#services`, `#probe`, `#incidents`, `#method`), all 6 project groups (`#project-haan`, `#project-styleshopz`, etc.), and `/admin`.
  - Accessible keyboard behavior: document-level `Escape` key immediately closes the drawer and restores focus.
- **Zero Horizontal Overflow**:
  - Measured `document.documentElement.scrollWidth <= document.documentElement.clientWidth` on both 390px (iPhone/Pixel standard) and 320px (compact mobile).

---

## 5. Truthful Health Copy & Provenance Rules
- **Dynamic Status Derivation**:
  - Implemented `deriveStatusClaim(data, error)` in `StatusPage.tsx`.
  - Truthfully emits overall fleet state and exact per-state counts:
    - Nominal: `All 11 endpoints operational`
    - Degraded: `Partial degradation · 2 degraded, 9 operational`
    - Major Outage: `Major outage · 3 down, 8 operational`
    - Incident Active: `Incident active · 1 incident, 10 operational`
    - Stale / Error: `System status unavailable · check back shortly`
  - Zero hardcoded cosmetic "every project is operational" claims.
- **Data Provenance**:
  - Zero `Math.random()` synthetic data in production UI or tests.
  - Zero simulated DNS/TLS/TTFB breakdown stages.
  - Single-row D1 read budget strictly preserved (persisted snapshot row in `public_snapshots`, 5-minute UI refresh, 15-minute cron).

---

## 6. Reduced-Motion & Battery Budget
- Detects `prefers-reduced-motion: reduce`.
- Immediately halts continuous canvas animation loops and Lenis smooth scrolling.
- Renders all progress states at 1.0 (unclipped strips, fully drawn SVG paths, resting stages).
- Tab visibility listener pauses canvas rendering loops when `document.hidden` is true, preserving device battery.
