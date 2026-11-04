import {
  CHECK_INTERVAL_MINUTES,
  CHECK_TIMEOUT_MS,
  MAX_MONITORS,
  PUBLIC_REFRESH_SECONDS,
  RETENTION_DAYS,
  deriveOverallState,
  overallHeadline,
} from "../shared/status";
import type { StatusResponse } from "../shared/types";
import { loadIncidents, loadMonitorViews } from "./data";
import type { Env } from "./env";

interface SnapshotRow {
  generated_at: string;
  payload: string;
}

/**
 * Production public reads cost one D1 row. The status response is rebuilt by
 * cron and owner mutations, not independently for every open browser.
 */
export async function readPublicStatus(env: Env): Promise<StatusResponse> {
  if (env.ENVIRONMENT !== "production") return buildPublicStatus(env);
  const row = await env.DB.prepare(
    "SELECT generated_at, payload FROM public_status_snapshot WHERE id = 1",
  ).first<SnapshotRow>();
  if (row) {
    try {
      const value = JSON.parse(row.payload) as StatusResponse;
      if (value.generatedAt === row.generated_at && Array.isArray(value.monitors)) return value;
    } catch {
      console.warn("Stored status snapshot is unreadable; rebuilding it.");
    }
  }
  return refreshPublicStatus(env);
}

export async function refreshPublicStatus(env: Env): Promise<StatusResponse> {
  const body = await buildPublicStatus(env);
  await env.DB.prepare(
    `INSERT INTO public_status_snapshot (id, generated_at, payload)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       generated_at = excluded.generated_at,
       payload = excluded.payload`,
  ).bind(body.generatedAt, JSON.stringify(body)).run();
  return body;
}

async function buildPublicStatus(env: Env): Promise<StatusResponse> {
  const now = new Date();
  const incidents = await loadIncidents(env, {
    now,
    includeResolvedDays: RETENTION_DAYS,
    limit: 20,
  });
  const monitors = await loadMonitorViews(env, {
    now,
    checksInResponse: 8,
    incidents,
  });
  const overall = deriveOverallState(monitors.map((monitor) => monitor.state));
  return {
    generatedAt: now.toISOString(),
    overall,
    headline: overallHeadline(overall),
    monitors,
    incidents,
    meta: {
      retentionDays: RETENTION_DAYS,
      maxMonitors: MAX_MONITORS,
      refreshSeconds: PUBLIC_REFRESH_SECONDS,
      checkIntervalMinutes: CHECK_INTERVAL_MINUTES,
      timeoutMs: CHECK_TIMEOUT_MS,
    },
  };
}
