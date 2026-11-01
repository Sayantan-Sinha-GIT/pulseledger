import type {
  CheckOutcome,
  DailyBucket,
  ExpectedStatus,
  LatencyPoint,
  LatencySummary,
  MonitorState,
  OverallState,
  UptimeSummary,
  UptimeWindow,
} from "./types";

export const RETENTION_DAYS = 30;
export const MAX_MONITORS = 12;
export const CHECK_INTERVAL_MINUTES = 15;
export const CHECK_TIMEOUT_MS = 10_000;
export const PUBLIC_REFRESH_SECONDS = 60;
export const DEGRADED_SLOW_MS = 2_000;
export const DEGRADED_WINDOW = 10;
export const DEGRADED_FAILURE_RATIO = 0.2;
export const SUFFICIENT_SAMPLES = 5;

export interface OutcomeLike {
  outcome: CheckOutcome;
}

export interface DurationLike extends OutcomeLike {
  duration_ms: number;
  checked_at: string;
}

/** Percentage of successful checks, or null when the window has no checks. */
export function uptimePercent(checks: OutcomeLike[]): number | null {
  if (checks.length === 0) return null;
  const up = checks.filter((check) => check.outcome === "up").length;
  return round1((up / checks.length) * 100);
}

export function uptimeWindow(checks: OutcomeLike[]): UptimeWindow {
  const up = checks.filter((check) => check.outcome === "up").length;
  const total = checks.length;
  return {
    percent: total === 0 ? null : round1((up / total) * 100),
    up,
    down: total - up,
    total,
    sufficient: total >= SUFFICIENT_SAMPLES,
  };
}

/** Percentile using the nearest-rank method. Returns null for an empty set. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export function latencySummary(checks: DurationLike[]): LatencySummary {
  const successful = checks.filter((check) => check.outcome === "up");
  const values = successful.map((check) => check.duration_ms);
  if (values.length === 0) {
    return { p50: null, p95: null, average: null, samples: 0 };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    average: Math.round(sum / values.length),
    samples: values.length,
  };
}

/**
 * Derives a monitor's visible state from stored checks and open incidents.
 * Precedence: paused, incident, unknown (no completed check), down, degraded, operational.
 */
export function deriveMonitorState(input: {
  paused: boolean;
  hasActiveIncident: boolean;
  checks: DurationLike[];
}): MonitorState {
  if (input.paused) return "paused";
  if (input.hasActiveIncident) return "incident";
  const latest = input.checks[0];
  if (!latest) return "unknown";
  if (latest.outcome === "down") return "down";

  const recent = input.checks.slice(0, DEGRADED_WINDOW);
  const failures = recent.filter((check) => check.outcome === "down").length;
  if (recent.length >= 3 && failures / recent.length >= DEGRADED_FAILURE_RATIO) {
    return "degraded";
  }
  if (latest.duration_ms >= DEGRADED_SLOW_MS) return "degraded";
  return "operational";
}

export function deriveOverallState(states: MonitorState[]): OverallState {
  if (states.length === 0) return "unknown";
  if (states.includes("incident")) return "incident";
  if (states.includes("down")) return "down";
  if (states.includes("degraded")) return "degraded";
  if (states.includes("unknown")) return "unknown";
  const observed = states.filter(
    (state) => state !== "unknown" && state !== "paused",
  );
  if (observed.length === 0) return "unknown";
  return "operational";
}

export function overallHeadline(state: OverallState): string {
  switch (state) {
    case "operational":
      return "All systems operational.";
    case "degraded":
      return "Partial degradation.";
    case "down":
      return "Service disruption.";
    case "incident":
      return "An incident is active.";
    default:
      return "Awaiting service checks.";
  }
}

export function expectedStatusMatches(
  status: number,
  expected: ExpectedStatus,
): boolean {
  switch (expected) {
    case "200":
      return status === 200;
    case "2xx":
      return status >= 200 && status < 300;
    case "3xx":
      return status >= 300 && status < 400;
    case "2xx_3xx":
    default:
      return status >= 200 && status < 400;
  }
}

/** UTC day buckets, oldest first, including days with no data. */
export function buildDailyBuckets(
  checks: { checked_at: string; outcome: CheckOutcome }[],
  days: number,
  now: Date,
): DailyBucket[] {
  const buckets = new Map<string, DailyBucket>();
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    buckets.set(date, { date, up: 0, down: 0, total: 0 });
  }
  for (const check of checks) {
    const date = check.checked_at.slice(0, 10);
    const bucket = buckets.get(date);
    if (!bucket) continue;
    if (check.outcome === "up") bucket.up += 1;
    else bucket.down += 1;
    bucket.total += 1;
  }
  return [...buckets.values()];
}

/** Builds the same UTC day grid from pre-aggregated counts. */
export function dailyBucketsFromCounts(
  rows: { date: string; up: number; down: number }[],
  days: number,
  now: Date,
): DailyBucket[] {
  const buckets = new Map<string, DailyBucket>();
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    buckets.set(date, { date, up: 0, down: 0, total: 0 });
  }
  for (const row of rows) {
    const bucket = buckets.get(row.date);
    if (!bucket) continue;
    bucket.up += Number(row.up);
    bucket.down += Number(row.down);
    bucket.total = bucket.up + bucket.down;
  }
  return [...buckets.values()];
}

export function toTrend(checks: DurationLike[], limit = 40): LatencyPoint[] {  return checks
    .slice(0, limit)
    .reverse()
    .map((check) => ({
      at: check.checked_at,
      ms: check.duration_ms,
      outcome: check.outcome,
    }));
}

export function summarizeUptime(
  checks: { checked_at: string; outcome: CheckOutcome }[],
  now: Date,
): UptimeSummary {
  const windows: [keyof UptimeSummary, number][] = [
    ["h24", 24 * 3_600_000],
    ["d7", 7 * 86_400_000],
    ["d30", 30 * 86_400_000],
  ];
  const result = {} as UptimeSummary;
  for (const [key, span] of windows) {
    const cutoff = now.getTime() - span;
    result[key] = uptimeWindow(
      checks.filter((check) => Date.parse(check.checked_at) >= cutoff),
    );
  }
  return result;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Formats a percentage without inventing precision for tiny samples. */
export function formatUptime(window: UptimeWindow): string {
  if (window.total === 0) return "No data";
  if (!window.sufficient) return `Provisional · ${window.total} check${window.total === 1 ? "" : "s"}`;
  if (window.percent === 100) return "100%";
  return `${window.percent?.toFixed(1)}%`;
}
