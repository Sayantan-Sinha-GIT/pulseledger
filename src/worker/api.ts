import {
  CHECK_INTERVAL_MINUTES,
  CHECK_TIMEOUT_MS,
  MAX_MONITORS,
  PUBLIC_REFRESH_SECONDS,
  RETENTION_DAYS,
  deriveOverallState,
  overallHeadline,
} from "../shared/status";
import type {
  AuditRow,
  IncidentRow,
  IncidentUpdateRow,
  MonitorRow,
  StatusResponse,
} from "../shared/types";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  clientIp,
  createSession,
  destroySession,
  getSession,
  loginKey,
  recordLoginFailure,
  requireAdmin,
  requireMutationAuth,
  verifyPassword,
} from "./auth";
import { runCheck } from "./checks";
import { loadAdminMonitorViews, loadIncidents, loadMonitorViews, writeAudit } from "./data";
import type { Env } from "./env";
import {
  fail,
  handleError,
  methodNotAllowed,
  notFound,
  ok,
  readJson,
} from "./http";
import {
  validateIncidentInput,
  validateIncidentUpdateInput,
  validateMonitorInput,
} from "./validation";

const UUID_LIKE = /^[A-Za-z0-9_-]{4,64}$/;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed/i.test(error.message)
  );
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          allow: "GET, POST, PATCH, DELETE, OPTIONS",
          "cache-control": "no-store",
        },
      });
    }

    if (path === "/api/status" && method === "GET") {
      return await cachedPublicStatus(request, env);
    }

    if (path === "/api/admin/login" && method === "POST") {
      return await login(request, env);
    }

    if (path === "/api/admin/logout" && method === "POST") {
      return await logout(request, env);
    }

    if (!path.startsWith("/api/admin/")) {
      return notFound();
    }

    const auth = await requireAdmin(request, env);
    if ("response" in auth) return auth.response;
    const { session } = auth;

    if (path === "/api/admin/session" && method === "GET") {
      return ok({
        email: session.email,
        expiresAt: session.expiresAt,
        csrfToken: session.csrfToken,
      });
    }

    if (path === "/api/admin/monitors" && method === "GET") {
      const monitors = await loadAdminMonitorViews(env, new Date());
      return ok({ monitors, generatedAt: new Date().toISOString() });
    }

    if (path === "/api/admin/monitors" && method === "POST") {
      const csrf = await requireMutationAuth(request, session);
      if (csrf) return csrf;
      return await createMonitor(request, env, session.email);
    }

    const monitorCheckMatch = path.match(
      /^\/api\/admin\/monitors\/([^/]+)\/check$/,
    );
    if (monitorCheckMatch && method === "POST") {
      const csrf = await requireMutationAuth(request, session);
      if (csrf) return csrf;
      return await manualCheck(env, monitorCheckMatch[1], session.email);
    }

    const monitorChecksMatch = path.match(
      /^\/api\/admin\/monitors\/([^/]+)\/checks$/,
    );
    if (monitorChecksMatch && method === "GET") {
      return await listChecks(env, monitorChecksMatch[1], url);
    }

    const monitorMatch = path.match(/^\/api\/admin\/monitors\/([^/]+)$/);
    if (monitorMatch) {
      if (method === "PATCH") {
        const csrf = await requireMutationAuth(request, session);
        if (csrf) return csrf;
        return await updateMonitor(request, env, monitorMatch[1], session.email);
      }
      if (method === "DELETE") {
        const csrf = await requireMutationAuth(request, session);
        if (csrf) return csrf;
        return await deleteMonitor(env, monitorMatch[1], session.email);
      }
      return methodNotAllowed("GET, PATCH, DELETE");
    }

    if (path === "/api/admin/incidents" && method === "GET") {
      const incidents = await loadIncidents(env, {
        now: new Date(),
        includeResolvedDays: 365,
        limit: 100,
      });
      return ok({ incidents, generatedAt: new Date().toISOString() });
    }

    if (path === "/api/admin/incidents" && method === "POST") {
      const csrf = await requireMutationAuth(request, session);
      if (csrf) return csrf;
      return await createIncident(request, env, session.email);
    }

    const incidentUpdateMatch = path.match(
      /^\/api\/admin\/incidents\/([^/]+)\/updates$/,
    );
    if (incidentUpdateMatch && method === "POST") {
      const csrf = await requireMutationAuth(request, session);
      if (csrf) return csrf;
      return await addIncidentUpdate(
        request,
        env,
        incidentUpdateMatch[1],
        session.email,
      );
    }

    if (path === "/api/admin/audit" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT 100",
      ).all<AuditRow>();
      return ok({ entries: results });
    }

    return notFound();
  } catch (error) {
    return handleError(error);
  }
}

