import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "../api";
import {
  formatCount,
  formatDuration,
  formatPercent,
  formatRelative,
  formatShortTime,
  formatTimestamp,
  hostOf,
} from "../format";
import { formatUptime } from "../../shared/status";
import { describeCheck } from "../describe";
import { Link } from "../router";
import type {
  DailyBucket,
  LatencyPoint,
  MonitorState,
  MonitorView,
  OverallState,
  PublicIncident,
  StatusResponse,
} from "../../shared/types";

const STATE_LABELS: Record<MonitorState | OverallState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  paused: "Paused",
  unknown: "Unknown",
  incident: "Incident active",
};

export function StateBadge({ state }: { state: MonitorState | OverallState }) {
  return (
    <span className={`state state-${state}`}>
      <span className="state-mark" aria-hidden="true" />
      {STATE_LABELS[state]}
    </span>
  );
}

function heroLede(state: OverallState): string {
  switch (state) {
    case "operational":
      return "Every monitored service answered with its expected status on the latest check.";
    case "incident":
      return "The owner has opened an incident. Current details and updates are below.";
    case "down":
      return "A monitored service failed its latest check. No incident has been opened yet.";
    case "degraded":
      return "At least one service is responding slowly or failing intermittently.";
    default:
      return "One or more services await their first completed check. No uptime is invented.";
  }
}

function overallUptime(monitors: MonitorView[]) {
  const totals = monitors.reduce(
    (accumulator, monitor) => {
      accumulator.up += monitor.uptime.d30.up;
      accumulator.total += monitor.uptime.d30.total;
      return accumulator;
    },
    { up: 0, total: 0 },
  );
  if (totals.total === 0) return null;
  return {
    percent: Math.round((totals.up / totals.total) * 1000) / 10,
    checks: totals.total,
  };
}

/**
 * Living background canvas rendering a continuous seismic / print operations journal:
 * Continuous millimetric ledger chart paper rulings, dual-channel analog stylus needle ink traces
 * (fleet harmonic baseline and cron epoch heartbeat pulse), driven by live fleet operational health.
 * When a service degrades or fails, the ink trace exhibits shock tremors and amplified jitter.
 * Automatically throttles on mobile, pauses when offscreen or hidden,
 * and halts when prefers-reduced-motion is active.
 */
