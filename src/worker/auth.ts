import type { Env } from "./env";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearSessionCookie,
  fail,
  parseCookies,
  sessionCookie,
  verifyRequestOrigin,
} from "./http";

const encoder = new TextEncoder();

export interface Session {
  token: string;
  tokenHash: string;
  email: string;
  expiresAt: string;
  csrfToken: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toBase64Url(buffer);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Verifies the `pbkdf2-sha256$iterations$salt$hash` format produced by
 * scripts/setup-local.mjs. Returns false for malformed hashes.
 */
export async function verifyPassword(
  password: string,
  stored: string | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.trim().split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) {
    return false;
  }
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(parts[2]);
    expected = fromBase64(parts[3]);
  } catch {
    return false;
  }
  const actual = await derivePassword(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}

export async function deriveCsrfToken(sessionToken: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("pulseledger.csrf.v1"),
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function createSession(
  env: Env,
  email: string,
  requestUrl: string,
): Promise<{ session: Session; cookie: string }> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const csrfToken = await deriveCsrfToken(token);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, email, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(tokenHash, email, now.toISOString(), expiresAt, now.toISOString())
    .run();
  return {
    session: { token, tokenHash, email, expiresAt, csrfToken },
    cookie: sessionCookie(token, requestUrl),
  };
}

export async function getSession(
  request: Request,
  env: Env,
): Promise<Session | null> {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!token || token.length < 20) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT email, expires_at FROM sessions WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first<{ email: string; expires_at: string }>();
  if (!row) return null;
  const now = Date.now();
  if (Date.parse(row.expires_at) <= now) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  // Refresh last_seen at most every five minutes to avoid a write per request.
  await env.DB.prepare(
    "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ? AND last_seen_at < ?",
  )
    .bind(new Date(now).toISOString(), tokenHash, new Date(now - 5 * 60_000).toISOString())
    .run();
  return {
    token,
    tokenHash,
    email: row.email,
    expiresAt: row.expires_at,
    csrfToken: await deriveCsrfToken(token),
  };
}

export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<{ session: Session } | { response: Response }> {
  const session = await getSession(request, env);
  if (!session) {
    return { response: fail("unauthorized", "Sign in to continue.", 401) };
  }
  return { session };
}

/** Validates CSRF token + origin for state-changing admin requests. */
export async function requireMutationAuth(
  request: Request,
  session: Session,
): Promise<Response | null> {
  if (!verifyRequestOrigin(request)) {
    return fail("bad_origin", "This request did not come from the PulseLedger origin.", 403);
  }
  const provided = request.headers.get("x-csrf-token") ?? "";
  if (!provided || !timingSafeEqual(provided, session.csrfToken)) {
    return fail("csrf_failed", "Refresh the page and try again.", 403);
  }
  return null;
}

export async function destroySession(request: Request, env: Env): Promise<string> {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return clearSessionCookie(request.url);
}

const MAX_LOGIN_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;

export interface RateLimitResult {
  blocked: boolean;
  retryAfterSeconds: number;
}

export async function checkLoginRateLimit(
  env: Env,
  key: string,
): Promise<RateLimitResult> {
  const row = await env.DB.prepare(
    "SELECT failures, window_start, blocked_until FROM login_attempts WHERE key = ?",
  )
    .bind(key)
    .first<{ failures: number; window_start: string; blocked_until: string | null }>();
  if (!row) return { blocked: false, retryAfterSeconds: 0 };
  const now = Date.now();
  if (row.blocked_until && Date.parse(row.blocked_until) > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((Date.parse(row.blocked_until) - now) / 1000)),
    };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

export async function recordLoginFailure(env: Env, key: string): Promise<void> {
  const now = new Date();
  const row = await env.DB.prepare(
    "SELECT failures, window_start FROM login_attempts WHERE key = ?",
  )
    .bind(key)
    .first<{ failures: number; window_start: string }>();
  const windowExpired =
    !row || now.getTime() - Date.parse(row.window_start) > LOGIN_WINDOW_MS;
  const failures = windowExpired ? 1 : row.failures + 1;
  const windowStart = windowExpired ? now.toISOString() : row.window_start;
  const blockedUntil =
    failures >= MAX_LOGIN_FAILURES
      ? new Date(now.getTime() + LOGIN_WINDOW_MS).toISOString()
      : null;
  await env.DB.prepare(
    `INSERT INTO login_attempts (key, failures, window_start, blocked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       failures = excluded.failures,
       window_start = excluded.window_start,
       blocked_until = excluded.blocked_until`,
  )
    .bind(key, failures, windowStart, blockedUntil)
    .run();
}

export async function clearLoginFailures(env: Env, key: string): Promise<void> {
  await env.DB.prepare("DELETE FROM login_attempts WHERE key = ?").bind(key).run();
}

export function loginKey(ip: string, email: string): Promise<string> {
  return sha256Hex(`${ip}|${email.trim().toLowerCase()}`);
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}
