import {
  RETENTION_DAYS,
  SUFFICIENT_SAMPLES,
  dailyBucketsFromCounts,
  deriveMonitorState,
  latencySummary,
  round1,
  toTrend,
} from "../shared/status";
import type {
  AdminMonitorView,
  CheckRow,
  IncidentRow,
  IncidentUpdateRow,
  MonitorRow,
  MonitorView,
  PublicIncident,
  UptimeSummary,
  UptimeWindow,
} from "../shared/types";
import type { Env } from "./env";

interface DailyRow {
  monitor_id: string;
  day: string;
  up: number;
  down: number;
}

interface BoundaryRow extends DailyRow {}

interface IncidentWithMonitor extends IncidentRow {
  monitor_name: string | null;
}

export interface MonitorDataOptions {
  now: Date;
  checksInResponse: number;
  recentLimit?: number;
  /** Pre-loaded incidents, to avoid a duplicate query on the public page. */
  incidents?: PublicIncident[];
}

export async function loadMonitorViews(
  env: Env,
  options: MonitorDataOptions,
): Promise<MonitorView[]> {
  const now = options.now;
  const recentLimit = options.recentLimit ?? 120;
  const cutoff30 = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
  const cutoff24 = new Date(now.getTime() - 86_400_000).toISOString();
  const cutoff7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const cutoffs = [cutoff24, cutoff7, cutoff30];
  const nextDays = cutoffs.map((cutoff) =>
    new Date(Date.parse(`${cutoff.slice(0, 10)}T00:00:00.000Z`) + 86_400_000).toISOString(),
  );
  const [monitorsResult, dailyResult, boundaryResult, incidentList] = await Promise.all([
    env.DB.prepare("SELECT * FROM monitors ORDER BY created_at ASC").all<MonitorRow>(),
    env.DB.prepare(
      "SELECT monitor_id, day, up, down FROM daily_check_counts WHERE day >= ?",
    ).bind(cutoff30.slice(0, 10)).all<DailyRow>(),
    // Only the three partial UTC days need raw checks. All complete days use
    // the write-through daily summary instead of rescanning 30 days of rows.
    env.DB.prepare(
      `SELECT monitor_id, substr(checked_at, 1, 10) AS day,
         SUM(CASE WHEN outcome = 'up' THEN 1 ELSE 0 END) AS up,
         SUM(CASE WHEN outcome = 'down' THEN 1 ELSE 0 END) AS down
       FROM checks WHERE (checked_at >= ? AND checked_at < ?)
         OR (checked_at >= ? AND checked_at < ?)
         OR (checked_at >= ? AND checked_at < ?)
       GROUP BY monitor_id, day`,
    ).bind(cutoff24, nextDays[0], cutoff7, nextDays[1], cutoff30, nextDays[2]).all<BoundaryRow>(),
    options.incidents ?? loadIncidents(env, {
      now, includeResolvedDays: RETENTION_DAYS, limit: 30,
    }),
  ]);
  const incidents = incidentList;

  const checksByMonitor = new Map<string, CheckRow[]>();
  await Promise.all(monitorsResult.results.map(async (monitor) => {
    const { results } = await env.DB.prepare(
      `SELECT * FROM checks WHERE monitor_id = ? AND checked_at >= ?
       ORDER BY checked_at DESC, id DESC LIMIT ?`,
    ).bind(monitor.id, cutoff30, recentLimit).all<CheckRow>();
    checksByMonitor.set(monitor.id, results);
  }));

  const dailyByMonitor = new Map<string, DailyRow[]>();
  for (const row of dailyResult.results) {
    const list = dailyByMonitor.get(row.monitor_id) ?? [];
    list.push(row);
    dailyByMonitor.set(row.monitor_id, list);
  }
  const boundaryByMonitor = new Map<string, BoundaryRow[]>();
  for (const row of boundaryResult.results) {
    const list = boundaryByMonitor.get(row.monitor_id) ?? [];
    list.push(row);
    boundaryByMonitor.set(row.monitor_id, list);
  }

  return monitorsResult.results.map((monitor) => {
    const checks = checksByMonitor.get(monitor.id) ?? [];
    const dailyRows = dailyByMonitor.get(monitor.id) ?? [];
    const boundaryRows = boundaryByMonitor.get(monitor.id) ?? [];
    const uptime: UptimeSummary = {
      h24: countWindow(dailyRows, boundaryRows, cutoffs[0]),
      d7: countWindow(dailyRows, boundaryRows, cutoffs[1]),
      d30: countWindow(dailyRows, boundaryRows, cutoffs[2]),
    };
    const daily = dailyBucketsFromCounts(
      dailyRows.map((row) => ({ date: row.day, up: Number(row.up), down: Number(row.down) })),
      RETENTION_DAYS,
      now,
    );

    const activeIncident =
      incidents.find(
        (incident) => incident.status !== "resolved" && incident.monitorId === monitor.id,
      ) ?? null;

    const checks24 = checks.filter((check) => Date.parse(check.checked_at) >= now.getTime() - 86_400_000);

    return {
      id: monitor.id,
      name: monitor.name,
      project: monitor.project,
      url: monitor.url,
      expectedStatus: monitor.expected_status,
      paused: monitor.paused === 1,
      state: deriveMonitorState({
        paused: monitor.paused === 1,
        hasActiveIncident: Boolean(activeIncident),
        checks,
      }),
      lastCheck: checks[0] ?? null,
      uptime,
      latency: latencySummary(checks24),
      trend: toTrend(checks, 40),
      daily,
      recentChecks: checks.slice(0, options.checksInResponse),
      activeIncident,
    };
  });
}

