import type { ApiErrorBody } from "../shared/types";

export const SESSION_COOKIE = "pl_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface JsonInit {
  status?: number;
  headers?: Record<string, string>;
  cacheControl?: string;
}

export function json<T>(data: T, init: JsonInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", init.cacheControl ?? "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers,
  });
}

export function ok<T>(data: T, init: JsonInit = {}): Response {
  return json({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>,
): Response {
  const body: ApiErrorBody = {
    ok: false,
    error: { code, message, ...(fields ? { fields } : {}) },
  };
  return json(body, { status });
}

export function methodNotAllowed(allow: string): Response {
  const response = fail("method_not_allowed", "That method is not supported.", 405);
  response.headers.set("allow", allow);
  return response;
}

export function notFound(): Response {
  return fail("not_found", "The requested resource does not exist.", 404);
}

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function sessionCookie(
  token: string,
  requestUrl: string,
  maxAgeSeconds = SESSION_TTL_MS / 1000,
): string {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(
    maxAgeSeconds,
  )}${secure}`;
}

export function clearSessionCookie(requestUrl: string): string {
  return sessionCookie("", requestUrl, 0);
}

/** Same-origin enforcement for browser state-changing requests. */
export function verifyRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (origin) return origin === expected;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }
  // Non-browser clients without Origin are allowed through; they still need a
  // session cookie and a CSRF token.
  return true;
}

export function securityHeaders(isHtml: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "cross-origin-opener-policy": "same-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
  };
  if (isHtml) {
    headers["content-security-policy"] = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
  }
  return headers;
}

export function withHeaders(response: Response, headers: Record<string, string>): Response {
  const next = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) {
    next.headers.set(name, value);
  }
  return next;
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Send JSON with a content-type of application/json.");
  }
  const text = await request.text();
  if (text.length > 64 * 1024) {
    throw new HttpError(413, "payload_too_large", "That request is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "The request body is not valid JSON.");
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return fail(error.code, error.message, error.status, error.fields);
  }
  console.error("Unhandled request error", error instanceof Error ? error.message : error);
  return fail("internal_error", "Something went wrong. Try again.", 500);
}