async function cachedPublicStatus(request: Request, env: Env): Promise<Response> {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  if (env.ENVIRONMENT !== "production") return publicStatus(env, fresh);
  const key = new Request(new URL("/api/status", request.url).toString());
  if (!fresh) {
    try {
      const cached = await caches.default.match(key);
      if (cached) return cached;
    } catch (error) {
      console.warn("Status cache read failed", error instanceof Error ? error.message : error);
    }
  }
  const response = await publicStatus(env, fresh);
  if (!fresh) {
    try {
      await caches.default.put(key, response.clone());
    } catch (error) {
      // A cache outage must not turn a successful D1 response into an API error.
      console.warn("Status cache write failed", error instanceof Error ? error.message : error);
    }
  }
  return response;
}

async function publicStatus(env: Env, fresh = false): Promise<Response> {
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
  const body: StatusResponse = {
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
  return ok(body, {
    cacheControl: fresh ? "no-store" : "public, max-age=300",
  });
}

async function login(request: Request, env: Env): Promise<Response> {
  const body = (await readJson(request)) as Record<string, unknown>;
  if (typeof body?.email !== "string" || typeof body?.password !== "string") {
    return fail("invalid_credentials", "Email or password is incorrect.", 400);
  }
  const email = body.email.trim().toLowerCase();
  const password = body.password;
  if (email.length > 254 || password.length < 1 || password.length > 512) {
    return fail("invalid_credentials", "Email or password is incorrect.", 400);
  }

  const ip = clientIp(request);
  const key = await loginKey(ip, "");
  const limit = await checkLoginRateLimit(env, key);
  if (limit.blocked) {
    const response = fail(
      "rate_limited",
      "Too many sign-in attempts. Try again in a few minutes.",
      429,
    );
    response.headers.set("retry-after", String(limit.retryAfterSeconds));
    return response;
  }

  // Always run the hash check so a wrong email does not reveal timing.
  const passwordOk = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  const emailOk = email === env.OWNER_EMAIL.trim().toLowerCase();
  if (!passwordOk || !emailOk) {
    await recordLoginFailure(env, key);
    await writeAudit(env, {
      actor: "anonymous",
      action: "login_failed",
      targetType: "session",
    });
    return fail("invalid_credentials", "Email or password is incorrect.", 401);
  }

  await clearLoginFailures(env, key);
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?")
    .bind(new Date().toISOString())
    .run();
  const { session, cookie } = await createSession(env, email, request.url);
  await writeAudit(env, {
    actor: email,
    action: "login_succeeded",
    targetType: "session",
  });
  return ok(
    {
      email: session.email,
      expiresAt: session.expiresAt,
      csrfToken: session.csrfToken,
    },
    { headers: { "set-cookie": cookie } },
  );
}

async function logout(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (session) {
    const csrf = await requireMutationAuth(request, session);
    if (csrf) return csrf;
    await writeAudit(env, {
      actor: session.email,
      action: "logout",
      targetType: "session",
    });
  }
  const cookie = await destroySession(request, env);
  return ok({ signedOut: true }, { headers: { "set-cookie": cookie } });
}

async function createMonitor(
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const input = validateMonitorInput(await readJson(request), { partial: false });
  const { count } = (await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM monitors",
  ).first<{ count: number }>()) ?? { count: 0 };
  if (Number(count) >= MAX_MONITORS) {
    return fail(
      "monitor_limit",
      `PulseLedger monitors at most ${MAX_MONITORS} services on the free plan.`,
      409,
    );
  }

  const now = new Date().toISOString();
  const id = `mon_${crypto.randomUUID()}`;
  try {
    await env.DB.prepare(
      `INSERT INTO monitors (id, name, project, url, expected_status, paused, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        input.name,
        input.project,
        input.url,
        input.expectedStatus,
        input.paused ? 1 : 0,
        now,
        now,
      )
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("duplicate_url", "An active monitor already uses that URL.", 409, {
        url: "An active monitor already uses that URL.",
      });
    }
    throw error;
  }

  await writeAudit(env, {
    actor,
    action: "monitor_created",
    targetType: "monitor",
    targetId: id,
    detail: { name: input.name, project: input.project, url: input.url },
  });
  const monitor = await env.DB.prepare("SELECT * FROM monitors WHERE id = ?")
    .bind(id)
    .first<MonitorRow>();
  return ok({ monitor }, { status: 201 });
}

async function updateMonitor(
  request: Request,
  env: Env,
  id: string,
  actor: string,
): Promise<Response> {
  if (!UUID_LIKE.test(id)) return notFound();
  const existing = await env.DB.prepare("SELECT * FROM monitors WHERE id = ?")
    .bind(id)
    .first<MonitorRow>();
  if (!existing) return notFound();

  const input = validateMonitorInput(await readJson(request), { partial: true });
  const next = {
    name: input.name ?? existing.name,
    project: input.project ?? existing.project,
    url: input.url ?? existing.url,
    expectedStatus: input.expectedStatus ?? existing.expected_status,
    paused: input.paused === undefined ? existing.paused : input.paused ? 1 : 0,
  };

  if (next.paused === 0) {
    const duplicate = await env.DB.prepare(
      "SELECT id FROM monitors WHERE url = ? AND paused = 0 AND id != ?",
    )
      .bind(next.url, id)
      .first<{ id: string }>();
    if (duplicate) {
      return fail("duplicate_url", "An active monitor already uses that URL.", 409, {
        url: "An active monitor already uses that URL.",
      });
    }
  }

  try {
    await env.DB.prepare(
      `UPDATE monitors SET name = ?, project = ?, url = ?, expected_status = ?, paused = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        next.name,
        next.project,
        next.url,
        next.expectedStatus,
        next.paused,
        new Date().toISOString(),
        id,
      )
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("duplicate_url", "An active monitor already uses that URL.", 409, {
        url: "An active monitor already uses that URL.",
      });
    }
    throw error;
  }

  await writeAudit(env, {
    actor,
    action: "monitor_updated",
    targetType: "monitor",
    targetId: id,
    detail: {
      changed: Object.keys(input),
      paused: next.paused === 1,
    },
  });
  const monitor = await env.DB.prepare("SELECT * FROM monitors WHERE id = ?")
    .bind(id)
    .first<MonitorRow>();
  return ok({ monitor });
}

