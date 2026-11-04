import { describe, expect, it } from "vitest";
import {
  buildDailyBuckets,
  dailyBucketsFromCounts,
  deriveMonitorState,
  deriveOverallState,
  expectedStatusMatches,
  formatUptime,
  latencySummary,
  percentile,
  summarizeUptime,
  uptimePercent,
  uptimeWindow,
} from "../src/shared/status";

const NOW = new Date("2026-11-01T12:00:00.000Z");

function check(outcome: "up" | "down", minutesAgo: number, duration = 100) {
  return {
    outcome,
    duration_ms: duration,
    checked_at: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
  };
}

describe("uptime", () => {
  it("returns null for an empty window instead of inventing 100%", () => {
    expect(uptimePercent([])).toBeNull();
    expect(uptimeWindow([])).toEqual({
      percent: null,
      up: 0,
      down: 0,
      total: 0,
      sufficient: false,
    });
  });

  it("calculates percentages from stored checks", () => {
    const window = uptimeWindow([
      { outcome: "up" },
      { outcome: "up" },
      { outcome: "down" },
    ]);
    expect(window.percent).toBe(66.7);
    expect(window.total).toBe(3);
    expect(window.sufficient).toBe(false);
  });

  it("marks small samples as insufficient and labels them provisional", () => {
    const window = uptimeWindow([{ outcome: "up" }]);
    expect(window.sufficient).toBe(false);
    expect(formatUptime(window)).toBe("Provisional · 1 check");
    expect(formatUptime(uptimeWindow([]))).toBe("No data");
  });

  it("reports 100% without decimal noise", () => {
    const checks = Array.from({ length: 5 }, () => ({ outcome: "up" as const }));
    expect(formatUptime(uptimeWindow(checks))).toBe("100%");
  });

  it("splits checks into 24h, 7d, and 30d windows from real timestamps", () => {
    const summary = summarizeUptime(
      [check("up", 60), check("down", 60 * 48), check("up", 60 * 24 * 10), check("up", 60 * 24 * 40)],
      NOW,
    );
    expect(summary.h24.total).toBe(1);
    expect(summary.d7.total).toBe(2);
    expect(summary.d7.percent).toBe(50);
    expect(summary.d30.total).toBe(3);
  });
});

describe("latency", () => {
  it("uses nearest-rank percentiles", () => {
    expect(percentile([40, 10, 30, 20], 50)).toBe(20);
    expect(percentile([40, 10, 30, 20], 95)).toBe(40);
    expect(percentile([], 50)).toBeNull();
  });

  it("excludes failed checks from latency figures", () => {
    const summary = latencySummary([
      { outcome: "up", duration_ms: 100, checked_at: NOW.toISOString() },
      { outcome: "up", duration_ms: 300, checked_at: NOW.toISOString() },
      { outcome: "down", duration_ms: 9_000, checked_at: NOW.toISOString() },
    ]);
    expect(summary.samples).toBe(2);
    expect(summary.average).toBe(200);
    expect(summary.p95).toBe(300);
  });
});

describe("monitor state", () => {
  it("is unknown before the first completed check", () => {
    expect(
      deriveMonitorState({ paused: false, hasActiveIncident: false, checks: [] }),
    ).toBe("unknown");
  });

  it("lets paused win over other conditions", () => {
    expect(
      deriveMonitorState({
        paused: true,
        hasActiveIncident: true,
        checks: [check("down", 1)],
      }),
    ).toBe("paused");
  });

  it("reports incident-active when the owner has an open incident", () => {
    expect(
      deriveMonitorState({
        paused: false,
        hasActiveIncident: true,
        checks: [check("up", 1)],
      }),
    ).toBe("incident");
  });

  it("reports down when the latest check failed", () => {
    expect(
      deriveMonitorState({
        paused: false,
        hasActiveIncident: false,
        checks: [check("down", 1), check("up", 16)],
      }),
    ).toBe("down");
  });

  it("reports degraded when 20% of the recent checks failed", () => {
    const checks = [
      check("up", 1),
      check("up", 16),
      check("up", 31),
      check("up", 46),
      check("up", 61),
      check("up", 76),
      check("up", 91),
      check("up", 106),
      check("down", 121),
      check("down", 136),
    ];
    expect(
      deriveMonitorState({ paused: false, hasActiveIncident: false, checks }),
    ).toBe("degraded");
  });

  it("reports degraded for a latest response of two seconds or more", () => {
    expect(
      deriveMonitorState({
        paused: false,
        hasActiveIncident: false,
        checks: [check("up", 1, 2_500)],
      }),
    ).toBe("degraded");
  });

  it("is operational when the latest check is healthy", () => {
    expect(
      deriveMonitorState({
        paused: false,
        hasActiveIncident: false,
        checks: [check("up", 1, 120), check("down", 20)],
      }),
    ).toBe("operational");
  });
});

