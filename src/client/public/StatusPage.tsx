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

export function overallUptime(monitors: MonitorView[]) {
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

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

interface ScrollChoreography {
  scrollY: number;
  pageProgress: number;
  heroProgress: number;
  chapter1Progress: number;
  chapter2Progress: number;
  chapter3Progress: number;
  chapter4Progress: number;
  rowProgress: Record<string, number>;
}

/**
 * Living background canvas rendering a continuous seismic / print operations journal:
 * Continuous millimetric ledger chart paper rulings that physically feed upward with scroll,
 * sprocket feed perforations along the outer margins, and dual-channel analog stylus needle
 * ink traces (fleet harmonic baseline and cron epoch heartbeat pulse) driven by live fleet health.
 * Automatically throttles on mobile, pauses when hidden, and halts under prefers-reduced-motion.
 */
function TelemetryCanvas({
  overallState = "operational",
}: {
  overallState?: OverallState;
}) {
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
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(40, 50, 67, 0.45)";
      ctx.lineWidth = 1;
      for (let y = 28; y < height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(56, 70, 92, 0.65)";
      ctx.lineWidth = 1.2;
      for (let y = 140; y < height; y += 140) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const base1 = height - (width < 768 ? 96 : 120);
      ctx.strokeStyle = "rgba(56, 139, 253, 0.75)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 0; x < width; x += 4) {
        const y = base1 + Math.sin(x * 0.008) * 12 + Math.sin(x * 0.02) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const base2 = height - (width < 768 ? 38 : 46);
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

      const isDegradedOrDown =
        overallState === "degraded" || overallState === "down" || overallState === "incident";
      const speedMultiplier = isDegradedOrDown ? 1.8 : 1.0;
      const currentScroll = window.scrollY || window.pageYOffset || 0;
      phaseA += dt * 1.35 * speedMultiplier;
      phaseB += dt * 0.95 * speedMultiplier;

      pulseX += dt * (width < 768 ? 90 : 150);
      if (pulseX > width + 100) pulseX = -100;

      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, width, height);

      // Scroll-coupled paper feed offset so chart rulings physically advance with scroll
      const minorStep = 28;
      const majorStep = 140;
      const minorOffset = (currentScroll * 0.45) % minorStep;
      const majorOffset = (currentScroll * 0.45) % majorStep;

      // 1. Horizontal millimetric ledger lines advancing with paper feed
      ctx.strokeStyle = "rgba(40, 50, 67, 0.32)";
      ctx.lineWidth = 1;
      for (let y = -minorOffset; y < height; y += minorStep) {
        if (y < 0) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Major ledger register bands every 140px advancing with scroll
      ctx.strokeStyle = "rgba(56, 70, 92, 0.54)";
      ctx.lineWidth = 1.2;
      for (let y = -majorOffset; y < height; y += majorStep) {
        if (y < 0) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Tractor-feed sprocket holes along left and right paper margins (desktop)
      if (width >= 960) {
        ctx.strokeStyle = "rgba(88, 166, 255, 0.18)";
        ctx.lineWidth = 1;
        for (let y = -minorOffset + 14; y < height; y += minorStep) {
          if (y < 0) continue;
          ctx.beginPath();
          ctx.arc(14, y, 3.2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(width - 14, y, 3.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Vertical timecode division graduation marks along margins
      ctx.strokeStyle = "rgba(56, 70, 92, 0.35)";
      ctx.lineWidth = 1;
      const stepX = width < 768 ? 80 : 120;
      for (let x = 0; x < width; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, height - 8);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // 2. Channel 1: Fleet Baseline & Operational Inkwash (lower margin safety band, never crossing text)
      const base1 = height - (width < 768 ? 96 : 120);
      const amp1 = isDegradedOrDown ? 18 : 10;
      const scrollPhaseShift = currentScroll * 0.004;

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
          Math.sin(x * 0.009 + phaseA + scrollPhaseShift) * amp1 +
          Math.sin(x * 0.021 - phaseA * 0.8) * (amp1 * 0.45);

        if (isDegradedOrDown) {
          deflection +=
            Math.sin(x * 0.08 + phaseA * 3.5) * 6 + Math.cos(x * 0.14) * 3;
        }

        const y = base1 + deflection;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const cursorX1 = (width * 0.85 + Math.sin(phaseA) * 60) % width;
      const cursorY1 =
        base1 +
        Math.sin(cursorX1 * 0.009 + phaseA + scrollPhaseShift) * amp1 +
        Math.sin(cursorX1 * 0.021 - phaseA * 0.8) * (amp1 * 0.45);

      ctx.fillStyle = isDegradedOrDown ? "#f85149" : "#58a6ff";
      ctx.beginPath();
      ctx.arc(cursorX1, cursorY1, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Channel 2: Cron Cadence & Epoch Heartbeat (Register Emerald along bottom edge strip)
      const base2 = height - (width < 768 ? 38 : 46);
      ctx.save();
      ctx.strokeStyle = "rgba(46, 160, 67, 0.75)";
      ctx.lineWidth = 2.0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(46, 160, 67, 0.4)";
      ctx.shadowBlur = 5;

      ctx.beginPath();
      for (let x = 0; x <= width; x += xStep) {
        let deflection = Math.cos(x * 0.006 + phaseB + scrollPhaseShift * 0.7) * 6;

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

      const cursorY2 =
        base2 +
        Math.cos(pulseX * 0.006 + phaseB + scrollPhaseShift * 0.7) * 6 -
        26;
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

  return (
    <canvas
      ref={canvasRef}
      className="telemetry-canvas"
      data-scroll-y={0}
      data-paper-offset={0}
      aria-hidden="true"
    />
  );
}

/**
 * Hero 30-Day Aggregate Seismograph SVG computed from real monitor daily buckets.
 * Includes a scroll-coupled drum carriage playhead updated via requestAnimationFrame.
 */
function HeroFleetSeismograph({
  monitors,
  heroProgress,
}: {
  monitors: MonitorView[];
  heroProgress: number;
}) {
  const aggregateDays = useMemo(() => {
    const map = new Map<string, { date: string; up: number; down: number; total: number }>();
    for (const mon of monitors) {
      for (const d of mon.daily) {
        const existing = map.get(d.date) ?? { date: d.date, up: 0, down: 0, total: 0 };
        existing.up += d.up;
        existing.down += d.down;
        existing.total += d.total;
        map.set(d.date, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [monitors]);

  const width = 320;
  const height = 54;
  const padX = 12;
  const padY = 8;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const points = useMemo(() => {
    if (aggregateDays.length === 0) return [];
    const maxTotal = Math.max(...aggregateDays.map((d) => d.total), 1);
    return aggregateDays.map((d, idx) => {
      const x =
        aggregateDays.length === 1
          ? width / 2
          : padX + (idx / (aggregateDays.length - 1)) * plotW;
      const ratio = d.total > 0 ? d.up / d.total : 1;
      const vol = d.total / maxTotal;
      const y =
        d.total === 0
          ? padY + plotH * 0.5
          : padY + (1 - ratio) * (plotH * 0.75) + (1 - vol) * (plotH * 0.2);
      return { x, y, day: d };
    });
  }, [aggregateDays, plotH, plotW]);

  const pathD = useMemo(() => {
    if (points.length === 0) return `M ${padX} ${height / 2} L ${width - padX} ${height / 2}`;
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
  }, [points, height]);

  const carriageX = (heroProgress * plotW).toFixed(1);

  return (
    <div className="hero-seismograph-block" aria-hidden="true">
      <div className="seismo-header mono">
        <span>30D DRUM SEISMOGRAPH</span>
        <span id="hero-carriage-readout">CARRIAGE: {Math.round(heroProgress * 100)}%</span>
      </div>
      <svg
        id="hero-seismograph-svg"
        className="hero-seismograph-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <line
          x1={padX}
          y1={height / 2}
          x2={width - padX}
          y2={height / 2}
          stroke="rgba(56, 70, 92, 0.45)"
          strokeDasharray="3 3"
        />
        {points.map((p) => (
          <line
            key={p.day.date}
            x1={p.x}
            y1={height - 4}
            x2={p.x}
            y2={p.day.total > 0 ? height - 10 : height - 6}
            stroke={
              p.day.down > 0
                ? "#f85149"
                : p.day.total > 0
                  ? "rgba(46, 160, 67, 0.65)"
                  : "rgba(100, 114, 135, 0.3)"
            }
            strokeWidth="2"
          />
        ))}
        <path
          d={pathD}
          fill="none"
          stroke="#58a6ff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g
          id="hero-drum-carriage"
          style={{
            transform: `translate3d(${carriageX}px, 0px, 0px)`,
          }}
        >
          <line
            x1={padX}
            y1={2}
            x2={padX}
            y2={height - 2}
            stroke="#3fb950"
            strokeWidth="1.6"
          />
          <circle cx={padX} cy={height / 2} r={3.2} fill="#3fb950" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Chapter 2: Scroll-Drawn Live Monitoring Timeline & Selectable Explorer of actual recentChecks records.
 * Queries genuine check records from Cloudflare D1 via the status API.
 * Features a scroll-scrubbed SVG latency/outcome timeline that physically draws as the chapter
 * scrolls into view, paired with the interactive Recorded Check Explorer and oscilloscope.
 */
function InteractiveProbeSandbox({
  monitors,
  timeoutMs,
  chapterProgress,
  onTargetChange,
}: {
  monitors: MonitorView[];
  timeoutMs: number;
  chapterProgress: number;
  onTargetChange?: () => void;
}) {
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>(
    monitors[0]?.id ?? "mon_haan_web",
  );
  const [selectedCheckId, setSelectedCheckId] = useState<number | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [waveformType, setWaveformType] = useState<"sine" | "pulse">("sine");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const wavePhaseRef = useRef<number>(0);

  const selectedMonitor = useMemo(
    () => monitors.find((m) => m.id === selectedMonitorId) ?? monitors[0],
    [monitors, selectedMonitorId],
  );

  // Available real checks for the selected monitor
  const checks = useMemo(() => {
    if (!selectedMonitor) return [];
    if (selectedMonitor.recentChecks && selectedMonitor.recentChecks.length > 0) {
      return selectedMonitor.recentChecks;
    }
    if (selectedMonitor.lastCheck) {
      return [selectedMonitor.lastCheck];
    }
    return [];
  }, [selectedMonitor]);

  const hasChecks = checks.length > 0;

  // Active check selected by user or latest available
  const activeCheck = useMemo(() => {
    if (!hasChecks) return null;
    if (selectedCheckId != null) {
      const found = checks.find((c) => c.id === selectedCheckId);
      if (found) return found;
    }
    return checks[0] ?? null;
  }, [checks, hasChecks, selectedCheckId]);

  // Real recorded timeline samples for the Scroll-Drawn Monitoring Timeline SVG:
  // Uses the selected monitor's trend points if >= 2, otherwise aggregates real recentChecks across active monitors.
  const timelineSamples = useMemo(() => {
    if (selectedMonitor && selectedMonitor.trend.length >= 2) {
      return selectedMonitor.trend.map((pt, idx) => ({
        id: `${selectedMonitor.id}-${idx}`,
        label: selectedMonitor.name,
        at: pt.at,
        ms: pt.ms,
        outcome: pt.outcome,
      }));
    }
    const collected: Array<{
      id: string;
      label: string;
      at: string;
      ms: number;
      outcome: "up" | "down";
    }> = [];
    for (const mon of monitors) {
      for (const chk of mon.recentChecks) {
        if (chk.duration_ms != null) {
          collected.push({
            id: `${mon.id}-${chk.id}`,
            label: mon.name,
            at: chk.checked_at,
            ms: chk.duration_ms,
            outcome: chk.outcome,
          });
        }
      }
    }
    collected.sort((a, b) => a.at.localeCompare(b.at));
    return collected.slice(-24);
  }, [monitors, selectedMonitor]);

  // SVG Timeline geometry (800 x 148)
  const svgW = 800;
  const svgH = 148;
  const padLeft = 48;
  const padRight = 32;
  const padTop = 20;
  const padBottom = 26;
  const chartW = svgW - padLeft - padRight;
  const chartH = svgH - padTop - padBottom;

  const timelineGeometry = useMemo(() => {
    if (timelineSamples.length === 0) {
      const midY = padTop + chartH / 2;
      return {
        tracePath: `M ${padLeft} ${midY} L ${padLeft + chartW} ${midY}`,
        areaPath: `M ${padLeft} ${padTop + chartH} L ${padLeft} ${midY} L ${padLeft + chartW} ${midY} L ${padLeft + chartW} ${padTop + chartH} Z`,
        coords: [] as Array<{
          x: number;
          y: number;
          sample: (typeof timelineSamples)[number];
        }>,
        maxMs: 400,
      };
    }
    const maxMs = Math.max(...timelineSamples.map((s) => s.ms), 120);
    const minMs = 0;
    const range = Math.max(1, maxMs - minMs);

    const coords = timelineSamples.map((sample, idx) => {
      const x =
        timelineSamples.length === 1
          ? padLeft + chartW / 2
          : padLeft + (idx / (timelineSamples.length - 1)) * chartW;
      const y = padTop + chartH - ((sample.ms - minMs) / range) * chartH;
      return { x, y, sample };
    });

    const tracePath =
      coords.length === 1
        ? `M ${padLeft} ${coords[0].y.toFixed(1)} L ${padLeft + chartW} ${coords[0].y.toFixed(1)}`
        : coords
            .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
            .join(" ");

    const firstX = coords.length === 1 ? padLeft : coords[0].x;
    const lastX = coords.length === 1 ? padLeft + chartW : coords[coords.length - 1].x;
    const linePart =
      coords.length === 1
        ? `L ${padLeft} ${coords[0].y.toFixed(1)} L ${padLeft + chartW} ${coords[0].y.toFixed(1)}`
        : coords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
    const areaPath = `M ${firstX.toFixed(1)} ${padTop + chartH} ${linePart} L ${lastX.toFixed(1)} ${padTop + chartH} Z`;

    return { tracePath, areaPath, coords, maxMs };
  }, [timelineSamples, chartH, chartW]);

  const traceDashoffset = Math.round((1 - chapterProgress) * 1000);
  const playheadTranslateX = (chapterProgress * chartW).toFixed(1);
  const areaClipRight = ((1 - chapterProgress) * 100).toFixed(1);
  const chassisLiftY = ((1 - chapterProgress) * 26).toFixed(1);

  const scrubbedSample = useMemo(() => {
    if (timelineSamples.length === 0) return null;
    const index = Math.min(
      timelineSamples.length - 1,
      Math.max(0, Math.floor(chapterProgress * timelineSamples.length)),
    );
    return timelineSamples[index] ?? timelineSamples[timelineSamples.length - 1];
  }, [timelineSamples, chapterProgress]);

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

      ctx.fillStyle = "#0c1017";
      ctx.fillRect(0, 0, width, height);

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

      ctx.strokeStyle = "rgba(56, 139, 253, 0.4)";
      ctx.lineWidth = 1.2;
      for (let y = 12; y < height; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(6, y);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(56, 139, 253, 0.28)";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      if (!isReduced) {
        wavePhaseRef.current += isReplaying ? 0.22 : 0.04;
      }
      const phase = wavePhaseRef.current;
      const midY = height / 2;

      const measuredMs = activeCheck?.duration_ms ?? null;
      const hasResponse = activeCheck?.outcome === "up" && measuredMs != null;
      const amplitude = hasResponse
        ? isReplaying
          ? 32
          : Math.min(26, Math.max(8, measuredMs / 8))
        : 0;
      const freq = isReplaying ? 0.045 : 0.025;

      if (amplitude > 0) {
        ctx.strokeStyle =
          isReplaying ? "rgba(88, 166, 255, 0.2)" : "rgba(46, 160, 67, 0.18)";
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

        ctx.strokeStyle = isReplaying ? "#58a6ff" : "#3fb950";
        ctx.lineWidth = 2.4;
        ctx.shadowColor = isReplaying
          ? "rgba(88, 166, 255, 0.7)"
          : "rgba(46, 160, 67, 0.6)";
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
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle =
          activeCheck?.outcome === "down"
            ? "rgba(248, 81, 73, 0.7)"
            : "rgba(100, 114, 135, 0.4)";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
      }

      const currentNeedleY =
        midY +
        (amplitude > 0 && waveformType === "sine"
          ? Math.sin((width / 2) * freq + phase) * amplitude
          : 0);
      ctx.fillStyle =
        amplitude > 0
          ? isReplaying
            ? "#58a6ff"
            : "#3fb950"
          : activeCheck?.outcome === "down"
            ? "#f85149"
            : "#647287";
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
  }, [isReplaying, activeCheck, waveformType]);

  const triggerReplay = () => {
    if (!hasChecks || !activeCheck) return;
    setIsReplaying(true);
    setTimeout(() => {
      setIsReplaying(false);
    }, 400);
  };

  useEffect(() => {
    onTargetChange?.();
  }, [selectedMonitorId, onTargetChange]);

  return (
    <div
      className="probe-sandbox"
      id="probe"
      aria-labelledby="probe-heading"
      data-scroll-progress={chapterProgress.toFixed(3)}
      style={{ "--chapter-2-progress": chapterProgress.toFixed(3) } as React.CSSProperties}
    >
      <div className="section-head">
        <div>
          <p className="section-kicker">02 / Recorded Check Explorer &amp; Chronograph</p>
          <h2 id="probe-heading">Recorded Check Telemetry &amp; Signal Inspector</h2>
        </div>
        <p className="section-meta">
          Scroll-coupled latency chronograph &amp; selectable Cloudflare D1 check inspector.
        </p>
      </div>

      {/* Scroll-Driven Monitoring Timeline Stage */}
      <div
        id="monitoring-timeline-stage"
        className="monitoring-timeline-stage"
        data-scroll-progress={chapterProgress.toFixed(3)}
      >
        <div className="timeline-stage-header">
          <div className="timeline-stage-title">
            <span className="timeline-pulse-pip" aria-hidden="true" />
            <span className="mono">
              SCROLL-COUPLED TELEMETRY CHRONOGRAPH // REAL D1 LATENCY TRACE
            </span>
          </div>
          <div id="timeline-scroll-readout" className="timeline-scroll-readout mono">
            {scrubbedSample ? (
              <>
                <span id="timeline-sample-label">SAMPLE: {scrubbedSample.label}</span>
                <span>·</span>
                <span id="timeline-sample-time">{formatShortTime(scrubbedSample.at)}</span>
                <span>·</span>
                <span
                  id="timeline-sample-ms"
                  className={scrubbedSample.outcome === "up" ? "highlight-green" : "value-down"}
                >
                  {scrubbedSample.ms}ms ({scrubbedSample.outcome.toUpperCase()})
                </span>
              </>
            ) : (
              <span>0 RECORDED SAMPLES IN D1 WINDOW</span>
            )}
            <span id="timeline-sweep-pct" className="timeline-sweep-pct">
              SWEEP {Math.round(chapterProgress * 100)}%
            </span>
          </div>
        </div>

        <div className="timeline-svg-wrap">
          <svg
            id="monitoring-timeline-svg"
            className="monitoring-timeline-svg"
            viewBox={`0 0 ${svgW} ${svgH}`}
            role="img"
            aria-label="Scroll-drawn monitoring latency timeline from recorded Cloudflare D1 checks"
          >
            <defs>
              <linearGradient id="timeline-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#388bfd" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#388bfd" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal latency calibration gridlines */}
            {[0, 0.5, 1].map((ratio, idx) => {
              const y = padTop + ratio * chartH;
              const labelMs = Math.round((1 - ratio) * timelineGeometry.maxMs);
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + chartW}
                    y2={y}
                    stroke="rgba(56, 70, 92, 0.42)"
                    strokeDasharray={idx === 1 ? "4 4" : undefined}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#647287"
                    fontSize="10"
                    fontFamily="var(--mono)"
                  >
                    {labelMs}ms
                  </text>
                </g>
              );
            })}

            {/* Scroll-clipped area fill */}
            <g
              id="timeline-area-group"
              style={{
                clipPath: `inset(0px ${areaClipRight}% 0px 0px)`,
              }}
            >
              <path d={timelineGeometry.areaPath} fill="url(#timeline-area-grad)" />
            </g>

            {/* Scroll-drawn primary telemetry trace */}
            <path
              id="timeline-svg-trace"
              d={timelineGeometry.tracePath}
              fill="none"
              stroke="#58a6ff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1000}
              strokeDasharray={1000}
              strokeDashoffset={traceDashoffset}
              style={{ strokeDashoffset: `${traceDashoffset}px` }}
            />

            {/* Plotted check sample nodes revealed along scroll sweep */}
            {timelineGeometry.coords.map((c, idx) => {
              const nodeThreshold =
                timelineGeometry.coords.length <= 1
                  ? 0
                  : idx / (timelineGeometry.coords.length - 1);
              const isRevealed = chapterProgress >= nodeThreshold - 0.02;
              return (
                <circle
                  key={c.sample.id}
                  className="timeline-sample-node"
                  data-threshold={nodeThreshold.toFixed(4)}
                  data-outcome={c.sample.outcome}
                  data-label={c.sample.label}
                  data-time={formatShortTime(c.sample.at)}
                  data-ms={String(c.sample.ms)}
                  cx={c.x}
                  cy={c.y}
                  r={isRevealed ? 3.8 : 1.5}
                  fill={
                    !isRevealed
                      ? "#283243"
                      : c.sample.outcome === "down"
                        ? "#f85149"
                        : "#3fb950"
                  }
                  stroke="#0b0e14"
                  strokeWidth="1.2"
                />
              );
            })}

            {/* Scroll-Scrubbed Chronograph Playhead Carriage */}
            <g
              id="timeline-playhead-group"
              style={{
                transform: `translate3d(${playheadTranslateX}px, 0px, 0px)`,
              }}
            >
              <line
                x1={padLeft}
                y1={padTop - 8}
                x2={padLeft}
                y2={padTop + chartH + 8}
                stroke="#3fb950"
                strokeWidth="1.8"
              />
              <polygon
                points={`${padLeft - 5},${padTop - 8} ${padLeft + 5},${padTop - 8} ${padLeft},${padTop - 1}`}
                fill="#3fb950"
              />
              <rect
                x={padLeft - 26}
                y={padTop + chartH + 6}
                width={52}
                height={15}
                rx={2}
                fill="#121720"
                stroke="#3fb950"
                strokeWidth="1"
              />
              <text
                id="timeline-playhead-pct"
                x={padLeft}
                y={padTop + chartH + 17}
                textAnchor="middle"
                fill="#3fb950"
                fontSize="9"
                fontFamily="var(--mono)"
              >
                {Math.round(chapterProgress * 100)}%
              </text>
            </g>
          </svg>
        </div>
      </div>

      <div
        id="probe-chassis-stage"
        className="probe-grid"
        style={{
          transform: `translate3d(0px, ${chassisLiftY}px, 0px)`,
        }}
      >
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
                setSelectedCheckId(null);
              }}
            >
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.project}] {m.name} — {hostOf(m.url)}
                </option>
              ))}
            </select>
          </div>

          {hasChecks ? (
            <div className="probe-field">
              <label htmlFor="probe-check-select" className="probe-label">
                Select Recorded Check ({checks.length} stored in D1)
              </label>
              <select
                id="probe-check-select"
                className="probe-select"
                value={activeCheck?.id ?? ""}
                onChange={(e) => setSelectedCheckId(Number(e.target.value))}
              >
                {checks.map((c) => (
                  <option key={c.id} value={c.id}>
                    Record #{c.id} · {formatShortTime(c.checked_at)} ·{" "}
                    {c.status_code ? `HTTP ${c.status_code}` : "No response"} ·{" "}
                    {c.duration_ms != null ? `${c.duration_ms}ms` : "timeout"} ({c.source})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="notice notice-quiet" role="status">
              <p className="mono">
                No check records stored in Cloudflare D1 for this endpoint yet.
              </p>
            </div>
          )}

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
              <span className="probe-meta-label">Expected Rule</span>
              <span className="probe-meta-value mono">
                {selectedMonitor?.expectedStatus ?? "2xx_3xx"}
              </span>
            </div>
            <div>
              <span className="probe-meta-label">Recorded Trend</span>
              <span className="probe-meta-value mono">
                {selectedMonitor?.trend?.length
                  ? `${selectedMonitor.trend.length} samples (${Math.round(
                      (selectedMonitor.trend.filter((t) => t.outcome === "up").length /
                        selectedMonitor.trend.length) *
                        100,
                    )}% up)`
                  : "No trend data"}
              </span>
            </div>
            <div>
              <span className="probe-meta-label">Failure Category</span>
              <span className="probe-meta-value mono">
                {activeCheck?.error_category ??
                  (activeCheck?.outcome === "down" ? "Uncategorized" : "None (Clean)")}
              </span>
            </div>
          </div>

          <div className="probe-action-row">
            <button
              type="button"
              className="button button-accent probe-button"
              onClick={triggerReplay}
              disabled={!hasChecks}
            >
              <span className={`probe-radar-icon ${isReplaying ? "spinning" : ""}`} />
              {hasChecks
                ? isReplaying
                  ? "Replaying Telemetry..."
                  : "Inspect Recorded Check Telemetry"
                : "Inspection Unavailable (0 Checks)"}
            </button>
            <div className="waveform-toggle" role="group" aria-label="Oscilloscope wave type">
              <button
                type="button"
                className={`button-chip ${waveformType === "sine" ? "active" : ""}`}
                onClick={() => setWaveformType("sine")}
                disabled={!hasChecks}
              >
                Sine Wave
              </button>
              <button
                type="button"
                className={`button-chip ${waveformType === "pulse" ? "active" : ""}`}
                onClick={() => setWaveformType("pulse")}
                disabled={!hasChecks}
              >
                Pulse Stream
              </button>
            </div>
          </div>

          <div className="probe-pipeline-status" aria-live="polite">
            <span
              className={`pipeline-indicator ${
                hasChecks
                  ? activeCheck?.outcome === "up"
                    ? "complete"
                    : "probing"
                  : "idle"
              }`}
            />
            <span className="pipeline-text mono">
              {hasChecks && activeCheck
                ? `D1 Check #${activeCheck.id}: ${
                    activeCheck.status_code
                      ? `HTTP ${activeCheck.status_code}`
                      : "No HTTP response"
                  } in ${
                    activeCheck.duration_ms != null ? `${activeCheck.duration_ms}ms` : "N/A"
                  } (${activeCheck.source} trigger at ${formatShortTime(
                    activeCheck.checked_at,
                  )}).`
                : "No check records stored in Cloudflare D1 for this endpoint."}
            </span>
          </div>

          <div className="stage-telemetry-breakdown">
            <div className="breakdown-card">
              <span className="breakdown-title">Check Timestamp</span>
              <span className="breakdown-val mono">
                {hasChecks && activeCheck
                  ? formatTimestamp(activeCheck.checked_at)
                  : "No checks recorded"}
              </span>
            </div>
            <div className="breakdown-card">
              <span className="breakdown-title">HTTP Status</span>
              <span className="breakdown-val mono">
                {hasChecks && activeCheck
                  ? activeCheck.status_code != null
                    ? `HTTP ${activeCheck.status_code}`
                    : "No HTTP response"
                  : "Unavailable"}
              </span>
            </div>
            <div className="breakdown-card">
              <span className="breakdown-title">Measured Latency</span>
              <span className="breakdown-val mono">
                {hasChecks && activeCheck && activeCheck.duration_ms != null
                  ? `${activeCheck.duration_ms} ms`
                  : "No response"}
              </span>
            </div>
            <div className="breakdown-card">
              <span className="breakdown-title">Execution Trigger</span>
              <span className="breakdown-val mono">
                {hasChecks && activeCheck
                  ? `${activeCheck.source.toUpperCase()} // Slot: ${
                      activeCheck.slot ?? "manual"
                    }`
                  : "No D1 slot"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Oscilloscope & Telemetry HUD */}
        <div className="probe-screen-panel">
          <div className="oscilloscope-header">
            <span className="oscilloscope-tag mono">
              {hasChecks
                ? "CHART RECORDER // ILLUSTRATIVE RESPONSE WAVEFORM"
                : "CHART RECORDER // NO RECORDED SIGNALS"}
            </span>
            <span className="oscilloscope-pop mono">
              {hasChecks && activeCheck ? `D1 RECORD #${activeCheck.id}` : "NO D1 RECORDS"}
            </span>
          </div>
          <div className="oscilloscope-viewport">
            <canvas
              ref={canvasRef}
              width={480}
              height={200}
              className="oscilloscope-canvas"
              aria-label={
                hasChecks
                  ? "Illustrative signal oscilloscope waveform"
                  : "Oscilloscope flat baseline (no recorded checks)"
              }
            />
          </div>
          <div className="oscilloscope-footer">
            <div>
              <span className="hud-label">Measured Latency</span>
              <span className="hud-val mono">
                {hasChecks && activeCheck && activeCheck.duration_ms != null
                  ? `${activeCheck.duration_ms} ms`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="hud-label">Recorded State</span>
              <span
                className={`hud-val mono ${
                  hasChecks && activeCheck?.outcome === "up" ? "highlight-green" : ""
                }`}
              >
                {hasChecks && activeCheck ? activeCheck.outcome.toUpperCase() : "UNAVAILABLE"}
              </span>
            </div>
            <div>
              <span className="hud-label">D1 Ledger Record</span>
              <span className="hud-val mono truncate-hash">
                {hasChecks && activeCheck ? `D1-REC:#${activeCheck.id}` : "NONE"}
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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const rafPendingRef = useRef<number | null>(null);
  const rafUpdateCountRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  renderCountRef.current += 1;

  const scrollRef = useRef<ScrollChoreography>({
    scrollY: 0,
    pageProgress: 0,
    heroProgress: 0,
    chapter1Progress: 0,
    chapter2Progress: 0,
    chapter3Progress: 0,
    chapter4Progress: 0,
    rowProgress: {},
  });

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

  // Deterministic Scroll Choreography Engine (DOM-direct, coalesced to 1 requestAnimationFrame per frame, 0 React rerenders on scroll)
  const applyScrollChoreography = useCallback(() => {
    if (typeof window === "undefined") return;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const vh = Math.max(window.innerHeight || 900, 1);
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      vh,
    );
    const maxScroll = Math.max(1, docHeight - vh);

    let pageProgress = 1;
    let heroProgress = 1;
    let chapter1Progress = 1;
    let chapter2Progress = 1;
    let chapter3Progress = 1;
    let chapter4Progress = 1;
    const rowProgress: Record<string, number> = {};

    const servicesEl = document.getElementById("services");
    const probeEl = document.getElementById("probe");
    const incidentsEl = document.getElementById("incidents");
    const methodEl = document.getElementById("method");
    const serviceNodes = document.querySelectorAll<HTMLElement>(".service[data-monitor-id]");

    if (isReduced) {
      serviceNodes.forEach((node) => {
        const id = node.getAttribute("data-monitor-id");
        if (id) rowProgress[id] = 1;
      });
    } else {
      pageProgress = clamp01(scrollY / maxScroll);
      heroProgress = clamp01(scrollY / (vh * 0.55));

      const computeChapterProgress = (el: HTMLElement | null, isServices = false): number => {
        if (!el) return 0;
        if (isServices) {
          if (scrollY <= 8) return 0;
          const rect = el.getBoundingClientRect();
          const entryAndTraverse = (vh * 0.58 - rect.top) / (vh * 1.15);
          return clamp01(Math.max(scrollY / (vh * 1.25), entryAndTraverse));
        }
        const rect = el.getBoundingClientRect();
        const elDocTop = rect.top + scrollY;
        const minPossibleTop = elDocTop - maxScroll;
        const targetTop = Math.max(-vh * 0.12, minPossibleTop + 16);
        const startTop = Math.max(vh * 0.92, targetTop + vh * 0.45);
        return clamp01((startTop - rect.top) / Math.max(1, startTop - targetTop));
      };

      chapter1Progress = computeChapterProgress(servicesEl, true);
      chapter2Progress = computeChapterProgress(probeEl, false);
      chapter3Progress = computeChapterProgress(incidentsEl, false);
      chapter4Progress = computeChapterProgress(methodEl, false);

      serviceNodes.forEach((node) => {
        const id = node.getAttribute("data-monitor-id");
        if (!id) return;
        const rect = node.getBoundingClientRect();
        const elDocTop = rect.top + scrollY;
        const minPossibleTop = elDocTop - maxScroll;
        const targetTop = Math.max(vh * 0.24, minPossibleTop + 16);
        const startTop = Math.max(vh * 0.92, targetTop + vh * 0.42);
        const raw = clamp01((startTop - rect.top) / Math.max(1, startTop - targetTop));
        rowProgress[id] = scrollY <= 4 ? Math.min(raw, 0.25) : raw;
      });
    }

    scrollRef.current = {
      scrollY,
      pageProgress,
      heroProgress,
      chapter1Progress,
      chapter2Progress,
      chapter3Progress,
      chapter4Progress,
      rowProgress,
    };

    rafUpdateCountRef.current += 1;

    // 0. Root shell CSS custom properties & telemetry canvas attributes
    const shellEl = shellRef.current;
    if (shellEl) {
      shellEl.style.setProperty("--page-scroll", pageProgress.toFixed(3));
      shellEl.style.setProperty("--hero-progress", heroProgress.toFixed(3));
      shellEl.style.setProperty("--chapter-1-progress", chapter1Progress.toFixed(3));
      shellEl.style.setProperty("--chapter-2-progress", chapter2Progress.toFixed(3));
      shellEl.style.setProperty("--chapter-3-progress", chapter3Progress.toFixed(3));
      shellEl.style.setProperty("--chapter-4-progress", chapter4Progress.toFixed(3));
      shellEl.setAttribute("data-raf-updates", String(rafUpdateCountRef.current));
    }

    const canvasEl = document.querySelector<HTMLElement>(".telemetry-canvas");
    if (canvasEl) {
      canvasEl.setAttribute("data-scroll-y", String(Math.round(scrollY)));
      canvasEl.setAttribute("data-paper-offset", String(Math.round((scrollY * 0.45) % 140)));
    }

    const mastheadFill = document.getElementById("masthead-scroll-fill");
    if (mastheadFill) {
      mastheadFill.style.transform = `scaleX(${pageProgress.toFixed(3)})`;
    }

    // 1. Hero section & 30-day drum carriage
    const heroEl = document.getElementById("hero-section");
    if (heroEl) {
      heroEl.setAttribute("data-scroll-progress", heroProgress.toFixed(3));
    }
    const heroCopyEl = document.getElementById("hero-copy-plate");
    if (heroCopyEl) {
      heroCopyEl.style.transform = `translate3d(0px, ${(-heroProgress * 18).toFixed(1)}px, 0px)`;
    }
    const heroFigEl = document.getElementById("hero-figure-plate");
    if (heroFigEl) {
      heroFigEl.style.transform = `translate3d(0px, ${(heroProgress * 20).toFixed(1)}px, 0px)`;
    }
    const heroCarriageEl = document.getElementById("hero-drum-carriage");
    if (heroCarriageEl) {
      heroCarriageEl.style.transform = `translate3d(${(heroProgress * 296).toFixed(1)}px, 0px, 0px)`;
    }
    const heroCarriageReadout = document.getElementById("hero-carriage-readout");
    if (heroCarriageReadout) {
      heroCarriageReadout.textContent = `CARRIAGE: ${Math.round(heroProgress * 100)}%`;
    }

    // 2. Chapter 1 (#services): Spool apparatus & per-row physical ledger strip unspooling
    if (servicesEl) {
      servicesEl.setAttribute("data-scroll-progress", chapter1Progress.toFixed(3));
    }
    const spoolWheelEl = document.getElementById("services-spool-wheel");
    if (spoolWheelEl) {
      spoolWheelEl.style.transform = `rotate(${(chapter1Progress * 180).toFixed(1)}deg)`;
    }
    const spoolFillEl = document.getElementById("services-spool-fill");
    if (spoolFillEl) {
      spoolFillEl.style.transform = `scaleX(${chapter1Progress.toFixed(3)})`;
    }
    const spoolPctEl = document.getElementById("services-spool-pct");
    if (spoolPctEl) {
      spoolPctEl.textContent = `FEED: ${Math.round(chapter1Progress * 100)}%`;
    }

    let engagedCount = 0;
    serviceNodes.forEach((node) => {
      const id = node.getAttribute("data-monitor-id");
      const clamped = clamp01(id ? (rowProgress[id] ?? 0.2) : 0.2);
      if (clamped >= 0.5) engagedCount += 1;

      const clipInsetRight = ((1 - clamped) * 88).toFixed(1);
      const stripShiftX = (-(1 - clamped) * 18).toFixed(1);
      const printheadX = (clamped * 100).toFixed(1);
      const rowShiftX = (-(1 - clamped) * 12).toFixed(1);

      node.setAttribute("data-row-progress", clamped.toFixed(3));
      node.style.setProperty("--row-progress", clamped.toFixed(3));
      node.style.transform = `translate3d(${rowShiftX}px, 0px, 0px)`;

      const stripEl = node.querySelector<HTMLElement>(".uptime-strip");
      if (stripEl) {
        stripEl.style.clipPath = `inset(0px ${clipInsetRight}% 0px 0px)`;
        stripEl.style.transform = `translate3d(${stripShiftX}px, 0px, 0px)`;
      }
      const printheadEl = node.querySelector<HTMLElement>(".strip-printhead");
      if (printheadEl) {
        printheadEl.style.transform = `translate3d(${printheadX}%, 0px, 0px)`;
        printheadEl.style.left = `${(12 + clamped * 88).toFixed(1)}%`;
      }
    });

    const spoolEngagedEl = document.getElementById("services-spool-engaged");
    if (spoolEngagedEl && data?.monitors) {
      spoolEngagedEl.textContent = `${engagedCount}/${data.monitors.length} STRIPS UNSPOOLED`;
    }

    // 3. Chapter 2 (#probe): Scroll-drawn live monitoring timeline & playhead carriage
    if (probeEl) {
      probeEl.setAttribute("data-scroll-progress", chapter2Progress.toFixed(3));
      probeEl.style.setProperty("--chapter-2-progress", chapter2Progress.toFixed(3));
    }
    const timelineStageEl = document.getElementById("monitoring-timeline-stage");
    if (timelineStageEl) {
      timelineStageEl.setAttribute("data-scroll-progress", chapter2Progress.toFixed(3));
    }
    const timelineAreaEl = document.getElementById("timeline-area-group");
    if (timelineAreaEl) {
      timelineAreaEl.style.clipPath = `inset(0px ${((1 - chapter2Progress) * 100).toFixed(1)}% 0px 0px)`;
    }
    const timelineTraceEl = document.getElementById("timeline-svg-trace");
    if (timelineTraceEl) {
      const traceDashoffset = Math.round((1 - chapter2Progress) * 1000);
      timelineTraceEl.setAttribute("stroke-dashoffset", String(traceDashoffset));
      timelineTraceEl.style.strokeDashoffset = `${traceDashoffset}px`;
    }
    const timelinePlayheadEl = document.getElementById("timeline-playhead-group");
    if (timelinePlayheadEl) {
      timelinePlayheadEl.style.transform = `translate3d(${(chapter2Progress * 720).toFixed(1)}px, 0px, 0px)`;
    }
    const timelinePlayheadPctEl = document.getElementById("timeline-playhead-pct");
    if (timelinePlayheadPctEl) {
      timelinePlayheadPctEl.textContent = `${Math.round(chapter2Progress * 100)}%`;
    }
    const timelineSweepPctEl = document.getElementById("timeline-sweep-pct");
    if (timelineSweepPctEl) {
      timelineSweepPctEl.textContent = `SWEEP ${Math.round(chapter2Progress * 100)}%`;
    }
    const probeChassisEl = document.getElementById("probe-chassis-stage");
    if (probeChassisEl) {
      probeChassisEl.style.transform = `translate3d(0px, ${((1 - chapter2Progress) * 26).toFixed(1)}px, 0px)`;
    }

    const sampleNodes = document.querySelectorAll<SVGCircleElement>(".timeline-sample-node");
    if (sampleNodes.length > 0) {
      sampleNodes.forEach((circle) => {
        const threshold = Number(circle.getAttribute("data-threshold") ?? "0");
        const outcome = circle.getAttribute("data-outcome") ?? "up";
        const isRevealed = chapter2Progress >= threshold - 0.02;
        circle.setAttribute("r", isRevealed ? "3.8" : "1.5");
        circle.setAttribute(
          "fill",
          !isRevealed ? "#283243" : outcome === "down" ? "#f85149" : "#3fb950",
        );
      });
      const activeIdx = Math.min(
        sampleNodes.length - 1,
        Math.max(0, Math.floor(chapter2Progress * sampleNodes.length)),
      );
      const activeNode = sampleNodes[activeIdx];
      if (activeNode) {
        const label = activeNode.getAttribute("data-label") ?? "";
        const time = activeNode.getAttribute("data-time") ?? "";
        const ms = activeNode.getAttribute("data-ms") ?? "";
        const outcome = activeNode.getAttribute("data-outcome") ?? "up";
        const labelEl = document.getElementById("timeline-sample-label");
        const timeEl = document.getElementById("timeline-sample-time");
        const msEl = document.getElementById("timeline-sample-ms");
        if (labelEl) labelEl.textContent = `SAMPLE: ${label}`;
        if (timeEl) timeEl.textContent = time;
        if (msEl) {
          msEl.textContent = `${ms}ms (${outcome.toUpperCase()})`;
          msEl.className = outcome === "up" ? "highlight-green" : "value-down";
        }
      }
    }

    // 4. Chapter 3 (#incidents): Rotary verification seal & unfolding broadsheet
    if (incidentsEl) {
      incidentsEl.setAttribute("data-scroll-progress", chapter3Progress.toFixed(3));
    }
    const dossierStageEl = document.getElementById("incident-dossier-stage");
    if (dossierStageEl) {
      dossierStageEl.setAttribute("data-scroll-progress", chapter3Progress.toFixed(3));
    }
    const sealRingEl = document.getElementById("incident-seal-ring");
    if (sealRingEl) {
      const sealDashoffset = Math.round((1 - chapter3Progress) * 1000);
      sealRingEl.setAttribute("stroke-dashoffset", String(sealDashoffset));
      sealRingEl.style.strokeDashoffset = `${sealDashoffset}px`;
    }
    const sealRotorEl = document.getElementById("incident-seal-rotor");
    if (sealRotorEl) {
      sealRotorEl.style.transform = `rotate(${(chapter3Progress * 180).toFixed(1)}deg)`;
    }
    const sealProgressTextEl = document.getElementById("incident-seal-progress-text");
    if (sealProgressTextEl) {
      sealProgressTextEl.textContent = `SEAL DRAWN · ${Math.round(chapter3Progress * 100)}%`;
    }
    const spineFillEl = document.getElementById("incident-spine-fill");
    if (spineFillEl) {
      spineFillEl.style.transform = `scaleY(${chapter3Progress.toFixed(3)})`;
    }
    const broadsheetEl = document.getElementById("incident-broadsheet-panel");
    if (broadsheetEl) {
      const slideX = ((1 - chapter3Progress) * 20).toFixed(1);
      const liftY = ((1 - chapter3Progress) * 26).toFixed(1);
      broadsheetEl.style.transform = `translate3d(${slideX}px, ${liftY}px, 0px)`;
    }

    // 5. Chapter 4 (#method): Protocol bus line & signal carriage
    if (methodEl) {
      methodEl.setAttribute("data-scroll-progress", chapter4Progress.toFixed(3));
    }
    const methodBusPctEl = document.getElementById("method-bus-pct");
    if (methodBusPctEl) {
      methodBusPctEl.textContent = `PROTOCOL BUS: ${Math.round(chapter4Progress * 100)}% WIRED`;
    }
    const methodBusLineEl = document.getElementById("method-bus-line");
    if (methodBusLineEl) {
      const methodBusDashoffset = Math.round((1 - chapter4Progress) * 1000);
      methodBusLineEl.setAttribute("stroke-dashoffset", String(methodBusDashoffset));
      methodBusLineEl.style.strokeDashoffset = `${methodBusDashoffset}px`;
    }
    const methodCarriageEl = document.getElementById("method-signal-carriage");
    if (methodCarriageEl) {
      methodCarriageEl.style.transform = `translate3d(${(chapter4Progress * 680).toFixed(1)}px, 0px, 0px)`;
    }
    const methodCardsEl = document.getElementById("method-cards-stage");
    if (methodCardsEl) {
      methodCardsEl.style.transform = `translate3d(0px, ${((1 - chapter4Progress) * 24).toFixed(1)}px, 0px)`;
    }
    const methodNodes = document.querySelectorAll<SVGGElement>("g[data-method-node-idx]");
    methodNodes.forEach((group) => {
      const idx = Number(group.getAttribute("data-method-node-idx") ?? "0");
      const reached = chapter4Progress >= idx / 3 - 0.05;
      const circle = group.querySelector("circle");
      const texts = group.querySelectorAll("text");
      if (circle) {
        circle.setAttribute("fill", reached ? "#121720" : "#0b0e14");
        circle.setAttribute("stroke", reached ? "#3fb950" : "#3b475c");
      }
      if (texts[0]) texts[0].setAttribute("fill", reached ? "#3fb950" : "#647287");
      if (texts[1]) texts[1].setAttribute("fill", reached ? "#f0f6fc" : "#647287");
    });
  }, [data]);

  const scheduleScrollChoreography = useCallback(() => {
    if (rafPendingRef.current != null) return;
    rafPendingRef.current = window.requestAnimationFrame(() => {
      rafPendingRef.current = null;
      applyScrollChoreography();
    });
  }, [applyScrollChoreography]);

  useEffect(() => {
    applyScrollChoreography();
    window.addEventListener("scroll", scheduleScrollChoreography, { passive: true });
    window.addEventListener("resize", scheduleScrollChoreography, { passive: true });

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        () => {
          scheduleScrollChoreography();
        },
        { threshold: [0, 0.15, 0.35, 0.65, 1] },
      );
      ["services", "probe", "incidents", "method"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer?.observe(el);
      });
    }

    return () => {
      window.removeEventListener("scroll", scheduleScrollChoreography);
      window.removeEventListener("resize", scheduleScrollChoreography);
      observer?.disconnect();
      if (rafPendingRef.current != null) {
        window.cancelAnimationFrame(rafPendingRef.current);
        rafPendingRef.current = null;
      }
    };
  }, [applyScrollChoreography, scheduleScrollChoreography, data, selectedProjectFilter]);

  const currentScrollState = scrollRef.current;
  const overall = data?.overall ?? "unknown";
  const uptime = data ? overallUptime(data.monitors) : null;
  const activeCount = data?.monitors.filter((monitor) => !monitor.paused).length ?? 0;
  const activeIncidents =
    data?.incidents.filter((incident) => incident.status !== "resolved") ?? [];
  const projects = data
    ? Array.from(new Set(data.monitors.map((monitor) => monitor.project)))
    : [];

  const engagedRowsCount = data?.monitors
    ? data.monitors.filter((m) => (currentScrollState.rowProgress[m.id] ?? 0) >= 0.5).length
    : 0;

  const sealDashoffset = Math.round((1 - currentScrollState.chapter3Progress) * 1000);
  const sealRotation = (currentScrollState.chapter3Progress * 180).toFixed(1);
  const incidentLiftY = ((1 - currentScrollState.chapter3Progress) * 26).toFixed(1);
  const incidentSlideX = ((1 - currentScrollState.chapter3Progress) * 20).toFixed(1);

  const methodBusDashoffset = Math.round((1 - currentScrollState.chapter4Progress) * 1000);
  const methodCarriageX = (currentScrollState.chapter4Progress * 680).toFixed(1);
  const methodGridLiftY = ((1 - currentScrollState.chapter4Progress) * 24).toFixed(1);

  return (
    <div
      ref={shellRef}
      className="public-shell telemetric-world"
      data-render-count={renderCountRef.current}
      data-raf-updates={rafUpdateCountRef.current}
      style={
        {
          "--page-scroll": currentScrollState.pageProgress.toFixed(3),
          "--hero-progress": currentScrollState.heroProgress.toFixed(3),
          "--chapter-1-progress": currentScrollState.chapter1Progress.toFixed(3),
          "--chapter-2-progress": currentScrollState.chapter2Progress.toFixed(3),
          "--chapter-3-progress": currentScrollState.chapter3Progress.toFixed(3),
          "--chapter-4-progress": currentScrollState.chapter4Progress.toFixed(3),
        } as React.CSSProperties
      }
    >
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
            JOURNAL: CLOUDFLARE D1
          </span>
        </div>
        <nav className="masthead-nav" aria-label="Primary">
          <a href="#services">Services</a>
          <a href="#probe">Recorded Checks</a>
          <a href="#incidents">Incidents</a>
          <a href="#method">Method</a>
          <Link className="owner-link button-secondary" href="/admin">
            Owner sign in
          </Link>
        </nav>
        <div className="masthead-tape-track" aria-hidden="true">
          <div
            id="masthead-scroll-fill"
            className="masthead-scroll-fill"
            style={{
              transform: `scaleX(${currentScrollState.pageProgress.toFixed(3)})`,
            }}
          />
        </div>
      </header>

      <main id="main">
        {/* Choreographed Hero Section */}
        <section
          id="hero-section"
          className="hero"
          aria-labelledby="status-heading"
          data-scroll-progress={currentScrollState.heroProgress.toFixed(3)}
        >
          <div
            id="hero-copy-plate"
            className="hero-copy"
            style={{
              transform: `translate3d(0px, ${(-currentScrollState.heroProgress * 18).toFixed(1)}px, 0px)`,
            }}
          >
            <div className="hero-eyebrow-row">
              <span className="telemetry-pulse-dot" />
              <p className="eyebrow">
                Operations Journal &amp; Ledger
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
                Inspect Recorded Checks
              </a>
              <span className="updated-note mono">
                {lastUpdated
                  ? `Updated ${formatRelative(new Date(lastUpdated).toISOString(), now)}`
                  : "Not updated yet"}
              </span>
            </div>

            {/* Live Portfolio Project Register Strip */}
            {projects.length > 0 && data ? (
              <div className="hero-portfolio-strip" aria-label="Monitored portfolio register">
                {projects.map((proj, idx) => {
                  const group = data.monitors.filter((m) => m.project === proj);
                  const upCount = group.filter((m) => m.state === "operational").length;
                  const hasDown = group.some(
                    (m) => m.state === "down" || m.state === "incident",
                  );
                  const hasDegraded = group.some((m) => m.state === "degraded");
                  const pipClass = hasDown
                    ? "pip-down"
                    : hasDegraded
                      ? "pip-degraded"
                      : "pip-up";
                  return (
                    <a
                      key={proj}
                      href={`#project-${idx}`}
                      className="portfolio-register-cell"
                    >
                      <span className={`register-pip ${pipClass}`} aria-hidden="true" />
                      <span className="register-proj-name">{proj}</span>
                      <span className="register-proj-count mono">
                        {upCount}/{group.length}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>

          <aside
            id="hero-figure-plate"
            className="hero-figure"
            aria-label="Thirty-day fleet ledger summary"
            style={{
              transform: `translate3d(0px, ${(currentScrollState.heroProgress * 20).toFixed(1)}px, 0px)`,
            }}
          >
            <div className="figure-top">
              <div className="figure-badge-group">
                <span className="figure-pip pip-active" aria-hidden="true" />
                <p className="figure-label">30-day Fleet Ledger</p>
              </div>
              <span className="figure-chip mono">CF-D1 ARCHIVE</span>
            </div>

            <div className="figure-metric-block">
              <div className="figure-metric-row">
                <p className="figure-value mono">
                  {uptime && uptime.checks > 0 ? formatPercent(uptime.percent) : "—"}
                </p>
                <span className="figure-metric-sub mono">FLEET AVAILABILITY</span>
              </div>
              <div className="figure-health-bar" aria-hidden="true">
                <div
                  className="health-bar-operational"
                  style={{
                    width:
                      uptime && uptime.checks > 0
                        ? `${Math.min(100, Math.max(0, uptime.percent))}%`
                        : "0%",
                  }}
                />
                {uptime && uptime.checks > 0 && uptime.percent < 100 ? (
                  <div
                    className="health-bar-impact"
                    style={{ width: `${Math.max(0, 100 - uptime.percent)}%` }}
                  />
                ) : null}
              </div>
            </div>

            {data ? (
              <HeroFleetSeismograph
                monitors={data.monitors}
                heroProgress={currentScrollState.heroProgress}
              />
            ) : null}

            <p className="figure-note">
              {uptime
                ? `Recorded from ${formatCount(uptime.checks)} checks across ${activeCount} active endpoint${activeCount === 1 ? "" : "s"} stored in Cloudflare D1.`
                : "No checks recorded yet. Scheduled runs populate this ledger."}
            </p>

            <div className="figure-stats-row">
              <div>
                <span className="fstat-label">Cadence</span>
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
              <div>
                <span className="fstat-label">Endpoints</span>
                <span className="fstat-val mono">{data?.monitors.length ?? 11} targets</span>
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
            {/* Scroll Chapter 1: Services Fleet Matrix & Physical Ledger Unspooling */}
            <section
              id="services"
              className="section"
              aria-labelledby="services-heading"
              data-scroll-progress={currentScrollState.chapter1Progress.toFixed(3)}
            >
              <div className="section-head">
                <div>
                  <p className="section-kicker">01 / Fleet Matrix &amp; Ledger Spool</p>
                  <h2 id="services-heading">What is being watched</h2>
                </div>
                <p className="section-meta">
                  {projects.length} project{projects.length === 1 ? "" : "s"} ·{" "}
                  {data.monitors.length} monitor{data.monitors.length === 1 ? "" : "s"} · checks
                  every {data.meta.checkIntervalMinutes} minutes · 30-day retention
                </p>
              </div>

              {/* Physical Ledger Spool Apparatus Bar */}
              <div
                id="chapter-1-spool-bar"
                className="chapter-spool-bar"
                aria-hidden="true"
              >
                <div className="spool-reel-group">
                  <svg
                    id="services-spool-wheel"
                    className="spool-wheel-svg"
                    viewBox="0 0 36 36"
                    style={{
                      transform: `rotate(${(currentScrollState.chapter1Progress * 180).toFixed(1)}deg)`,
                    }}
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#388bfd"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                    <circle cx="18" cy="18" r="5" fill="#121720" stroke="#58a6ff" strokeWidth="1.5" />
                    <line x1="18" y1="3" x2="18" y2="33" stroke="rgba(88, 166, 255, 0.45)" strokeWidth="1.2" />
                    <line x1="3" y1="18" x2="33" y2="18" stroke="rgba(88, 166, 255, 0.45)" strokeWidth="1.2" />
                  </svg>
                  <span className="spool-label mono">30D LEDGER TAPE FEED</span>
                </div>

                <div className="spool-track-wrap">
                  <div className="spool-track">
                    <div
                      id="services-spool-fill"
                      className="spool-track-fill"
                      style={{
                        transform: `scaleX(${currentScrollState.chapter1Progress.toFixed(3)})`,
                      }}
                    />
                  </div>
                  <div className="spool-ruler-ticks mono">
                    <span>-30D</span>
                    <span>-21D</span>
                    <span>-14D</span>
                    <span>-07D</span>
                    <span>TODAY</span>
                  </div>
                </div>

                <div id="services-spool-readout" className="spool-readout mono">
                  <span id="services-spool-pct">
                    FEED: {Math.round(currentScrollState.chapter1Progress * 100)}%
                  </span>
                  <span>·</span>
                  <span id="services-spool-engaged">
                    {engagedRowsCount}/{data.monitors.length} STRIPS UNSPOOLED
                  </span>
                </div>
              </div>

              {/* Project Filter Ribbon */}
              <div
                className="project-filter-bar"
                role="toolbar"
                aria-label="Filter services by project"
              >
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
                    <Link href="/admin">owner desk</Link>. Nothing is shown until a real check
                    completes.
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
                            {projectMonitors.length} endpoint
                            {projectMonitors.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="service-list">
                          {projectMonitors.map((monitor) => (
                            <ServiceRow
                              key={monitor.id}
                              monitor={monitor}
                              timeoutMs={data.meta.timeoutMs}
                              rowProgress={currentScrollState.rowProgress[monitor.id] ?? 0.2}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Scroll Chapter 2: Scroll-Drawn Monitoring Timeline & Recorded Check Explorer */}
            <section className="section">
              <InteractiveProbeSandbox
                monitors={data.monitors}
                timeoutMs={data.meta.timeoutMs}
                chapterProgress={currentScrollState.chapter2Progress}
                onTargetChange={scheduleScrollChoreography}
              />
            </section>

            {/* Scroll Chapter 3: Forensic Incident Stream & Rotary Verification Seal */}
            <section
              id="incidents"
              className="section"
              aria-labelledby="incidents-heading"
              data-scroll-progress={currentScrollState.chapter3Progress.toFixed(3)}
            >
              <div className="section-head">
                <div>
                  <p className="section-kicker">03 / Incident journal &amp; forensic seal</p>
                  <h2 id="incidents-heading">What happened, in plain language</h2>
                </div>
                <p className="section-meta">
                  {activeIncidents.length} active · resolved incidents kept for 30 days
                </p>
              </div>

              <div
                id="incident-dossier-stage"
                className="incident-dossier-stage"
                data-scroll-progress={currentScrollState.chapter3Progress.toFixed(3)}
              >
                {/* Left: Scroll-Driven Rotary Verification Seal & Audit Spine */}
                <aside className="incident-seal-panel" aria-hidden="true">
                  <div className="seal-svg-wrap">
                    <svg
                      id="incident-seal-svg"
                      className="incident-seal-svg"
                      viewBox="0 0 180 180"
                    >
                      <circle
                        cx="90"
                        cy="90"
                        r="76"
                        fill="none"
                        stroke="rgba(56, 70, 92, 0.45)"
                        strokeWidth="1.5"
                        strokeDasharray="3 5"
                      />
                      <circle
                        id="incident-seal-ring"
                        cx="90"
                        cy="90"
                        r="68"
                        fill="none"
                        stroke={activeIncidents.length > 0 ? "#f85149" : "#3fb950"}
                        strokeWidth="3"
                        strokeLinecap="round"
                        pathLength={1000}
                        strokeDasharray={1000}
                        strokeDashoffset={sealDashoffset}
                        transform="rotate(-90 90 90)"
                        style={{ strokeDashoffset: `${sealDashoffset}px` }}
                      />
                      <g
                        id="incident-seal-rotor"
                        style={{
                          transform: `rotate(${sealRotation}deg)`,
                          transformOrigin: "90px 90px",
                        }}
                      >
                        <circle
                          cx="90"
                          cy="90"
                          r="52"
                          fill="none"
                          stroke="#58a6ff"
                          strokeWidth="1.4"
                          strokeDasharray="12 8"
                        />
                        <line x1="90" y1="28" x2="90" y2="42" stroke="#58a6ff" strokeWidth="2" />
                        <line x1="90" y1="138" x2="90" y2="152" stroke="#58a6ff" strokeWidth="2" />
                        <line x1="28" y1="90" x2="42" y2="90" stroke="#58a6ff" strokeWidth="2" />
                        <line x1="138" y1="90" x2="152" y2="90" stroke="#58a6ff" strokeWidth="2" />
                      </g>
                      <text
                        x="90"
                        y="84"
                        textAnchor="middle"
                        fill="#f0f6fc"
                        fontSize="12"
                        fontWeight="700"
                        fontFamily="var(--mono)"
                      >
                        {activeIncidents.length === 0
                          ? "SEAL: CLEAN"
                          : `${activeIncidents.length} ACTIVE`}
                      </text>
                      <text
                        id="incident-seal-progress-text"
                        x="90"
                        y="102"
                        textAnchor="middle"
                        fill="#8b949e"
                        fontSize="9.5"
                        fontFamily="var(--mono)"
                      >
                        SEAL DRAWN · {Math.round(currentScrollState.chapter3Progress * 100)}%
                      </text>
                    </svg>
                  </div>

                  <div className="incident-audit-spine">
                    <span className="spine-label mono">30D AUDIT HORIZON</span>
                    <div className="spine-track">
                      <div
                        id="incident-spine-fill"
                        className="spine-track-fill"
                        style={{
                          transform: `scaleY(${currentScrollState.chapter3Progress.toFixed(3)})`,
                        }}
                      />
                    </div>
                    <span className="spine-readout mono">
                      {data.incidents.length} RECORD{data.incidents.length === 1 ? "" : "S"}
                    </span>
                  </div>
                </aside>

                {/* Right: Unfolding Forensic Incident Broadsheet */}
                <div
                  id="incident-broadsheet-panel"
                  className="incident-broadsheet-panel"
                  style={{
                    transform: `translate3d(${incidentSlideX}px, ${incidentLiftY}px, 0px)`,
                  }}
                >
                  {data.incidents.length === 0 ? (
                    <div className="empty-state incident-clean-seal">
                      <div className="seal-badge mono">0 DISRUPTIONS ACTIVE</div>
                      <h3>No incidents recorded.</h3>
                      <p>
                        This log starts with the current deployment. No past incident history
                        has been invented. All {data.monitors.length} portfolio endpoints are
                        checked on the {data.meta.checkIntervalMinutes}-minute cron.
                      </p>
                    </div>
                  ) : (
                    <div className="incident-list">
                      {data.incidents.map((incident) => (
                        <IncidentCard key={incident.id} incident={incident} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Scroll Chapter 4: Operational Protocol & Scroll-Wired Signal Schematic */}
            <section
              id="method"
              className="section method"
              aria-labelledby="method-heading"
              data-scroll-progress={currentScrollState.chapter4Progress.toFixed(3)}
            >
              <div className="section-head">
                <div>
                  <p className="section-kicker">04 / Method &amp; protocol</p>
                  <h2 id="method-heading">How these numbers are made</h2>
                </div>
                <p id="method-bus-pct" className="section-meta mono">
                  PROTOCOL BUS: {Math.round(currentScrollState.chapter4Progress * 100)}% WIRED
                </p>
              </div>

              {/* Scroll-Wired Protocol Signal Schematic */}
              <div
                id="method-schematic-stage"
                className="method-schematic-stage"
                aria-hidden="true"
              >
                <svg
                  id="method-schematic-svg"
                  className="method-schematic-svg"
                  viewBox="0 0 880 76"
                >
                  <line
                    x1="80"
                    y1="38"
                    x2="800"
                    y2="38"
                    stroke="rgba(56, 70, 92, 0.5)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <path
                    id="method-bus-line"
                    d="M 80 38 L 800 38"
                    fill="none"
                    stroke="#3fb950"
                    strokeWidth="3"
                    strokeLinecap="round"
                    pathLength={1000}
                    strokeDasharray={1000}
                    strokeDashoffset={methodBusDashoffset}
                    style={{ strokeDashoffset: `${methodBusDashoffset}px` }}
                  />
                  {[
                    { x: 80, code: "01", title: "CRON TRIGGER" },
                    { x: 320, code: "02", title: "SSRF & TLS GUARD" },
                    { x: 560, code: "03", title: "ZERO-SAMPLE MATH" },
                    { x: 800, code: "04", title: "6-STATE LEDGER" },
                  ].map((node, idx) => {
                    const reached = currentScrollState.chapter4Progress >= idx / 3 - 0.05;
                    return (
                      <g key={node.code} data-method-node-idx={idx}>
                        <circle
                          cx={node.x}
                          cy="38"
                          r="12"
                          fill={reached ? "#121720" : "#0b0e14"}
                          stroke={reached ? "#3fb950" : "#3b475c"}
                          strokeWidth="2.2"
                        />
                        <text
                          x={node.x}
                          y="42"
                          textAnchor="middle"
                          fill={reached ? "#3fb950" : "#647287"}
                          fontSize="9"
                          fontWeight="700"
                          fontFamily="var(--mono)"
                        >
                          {node.code}
                        </text>
                        <text
                          x={node.x}
                          y="66"
                          textAnchor="middle"
                          fill={reached ? "#f0f6fc" : "#647287"}
                          fontSize="9.5"
                          fontFamily="var(--mono)"
                        >
                          {node.title}
                        </text>
                      </g>
                    );
                  })}
                  <g
                    id="method-signal-carriage"
                    style={{
                      transform: `translate3d(${methodCarriageX}px, 0px, 0px)`,
                    }}
                  >
                    <circle cx="80" cy="38" r="5" fill="#58a6ff" />
                  </g>
                </svg>
              </div>

              <div
                id="method-cards-stage"
                className="method-grid"
                style={{
                  transform: `translate3d(0px, ${methodGridLiftY}px, 0px)`,
                }}
              >
                <div className="method-card">
                  <div className="method-card-header">
                    <span className="card-num mono">01</span>
                    <h3>Edge Checks</h3>
                  </div>
                  <p>
                    Each active service is requested over HTTPS every{" "}
                    {data.meta.checkIntervalMinutes} minutes with a{" "}
                    {Math.round(data.meta.timeoutMs / 1000)}-second timeout. Redirects are not
                    followed; a 3xx response is recorded as-is.
                  </p>
                </div>
                <div className="method-card">
                  <div className="method-card-header">
                    <span className="card-num mono">02</span>
                    <h3>Strict Success</h3>
                  </div>
                  <p>
                    A check is up when the response matches the monitor&apos;s status rule
                    (2xx/3xx by default). Timeouts, DNS, TLS, and connection errors are down.
                    Every completed check is stored.
                  </p>
                </div>
                <div className="method-card">
                  <div className="method-card-header">
                    <span className="card-num mono">03</span>
                    <h3>Zero-Sample Uptime</h3>
                  </div>
                  <p>
                    Percentages are calculated only from recorded checks in each window. Paused
                    monitors run no checks, so paused time is never counted as a failure. Small
                    samples are labelled provisional.
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
                      <StateBadge state="degraded" /> A recent failure ratio of 20% or a latest
                      response of 2 seconds or more.
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
          <p className="footer-wordmark">
            Pulse<span>Ledger</span>
          </p>
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

function ServiceRow({
  monitor,
  timeoutMs,
  rowProgress,
}: {
  monitor: MonitorView;
  timeoutMs: number;
  rowProgress: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailId = `detail-${monitor.id}`;
  const last = monitor.lastCheck;
  const lastDescription = last
    ? `${describeCheck(last, timeoutMs)} · ${formatRelative(last.checked_at)}`
    : "No completed check yet";

  // Physical unspooling calculations driven by scroll position
  const clamped = clamp01(rowProgress);
  const clipInsetRight = ((1 - clamped) * 88).toFixed(1);
  const stripShiftX = (-(1 - clamped) * 18).toFixed(1);
  const printheadX = (clamped * 100).toFixed(1);
  const rowShiftX = (-(1 - clamped) * 12).toFixed(1);

  return (
    <article
      className={`service service-state-${monitor.state}`}
      data-monitor-id={monitor.id}
      data-row-progress={clamped.toFixed(3)}
      style={
        {
          "--row-progress": clamped.toFixed(3),
          transform: `translate3d(${rowShiftX}px, 0px, 0px)`,
        } as React.CSSProperties
      }
    >
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
        <div className="service-strip-unspool">
          <UptimeStrip
            daily={monitor.daily}
            name={monitor.name}
            clipInsetRight={clipInsetRight}
            stripShiftX={stripShiftX}
          />
          <span
            className="strip-printhead"
            aria-hidden="true"
            style={{
              transform: `translate3d(${printheadX}%, 0px, 0px)`,
              left: `${(12 + clamped * 88).toFixed(1)}%`,
            }}
          />
        </div>
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

function UptimeStrip({
  daily,
  name,
  clipInsetRight,
  stripShiftX,
}: {
  daily: DailyBucket[];
  name: string;
  clipInsetRight: string;
  stripShiftX: string;
}) {
  const total = daily.reduce((sum, day) => sum + day.total, 0);
  const up = daily.reduce((sum, day) => sum + day.up, 0);
  const summary =
    total === 0
      ? `No checks recorded in the last 30 days for ${name}.`
      : `Thirty-day check history for ${name}: ${up} up and ${
          total - up
        } down across ${total} checks.`;

  return (
    <div
      className="uptime-strip"
      role="img"
      aria-label={summary}
      style={{
        clipPath: `inset(0px ${clipInsetRight}% 0px 0px)`,
        transform: `translate3d(${stripShiftX}px, 0px, 0px)`,
      }}
    >
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
        Latest {formatDuration(latest.ms)} · range {formatDuration(fastest)}–
        {formatDuration(slowest)}
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
          <summary>Earlier updates ({incident.updates.length - 1})</summary>
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
