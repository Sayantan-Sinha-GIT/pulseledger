import {
  RETENTION_DAYS,
  dailyBucketsFromCounts,
  deriveMonitorState,
  latencySummary,
  summarizeUptime,
  toTrend,
  uptimeWindow,
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
} from "../shared/types";
import type { Env } from "./env";

interface AggregateRow {
  monitor_id: string;
  up24: number;
  down24: number;
  up7: number;
  down7: number;
  up30: number;
  down30: number;
}

interface DailyRow {
  monitor_id: string;
  day: string;
  up: number;
  down: number;
}

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

  const [monitorsResult, checksResult, aggregateResult, dailyResult, incidentList] =
    await Promise.all([
      env.DB.prepare("SELECT * FROM monitors ORDER BY created_at ASC").all<MonitorRow>(),
      env.DB.prepare(
        `SELECT * FROM (
           SELECT c.*, ROW_NUMBER() OVER (
             PARTITION BY c.monitor_id ORDER BY c.checked_at DESC, c.id DESC
           ) AS rn
           FROM checks c WHERE c.checked_at >= ?
         ) WHERE rn <= ? ORDER BY checked_at DESC`,
      )
        .bind(cutoff30, recentLimit)
        .all<CheckRow & { rn: number }>(),
      env.DB.prepare(
        `SELECT monitor_id,
           SUM(CASE WHEN checked_at >= ? AND outcome = 'up' THEN 1 ELSE 0 END) AS up24,
           SUM(CASE WHEN checked_at >= ? AND outcome = 'down' THEN 1 ELSE 0 END) AS down24,
           SUM(CASE WHEN checked_at >= ? AND outcome = 'up' THEN 1 ELSE 0 END) AS up7,
           SUM(CASE WHEN checked_at >= ? AND outcome = 'down' THEN 1 ELSE 0 END) AS down7,
           SUM(CASE WHEN checked_at >= ? AND outcome = 'up' THEN 1 ELSE 0 END) AS up30,
           SUM(CASE WHEN checked_at >= ? AND outcome = 'down' THEN 1 ELSE 0 END) AS down30
         FROM checks WHERE checked_at >= ?
         GROUP BY monitor_id`,
      )
        .bind(cutoff24, cutoff24, cutoff7, cutoff7, cutoff30, cutoff30, cutoff30)
        .all<AggregateRow>(),
      env.DB.prepare(
        `SELECT monitor_id, substr(checked_at, 1, 10) AS day,
           SUM(CASE WHEN outcome = 'up' THEN 1 ELSE 0 END) AS up,
           SUM(CASE WHEN outcome = 'down' THEN 1 ELSE 0 END) AS down
         FROM checks WHERE checked_at >= ?
         GROUP BY monitor_id, day`,
      )
        .bind(cutoff30)
        .all<DailyRow>(),
      options.incidents ??
        loadIncidents(env, {
          now,
          includeResolvedDays: RETENTION_DAYS,
          limit: 30,
        }),
    ]);
  const incidents = incidentList;

  const checksByMonitor = new Map<string, CheckRow[]>();
  for (const row of checksResult.results) {
    const { rn: _rn, ...check } = row;
    const list = checksByMonitor.get(check.monitor_id) ?? [];
    list.push(check);
    checksByMonitor.set(check.monitor_id, list);
  }

  const aggregates = new Map(aggregateResult.results.map((row) => [row.monitor_id, row]));
  const dailyByMonitor = new Map<string, DailyRow[]>();
  for (const row of dailyResult.results) {
    const list = dailyByMonitor.get(row.monitor_id) ?? [];
    list.push(row);
    dailyByMonitor.set(row.monitor_id, list);
  }

  return monitorsResult.results.map((monitor) => {
    const checks = checksByMonitor.get(monitor.id) ?? [];
    const aggregate = aggregates.get(monitor.id);
    const uptime: UptimeSummary = aggregate
      ? {
          h24: uptimeWindow(countsToChecks(aggregate.up24, aggregate.down24)),
          d7: uptimeWindow(countsToChecks(aggregate.up7, aggregate.down7)),
          d30: uptimeWindow(countsToChecks(aggregate.up30, aggregate.down30)),
        }
      : summarizeUptime(checks, now);

    const dailyRows = dailyByMonitor.get(monitor.id) ?? [];
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

function countsToChecks(up: number, down: number) {
  return [
    ...Array.from({ length: Number(up ?? 0) }, () => ({ outcome: "up" as const })),
    ...Array.from({ length: Number(down ?? 0) }, () => ({ outcome: "down" as const })),
  ];
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
