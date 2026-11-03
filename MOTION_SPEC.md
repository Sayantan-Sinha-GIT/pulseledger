# MOTION_SPEC.md — PulseLedger Telemetric Signal World

## 1. Product Metaphor & Visual Thesis
PulseLedger is an independent uptime and incident operations desk. Its visual metaphor is the **Telemetric Pulse Matrix**: a living edge observatory that continuously listens to the heartbeat of distributed services (Haan, StyleShopZ, CodeSense, Grepless, ArthaSetu, Dispatch). It avoids consumer SaaS tropes (floating generic blobs, cartoon illustrations, rainbow cards) in favor of **tactile aerospace telemetry**: luminous oscilloscope waveforms, packet propagation vectors, edge coordinate lines, and atomic clock precision.

## 2. Color Palette & Material Architecture
- **Deep Slate Void (Chassis)**: `#070a0f` base background, with subtle layered radial gradients of deep obsidian `#0b1018` and navy slate `#101726`.
- **Surface Elevation**: Cards and drawers use `#0d131f` (sunken), `#121a2b` (raised), and `#172136` (hover/active), framed with hairline telemetry borders (`1px solid rgba(148, 163, 184, 0.12)`).
- **Signal Status Luminance**:
  - `Operational`: Vibrant emerald `#00e599` (core), `#059669` (border), `rgba(0, 229, 153, 0.15)` (ambient glow aura).
  - `Degraded`: Alert amber `#fbbf24` (core), `#d97706` (border), `rgba(251, 191, 36, 0.15)` (glow).
  - `Down`: Disruption crimson `#f43f5e` (core), `#e11d48` (border), `rgba(244, 63, 94, 0.2)` (glow).
  - `Incident`: Telemetry violet `#a855f7` (core), `#9333ea` (border), `rgba(168, 85, 247, 0.18)` (glow).
  - `Paused`: Telemetric slate `#64748b` (core), `#475569` (border).
  - `Unknown`: Neutral zinc `#71717a`.
- **Signal Accents**: Cyan `#00d4ff` (ping trace and active beam), Ice White `#f8fafc` (primary typography), Muted Phosphor `#94a3b8` (secondary telemetry tags).
- **Typography & Brand Identity**:
  - Display, Headings, and Interface: **Space Grotesk** (self-hosted WOFF2 variable font, SIL Open Font License 1.1). Precision engineered geometric character.
  - Telemetry Data, Numbers, Code, and Timestamps: **JetBrains Mono** (self-hosted WOFF2 variable font, SIL Open Font License 1.1). Monospace clarity with clear 0/O distinction and tabular figures.
  - Zero generic system type (`Segoe UI`, `Iowan Old Style` serif removed across both public and private areas).
- **Unified Surface Architecture**:
  - The entire site—public status (`/`), private owner sign-in (`/admin`), and authenticated operations desk (Overview, Monitors, Incidents, Activity)—is unified around the dark telemetric chassis. Admin tasks maintain restrained operational density, low eye strain, and rapid keyboard/touch response.

## 3. Layered Living Environment (Above & Below Fold)
- **Layer 1: Edge Ambient Gradient Field**:
  - Subtle drifting radial aura (`radial-gradient`) tied to fleet health. Reflects operational state: soft emerald breathing pulse when all services are green; amber undertone if degraded.
- **Layer 2: Orthogonal Telemetry Grid**:
  - SVG/CSS micro-grid with coordinate markers (`32px` intervals, hairline opacity `0.05`), crosshair reticles at intersections, and edge datum coordinates (`CF-EDGE.APAC`, `LAT: 22.57°N`, `LONG: 88.36°E`).
- **Layer 3: Living Signal Canvas (`<canvas class="telemetry-canvas">`)**:
  - Continuous 60fps lightweight particle & signal packet bus.
  - Horizontal and vertical signal busbars with discrete data packets gliding at controlled velocities.
  - Pulse sonar rings gently emanating from the hero origin every 4.2 seconds.
  - Pauses execution automatically via `IntersectionObserver` when offscreen, or when tab is backgrounded (`visibilitychange`).
- **Layer 4: High-Contrast Frosted Telemetry Panels**:
  - Content containers with `backdrop-filter: blur(12px)` and subtle hairline edge lighting. Numbers, tables, and buttons maintain WCAG AAA contrast ratios (minimum 7:1 for text, 4.5:1 for UI components).

## 4. Hero Timeline & Choreography
- **T = 0.0s**: Background grid and coordinate markings appear instantly (zero layout jump; fully readable immediately).
- **T = 0.2s**: Ambient radar pulse expands outward in concentric rings.
- **T = 0.4s**: Primary status badge and headline reveal with subtle vertical spring (`translateY(16px)` -> `0px`, `opacity: 0` -> `1`).
- **T = 0.6s**: Hero telemetry figures (30-day uptime, monitored services, edge check interval) count up / settle into place.
- **T = 0.8s**: The Live Heartbeat Ring synchronizes: a gentle 4-second sinusoidal breathing glow (`box-shadow: 0 0 24px rgba(0, 229, 153, 0.4)`).
- **T = 1.0s**: Quick-jump navigation and manual refresh controls illuminate.