async function deleteMonitor(env: Env, id: string, actor: string): Promise<Response> {
  if (!UUID_LIKE.test(id)) return notFound();
  const existing = await env.DB.prepare("SELECT * FROM monitors WHERE id = ?")
    .bind(id)
    .first<MonitorRow>();
  if (!existing) return notFound();
  await env.DB.prepare("DELETE FROM monitors WHERE id = ?").bind(id).run();
  await writeAudit(env, {
    actor,
    action: "monitor_deleted",
    targetType: "monitor",
    targetId: id,
    detail: { name: existing.name, url: existing.url },
  });
  return ok({ deleted: id });
}

async function manualCheck(env: Env, id: string, actor: string): Promise<Response> {
  if (!UUID_LIKE.test(id)) return notFound();
  const monitor = await env.DB.prepare("SELECT * FROM monitors WHERE id = ?")
    .bind(id)
    .first<MonitorRow>();
  if (!monitor) return notFound();
  const result = await runCheck(env, monitor, "manual", null);
  await writeAudit(env, {
    actor,
    action: "manual_check",
    targetType: "monitor",
    targetId: id,
    detail: {
      outcome: result.check.outcome,
      statusCode: result.check.status_code,
      durationMs: result.check.duration_ms,
    },
  });
  return ok({ check: result.check, inserted: result.inserted });
}

