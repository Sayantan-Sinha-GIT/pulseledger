import { afterEach, describe, expect, it, vi } from "vitest";
import { env, SELF } from "cloudflare:test";
import type { AdminMonitorView, PublicIncident, StatusResponse } from "../src/shared/types";
import type { Env } from "../src/worker/env";
import { readPublicStatus, refreshPublicStatus } from "../src/worker/publicStatus";
import { adminRequest, BASE, getMonitorId, insertCheck, login } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function status(): Promise<StatusResponse> {
  const response = await SELF.fetch(`${BASE}/api/status`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { ok: true; data: StatusResponse };
  return body.data;
}

describe("public status API", () => {
  it("returns both seeded Haan monitors as unknown before any check", async () => {
    const data = await status();
    expect(data.monitors).toHaveLength(2);
    expect(data.overall).toBe("unknown");
    expect(data.headline).toBe("Awaiting service checks.");
    expect(data.monitors.every((monitor) => monitor.state === "unknown")).toBe(true);
    expect(data.monitors.every((monitor) => monitor.lastCheck === null)).toBe(true);
    expect(data.monitors.every((monitor) => monitor.uptime.h24.percent === null)).toBe(true);
    expect(data.incidents).toEqual([]);
    expect(data.meta.retentionDays).toBe(30);
    expect(data.meta.checkIntervalMinutes).toBe(15);
    expect(data.meta.maxMonitors).toBe(12);
    expect(data.meta.refreshSeconds).toBe(300);
    expect(data.monitors[0].url).toMatch(/^https:\/\//);
  });

  it("is honest when no monitors exist", async () => {
    await env.DB.prepare("DELETE FROM monitors").run();
    const data = await status();
    expect(data.monitors).toEqual([]);
    expect(data.overall).toBe("unknown");
  });

  it("derives operational state and real uptime from stored checks", async () => {
    const monitorId = await getMonitorId("Haan website");
    for (let index = 0; index < 6; index += 1) {
      await insertCheck({
        monitorId,
        outcome: index === 0 ? "down" : "up",
        checkedAt: new Date(Date.now() - index * 60_000).toISOString(),
      });
    }
    const data = await status();
    const monitor = data.monitors.find((item) => item.id === monitorId);
    expect(monitor?.state).toBe("down");
    expect(monitor?.uptime.h24.total).toBe(6);
    expect(monitor?.uptime.h24.percent).toBe(83.3);
    expect(monitor?.uptime.h24.sufficient).toBe(true);
    expect(monitor?.trend).toHaveLength(6);
  });

  it("counts full UTC days and rolling boundary days beyond the recent-check limit", async () => {
    const monitorId = await getMonitorId("Haan website");
    const now = Date.now();
    for (let index = 0; index < 130; index += 1) {
      await insertCheck({
        monitorId,
        outcome: "up",
        checkedAt: new Date(now - (index + 1) * 60_000).toISOString(),
      });
    }
    await insertCheck({ monitorId, outcome: "down", checkedAt: new Date(now - 25 * 3_600_000).toISOString() });
    await insertCheck({ monitorId, outcome: "down", checkedAt: new Date(now - 8 * 86_400_000).toISOString() });
    await insertCheck({ monitorId, outcome: "down", checkedAt: new Date(now - 31 * 86_400_000).toISOString() });

    const monitor = (await status()).monitors.find((item) => item.id === monitorId);
    expect(monitor?.recentChecks).toHaveLength(8);
    expect(monitor?.uptime.h24).toMatchObject({ up: 130, down: 0, total: 130 });
    expect(monitor?.uptime.d7).toMatchObject({ up: 130, down: 1, total: 131 });
    expect(monitor?.uptime.d30).toMatchObject({ up: 130, down: 2, total: 132 });

    await env.DB.prepare("DELETE FROM checks WHERE monitor_id = ? AND outcome = 'down'")
      .bind(monitorId).run();
    const afterDeletion = (await status()).monitors.find((item) => item.id === monitorId);
    expect(afterDeletion?.uptime.d30).toMatchObject({ up: 130, down: 0, total: 130 });
  });

  it("does not expose the owner password hash", async () => {
    const response = await SELF.fetch(`${BASE}/api/status`);
    const text = await response.text();
    expect(text).not.toContain("pbkdf2");
    expect(text).not.toContain(env.ADMIN_PASSWORD_HASH);
  });

  it("does not allow a query parameter to bypass the public snapshot", async () => {
    const response = await SELF.fetch(`${BASE}/api/status?fresh=1`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("serves a single persisted snapshot until source changes rebuild it", async () => {
    const productionEnv = { ...env, ENVIRONMENT: "production" } as Env;
    const monitorId = await getMonitorId("Haan website");
    const first = await readPublicStatus(productionEnv);
    expect(first.monitors.find((item) => item.id === monitorId)?.uptime.h24.total).toBe(0);

    await insertCheck({ monitorId, outcome: "up", checkedAt: new Date().toISOString() });
    const unchanged = await readPublicStatus(productionEnv);
    expect(unchanged.generatedAt).toBe(first.generatedAt);
    expect(unchanged.monitors.find((item) => item.id === monitorId)?.uptime.h24.total).toBe(0);

    await refreshPublicStatus(productionEnv);
    const updated = await readPublicStatus(productionEnv);
    expect(updated.monitors.find((item) => item.id === monitorId)?.uptime.h24.total).toBe(1);
    const row = await env.DB.prepare("SELECT payload FROM public_status_snapshot WHERE id = 1")
      .first<{ payload: string }>();
    expect(row?.payload).toContain(monitorId);
  });
});

describe("owner monitor API", () => {
  it("rejects an unsafe URL and returns a field error", async () => {
    const session = await login();
    const response = await adminRequest("/api/admin/monitors", session, {
      method: "POST",
      body: { name: "Unsafe", url: "http://127.0.0.1:8080/" },
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { fields?: Record<string, string> };
    };
    expect(body.error.fields?.url).toMatch(/HTTPS/);
  });

  it("prevents duplicate active URLs", async () => {
    const session = await login();
    const response = await adminRequest("/api/admin/monitors", session, {
      method: "POST",
      body: {
        name: "Duplicate Haan",
        url: "https://haan-kolkata-pilot.pages.dev/",
      },
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("duplicate_url");
  });

  it("creates, pauses, edits, and removes a monitor", async () => {
    const session = await login();
    const created = await adminRequest("/api/admin/monitors", session, {
      method: "POST",
      body: {
        name: "Example status",
        project: "Example",
        url: "https://example.com/health",
        expectedStatus: "200",
      },
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      data: { monitor: { id: string; project: string; paused: number; expected_status: string } };
    };
    const id = createdBody.data.monitor.id;
    expect(createdBody.data.monitor.paused).toBe(0);
    expect(createdBody.data.monitor.project).toBe("Example");
    expect(createdBody.data.monitor.expected_status).toBe("200");
    const createdSnapshot = await env.DB.prepare(
      "SELECT payload FROM public_status_snapshot WHERE id = 1",
    ).first<{ payload: string }>();
    expect(JSON.parse(createdSnapshot?.payload ?? "{}").monitors.some((monitor: { id: string }) => monitor.id === id)).toBe(true);

    const paused = await adminRequest(`/api/admin/monitors/${id}`, session, {
      method: "PATCH",
      body: { paused: true },
    });
    expect(paused.status).toBe(200);
    const pausedBody = (await paused.json()) as {
      data: { monitor: { paused: number } };
    };
    expect(pausedBody.data.monitor.paused).toBe(1);

    const edited = await adminRequest(`/api/admin/monitors/${id}`, session, {
      method: "PATCH",
      body: { name: "Example status renamed", project: "Example operations" },
    });
    expect(edited.status).toBe(200);

    const list = await adminRequest("/api/admin/monitors", session);
    const listBody = (await list.json()) as {
      data: { monitors: AdminMonitorView[] };
    };
    const row = listBody.data.monitors.find((monitor) => monitor.id === id);
    expect(row?.name).toBe("Example status renamed");
    expect(row?.project).toBe("Example operations");
    expect(row?.state).toBe("paused");

    const removed = await adminRequest(`/api/admin/monitors/${id}`, session, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);
    const after = await adminRequest("/api/admin/monitors", session);
    const afterBody = (await after.json()) as {
      data: { monitors: AdminMonitorView[] };
    };
    expect(afterBody.data.monitors.some((monitor) => monitor.id === id)).toBe(false);
    const removedSnapshot = await env.DB.prepare(
      "SELECT payload FROM public_status_snapshot WHERE id = 1",
    ).first<{ payload: string }>();
    expect(JSON.parse(removedSnapshot?.payload ?? "{}").monitors.some((monitor: { id: string }) => monitor.id === id)).toBe(false);
  });

  it("rejects malformed update payloads", async () => {
    const session = await login();
    const monitorId = await getMonitorId("Haan website");
    const response = await adminRequest(`/api/admin/monitors/${monitorId}`, session, {
      method: "PATCH",
      body: {},
    });
    expect(response.status).toBe(400);
  });

  it("enforces the documented monitor limit", async () => {
    const session = await login();
    for (let index = 0; index < 10; index += 1) {
      const response = await adminRequest("/api/admin/monitors", session, {
        method: "POST",
        body: { name: `Extra ${index}`, url: `https://example${index}.com/` },
      });
      expect(response.status).toBe(201);
    }
    const over = await adminRequest("/api/admin/monitors", session, {
      method: "POST",
      body: { name: "Over limit", url: "https://over.example.com/" },
    });
    expect(over.status).toBe(409);
    const body = (await over.json()) as { error: { code: string } };
    expect(body.error.code).toBe("monitor_limit");
  });
});

describe("manual checks", () => {
  it("records an up check through the shared check path", async () => {
    const session = await login();
    const monitorId = await getMonitorId("Haan API health");
    const fetchStub = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchStub);

    const response = await adminRequest(
      `/api/admin/monitors/${monitorId}/check`,
      session,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { check: { outcome: string; source: string; status_code: number; duration_ms: number } };
    };
    expect(body.data.check.outcome).toBe("up");
    expect(body.data.check.source).toBe("manual");
    expect(body.data.check.status_code).toBe(200);
    expect(body.data.check.duration_ms).toBeGreaterThanOrEqual(0);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchStub.mock.calls[0][0]);
    expect(calledUrl).toBe("https://haan-api.srimantasutapa123.workers.dev/health");

    const data = await status();
    const monitor = data.monitors.find((item) => item.id === monitorId);
    expect(monitor?.state).toBe("operational");
    expect(monitor?.lastCheck?.source).toBe("manual");
    const snapshot = await readPublicStatus({ ...env, ENVIRONMENT: "production" } as Env);
    expect(snapshot.monitors.find((item) => item.id === monitorId)?.lastCheck?.source).toBe("manual");
  });

  it("records an HTTP failure as down with a diagnostic", async () => {
    const session = await login();
    const monitorId = await getMonitorId("Haan website");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));

    const response = await adminRequest(
      `/api/admin/monitors/${monitorId}/check`,
      session,
      { method: "POST" },
    );
    const body = (await response.json()) as {
      data: { check: { outcome: string; error_category: string; status_code: number } };
    };
    expect(body.data.check.outcome).toBe("down");
    expect(body.data.check.error_category).toBe("http_status");
    expect(body.data.check.status_code).toBe(503);
  });

  it("records a network failure as down", async () => {
    const session = await login();
    const monitorId = await getMonitorId("Haan website");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const response = await adminRequest(
      `/api/admin/monitors/${monitorId}/check`,
      session,
      { method: "POST" },
    );
    const body = (await response.json()) as {
      data: { check: { outcome: string; error_category: string } };
    };
    expect(body.data.check.outcome).toBe("down");
    expect(body.data.check.error_category).toBe("connection");
  });

  it("lists recent checks with a bounded limit", async () => {
    const session = await login();
    const monitorId = await getMonitorId("Haan website");
    await insertCheck({ monitorId, outcome: "up" });
    await insertCheck({ monitorId, outcome: "down" });
    const response = await adminRequest(
      `/api/admin/monitors/${monitorId}/checks?limit=1`,
      session,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { checks: unknown[] } };
    expect(body.data.checks).toHaveLength(1);
  });
});

describe("incident lifecycle", () => {
  it("opens, updates, resolves, and publishes an incident", async () => {
    const session = await login();
    const monitorId = await getMonitorId("Haan API health");

    const created = await adminRequest("/api/admin/incidents", session, {
      method: "POST",
      body: {
        title: "API latency above baseline",
        severity: "major",
        status: "investigating",
        monitorId,
        body: "The health endpoint is responding slowly. Investigating upstream load.",
      },
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      data: { incident: { id: string; status: string; resolved_at: string | null } };
    };
    const incidentId = createdBody.data.incident.id;
    expect(createdBody.data.incident.status).toBe("investigating");
    expect(createdBody.data.incident.resolved_at).toBeNull();

    const publicData = await status();
    expect(publicData.overall).toBe("incident");
    const monitor = publicData.monitors.find((item) => item.id === monitorId);
    expect(monitor?.state).toBe("incident");
    const publicIncident = publicData.incidents.find((item) => item.id === incidentId);
    expect(publicIncident?.updates).toHaveLength(1);
    expect(publicIncident?.monitorName).toBe("Haan API health");

    const updated = await adminRequest(`/api/admin/incidents/${incidentId}/updates`, session, {
      method: "POST",
      body: {
        status: "identified",
        body: "A slow upstream dependency is the cause. Mitigation is in progress.",
      },
    });
    expect(updated.status).toBe(200);

    const resolved = await adminRequest(`/api/admin/incidents/${incidentId}/updates`, session, {
      method: "POST",
      body: {
        status: "resolved",
        body: "Latency returned to normal after the upstream dependency recovered.",
      },
    });
    expect(resolved.status).toBe(200);
    const resolvedBody = (await resolved.json()) as {
      data: { incident: { status: string; resolved_at: string | null } };
    };
    expect(resolvedBody.data.incident.status).toBe("resolved");
    expect(resolvedBody.data.incident.resolved_at).not.toBeNull();

    const afterResolution = await status();
    const resolvedIncident = afterResolution.incidents.find((item) => item.id === incidentId);
    expect(resolvedIncident?.status).toBe("resolved");
    expect(resolvedIncident?.updates).toHaveLength(3);
    expect(afterResolution.overall).not.toBe("incident");

    const blocked = await adminRequest(`/api/admin/incidents/${incidentId}/updates`, session, {
      method: "POST",
      body: { status: "monitoring", body: "Trying to reopen a closed incident." },
    });
    expect(blocked.status).toBe(409);
  });

  it("validates incident fields and monitor references", async () => {
    const session = await login();
    const badTitle = await adminRequest("/api/admin/incidents", session, {
      method: "POST",
      body: {
        title: "x",
        severity: "major",
        status: "investigating",
        monitorId: null,
        body: "A sufficiently long update body.",
      },
    });
    expect(badTitle.status).toBe(400);

    const badMonitor = await adminRequest("/api/admin/incidents", session, {
      method: "POST",
      body: {
        title: "Valid title",
        severity: "minor",
        status: "investigating",
        monitorId: "mon_missing",
        body: "A sufficiently long update body.",
      },
    });
    expect(badMonitor.status).toBe(400);
  });

  it("lists incidents for the owner with full update history", async () => {
    const session = await login();
    await adminRequest("/api/admin/incidents", session, {
      method: "POST",
      body: {
        title: "Owner-visible incident",
        severity: "critical",
        status: "identified",
        monitorId: null,
        body: "This incident is not tied to a single monitor.",
      },
    });
    const response = await adminRequest("/api/admin/incidents", session);
    const body = (await response.json()) as { data: { incidents: PublicIncident[] } };
    expect(body.data.incidents).toHaveLength(1);
    expect(body.data.incidents[0].updates).toHaveLength(1);
  });
});

describe("audit trail", () => {
  it("records sign-in and administrative actions without secrets", async () => {
    const session = await login();
    const monitorId = await getMonitorId("Haan website");
    await adminRequest(`/api/admin/monitors/${monitorId}/check`, session, {
      method: "POST",
    });
    await adminRequest("/api/admin/incidents", session, {
      method: "POST",
      body: {
        title: "Audit check",
        severity: "minor",
        status: "investigating",
        monitorId: null,
        body: "Confirming that administrative actions are written to the audit log.",
      },
    });

    const response = await adminRequest("/api/admin/audit", session);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { entries: { action: string; actor: string; detail: string | null }[] };
    };
    const actions = body.data.entries.map((entry) => entry.action);
    expect(actions).toContain("login_succeeded");
    expect(actions).toContain("manual_check");
    expect(actions).toContain("incident_opened");
    expect(body.data.entries.every((entry) => entry.actor === env.OWNER_EMAIL)).toBe(true);
    expect(JSON.stringify(body)).not.toContain(env.TEST_OWNER_PASSWORD);
    expect(JSON.stringify(body)).not.toContain("pbkdf2");
  });
});

describe("health and routing", () => {
  it("reports database health without secrets", async () => {
    const response = await SELF.fetch(`${BASE}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      database: string;
      service: string;
    };
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(body.service).toBe("pulseledger");
    expect(JSON.stringify(body)).not.toContain("pbkdf2");
  });

  it("returns JSON 404s for unknown API routes", async () => {
    const response = await SELF.fetch(`${BASE}/api/nope`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("rejects unsupported methods", async () => {
    const response = await SELF.fetch(`${BASE}/health`, { method: "POST" });
    expect(response.status).toBe(405);
  });
});
