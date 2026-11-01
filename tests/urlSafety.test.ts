import { describe, expect, it } from "vitest";
import { validateMonitorUrl } from "../src/shared/urlSafety";

describe("monitor URL safety", () => {
  it("accepts public HTTPS URLs and normalizes them", () => {
    const result = validateMonitorUrl("https://example.com/health?deep=1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe("https://example.com/health?deep=1");
    }
  });

  it("accepts subdomains and a standard port", () => {
    expect(validateMonitorUrl("https://status.example.co.uk:443/").ok).toBe(true);
  });

  it("rejects non-HTTPS schemes", () => {
    for (const url of [
      "http://example.com",
      "ftp://example.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
    ]) {
      expect(validateMonitorUrl(url).ok, url).toBe(false);
    }
  });

  it("rejects credentials in URLs", () => {
    expect(validateMonitorUrl("https://user:pass@example.com/").ok).toBe(false);
    expect(validateMonitorUrl("https://user@example.com/").ok).toBe(false);
  });

  it("rejects localhost and private hosts", () => {
    for (const url of [
      "https://localhost/",
      "https://app.localhost/",
      "https://service.local/",
      "https://metadata.google.internal/",
      "https://foo.nip.io/",
      "https://foo.sslip.io/",
    ]) {
      expect(validateMonitorUrl(url).ok, url).toBe(false);
    }
  });

  it("rejects IPv4 and IPv6 literals, including private ranges", () => {
    for (const url of [
      "https://127.0.0.1/",
      "https://10.0.0.5/",
      "https://172.16.0.1/",
      "https://192.168.1.1/",
      "https://169.254.169.254/latest/meta-data/",
      "https://0.0.0.0/",
      "https://[::1]/",
      "https://[fd00::1]/",
      "https://2130706433/",
    ]) {
      expect(validateMonitorUrl(url).ok, url).toBe(false);
    }
  });

  it("rejects non-standard ports", () => {
    expect(validateMonitorUrl("https://example.com:8443/").ok).toBe(false);
    expect(validateMonitorUrl("https://example.com:443/").ok).toBe(true);
  });

  it("rejects incomplete or oversized input", () => {
    expect(validateMonitorUrl("").ok).toBe(false);
    expect(validateMonitorUrl("example.com").ok).toBe(false);
    expect(validateMonitorUrl("https://").ok).toBe(false);
    expect(validateMonitorUrl(`https://example.com/${"a".repeat(2100)}`).ok).toBe(false);
    expect(validateMonitorUrl(42).ok).toBe(false);
    expect(validateMonitorUrl(null).ok).toBe(false);
  });

  it("rejects single-label hostnames", () => {
    expect(validateMonitorUrl("https://intranet/").ok).toBe(false);
  });

  it("removes fragments because they are never sent to the server", () => {
    const result = validateMonitorUrl("https://example.com/status#section");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://example.com/status");
  });
});
