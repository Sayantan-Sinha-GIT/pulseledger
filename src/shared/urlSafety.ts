export type ValidationResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

const MAX_URL_LENGTH = 2048;
const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".nip.io",
  ".sslip.io",
  ".xip.io",
  ".localtest.me",
];
const NUMERIC_HOST = /^\d+(\.\d+){0,3}$/;
const IPV4_LITERAL = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateIpv4(host: string): boolean {
  const match = host.match(IPV4_LITERAL);
  if (!match) return false;
  const octets = match.slice(1, 5).map((part) => Number(part));
  if (octets.some((octet) => octet > 255)) return false;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const value = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  const mapped = value.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

/**
 * Validates an HTTPS monitor target before it is stored or fetched.
 *
 * This blocks literal private addresses, credentials in URLs, non-HTTPS
 * schemes, non-standard ports, and hosts that resolve arbitrary addresses
 * (nip.io and friends). DNS rebinding cannot be fully eliminated at the URL
 * layer; see README limitations.
 */
export function validateMonitorUrl(input: unknown): ValidationResult {
  if (typeof input !== "string") {
    return { ok: false, message: "Enter a URL." };
  }
  const raw = input.trim();
  if (raw.length === 0) return { ok: false, message: "Enter a URL." };
  if (raw.length > MAX_URL_LENGTH) {
    return { ok: false, message: `URLs must be ${MAX_URL_LENGTH} characters or fewer.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, message: "Enter a complete URL, including https://." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, message: "Only HTTPS URLs can be monitored." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: "Remove credentials from the URL." };
  }
  if (parsed.port && parsed.port !== "443") {
    return { ok: false, message: "Only the standard HTTPS port (443) is supported." };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, message: "The URL needs a hostname." };
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, message: "Local and private hosts cannot be monitored." };
  }
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, message: "Private or wildcard-DNS hosts cannot be monitored." };
  }
  if (NUMERIC_HOST.test(host) || IPV4_LITERAL.test(host)) {
    return { ok: false, message: "IP addresses cannot be monitored; use a public hostname." };
  }
  if (host.startsWith("[") || host.includes(":")) {
    if (isPrivateIpv6(host)) {
      return { ok: false, message: "Private IP addresses cannot be monitored." };
    }
    return { ok: false, message: "IP addresses cannot be monitored; use a public hostname." };
  }
  if (isPrivateIpv4(host)) {
    return { ok: false, message: "Private IP addresses cannot be monitored." };
  }
  if (!host.includes(".")) {
    return { ok: false, message: "Use a public hostname such as example.com." };
  }
  if (host.split(".").some((label) => label.length === 0 || label.length > 63)) {
    return { ok: false, message: "The hostname is not valid." };
  }

  parsed.hash = "";
  return { ok: true, url: parsed.toString() };
}

export function isPrivateHostForTests(host: string): boolean {
  return isPrivateIpv4(host) || isPrivateIpv6(host);
}