async function listChecks(env: Env, id: string, url: URL): Promise<Response> {
  if (!UUID_LIKE.test(id)) return notFound();
  const monitor = await env.DB.prepare("SELECT id FROM monitors WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (!monitor) return notFound();
  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam)
    ? Math.min(200, Math.max(1, Math.floor(limitParam)))
    : 50;
  const { results } = await env.DB.prepare(
    "SELECT * FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC, id DESC LIMIT ?",
  )
    .bind(id, limit)
    .all();
  return ok({ checks: results });
}

async function createIncident(
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const input = validateIncidentInput(await readJson(request));
  if (input.monitorId) {
    const monitor = await env.DB.prepare("SELECT id FROM monitors WHERE id = ?")
      .bind(input.monitorId)
      .first<{ id: string }>();
    if (!monitor) {
      return fail("invalid_monitor", "That monitor no longer exists.", 400, {
        monitorId: "Choose a monitor from the list.",
      });
    }
  }

  const now = new Date().toISOString();
  const id = `inc_${crypto.randomUUID()}`;
  const updateId = `upd_${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO incidents
        (id, monitor_id, title, severity, status, started_at, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ).bind(id, input.monitorId, input.title, input.severity, input.status, now, now, now),
    env.DB.prepare(
      "INSERT INTO incident_updates (id, incident_id, status, body, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(updateId, id, input.status, input.body, now),
  ]);

  await writeAudit(env, {
    actor,
    action: "incident_opened",
    targetType: "incident",
    targetId: id,
    detail: { title: input.title, severity: input.severity },
  });

  const incident = await env.DB.prepare("SELECT * FROM incidents WHERE id = ?")
    .bind(id)
    .first<IncidentRow>();
  const update = await env.DB.prepare(
    "SELECT * FROM incident_updates WHERE id = ?",
  )
    .bind(updateId)
    .first<IncidentUpdateRow>();
  return ok({ incident, updates: update ? [update] : [] }, { status: 201 });
}

async function addIncidentUpdate(
  request: Request,
  env: Env,
  id: string,
  actor: string,
): Promise<Response> {
  if (!UUID_LIKE.test(id)) return notFound();
  const incident = await env.DB.prepare("SELECT * FROM incidents WHERE id = ?")
    .bind(id)
    .first<IncidentRow>();
  if (!incident) return notFound();
  if (incident.status === "resolved") {
    return fail(
      "incident_resolved",
      "This incident is resolved. Open a new incident for a new problem.",
      409,
    );
  }

  const input = validateIncidentUpdateInput(await readJson(request));
  const now = new Date().toISOString();
  const updateId = `upd_${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO incident_updates (id, incident_id, status, body, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(updateId, id, input.status, input.body, now),
    env.DB.prepare(
      "UPDATE incidents SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?",
    ).bind(
      input.status,
      input.status === "resolved" ? now : incident.resolved_at,
      now,
      id,
    ),
  ]);

  await writeAudit(env, {
    actor,
    action: input.status === "resolved" ? "incident_resolved" : "incident_updated",
    targetType: "incident",
    targetId: id,
    detail: { status: input.status },
  });

  const updated = await env.DB.prepare("SELECT * FROM incidents WHERE id = ?")
    .bind(id)
    .first<IncidentRow>();
  const update = await env.DB.prepare(
    "SELECT * FROM incident_updates WHERE id = ?",
  )
    .bind(updateId)
    .first<IncidentUpdateRow>();
  return ok({ incident: updated, update });
}