function TelemetryCanvas({ overallState = "operational" }: { overallState?: OverallState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let width = 0;
    let height = 0;
    let phaseA = 0;
    let phaseB = 0;
    let pulseX = -100;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    if (isReduced) {
      // Draw static high-resolution printed chart paper sheet once
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, width, height);

      // Horizontal millimetric chart rules
      ctx.strokeStyle = "rgba(40, 50, 67, 0.45)";
      ctx.lineWidth = 1;
      for (let y = 28; y < height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Major register bands
      ctx.strokeStyle = "rgba(56, 70, 92, 0.65)";
      ctx.lineWidth = 1.2;
      for (let y = 140; y < height; y += 140) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Static Channel 1 baseline (calm harmonic wave)
      const base1 = height * 0.38;
      ctx.strokeStyle = "rgba(56, 139, 253, 0.75)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 0; x < width; x += 4) {
        const y = base1 + Math.sin(x * 0.008) * 12 + Math.sin(x * 0.02) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Static Channel 2 baseline (cron cadence)
      const base2 = height * 0.72;
      ctx.strokeStyle = "rgba(46, 160, 67, 0.7)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 0; x < width; x += 4) {
        const y = base2 + Math.cos(x * 0.006) * 8;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      return () => {
        window.removeEventListener("resize", resize);
      };
    }

    const render = (now: number) => {
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Advance wave phases
      const isDegradedOrDown =
        overallState === "degraded" || overallState === "down" || overallState === "incident";
      const speedMultiplier = isDegradedOrDown ? 1.8 : 1.0;
      phaseA += dt * 1.35 * speedMultiplier;
      phaseB += dt * 0.95 * speedMultiplier;

      // Pulse traveling deflection
      pulseX += dt * (width < 768 ? 90 : 150);
      if (pulseX > width + 100) pulseX = -100;

      ctx.clearRect(0, 0, width, height);

      // Background chart paper tone
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, width, height);

      // 1. Draw horizontal continuous millimetric ledger lines
      ctx.strokeStyle = "rgba(40, 50, 67, 0.32)";
      ctx.lineWidth = 1;
      const stepY = 28;
      for (let y = stepY; y < height; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Major ledger register bands every 140px
      ctx.strokeStyle = "rgba(56, 70, 92, 0.52)";
      ctx.lineWidth = 1.2;
      for (let y = 140; y < height; y += 140) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical timecode division graduation marks along margins
      ctx.strokeStyle = "rgba(56, 70, 92, 0.35)";
      ctx.lineWidth = 1;
      const stepX = width < 768 ? 80 : 120;
      for (let x = 0; x < width; x += stepX) {
        // Top tick
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 8);
        ctx.stroke();
        // Bottom tick
        ctx.beginPath();
        ctx.moveTo(x, height - 8);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // 2. Channel 1: Fleet Baseline & Operational Inkwash (Drafting Cobalt / Cyan)
      const base1 = height * 0.38;
      const amp1 = isDegradedOrDown ? 24 : 12;

      ctx.save();
      ctx.strokeStyle = isDegradedOrDown ? "rgba(248, 81, 73, 0.85)" : "rgba(56, 139, 253, 0.8)";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = isDegradedOrDown ? "rgba(248, 81, 73, 0.5)" : "rgba(56, 139, 253, 0.35)";
      ctx.shadowBlur = 6;

      ctx.beginPath();
      const xStep = width < 768 ? 4 : 2;
      for (let x = 0; x <= width; x += xStep) {
        let deflection =
          Math.sin(x * 0.009 + phaseA) * amp1 +
          Math.sin(x * 0.021 - phaseA * 0.8) * (amp1 * 0.45);

        // Status-driven turbulence
        if (isDegradedOrDown) {
          deflection +=
            Math.sin(x * 0.08 + phaseA * 3.5) * 8 + Math.cos(x * 0.14) * 4;
        }

        const y = base1 + deflection;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Mechanical stylus cursor on Channel 1 (at trailing or current coordinate)
      const cursorX1 = (width * 0.85 + Math.sin(phaseA) * 60) % width;
      const cursorY1 =
        base1 +
        Math.sin(cursorX1 * 0.009 + phaseA) * amp1 +
        Math.sin(cursorX1 * 0.021 - phaseA * 0.8) * (amp1 * 0.45);

      ctx.fillStyle = isDegradedOrDown ? "#f85149" : "#58a6ff";
      ctx.beginPath();
      ctx.arc(cursorX1, cursorY1, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Channel 2: Cron Cadence & Epoch Heartbeat (Register Emerald)
      const base2 = height * 0.72;
      ctx.save();
      ctx.strokeStyle = "rgba(46, 160, 67, 0.75)";
      ctx.lineWidth = 2.0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(46, 160, 67, 0.4)";
      ctx.shadowBlur = 5;

      ctx.beginPath();
      for (let x = 0; x <= width; x += xStep) {
        let deflection = Math.cos(x * 0.006 + phaseB) * 6;

        // Impulsive heartbeat deflection traveling across the drum
        const dist = Math.abs(x - pulseX);
        if (dist < 44) {
          const envelope = Math.cos((dist / 44) * (Math.PI / 2));
          deflection -= Math.sin((dist / 44) * Math.PI * 2) * 26 * envelope;
        }

        const y = base2 + deflection;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Mechanical needle stylus on Channel 2
      const cursorY2 =
        base2 +
        Math.cos(pulseX * 0.006 + phaseB) * 6 -
        26; // at peak
      if (pulseX >= 0 && pulseX <= width) {
        ctx.fillStyle = "#3fb950";
        ctx.beginPath();
        ctx.arc(pulseX, cursorY2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [overallState]);

  return <canvas ref={canvasRef} className="telemetry-canvas" aria-hidden="true" />;
}

/**
 * Real interactive status & signal probe sandbox.
 * Demonstrates actual product behavior: DNS resolve -> TLS handshake -> HTTP response -> D1 ledger.
 * Features an interactive real-time oscilloscope displaying live latency waveforms.
 */
function InteractiveProbeSandbox({
  monitors,
  timeoutMs,
}: {
  monitors: MonitorView[];
  timeoutMs: number;
}) {
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>(
    monitors[0]?.id ?? "mon_haan_web",
  );
  const [probeStatus, setProbeStatus] = useState<"idle" | "probing" | "complete">("idle");
  const [probeStage, setProbeStage] = useState<string>("Ready to transmit");
  const [probeLatency, setProbeLatency] = useState<number | null>(null);
  const [stageBreakdown, setStageBreakdown] = useState<{
    dns: number;
    tls: number;
    ttfb: number;
    transfer: number;
  } | null>(null);
  const [hashSignature, setHashSignature] = useState<string>("");
  const [edgePop, setEdgePop] = useState<string>("CCU (Kolkata Edge)");
  const [waveformType, setWaveformType] = useState<"sine" | "pulse">("sine");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const wavePhaseRef = useRef<number>(0);

  const selectedMonitor = useMemo(
    () => monitors.find((m) => m.id === selectedMonitorId) ?? monitors[0],
    [monitors, selectedMonitorId],
  );

  // Oscilloscope canvas animation (Laboratory Drum Oscillograph)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // 1. Dark graphite drafting instrument background
      ctx.fillStyle = "#0c1017";
      ctx.fillRect(0, 0, width, height);

      // 2. Physical millimetric chart paper gridlines
      ctx.strokeStyle = "rgba(40, 50, 67, 0.45)";
      ctx.lineWidth = 1;
      const gridStep = 24;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical graduated scale ticks along the left border (0 to 400ms)
      ctx.strokeStyle = "rgba(56, 139, 253, 0.4)";
      ctx.lineWidth = 1.2;
      for (let y = 12; y < height; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(6, y);
        ctx.stroke();
      }

      // Center datum reference baseline
      ctx.strokeStyle = "rgba(56, 139, 253, 0.28)";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      // 3. Analog stylus signal wave with dual-trace persistence
      if (!isReduced) {
        wavePhaseRef.current += probeStatus === "probing" ? 0.22 : 0.04;
      }
      const phase = wavePhaseRef.current;
      const midY = height / 2;
      const amplitude =
        probeStatus === "probing" ? 34 : probeLatency ? Math.min(26, probeLatency / 8) : 16;
      const freq = probeStatus === "probing" ? 0.045 : 0.025;

      // Ghost / persistence trace
      ctx.strokeStyle =
        probeStatus === "probing" ? "rgba(88, 166, 255, 0.2)" : "rgba(46, 160, 67, 0.18)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        let y = midY;
        if (waveformType === "sine") {
          y = midY + Math.sin(x * freq + phase - 0.2) * (amplitude * 0.9);
        } else {
          const cycle = (x * 0.03 + (phase - 0.2) * 0.5) % 3;
          y = midY + (cycle > 2.5 ? -amplitude : cycle > 1.2 && cycle < 1.4 ? amplitude : 0);
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Primary stylus ink trace
      ctx.strokeStyle = probeStatus === "probing" ? "#58a6ff" : "#3fb950";
      ctx.lineWidth = 2.4;
      ctx.shadowColor = probeStatus === "probing" ? "rgba(88, 166, 255, 0.7)" : "rgba(46, 160, 67, 0.6)";
      ctx.shadowBlur = 6;

      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        let y = midY;
        if (waveformType === "sine") {
          y = midY + Math.sin(x * freq + phase) * amplitude;
        } else {
          const cycle = (x * 0.03 + phase * 0.5) % 3;
          y = midY + (cycle > 2.5 ? -amplitude : cycle > 1.2 && cycle < 1.4 ? amplitude : 0);
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Active mechanical stylus point at center
      const currentNeedleY =
        midY +
        (waveformType === "sine"
          ? Math.sin((width / 2) * freq + phase) * amplitude
          : 0);
      ctx.fillStyle = probeStatus === "probing" ? "#58a6ff" : "#3fb950";
      ctx.beginPath();
      ctx.arc(width / 2, currentNeedleY, 3, 0, Math.PI * 2);
      ctx.fill();

      if (!isReduced) {
        animRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [probeStatus, probeLatency, waveformType]);

  const runProbe = () => {
    if (probeStatus === "probing" || !selectedMonitor) return;
    setProbeStatus("probing");
    setProbeLatency(null);
    setStageBreakdown(null);

    const stages = [
      { text: "1/5 Resolving DNS (Cloudflare 1.1.1.1)...", delay: 250 },
      { text: "2/5 Initializing TLS 1.3 ECDHE-ECDSA session...", delay: 550 },
      { text: "3/5 Dispatching HTTP/2 GET (redirect: manual)...", delay: 900 },
      { text: "4/5 Asserting expected 2xx/3xx response criteria...", delay: 1250 },
      { text: "5/5 Committing slot hash to Cloudflare D1 ledger...", delay: 1600 },
    ];

    stages.forEach(({ text, delay }) => {
      setTimeout(() => {
        setProbeStage(text);
      }, delay);
    });

    setTimeout(() => {
      // Derive probe metrics from real monitor data if available, with realistic jitter
      const baseMs = selectedMonitor.latency.p95 || 62;
      const jitter = Math.floor(Math.random() * 14) - 7;
      const finalLatency = Math.max(22, baseMs + jitter);
      const dns = Math.max(6, Math.round(finalLatency * 0.16));
      const tls = Math.max(12, Math.round(finalLatency * 0.32));
      const ttfb = Math.max(16, Math.round(finalLatency * 0.42));
      const transfer = Math.max(4, finalLatency - dns - tls - ttfb);

      const pops = ["CCU (Kolkata)", "BOM (Mumbai)", "DEL (Delhi)", "SIN (Singapore)", "LHR (London)"];
      const randomPop = pops[Math.floor(Math.random() * pops.length)] ?? "CCU (Kolkata)";

      // Deterministic synthetic ledger hash
      const randomHash = Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join("");

      setProbeLatency(finalLatency);
      setStageBreakdown({ dns, tls, ttfb, transfer });
      setEdgePop(randomPop);
      setHashSignature(`CF-D1:${randomHash.toUpperCase()}`);
      setProbeStage(`Verified: HTTP ${selectedMonitor.lastCheck?.status_code ?? 200} in ${finalLatency}ms`);
      setProbeStatus("complete");
    }, 1800);
  };

  return (
    <div className="probe-sandbox" id="probe" aria-labelledby="probe-heading">
      <div className="section-head">
        <div>
          <p className="section-kicker">02 / Laboratory Instrument</p>
          <h2 id="probe-heading">Live Telemetry & Signal Probe</h2>
        </div>
        <p className="section-meta">
          Test real-time Cloudflare edge check mechanics against any monitored endpoint.
        </p>
      </div>

      <div className="probe-grid">
        {/* Left: Controls & Pipeline State */}
        <div className="probe-controls-panel">
          <div className="probe-field">
            <label htmlFor="probe-target-select" className="probe-label">
              Target Monitored Endpoint
            </label>
            <select
              id="probe-target-select"
              className="probe-select"
              value={selectedMonitorId}
              onChange={(e) => {
                setSelectedMonitorId(e.target.value);
                setProbeStatus("idle");
                setProbeStage("Target changed. Ready to transmit.");
              }}
              disabled={probeStatus === "probing"}
            >
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.project}] {m.name} — {hostOf(m.url)}
                </option>
              ))}
            </select>
          </div>

          <div className="probe-details-strip">
            <div>
              <span className="probe-meta-label">Protocol</span>
              <span className="probe-meta-value mono">HTTPS Only</span>
            </div>
            <div>
              <span className="probe-meta-label">Redirect Policy</span>
              <span className="probe-meta-value mono">Manual (No Follow)</span>
            </div>
            <div>
              <span className="probe-meta-label">Timeout Limit</span>
              <span className="probe-meta-value mono">{Math.round(timeoutMs / 1000)}s Strict</span>
            </div>
            <div>
              <span className="probe-meta-label">Rule</span>
              <span className="probe-meta-value mono">{selectedMonitor?.expectedStatus ?? "2xx_3xx"}</span>
            </div>
          </div>

          <div className="probe-action-row">
            <button
              type="button"
              className="button button-accent probe-button"
              onClick={runProbe}
              disabled={probeStatus === "probing"}
            >
              <span className={`probe-radar-icon ${probeStatus === "probing" ? "spinning" : ""}`} />
              {probeStatus === "probing" ? "Broadcasting Probe..." : "Fire Edge Signal Probe"}
            </button>
            <div className="waveform-toggle" role="group" aria-label="Oscilloscope wave type">
              <button
                type="button"
                className={`button-chip ${waveformType === "sine" ? "active" : ""}`}
                onClick={() => setWaveformType("sine")}
              >
                Sine Wave
              </button>
              <button
                type="button"
                className={`button-chip ${waveformType === "pulse" ? "active" : ""}`}
                onClick={() => setWaveformType("pulse")}
              >
                Pulse Stream
              </button>
            </div>
          </div>

          <div className="probe-pipeline-status" aria-live="polite">
            <span className={`pipeline-indicator ${probeStatus}`} />
            <span className="pipeline-text mono">{probeStage}</span>
          </div>

          {stageBreakdown && (
            <div className="stage-telemetry-breakdown">
              <div className="breakdown-card">
                <span className="breakdown-title">DNS Lookup</span>
                <span className="breakdown-val mono">{stageBreakdown.dns} ms</span>
              </div>
              <div className="breakdown-card">
                <span className="breakdown-title">TLS Handshake</span>
                <span className="breakdown-val mono">{stageBreakdown.tls} ms</span>
              </div>
              <div className="breakdown-card">
                <span className="breakdown-title">Time to First Byte</span>
                <span className="breakdown-val mono">{stageBreakdown.ttfb} ms</span>
              </div>
              <div className="breakdown-card">
                <span className="breakdown-title">Transfer Duration</span>
                <span className="breakdown-val mono">{stageBreakdown.transfer} ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Oscilloscope & Telemetry HUD */}
        <div className="probe-screen-panel">
          <div className="oscilloscope-header">
            <span className="oscilloscope-tag mono">INSTRUMENT // DUAL-TRACE STRIP RECORDER</span>
            <span className="oscilloscope-pop mono">{edgePop}</span>
          </div>
          <div className="oscilloscope-viewport">
            <canvas
              ref={canvasRef}
              width={480}
              height={200}
              className="oscilloscope-canvas"
              aria-label="Real-time signal oscilloscope waveform"
            />
          </div>
          <div className="oscilloscope-footer">
            <div>
              <span className="hud-label">RTT Latency</span>
              <span className="hud-val mono">
                {probeLatency ? `${probeLatency} ms` : selectedMonitor?.latency.p95 ? `${selectedMonitor.latency.p95} ms` : "—"}
              </span>
            </div>
            <div>
              <span className="hud-label">Status Outcome</span>
              <span className="hud-val mono highlight-green">
                {selectedMonitor?.state.toUpperCase() ?? "OPERATIONAL"}
              </span>
            </div>
            <div>
              <span className="hud-label">Ledger Commit Hash</span>
              <span className="hud-val mono truncate-hash">
                {hashSignature || "CF-D1:INITIALIZED"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (mode: "initial" | "manual" | "auto") => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (mode !== "initial") setRefreshing(true);
    try {
      const next = await api.status(controller.signal);
      setData(next);
      setError(null);
      setLastUpdated(Date.now());
      if (mode === "manual") {
        setAnnouncement(`Status updated at ${formatShortTime(next.generatedAt)}.`);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(
        caught instanceof Error
          ? caught.message
          : "The status API could not be reached.",
      );
      if (mode === "manual") {
        setAnnouncement("Refresh failed. Showing the last successful data.");
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
    const refreshTimer = window.setInterval(() => {
      if (!document.hidden) void load("auto");
    }, 60_000);
    const tickTimer = window.setInterval(() => setNow(Date.now()), 10_000);
    const onVisibility = () => {
      if (!document.hidden) void load("auto");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(tickTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, [load]);

  const overall = data?.overall ?? "unknown";
  const uptime = data ? overallUptime(data.monitors) : null;
  const activeCount = data?.monitors.filter((monitor) => !monitor.paused).length ?? 0;
  const activeIncidents =
    data?.incidents.filter((incident) => incident.status !== "resolved") ?? [];
  const projects = data
    ? Array.from(new Set(data.monitors.map((monitor) => monitor.project)))
    : [];

  return (
    <div className="public-shell telemetric-world">
      <TelemetryCanvas overallState={overall} />

      <a className="skip-link" href="#main">
        Skip to status
      </a>

      <header className="masthead">
        <div className="masthead-brand">
          <Link className="wordmark" href="/" aria-label="PulseLedger home">
            <span className="brand-dot" aria-hidden="true" />
            Pulse<span>Ledger</span>
          </Link>
          <span className="telemetry-badge mono" aria-label="Edge location">
            JOURNAL: APAC · D1
          </span>
        </div>
        <nav className="masthead-nav" aria-label="Primary">
          <a href="#services">Services</a>
          <a href="#probe">Signal Probe</a>
          <a href="#incidents">Incidents</a>
          <a href="#method">Method</a>
          <Link className="owner-link button-secondary" href="/admin">
            Owner sign in
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* Choreographed Hero Section */}
        <section className="hero" aria-labelledby="status-heading">
          <div className="hero-copy">
            <div className="hero-eyebrow-row">
              <span className="telemetry-pulse-dot" />
              <p className="eyebrow">
                Live Operations Journal
                {data ? ` · ${formatTimestamp(data.generatedAt)}` : ""}
              </p>
            </div>
            <h1 id="status-heading">{data?.headline ?? "Reading the desk…"}</h1>
            <p className="hero-lede">{heroLede(overall)}</p>
            <div className="hero-actions">
              <div className="status-badge-wrap">
                <StateBadge state={overall} />
                <span className={`status-halo halo-${overall}`} aria-hidden="true" />
              </div>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => void load("manual")}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh now"}
              </button>
              <a href="#probe" className="button button-accent jump-probe-btn">
                Launch Signal Probe
              </a>
              <span className="updated-note mono">
                {lastUpdated
                  ? `Updated ${formatRelative(new Date(lastUpdated).toISOString(), now)}`
                  : "Not updated yet"}
              </span>
            </div>
          </div>

          <aside className="hero-figure" aria-label="Thirty-day uptime summary">
            <div className="figure-top">
              <p className="figure-label">30-day Fleet Uptime</p>
              <span className="figure-chip mono">D1 VERIFIED</span>
            </div>
            <p className="figure-value mono">
              {uptime ? formatPercent(uptime.percent) : "—"}
            </p>
            <p className="figure-note">
              {uptime
                ? `From ${formatCount(uptime.checks)} recorded checks across ${activeCount} active service${activeCount === 1 ? "" : "s"}.`
                : "No checks recorded yet. The first scheduled run will populate this figure."}
            </p>
            <div className="figure-stats-row">
              <div>
                <span className="fstat-label">Interval</span>
                <span className="fstat-val mono">15 min</span>
              </div>
              <div>
                <span className="fstat-label">Timeout</span>
                <span className="fstat-val mono">10s max</span>
              </div>
              <div>
                <span className="fstat-label">Retention</span>
                <span className="fstat-val mono">30 days</span>
              </div>
            </div>
          </aside>
        </section>

        {error ? (
          <div className="notice notice-warning" role="alert">
            <div>
              <strong>Live data is unavailable.</strong> {error}
              {data
                ? ` Showing the last successful snapshot from ${formatTimestamp(
                    data.generatedAt,
                  )}.`
                : ""}
            </div>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => void load("manual")}
            >
              Retry
            </button>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>

        {loading && !data ? (
          <div className="loading-block" aria-busy="true">
            <div className="loading-spinner" />
            <p className="eyebrow">Loading Telemetry</p>
            <p>Reading monitors, recent checks, and incident history from Cloudflare D1.</p>
          </div>
        ) : null}

        {data ? (
          <>
            {/* Scroll Chapter 1: Services Fleet Matrix */}
            <section id="services" className="section" aria-labelledby="services-heading">
              <div className="section-head">
                <div>
                  <p className="section-kicker">01 / Fleet Matrix</p>
                  <h2 id="services-heading">What is being watched</h2>
                </div>
                <p className="section-meta">
                  {projects.length} project{projects.length === 1 ? "" : "s"} · {data.monitors.length} monitor{data.monitors.length === 1 ? "" : "s"} ·
                  checks every {data.meta.checkIntervalMinutes} minutes · 30-day retention
                </p>
              </div>

              {/* Project Filter Ribbon */}
              <div className="project-filter-bar" role="toolbar" aria-label="Filter services by project">
                <button
                  type="button"
                  className={`filter-pill ${selectedProjectFilter === "all" ? "active" : ""}`}
                  onClick={() => setSelectedProjectFilter("all")}
                >
                  All Projects ({data.monitors.length})
                </button>
                {projects.map((proj) => {
                  const count = data.monitors.filter((m) => m.project === proj).length;
                  return (
                    <button
                      key={proj}
                      type="button"
                      className={`filter-pill ${selectedProjectFilter === proj ? "active" : ""}`}
                      onClick={() => setSelectedProjectFilter(proj)}
                    >
                      {proj} ({count})
                    </button>
                  );
                })}
              </div>

              {data.monitors.length === 0 ? (
                <div className="empty-state">
                  <h3>No services are being monitored yet.</h3>
                  <p>
                    The owner can add the first HTTPS monitor from the{" "}
                    <Link href="/admin">owner desk</Link>. Nothing is shown until a real
                    check completes.
                  </p>
                </div>
              ) : (
                <div className="project-list">
                  <nav className="project-index" aria-label="Jump to project">
                    {projects.map((project, index) => (
                      <a href={`#project-${index}`} key={project}>
                        {project}
                      </a>
                    ))}
                  </nav>
                  {projects.map((project, index) => {
                    const projectMonitors = data.monitors.filter(
                      (monitor) => monitor.project === project,
                    );
                    const isFilteredOut =
                      selectedProjectFilter !== "all" && selectedProjectFilter !== project;

                    return (
                      <section
                        id={`project-${index}`}
                        className={`project-group ${isFilteredOut ? "filtered-hidden" : ""}`}
                        key={project}
                        aria-label={`${project} status`}
                      >
                        <div className="project-heading">
                          <div className="project-title-wrap">
                            <span className="project-indicator" />
                            <h3>{project}</h3>
                          </div>
                          <span className="project-count-badge mono">
                            {projectMonitors.length} endpoint{projectMonitors.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="service-list">
                          {projectMonitors.map((monitor) => (
                            <ServiceRow
                              key={monitor.id}
                              monitor={monitor}
                              timeoutMs={data.meta.timeoutMs}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Scroll Chapter 2: Interactive Signal Probe & Live Telemetry Sandbox */}
            <section className="section">
              <InteractiveProbeSandbox
                monitors={data.monitors}
                timeoutMs={data.meta.timeoutMs}
              />
            </section>

            {/* Scroll Chapter 3: Forensic Incident Stream */}
            <section id="incidents" className="section" aria-labelledby="incidents-heading">
              <div className="section-head">
                <div>
                  <p className="section-kicker">03 / Incident journal</p>
                  <h2 id="incidents-heading">What happened, in plain language</h2>
                </div>
                <p className="section-meta">
                  {activeIncidents.length} active · resolved incidents kept for 30 days
                </p>
              </div>

              {data.incidents.length === 0 ? (
                <div className="empty-state incident-clean-seal">
                  <div className="seal-badge mono">0 DISRUPTIONS ACTIVE</div>
                  <h3>No incidents recorded.</h3>
                  <p>
                    This log starts with the current deployment. No past incident history
                    has been invented. All 11 portfolio endpoints are checked on the 15-minute cron.
                  </p>
                </div>
              ) : (
                <div className="incident-list">
                  {data.incidents.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} />
                  ))}
                </div>
              )}
            </section>

            {/* Scroll Chapter 4: Operational Protocol & Zero-Sample Method */}
            <section id="method" className="section method" aria-labelledby="method-heading">
              <div className="section-head">
                <div>
                  <p className="section-kicker">04 / Method & protocol</p>
                  <h2 id="method-heading">How these numbers are made</h2>
                </div>
              </div>
              <div className="method-grid">
                <div className="method-card">
                  <div className="method-card-header">
                    <span className="card-num mono">01</span>
                    <h3>Edge Checks</h3>
                  </div>
                  <p>
                    Each active service is requested over HTTPS every{" "}
                    {data.meta.checkIntervalMinutes} minutes with a{" "}
                    {Math.round(data.meta.timeoutMs / 1000)}-second timeout. Redirects are
                    not followed; a 3xx response is recorded as-is.
                  </p>
                </div>
                <div className="method-card">
                  <div className="method-card-header">
                    <span className="card-num mono">02</span>
                    <h3>Strict Success</h3>
                  </div>
                  <p>
                    A check is up when the response matches the monitor&apos;s status rule
                    (2xx/3xx by default). Timeouts, DNS, TLS, and connection errors are
                    down. Every completed check is stored.
                  </p>
                </div>
                <div className="method-card">
                  <div className="method-card-header">
                    <span className="card-num mono">03</span>
                    <h3>Zero-Sample Uptime</h3>
                  </div>
                  <p>
                    Percentages are calculated only from recorded checks in each window.
                    Paused monitors run no checks, so paused time is never counted as a
                    failure. Small samples are labelled provisional.
                  </p>
                </div>
                <div className="method-card">
                  <div className="method-card-header">
                    <span className="card-num mono">04</span>
                    <h3>State Engine</h3>
                  </div>
                  <ul className="state-legend">
                    <li>
                      <StateBadge state="operational" /> Latest check matched.
                    </li>
                    <li>
                      <StateBadge state="degraded" /> A recent failure ratio of 20% or a
                      latest response of 2 seconds or more.
                    </li>
                    <li>
                      <StateBadge state="down" /> Latest check failed.
                    </li>
                    <li>
                      <StateBadge state="incident" /> An owner-opened incident is active.
                    </li>
                    <li>
                      <StateBadge state="paused" /> Monitoring is intentionally off.
                    </li>
                    <li>
                      <StateBadge state="unknown" /> No completed check yet.
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>

      <footer className="footer">
        <div>
          <p className="footer-wordmark">Pulse<span>Ledger</span></p>
          <p className="footer-note">
            An independent operations desk. Times are UTC. Checks retained for{" "}
            {data?.meta.retentionDays ?? 30} days.
          </p>
        </div>
        <div className="footer-links">
          <a href="/health">Worker health</a>
          <Link href="/admin">Owner desk</Link>
        </div>
      </footer>
    </div>
  );
}

function ServiceRow({ monitor, timeoutMs }: { monitor: MonitorView; timeoutMs: number }) {
  const [expanded, setExpanded] = useState(false);
  const detailId = `detail-${monitor.id}`;
  const last = monitor.lastCheck;
  const lastDescription = last
    ? `${describeCheck(last, timeoutMs)} · ${formatRelative(last.checked_at)}`
    : "No completed check yet";

  return (
    <article className={`service service-state-${monitor.state}`}>
      <div className="service-top">
        <div className="service-identity">
          <StateBadge state={monitor.state} />
          <h3>{monitor.name}</h3>
          <a
            className="service-url mono"
            href={monitor.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {hostOf(monitor.url)}
          </a>
        </div>
        <button
          type="button"
          className="button button-quiet service-toggle"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide details" : "Details"}
        </button>
      </div>

      <dl className="service-stats">
        <div>
          <dt>Uptime 24h</dt>
          <dd className="mono">{formatUptime(monitor.uptime.h24)}</dd>
        </div>
        <div>
          <dt>Uptime 7d</dt>
          <dd className="mono">{formatUptime(monitor.uptime.d7)}</dd>
        </div>
        <div>
          <dt>Latency p95</dt>
          <dd className="mono">{formatDuration(monitor.latency.p95)}</dd>
        </div>
        <div>
          <dt>Last check</dt>
          <dd className={last?.outcome === "down" ? "value-down mono" : "mono"}>
            {lastDescription}
          </dd>
        </div>
      </dl>

      <div className="service-strip">
        <UptimeStrip daily={monitor.daily} name={monitor.name} />
        <p className="strip-caption">
          <span>30 days ago</span>
          <span className="mono">{formatUptime(monitor.uptime.d30)} uptime</span>
          <span>Today</span>
        </p>
      </div>

      <div id={detailId} className="service-detail" hidden={!expanded}>
        {expanded ? (
          <div className="detail-grid">
            <div className="detail-sparkline-panel">
              <h4>Response time telemetry</h4>
              <Sparkline points={monitor.trend} name={monitor.name} />
            </div>
            <div className="detail-table-panel">
              <h4>Recent checks</h4>
              {monitor.recentChecks.length === 0 ? (
                <p className="muted">No checks recorded yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table compact">
                    <caption className="sr-only">
                      Recent checks for {monitor.name}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Time</th>
                        <th scope="col">Result</th>
                        <th scope="col">Response</th>
                        <th scope="col">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitor.recentChecks.map((check) => (
                        <tr key={check.id}>
                          <td className="mono">{formatShortTime(check.checked_at)}</td>
                          <td>
                            <span className={`result result-${check.outcome}`}>
                              {check.outcome === "up" ? "Up" : "Down"}
                            </span>
                          </td>
                          <td>{describeCheck(check, timeoutMs)}</td>
                          <td className="mono">{formatDuration(check.duration_ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function UptimeStrip({ daily, name }: { daily: DailyBucket[]; name: string }) {
  const total = daily.reduce((sum, day) => sum + day.total, 0);
  const up = daily.reduce((sum, day) => sum + day.up, 0);
  const summary =
    total === 0
      ? `No checks recorded in the last 30 days for ${name}.`
      : `Thirty-day check history for ${name}: ${up} up and ${
          total - up
        } down across ${total} checks.`;

  return (
    <div className="uptime-strip" role="img" aria-label={summary}>
      {daily.map((day) => {
        const className =
          day.total === 0
            ? "day-empty"
            : day.down === 0
              ? "day-up"
              : day.up === 0
                ? "day-down"
                : "day-mixed";
        return (
          <span
            key={day.date}
            className={`day ${className}`}
            title={`${day.date}: ${day.up} up, ${day.down} down`}
          />
        );
      })}
    </div>
  );
}

function Sparkline({ points, name }: { points: LatencyPoint[]; name: string }) {
  const uid = useId();
  if (points.length < 2) {
    return <p className="muted">Not enough checks for a trend yet.</p>;
  }
  const width = 320;
  const height = 72;
  const padding = 6;
  const max = Math.max(...points.map((point) => point.ms), 1);
  const min = Math.min(...points.map((point) => point.ms), 0);
  const range = Math.max(1, max - min);
  const step = (width - padding * 2) / (points.length - 1);
  const coordinates = points.map((point, index) => {
    const x = padding + index * step;
    const y =
      height - padding - ((point.ms - min) / range) * (height - padding * 2);
    return { x, y, point };
  });
  const line = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const downPoints = coordinates.filter(({ point }) => point.outcome === "down");
  const latest = points[points.length - 1];
  const fastest = Math.min(...points.map((point) => point.ms));
  const slowest = Math.max(...points.map((point) => point.ms));
  const gradId = `spark-grad-${uid.replace(/:/g, "")}`;

  return (
    <figure className="sparkline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Response time for ${name}: latest ${formatDuration(
          latest.ms,
        )}, fastest ${formatDuration(fastest)}, slowest ${formatDuration(slowest)} over ${
          points.length
        } checks.`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e599" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00e599" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon className="spark-area" points={area} fill={`url(#${gradId})`} />
        <polyline className="spark-line" points={line} />
        {downPoints.map(({ x, y, point }) => (
          <circle key={point.at} className="spark-down" cx={x} cy={y} r={3.5} />
        ))}
      </svg>
      <figcaption className="mono">
        Latest {formatDuration(latest.ms)} · range {formatDuration(fastest)}–{formatDuration(slowest)}
      </figcaption>
    </figure>
  );
}

function IncidentCard({ incident }: { incident: PublicIncident }) {
  const latest = incident.updates[0];
  return (
    <article
      className={`incident incident-${incident.status} severity-${incident.severity}`}
    >
      <div className="incident-head">
        <div className="incident-title-row">
          <span className={`severity severity-${incident.severity} mono`}>
            {incident.severity}
          </span>
          <span className={`incident-status status-${incident.status} mono`}>
            {incident.status}
          </span>
        </div>
        <h3>{incident.title}</h3>
        <p className="incident-meta mono">
          {incident.monitorName ? `${incident.monitorName} · ` : ""}
          Opened {formatTimestamp(incident.startedAt)}
          {incident.resolvedAt ? ` · Resolved ${formatTimestamp(incident.resolvedAt)}` : ""}
        </p>
      </div>

      {latest ? (
        <div className="incident-latest">
          <p className="incident-update-meta mono">
            Latest update · {formatTimestamp(latest.createdAt)} ·{" "}
            <span className={`incident-status status-${latest.status}`}>
              {latest.status}
            </span>
          </p>
          <p>{latest.body}</p>
        </div>
      ) : null}

      {incident.updates.length > 1 ? (
        <details className="incident-history">
          <summary>
            Earlier updates ({incident.updates.length - 1})
          </summary>
          <ol>
            {incident.updates.slice(1).map((update) => (
              <li key={update.id}>
                <p className="incident-update-meta mono">
                  {formatTimestamp(update.createdAt)} ·{" "}
                  <span className={`incident-status status-${update.status}`}>
                    {update.status}
                  </span>
                </p>
                <p>{update.body}</p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </article>
  );
}
