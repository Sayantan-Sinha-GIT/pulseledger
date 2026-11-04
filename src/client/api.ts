import type {
  AdminMonitorView,
  AdminSessionResponse,
  AuditRow,
  CheckRow,
  IncidentRow,
  IncidentSeverity,
  IncidentStatus,
  IncidentUpdateRow,
  MonitorRow,
  PublicIncident,
  StatusResponse,
} from "../shared/types";

let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public code = "request_failed",
    public status = 0,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ accept: "application/json" });
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (csrfToken && options.method && options.method !== "GET") {
    headers.set("x-csrf-token", csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      "PulseLedger could not reach its API. Check the connection and try again.",
      "network_error",
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError("The API returned an unreadable response.", "bad_response", response.status);
    }
  }

  const body = payload as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }
    | null;

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("pl:unauthorized"));
  }

  if (!response.ok || !body || body.ok === false) {
    const error = body && body.ok === false ? body.error : null;
    throw new ApiError(
      error?.message ?? "The request failed.",
      error?.code ?? "request_failed",
      response.status,
      error?.fields ?? {},
    );
  }

  return body.data;
}

export const api = {
  status(signal?: AbortSignal, fresh = false) {
    return request<StatusResponse>(fresh ? "/api/status?fresh=1" : "/api/status", { signal });
  },

  async login(email: string, password: string) {
    const session = await request<AdminSessionResponse>("/api/admin/login", {
      method: "POST",
      body: { email, password },
    });
    setCsrfToken(session.csrfToken);
    return session;
  },

  async logout() {
    await request<{ signedOut: boolean }>("/api/admin/logout", { method: "POST" });
    setCsrfToken(null);
  },

  session() {
    return request<AdminSessionResponse>("/api/admin/session");
  },

  monitors() {
    return request<{ monitors: AdminMonitorView[]; generatedAt: string }>(
      "/api/admin/monitors",
    );
  },

  createMonitor(input: {
    name: string;
      project?: string;
    url: string;
    expectedStatus: string;
    paused?: boolean;
  }) {
    return request<{ monitor: MonitorRow }>("/api/admin/monitors", {
      method: "POST",
      body: input,
    });
  },

  updateMonitor(
    id: string,
      input: { name?: string; project?: string; url?: string; expectedStatus?: string; paused?: boolean },
  ) {
    return request<{ monitor: MonitorRow }>(`/api/admin/monitors/${id}`, {
      method: "PATCH",
      body: input,
    });
  },

  deleteMonitor(id: string) {
    return request<{ deleted: string }>(`/api/admin/monitors/${id}`, {
      method: "DELETE",
    });
  },

  checkMonitor(id: string) {
    return request<{ check: CheckRow; inserted: boolean }>(
      `/api/admin/monitors/${id}/check`,
      { method: "POST" },
    );
  },

  checks(id: string, limit = 50) {
    return request<{ checks: CheckRow[] }>(
      `/api/admin/monitors/${id}/checks?limit=${limit}`,
    );
  },

  incidents() {
    return request<{ incidents: PublicIncident[]; generatedAt: string }>(
      "/api/admin/incidents",
    );
  },

  createIncident(input: {
    title: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    monitorId: string | null;
    body: string;
  }) {
    return request<{ incident: IncidentRow; updates: IncidentUpdateRow[] }>(
      "/api/admin/incidents",
      { method: "POST", body: input },
    );
  },

  updateIncident(id: string, input: { status: IncidentStatus; body: string }) {
    return request<{ incident: IncidentRow; update: IncidentUpdateRow }>(
      `/api/admin/incidents/${id}/updates`,
      { method: "POST", body: input },
    );
  },

  audit() {
    return request<{ entries: AuditRow[] }>("/api/admin/audit");
  },
};
