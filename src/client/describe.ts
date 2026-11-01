import type { CheckRow } from "../shared/types";

export function describeCheck(check: CheckRow, timeoutMs = 10_000): string {
  if (check.outcome === "up") return `HTTP ${check.status_code ?? "—"}`;
  switch (check.error_category) {
    case "http_status":
      return `HTTP ${check.status_code ?? "—"}`;
    case "timeout":
      return `Timed out after ${Math.round(timeoutMs / 1000)} s`;
    case "dns":
      return "DNS lookup failed";
    case "tls":
      return "TLS handshake failed";
    case "connection":
      return "Connection failed";
    case "invalid_url":
      return "URL rejected";
    default:
      return "Check failed";
  }
}

export const EXPECTED_STATUS_LABELS: Record<string, string> = {
  "2xx_3xx": "2xx or 3xx (default)",
  "2xx": "2xx only",
  "3xx": "3xx only",
  "200": "Exactly 200",
};
