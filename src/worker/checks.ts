import {
  CHECK_INTERVAL_MINUTES,
  CHECK_TIMEOUT_MS,
  RETENTION_DAYS,
  expectedStatusMatches,
} from "../shared/status";
import { validateMonitorUrl } from "../shared/urlSafety";
import type {
  CheckOutcome,
  CheckRow,
  CheckSource,
  ErrorCategory,
  MonitorRow,
} from "../shared/types";
import type { Env } from "./env";

const USER_AGENT =
  "PulseLedger/1.0 (uptime monitor; https://github.com/Sayantan-Sinha-GIT/pulseledger)";

export function slotForTime(scheduledTime: number): string {
  const interval = CHECK_INTERVAL_MINUTES * 60_000;
  return new Date(Math.floor(scheduledTime / interval) * interval).toISOString();
}

export function classifyCheckError(error: unknown): ErrorCategory {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const cause = (error as { cause?: { code?: string } } | undefined)?.cause;
  const code = cause?.code ?? "";
  const haystack = `${code} ${message}`;
  if (name === "TimeoutError" || name === "AbortError" || /timeout|timed out/i.test(haystack)) {
    return "timeout";
  }
  if (/ENOTFOUND|EAI_AGAIN|dns/i.test(haystack)) return "dns";
  if (/CERT|TLS|SSL|certificate|handshake/i.test(haystack)) return "tls";
  return "connection";
}

export interface CheckResult {
  check: CheckRow;
  inserted: boolean;
}

/**
 * Performs one HTTP check and stores it. Manual checks and cron checks share
 * this path so their history, latency, and uptime semantics are identical.
 */
export async function runCheck(
  env: Env,
  monitor: MonitorRow,
  source: CheckSource,
  slot: string | null,
): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  let statusCode: number | null = null;
  let outcome: CheckOutcome = "down";
  let errorCategory: ErrorCategory | null = null;
  const started = performance.now();

  const validation = validateMonitorUrl(monitor.url);
  if (!validation.ok) {
    errorCategory = "invalid_url";
  } else {
    try {
      const response = await fetch(validation.url, {
        method: "GET",
        redirect: "manual",
        headers: {
          "user-agent": USER_AGENT,
          accept: "*/*",
          "cache-control": "no-cache",
        },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
      statusCode = response.status;
      // Never download an unbounded body; the status line is the signal.
      await response.body?.cancel().catch(() => undefined);
      if (expectedStatusMatches(statusCode, monitor.expected_status)) {
        outcome = "up";
      } else {
        errorCategory = "http_status";
      }
    } catch (error) {
      errorCategory = classifyCheckError(error);
    }
  }

  const durationMs = Math.max(0, Math.round(performance.now() - started));

  const insert = await env.DB.prepare(
    `INSERT OR IGNORE INTO checks
      (monitor_id, checked_at, status_code, outcome, error_category, duration_ms, source, slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      monitor.id,
      checkedAt,
      statusCode,
      outcome,
      errorCategory,
      durationMs,
      source,
      slot,
    )
    .run();

  const inserted = (insert.meta.changes ?? 0) > 0;
  let row: CheckRow | null = null;
  if (inserted) {
    row = await env.DB.prepare("SELECT * FROM checks WHERE id = ?")
      .bind(insert.meta.last_row_id)
      .first<CheckRow>();
  } else if (slot) {
    row = await env.DB.prepare(
      "SELECT * FROM checks WHERE monitor_id = ? AND slot = ?",
    )
      .bind(monitor.id, slot)
      .first<CheckRow>();
  }

  return {
    inserted,
    check:
      row ?? {
        id: Number(insert.meta.last_row_id ?? 0),
        monitor_id: monitor.id,
        checked_at: checkedAt,
        status_code: statusCode,
        outcome,
        error_category: errorCategory,
        duration_ms: durationMs,
        source,
        slot,
      },
  };
}

export interface ScheduledSummary {
  slot: string;
  monitors: number;
  checked: number;
  skipped: number;
  failures: number;
}

/**
 * Runs all active monitors for one cron slot. Checks are idempotent per
 * (monitor, slot), so a retried or overlapping invocation does not duplicate
 * history.
 */
export async function runScheduledChecks(
  env: Env,
  scheduledTime: number,
): Promise<ScheduledSummary> {
  const slot = slotForTime(scheduledTime);
  const startedAt = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO cron_runs (slot, started_at) VALUES (?, ?)",
  )
    .bind(slot, startedAt)
    .run();

  const { results: monitors } = await env.DB.prepare(
    "SELECT * FROM monitors WHERE paused = 0 ORDER BY created_at ASC",
  ).all<MonitorRow>();

  let checked = 0;
  let skipped = 0;
  let failures = 0;
  const concurrency = 3;

  for (let index = 0; index < monitors.length; index += concurrency) {
    const batch = monitors.slice(index, index + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (monitor) => {
        const existing = await env.DB.prepare(
          "SELECT 1 AS present FROM checks WHERE monitor_id = ? AND slot = ?",
        )
          .bind(monitor.id, slot)
          .first<{ present: number }>();
        if (existing) return "skipped" as const;
        const result = await runCheck(env, monitor, "scheduled", slot);
        return result.check.outcome === "up" ? ("up" as const) : ("down" as const);
      }),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        failures += 1;
        console.error("Scheduled check failed", result.reason);
      } else if (result.value === "skipped") {
        skipped += 1;
      } else {
        checked += 1;
        if (result.value === "down") failures += 1;
      }
    }
  }

  await env.DB.prepare(
    `UPDATE cron_runs SET finished_at = ?, monitors_checked = monitors_checked + ?, failures = failures + ? WHERE slot = ?`,
  )
    .bind(new Date().toISOString(), checked, failures, slot)
    .run();

  await pruneOldData(env);

  return { slot, monitors: monitors.length, checked, skipped, failures };
}

/** Bounded retention keeps the free-tier database small and predictable. */
export async function pruneOldData(env: Env): Promise<void> {
  const now = Date.now();
  const checkCutoff = new Date(now - RETENTION_DAYS * 86_400_000).toISOString();
  const sessionCutoff = new Date(now).toISOString();
  const attemptCutoff = new Date(now - 86_400_000).toISOString();
  const cronCutoff = new Date(now - 7 * 86_400_000).toISOString();
  const auditCutoff = new Date(now - 180 * 86_400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checks WHERE checked_at < ?").bind(checkCutoff),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(sessionCutoff),
    env.DB.prepare("DELETE FROM login_attempts WHERE window_start < ?").bind(attemptCutoff),
    env.DB.prepare("DELETE FROM cron_runs WHERE slot < ?").bind(cronCutoff),
    env.DB.prepare("DELETE FROM audit_log WHERE created_at < ?").bind(auditCutoff),
  ]);
}