export async function loadAdminMonitorViews(
  env: Env,
  now: Date,
): Promise<AdminMonitorView[]> {
  const views = await loadMonitorViews(env, { now, checksInResponse: 25 });
  const cutoff = new Date(now.getTime() - 86_400_000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT monitor_id,
       COUNT(*) AS total,
       SUM(CASE WHEN outcome = 'down' THEN 1 ELSE 0 END) AS failures
     FROM checks WHERE checked_at >= ? GROUP BY monitor_id`,
  )
    .bind(cutoff)
    .all<{ monitor_id: string; total: number; failures: number }>();
  const counts = new Map(results.map((row) => [row.monitor_id, row]));
  return views.map((view) => {
    const row = counts.get(view.id);
    return {
      ...view,
      checks24h: Number(row?.total ?? 0),
      failures24h: Number(row?.failures ?? 0),
    };
  });
}

function countWindow(daily: DailyRow[], boundaries: BoundaryRow[], cutoff: string): UptimeWindow {
  const cutoffDay = cutoff.slice(0, 10);
  const fullDays = daily.filter((row) => row.day > cutoffDay);
  const firstDay = boundaries.filter((row) => row.day === cutoffDay);
  const up = [...fullDays, ...firstDay].reduce((total, row) => total + Number(row.up), 0);
  const down = [...fullDays, ...firstDay].reduce((total, row) => total + Number(row.down), 0);
  const total = up + down;
  return {
    percent: total === 0 ? null : round1((up / total) * 100),
    up,
    down,
    total,
    sufficient: total >= SUFFICIENT_SAMPLES,
  };
}

export async function loadIncidents(
  env: Env,
  options: { now: Date; includeResolvedDays: number; limit: number },
): Promise<PublicIncident[]> {
  const cutoff = new Date(
    options.now.getTime() - options.includeResolvedDays * 86_400_000,
  ).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT i.*, m.name AS monitor_name
     FROM incidents i LEFT JOIN monitors m ON m.id = i.monitor_id
     WHERE i.status != 'resolved' OR i.started_at >= ?
     ORDER BY CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END, i.started_at DESC
     LIMIT ?`,
  )
    .bind(cutoff, options.limit)
    .all<IncidentWithMonitor>();

  if (results.length === 0) return [];

  const placeholders = results.map(() => "?").join(",");
  const { results: updates } = await env.DB.prepare(
    `SELECT * FROM incident_updates WHERE incident_id IN (${placeholders})
     ORDER BY created_at DESC`,
  )
    .bind(...results.map((incident) => incident.id))
    .all<IncidentUpdateRow>();

  const updatesByIncident = new Map<string, IncidentUpdateRow[]>();
  for (const update of updates) {
    const list = updatesByIncident.get(update.incident_id) ?? [];
    list.push(update);
    updatesByIncident.set(update.incident_id, list);
  }

  return results.map((incident) => ({
    id: incident.id,
    monitorId: incident.monitor_id,
    monitorName: incident.monitor_name,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    startedAt: incident.started_at,
    resolvedAt: incident.resolved_at,
    updatedAt: incident.updated_at,
    updates: (updatesByIncident.get(incident.id) ?? []).map((update) => ({
      id: update.id,
      status: update.status,
      body: update.body,
      createdAt: update.created_at,
    })),
  }));
}

export async function writeAudit(
  env: Env,
  input: {
    actor: string;
    action: string;
    targetType?: string;
    targetId?: string;
    detail?: unknown;
  },
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO audit_log (actor, action, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      input.actor,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.detail === undefined ? null : JSON.stringify(input.detail),
      new Date().toISOString(),
    )
    .run();
}
