import { expectedStatusMatches } from "../shared/status";
import { validateMonitorUrl } from "../shared/urlSafety";
import type { ExpectedStatus, IncidentSeverity, IncidentStatus } from "../shared/types";
import { HttpError } from "./http";

const EXPECTED_STATUSES: ExpectedStatus[] = ["2xx_3xx", "2xx", "3xx", "200"];
const SEVERITIES: IncidentSeverity[] = ["minor", "major", "critical"];
const INCIDENT_STATUSES: IncidentStatus[] = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
];

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "invalid_body", "Send a JSON object.");
  }
  return body as Record<string, unknown>;
}

function text(
  value: unknown,
  field: string,
  label: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_field", `${label} is required.`, {
      [field]: `${label} is required.`,
    });
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new HttpError(400, "invalid_field", `${label} is too short.`, {
      [field]: `${label} must be at least ${min} characters.`,
    });
  }
  if (trimmed.length > max) {
    throw new HttpError(400, "invalid_field", `${label} is too long.`, {
      [field]: `${label} must be ${max} characters or fewer.`,
    });
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new HttpError(400, "invalid_field", `${label} contains control characters.`, {
      [field]: `${label} contains characters that are not allowed.`,
    });
  }
  return trimmed;
}

export interface MonitorInput {
  name?: string;
  project?: string;
  url?: string;
  expectedStatus?: ExpectedStatus;
  paused?: boolean;
}

export function validateMonitorInput(
  body: unknown,
  options: { partial: boolean },
): MonitorInput {
  const input = asObject(body);
  const result: MonitorInput = {};

  if (input.name !== undefined || !options.partial) {
    result.name = text(input.name, "name", "Name", 1, 60);
  }
  if (input.project !== undefined) {
    result.project = text(input.project, "project", "Project", 1, 40);
  } else if (!options.partial) {
    result.project = "Other";
  }
  if (input.url !== undefined || !options.partial) {
    const validation = validateMonitorUrl(input.url);
    if (!validation.ok) {
      throw new HttpError(400, "invalid_field", validation.message, {
        url: validation.message,
      });
    }
    result.url = validation.url;
  }
  if (input.expectedStatus !== undefined) {
    if (!EXPECTED_STATUSES.includes(input.expectedStatus as ExpectedStatus)) {
      throw new HttpError(400, "invalid_field", "Choose a supported status rule.", {
        expectedStatus: "Choose 2xx/3xx, 2xx only, 3xx only, or exactly 200.",
      });
    }
    result.expectedStatus = input.expectedStatus as ExpectedStatus;
  } else if (!options.partial) {
    result.expectedStatus = "2xx_3xx";
  }
  if (input.paused !== undefined) {
    if (typeof input.paused !== "boolean") {
      throw new HttpError(400, "invalid_field", "Paused must be true or false.", {
        paused: "Paused must be true or false.",
      });
    }
    result.paused = input.paused;
  }

  if (options.partial && Object.keys(result).length === 0) {
    throw new HttpError(400, "no_changes", "Provide at least one field to update.");
  }
  return result;
}

export interface IncidentInput {
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  monitorId: string | null;
  body: string;
}

export function validateIncidentInput(body: unknown): IncidentInput {
  const input = asObject(body);
  const title = text(input.title, "title", "Title", 3, 120);
  const severity = input.severity;
  if (!SEVERITIES.includes(severity as IncidentSeverity)) {
    throw new HttpError(400, "invalid_field", "Choose a severity.", {
      severity: "Choose minor, major, or critical.",
    });
  }
  const status = input.status ?? "investigating";
  if (
    !INCIDENT_STATUSES.includes(status as IncidentStatus) ||
    status === "resolved"
  ) {
    throw new HttpError(400, "invalid_field", "Choose an opening status.", {
      status: "Open an incident as investigating, identified, or monitoring.",
    });
  }
  let monitorId: string | null = null;
  if (input.monitorId !== undefined && input.monitorId !== null && input.monitorId !== "") {
    if (typeof input.monitorId !== "string" || input.monitorId.length > 64) {
      throw new HttpError(400, "invalid_field", "Choose a valid monitor.", {
        monitorId: "Choose a monitor from the list.",
      });
    }
    monitorId = input.monitorId;
  }
  const updateBody = text(input.body, "body", "Update", 3, 2000);
  return {
    title,
    severity: severity as IncidentSeverity,
    status: status as IncidentStatus,
    monitorId,
    body: updateBody,
  };
}

export interface IncidentUpdateInput {
  status: IncidentStatus;
  body: string;
}

export function validateIncidentUpdateInput(body: unknown): IncidentUpdateInput {
  const input = asObject(body);
  const status = input.status;
  if (!INCIDENT_STATUSES.includes(status as IncidentStatus)) {
    throw new HttpError(400, "invalid_field", "Choose an incident status.", {
      status: "Choose investigating, identified, monitoring, or resolved.",
    });
  }
  return {
    status: status as IncidentStatus,
    body: text(input.body, "body", "Update", 3, 2000),
  };
}

export function validateExpectedStatusForTest(
  status: number,
  expected: ExpectedStatus,
): boolean {
  return expectedStatusMatches(status, expected);
}