describe("overall state", () => {
  it("uses incident, down, degraded, unknown precedence", () => {
    expect(deriveOverallState(["operational", "incident"])).toBe("incident");
    expect(deriveOverallState(["operational", "down"])).toBe("down");
    expect(deriveOverallState(["operational", "degraded"])).toBe("degraded");
    expect(deriveOverallState(["paused", "unknown"])).toBe("unknown");
    expect(deriveOverallState(["operational", "unknown"])).toBe("unknown");
    expect(deriveOverallState([])).toBe("unknown");
    expect(deriveOverallState(["operational", "paused"])).toBe("operational");
  });
});

describe("status rules", () => {
  it("matches the configured expected status", () => {
    expect(expectedStatusMatches(200, "2xx_3xx")).toBe(true);
    expect(expectedStatusMatches(301, "2xx_3xx")).toBe(true);
    expect(expectedStatusMatches(404, "2xx_3xx")).toBe(false);
    expect(expectedStatusMatches(204, "2xx")).toBe(true);
    expect(expectedStatusMatches(301, "2xx")).toBe(false);
    expect(expectedStatusMatches(302, "3xx")).toBe(true);
    expect(expectedStatusMatches(200, "200")).toBe(true);
    expect(expectedStatusMatches(201, "200")).toBe(false);
  });
});

describe("daily buckets", () => {
  it("creates a full UTC day grid and leaves empty days empty", () => {
    const buckets = buildDailyBuckets(
      [
        { checked_at: "2026-11-01T10:00:00.000Z", outcome: "up" },
        { checked_at: "2026-11-01T11:00:00.000Z", outcome: "down" },
        { checked_at: "2026-10-30T11:00:00.000Z", outcome: "up" },
      ],
      3,
      NOW,
    );
    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toEqual({ date: "2026-10-30", up: 1, down: 0, total: 1 });
    expect(buckets[1]).toEqual({ date: "2026-10-31", up: 0, down: 0, total: 0 });
    expect(buckets[2]).toEqual({ date: "2026-11-01", up: 1, down: 1, total: 2 });
  });

  it("builds the same grid from aggregate counts", () => {
    const buckets = dailyBucketsFromCounts(
      [{ date: "2026-11-01", up: 4, down: 1 }],
      2,
      NOW,
    );
    expect(buckets[1]).toEqual({ date: "2026-11-01", up: 4, down: 1, total: 5 });
  });
});

describe("real-data and no-data branches", () => {
  it("never invents uptime when total checks is zero", () => {
    expect(uptimePercent([])).toBeNull();
    const window = uptimeWindow([]);
    expect(window.percent).toBeNull();
    expect(window.total).toBe(0);
    expect(formatUptime(window)).toBe("No data");
  });

  it("handles empty and zero-check latency measurements honestly without fabricated metrics", () => {
    const summary = latencySummary([]);
    expect(summary.samples).toBe(0);
    expect(summary.average).toBeNull();
    expect(summary.p95).toBeNull();
    expect(percentile([], 50)).toBeNull();
    expect(percentile([], 95)).toBeNull();
  });

  it("preserves authentic failure outcomes for checks without HTTP response", () => {
    const state = deriveMonitorState({
      paused: false,
      hasActiveIncident: false,
      checks: [
        {
          outcome: "down",
          duration_ms: 10_000,
          checked_at: NOW.toISOString(),
        },
      ],
    });
    expect(state).toBe("down");
  });

  it("distinguishes active checks from honest zero-fill empty state across multiple days", () => {
    const buckets = buildDailyBuckets([], 7, NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets.every((b) => b.total === 0 && b.up === 0 && b.down === 0)).toBe(true);
  });
});
