import { describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import { adminRequest, BASE, login } from "./helpers";

describe("owner authentication", () => {
  it("rejects a wrong password with a generic message", async () => {
    const response = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: env.OWNER_EMAIL, password: "invalid" }),
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      ok: false;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe("Email or password is incorrect.");
    expect(JSON.stringify(body)).not.toContain("pbkdf2");
  });

  it("rejects a wrong email without revealing which field failed", async () => {
    const response = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "someone@example.com", password: env.TEST_OWNER_PASSWORD }),
    });
    expect(response.status).toBe(401);
  });

  it("creates a secure session cookie and a CSRF token", async () => {
    const response = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: env.OWNER_EMAIL, password: env.TEST_OWNER_PASSWORD }),
    });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("Path=/");
    const body = (await response.json()) as {
      ok: true;
      data: { email: string; csrfToken: string; expiresAt: string };
    };
    expect(body.data.email).toBe(env.OWNER_EMAIL);
    expect(body.data.csrfToken.length).toBeGreaterThan(30);
    expect(JSON.stringify(body)).not.toContain(env.TEST_OWNER_PASSWORD);
  });

  it("returns the session and a stable CSRF token for the cookie holder", async () => {
    const session = await login();
    const response = await adminRequest("/api/admin/session", session);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: true;
      data: { email: string; csrfToken: string };
    };
    expect(body.data.email).toBe(env.OWNER_EMAIL);
    expect(body.data.csrfToken).toBe(session.csrf);
  });

  it("rejects admin API calls without a session", async () => {
    for (const path of ["/api/admin/session", "/api/admin/monitors", "/api/admin/audit"]) {
      const response = await SELF.fetch(`${BASE}${path}`);
      expect(response.status, path).toBe(401);
    }
  });

  it("rejects a state-changing request without a CSRF token", async () => {
    const session = await login();
    const response = await adminRequest("/api/admin/monitors", session, {
      method: "POST",
      csrf: "",
      body: { name: "Test", url: "https://example.com/" },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("csrf_failed");
  });

  it("rejects a state-changing request with a wrong CSRF token", async () => {
    const session = await login();
    const response = await adminRequest("/api/admin/monitors", session, {
      method: "POST",
      csrf: "wrong-token",
      body: { name: "Test", url: "https://example.com/" },
    });
    expect(response.status).toBe(403);
  });

  it("rejects a cross-origin mutation even with a valid session", async () => {
    const session = await login();
    const response = await adminRequest("/api/admin/monitors", session, {
      method: "POST",
      origin: "https://evil.example",
      body: { name: "Test", url: "https://example.com/" },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("bad_origin");
  });

  it("allows a same-origin mutation", async () => {
    const session = await login();
    const response = await adminRequest("/api/admin/monitors", session, {
      method: "POST",
      origin: BASE,
      body: { name: "Same origin", url: "https://example.com/" },
    });
    expect(response.status).toBe(201);
  });

  it("rate limits repeated sign-in failures", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await SELF.fetch(`${BASE}/api/admin/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: env.OWNER_EMAIL, password: "wrong" }),
      });
      expect(response.status).toBe(401);
    }
    const blocked = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: env.OWNER_EMAIL, password: env.TEST_OWNER_PASSWORD }),
    });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("invalidates the session on logout", async () => {
    const session = await login();
    const logout = await adminRequest("/api/admin/logout", session, { method: "POST" });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");

    const after = await adminRequest("/api/admin/session", session);
    expect(after.status).toBe(401);
  });

  it("expires sessions whose database timestamp has passed", async () => {
    const session = await login();
    await env.DB.prepare("UPDATE sessions SET expires_at = ?")
      .bind(new Date(Date.now() - 1000).toISOString())
      .run();
    const response = await adminRequest("/api/admin/session", session);
    expect(response.status).toBe(401);
  });
});
