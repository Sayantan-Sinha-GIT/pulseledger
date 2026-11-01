/**
 * Types shared by the Worker API and the React client.
 * Keep this file free of runtime dependencies so both bundles can import it.
 */

export type CheckOutcome = "up" | "down";

export type CheckSource = "scheduled" | "manual";

export type ErrorCategory =
  | "timeout"
  | "dns"
  | "tls"
  | "connection"
  | "http_status"
  | "invalid_url"
  | "unknown";

export type MonitorState =
  | "operational"
  | "degraded"
  | "down"
  | "paused"
  | "unknown"
  | "incident";

export type OverallState =
  | "operational"
  | "degraded"
  | "down"
  | "unknown"
  | "incident";

export type ExpectedStatus = "2xx_3xx" | "2xx" | "3xx" | "200";

export type IncidentSeverity = "minor" | "major" | "critical";

export type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

export interface MonitorRow {
  id: string;
  name: string;
  url: string;
  expected_status: ExpectedStatus;
  paused: number;
  created_at: string;
  updated_at: string;
}

export interface CheckRow {
  id: number;
  monitor_id: string;
  checked_at: string;
  status_code: number | null;
  outcome: CheckOutcome;
  error_category: ErrorCategory | null;
  duration_ms: number;
  source: CheckSource;
  slot: string | null;
}

export interface IncidentRow {
  id: string;
  monitor_id: string | null;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  started_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentUpdateRow {
  id: string;
  incident_id: string;
  status: IncidentStatus;
  body: string;
  created_at: string;
}

export interface AuditRow {
  id: number;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: string | null;
  created_at: string;
}

export interface UptimeWindow {
  percent: number | null;
  up: number;
  down: number;
  total: number;
  sufficient: boolean;
}

export interface UptimeSummary {
  h24: UptimeWindow;
  d7: UptimeWindow;
  d30: UptimeWindow;
}

export interface LatencySummary {
  p50: number | null;
  p95: number | null;
  average: number | null;
  samples: number;
}

export interface LatencyPoint {
  at: string;
  ms: number;
  outcome: CheckOutcome;
}

export interface DailyBucket {
  /** UTC calendar day, YYYY-MM-DD */
  date: string;
  up: number;
  down: number;
  total: number;
}

export interface MonitorView {
  id: string;
  name: string;
  url: string;
  expectedStatus: ExpectedStatus;
  paused: boolean;
  state: MonitorState;
  lastCheck: CheckRow | null;
  uptime: UptimeSummary;
  latency: LatencySummary;
  trend: LatencyPoint[];
  daily: DailyBucket[];
  recentChecks: CheckRow[];
  activeIncident: PublicIncident | null;
}

export interface PublicIncidentUpdate {
  id: string;
  status: IncidentStatus;
  body: string;
  createdAt: string;
}

export interface PublicIncident {
  id: string;
  monitorId: string | null;
  monitorName: string | null;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
  updates: PublicIncidentUpdate[];
}

export interface StatusResponse {
  generatedAt: string;
  overall: OverallState;
  headline: string;
  monitors: MonitorView[];
  incidents: PublicIncident[];
  meta: {
    retentionDays: number;
    maxMonitors: number;
    refreshSeconds: number;
    checkIntervalMinutes: number;
    timeoutMs: number;
  };
}

export interface AdminSessionResponse {
  email: string;
  expiresAt: string;
  csrfToken: string;
}

export interface AdminMonitorView extends MonitorView {
  checks24h: number;
  failures24h: number;
}

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface ApiSuccessBody<T> {
  ok: true;
  data: T;
}