## 5. Four Scroll Chapters & Staged Dashboard Narrative
1. **Chapter 1: The Fleet Matrix & Live Mesh (`#services`)**:
   - Filter chips allow instant sorting by project: `All (11)`, `Haan (2)`, `StyleShopZ (2)`, `CodeSense (2)`, `Grepless (2)`, `ArthaSetu (2)`, `Dispatch (1)`.
   - Each service card features:
     - Real-time pulse indicator matching the monitor state.
     - Interactive 30-day uptime strip with day-by-day telemetry tooltips.
     - SVG response-time trend sparkline with gradient fill.
     - Expandable deep diagnostic drawer with recent check history table and HTTP status codes.
2. **Chapter 2: Interactive Signal Probe & Telemetry Sandbox (`#probe`)**:
   - A real, working interactive diagnostic tool for visitors.
   - Allows selecting any of the 11 monitored endpoints (e.g. `Haan website`, `CodeSense review service`, `Dispatch`) or running a synthetic edge probe.
   - Clicking **"Fire Edge Probe"** simulates the Cloudflare Worker 5-stage edge check:
     1. DNS Resolution (Cloudflare 1.1.1.1)
     2. TLS 1.3 Handshake (ECDHE-ECDSA)
     3. Edge HTTP Handshake (`redirect: manual`, strict 10s timeout)
     4. Response Validation (2xx/3xx assertion)
     5. D1 Ledger Commit (cryptographic hash & slot deduplication)
   - Real-time animated SVG/canvas Oscilloscope visualizing response waveform, packet jitter, and latency thresholds.
   - Real-time metric readouts: Total Latency (ms), Time to First Byte (TTFB), DNS time, Status Code (`HTTP 200 OK`), and Edge Node ID (`CCU/BOM/SIN`).
3. **Chapter 3: Forensic Incident Stream (`#incidents`)**:
   - Chronological incident ledger.
   - Highlights active incidents with amber/crimson priority banners and timestamped updates.
   - If zero incidents are open, displays the cryptographic zero-disruption ledger seal: confirming all recorded checks are genuine with zero invented history.
4. **Chapter 4: Operational Protocol & Zero-Sample Truth (`#method`)**:
   - Four interactive protocol cards detailing edge cron execution, SSRF validation, mathematical state thresholds, and PBKDF2 cryptographic session security.

## 6. Response, Continuity & Micro-Interactions
- **Button Feedback**: Micro-scale transition (`transform: scale(0.98)` on active) with high-intensity border highlight.
- **Day Strip Hover**: Hovering over a day block in the 30-day strip illuminates the corresponding day check summary and highlights the sparkline coordinate.
- **Scroll Sync**: As the user scrolls, chapter indicator dots update in the sticky masthead, maintaining orientation through the telemetric journey.

## 7. Mobile Adaptation (Viewport: 390px × 844px)
- Telemetry canvas automatically reduces packet count by 65% on screens under 768px to preserve battery and 60fps frame rates.
- Project filter pills convert to a touch-optimized horizontally swipeable ribbon with fading scroll edges.
- Interactive Signal Probe displays a compact mobile telemetry HUD with stacked oscilloscope and single-touch probe trigger.
- Service cards stack stats neatly in a 2x2 grid, maintaining 48px minimum touch targets for all buttons and links.
- Zero horizontal overflow guaranteed via rigid container clamping and `overflow-x: hidden` guardrails.

## 8. Reduced-Motion Mode (`prefers-reduced-motion: reduce`)
- Canvas animation loop is paused; a single static telemetry coordinate frame is rendered.
- CSS transitions and animations are replaced with immediate visibility or short opacity changes (`duration: 0.01ms`).
- Heartbeat glow becomes a stable, high-contrast glow indicator.
- Interactive probe instantly displays probe results without waiting for simulated packet sweeps.
- All content, interactive features, tables, and buttons remain 100% accessible.

## 9. Performance Budget & Guardrails
- **FPS Target**: Steady 60fps on modern mobile and desktop browsers.
- **GPU Acceleration**: Animations restricted to `transform` and `opacity`. No layout thrashing or `getComputedStyle` in scroll/render loops.
- **Offscreen Throttling**: Particle/radar canvas pauses rendering when not in viewport (`IntersectionObserver`).
- **Tab Background Throttling**: Animation loops cancel when document is hidden (`document.visibilityState === "hidden"`).
- **Bundle Size**: Pure vanilla TypeScript/React + SVG + HTML5 Canvas. Zero heavy 3D or bloated third-party animation libraries added.

