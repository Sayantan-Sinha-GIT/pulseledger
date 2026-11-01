import { env, SELF } from "cloudflare:test";
import { expect } from "vitest";

export const BASE = "https://pulseledger.test";

export interface Session {
  cookie: string;
  csrf: string;
  email: string;
  expiresAt: string;
}

export async function login(password = env.TEST_OWNER_PASSWORD): Promise<Session> {
  const response = await SELF.fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: env.OWNER_EMAIL, password }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    ok: true;
    data: { email: string; csrfToken: string; expiresAt: string };
  };
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  expect(cookie).toMatch(/^pl_session=/);
  return {
    cookie,
    csrf: body.data.csrfToken,
    email: body.data.email,
    expiresAt: body.data.expiresAt,
  };
}

export async function adminRequest(
  path: string,
  session: Session,
  options: { method?: string; body?: unknown; csrf?: string; origin?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    cookie: session.cookie,
  };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.method && options.method !== "GET") {
    headers["x-csrf-token"] = options.csrf ?? session.csrf;
  }
  if (options.origin) headers.origin = options.origin;
  return SELF.fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export async function insertCheck(input: {
  monitorId: string;
  outcome: "up" | "down";
  checkedAt?: string;
  durationMs?: number;
  statusCode?: number | null;
  errorCategory?: string | null;
  source?: "scheduled" | "manual";
  slot?: string | null;
}): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO checks (monitor_id, checked_at, status_code, outcome, error_category, duration_ms, source, slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.monitorId,
      input.checkedAt ?? new Date().toISOString(),
      input.statusCode === undefined ? (input.outcome === "up" ? 200 : null) : input.statusCode,
      input.outcome,
      input.errorCategory ?? (input.outcome === "down" ? "http_status" : null),
      input.durationMs ?? 120,
      input.source ?? "scheduled",
      input.slot ?? null,
    )
    .run();
}

export async function getMonitorId(name: string): Promise<string> {
  const row = await env.DB.prepare("SELECT id FROM monitors WHERE name = ?")
    .bind(name)
    .first<{ id: string }>();
  if (!row) throw new Error(`Missing monitor: ${name}`);
  return row.id;
}

export async function countChecks(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM checks").first<{
    count: number;
  }>();
  return Number(row?.count ?? 0);
}

/** Restores the seeded two-monitor state between tests. */
export async function resetDatabase(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checks"),
    env.DB.prepare("DELETE FROM incident_updates"),
    env.DB.prepare("DELETE FROM incidents"),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM login_attempts"),
    env.DB.prepare("DELETE FROM audit_log"),
    env.DB.prepare("DELETE FROM cron_runs"),
    env.DB.prepare("DELETE FROM monitors"),
  ]);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO monitors (id, name, url, expected_status, paused, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    ).bind(
      "mon_haan_web",
      "Haan website",
      "https://haan-kolkata-pilot.pages.dev/",
      "2xx_3xx",
      now,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO monitors (id, name, url, expected_status, paused, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    ).bind(
      "mon_haan_api",
      "Haan API health",
      "https://haan-api.srimantasutapa123.workers.dev/health",
      "200",
      now,
      now,
    ),
  ]);
}
