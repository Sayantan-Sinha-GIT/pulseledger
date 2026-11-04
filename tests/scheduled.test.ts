import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import {
  classifyCheckError,
  pruneOldData,
  runScheduledChecks,
  slotForTime,
} from "../src/worker/checks";
import { insertCheck, getMonitorId } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scheduled checks", () => {
  it("floors the scheduled time to a 15-minute slot", () => {
    expect(slotForTime(Date.parse("2026-11-01T12:07:45.000Z"))).toBe(
      "2026-11-01T12:00:00.000Z",
    );
    expect(slotForTime(Date.parse("2026-11-01T12:15:00.000Z"))).toBe(
      "2026-11-01T12:15:00.000Z",
    );
  });

  it("checks both active monitors and stores one row per slot", async () => {
    const fetchStub = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);

    const summary = await runScheduledChecks(
      env,
      Date.parse("2026-11-01T12:07:45.000Z"),
    );
    expect(summary.slot).toBe("2026-11-01T12:00:00.000Z");
    expect(summary.monitors).toBe(2);
    expect(summary.checked).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.failures).toBe(0);
    expect(fetchStub).toHaveBeenCalledTimes(2);

    const rows = await env.DB.prepare(
      "SELECT outcome, source, slot FROM checks ORDER BY monitor_id",
    ).all<{ outcome: string; source: string; slot: string }>();
    expect(rows.results).toHaveLength(2);
    expect(rows.results.every((row) => row.outcome === "up")).toBe(true);
    expect(rows.results.every((row) => row.source === "scheduled")).toBe(true);
    expect(rows.results.every((row) => row.slot === "2026-11-01T12:00:00.000Z")).toBe(true);
    const snapshot = await env.DB.prepare(
      "SELECT payload FROM public_status_snapshot WHERE id = 1",
    ).first<{ payload: string }>();
    expect(JSON.parse(snapshot?.payload ?? "{}").monitors.every((monitor: { lastCheck: { source: string } }) => monitor.lastCheck.source === "scheduled")).toBe(true);

    const second = await runScheduledChecks(env, Date.parse("2026-11-01T12:09:00.000Z"));
    expect(second.skipped).toBe(2);
    expect(second.checked).toBe(0);
    expect(fetchStub).toHaveBeenCalledTimes(2);

    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM checks").first<{
      count: number;
    }>();
    expect(Number(count?.count)).toBe(2);

    const run = await env.DB.prepare("SELECT * FROM cron_runs WHERE slot = ?")
      .bind("2026-11-01T12:00:00.000Z")
      .first<{ finished_at: string | null; monitors_checked: number }>();
    expect(run?.finished_at).not.toBeNull();
    expect(run?.monitors_checked).toBe(2);
  });

  it("records HTTP failures and counts them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const summary = await runScheduledChecks(env, Date.parse("2026-11-01T13:00:00.000Z"));
    expect(summary.checked).toBe(2);
    expect(summary.failures).toBe(2);
    const rows = await env.DB.prepare(
      "SELECT outcome, error_category, status_code FROM checks",
    ).all<{ outcome: string; error_category: string; status_code: number }>();
    expect(rows.results.every((row) => row.outcome === "down")).toBe(true);
    expect(rows.results.every((row) => row.error_category === "http_status")).toBe(true);
    expect(rows.results.every((row) => row.status_code === 500)).toBe(true);
  });

  it("skips paused monitors", async () => {
    const monitorId = await getMonitorId("Haan website");
    await env.DB.prepare("UPDATE monitors SET paused = 1 WHERE id = ?").bind(monitorId).run();
    const fetchStub = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);
    const summary = await runScheduledChecks(env, Date.parse("2026-11-01T14:00:00.000Z"));
    expect(summary.monitors).toBe(1);
    expect(summary.checked).toBe(1);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});

describe("retention", () => {
  it("removes checks older than 30 days and keeps fresh ones", async () => {
    const monitorId = await getMonitorId("Haan website");
    await insertCheck({
      monitorId,
      outcome: "up",
      checkedAt: new Date(Date.now() - 31 * 86_400_000).toISOString(),
    });
    await insertCheck({ monitorId, outcome: "up" });
    await pruneOldData(env);
    const rows = await env.DB.prepare("SELECT checked_at FROM checks").all<{
      checked_at: string;
    }>();
    expect(rows.results).toHaveLength(1);
    expect(Date.parse(rows.results[0].checked_at)).toBeGreaterThan(
      Date.now() - 30 * 86_400_000,
    );
  });
});

describe("error classification", () => {
  it("maps runtime failures to stable diagnostic categories", () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    expect(classifyCheckError(timeout)).toBe("timeout");

    const dns = new TypeError("fetch failed");
    (dns as TypeError & { cause?: { code: string } }).cause = { code: "ENOTFOUND" };
    expect(classifyCheckError(dns)).toBe("dns");

    const tls = new TypeError("fetch failed");
    (tls as TypeError & { cause?: { code: string } }).cause = {
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
    };
    expect(classifyCheckError(tls)).toBe("tls");

    expect(classifyCheckError(new TypeError("fetch failed"))).toBe("connection");
  });
});
