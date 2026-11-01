import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  formatCount,
  formatDuration,
  formatPercent,
  formatRelative,
  formatShortTime,
  formatTimestamp,
  hostOf,
} from "../format";
import { formatUptime } from "../../shared/status";
import { describeCheck } from "../describe";
import { Link } from "../router";
import type {
  DailyBucket,
  LatencyPoint,
  MonitorState,
  MonitorView,
  OverallState,
  PublicIncident,
  StatusResponse,
} from "../../shared/types";

const STATE_LABELS: Record<MonitorState | OverallState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  paused: "Paused",
  unknown: "Unknown",
  incident: "Incident active",
};

export function StateBadge({ state }: { state: MonitorState | OverallState }) {
  return (
    <span className={`state state-${state}`}>
      <span className="state-mark" aria-hidden="true" />
      {STATE_LABELS[state]}
    </span>
  );
}

function heroLede(state: OverallState): string {
  switch (state) {
    case "operational":
      return "Every monitored service answered with its expected status on the latest check.";
    case "incident":
      return "The owner has opened an incident. Current details and updates are below.";
    case "down":
      return "A monitored service failed its latest check. No incident has been opened yet.";
    case "degraded":
      return "At least one service is responding slowly or failing intermittently.";
    default:
      return "PulseLedger is waiting for the first completed checks. No uptime is invented.";
  }
}

function overallUptime(monitors: MonitorView[]) {
  const totals = monitors.reduce(
    (accumulator, monitor) => {
      accumulator.up += monitor.uptime.d30.up;
      accumulator.total += monitor.uptime.d30.total;
      return accumulator;
    },
    { up: 0, total: 0 },
  );
  if (totals.total === 0) return null;
  return {
    percent: Math.round((totals.up / totals.total) * 1000) / 10,
    checks: totals.total,
  };
}

export function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (mode: "initial" | "manual" | "auto") => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (mode !== "initial") setRefreshing(true);
    try {
      const next = await api.status(controller.signal);
      setData(next);
      setError(null);
      setLastUpdated(Date.now());
      if (mode === "manual") {
        setAnnouncement(`Status updated at ${formatShortTime(next.generatedAt)}.`);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(
        caught instanceof Error
          ? caught.message
          : "The status API could not be reached.",
      );
      if (mode === "manual") {
        setAnnouncement("Refresh failed. Showing the last successful data.");
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
    const refreshTimer = window.setInterval(() => {
      if (!document.hidden) void load("auto");
    }, 60_000);
    const tickTimer = window.setInterval(() => setNow(Date.now()), 10_000);
    const onVisibility = () => {
      if (!document.hidden) void load("auto");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(tickTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, [load]);

  const overall = data?.overall ?? "unknown";
  const uptime = data ? overallUptime(data.monitors) : null;
  const activeCount = data?.monitors.filter((monitor) => !monitor.paused).length ?? 0;
  const activeIncidents =
    data?.incidents.filter((incident) => incident.status !== "resolved") ?? [];

  return (
    <div className="public-shell">
      <a className="skip-link" href="#main">
        Skip to status
      </a>

      <header className="masthead">
        <Link className="wordmark" href="/" aria-label="PulseLedger home">
          Pulse<span>Ledger</span>
        </Link>
        <nav className="masthead-nav" aria-label="Primary">
          <a href="#services">Services</a>
          <a href="#incidents">Incidents</a>
          <a href="#method">Method</a>
          <Link className="owner-link" href="/admin">
            Owner sign in
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="status-heading">
          <div className="hero-copy">
            <p className="eyebrow">
              Live operations desk
              {data ? ` · ${formatTimestamp(data.generatedAt)}` : ""}
            </p>
            <h1 id="status-heading">{data?.headline ?? "Reading the desk…"}</h1>
            <p className="hero-lede">{heroLede(overall)}</p>
            <div className="hero-actions">
              <StateBadge state={overall} />
              <button
                type="button"
                className="button button-quiet"
                onClick={() => void load("manual")}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh now"}
              </button>
              <span className="updated-note">
                {lastUpdated
                  ? `Updated ${formatRelative(new Date(lastUpdated).toISOString(), now)}`
                  : "Not updated yet"}
              </span>
            </div>
          </div>

          <aside className="hero-figure" aria-label="Thirty-day uptime summary">
            <p className="figure-label">30-day uptime</p>
            <p className="figure-value">
              {uptime ? formatPercent(uptime.percent) : "—"}
            </p>
            <p className="figure-note">
              {uptime
                ? `From ${formatCount(uptime.checks)} recorded checks across ${activeCount} active service${activeCount === 1 ? "" : "s"}.`
                : "No checks recorded yet. The first scheduled run will populate this figure."}
            </p>
          </aside>
        </section>

        {error ? (
          <div className="notice notice-warning" role="alert">
            <div>
              <strong>Live data is unavailable.</strong> {error}
              {data
                ? ` Showing the last successful snapshot from ${formatTimestamp(
                    data.generatedAt,
                  )}.`
                : ""}
            </div>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => void load("manual")}
            >
              Retry
            </button>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>

        {loading && !data ? (
          <div className="loading-block" aria-busy="true">
            <p className="eyebrow">Loading checks</p>
            <p>Reading monitors, recent checks, and incident history.</p>
          </div>
        ) : null}

        {data ? (
          <>
            <section id="services" className="section" aria-labelledby="services-heading">
              <div className="section-head">
                <div>
                  <p className="section-kicker">01 / Services</p>
                  <h2 id="services-heading">What is being watched</h2>
                </div>
                <p className="section-meta">
                  {data.monitors.length} monitor{data.monitors.length === 1 ? "" : "s"} ·
                  checks every {data.meta.checkIntervalMinutes} minutes · 30-day retention
                </p>
              </div>

              {data.monitors.length === 0 ? (
                <div className="empty-state">
                  <h3>No services are being monitored yet.</h3>
                  <p>
                    The owner can add the first HTTPS monitor from the{" "}
                    <Link href="/admin">owner desk</Link>. Nothing is shown until a real
                    check completes.
                  </p>
                </div>
              ) : (
                <div className="service-list">
                  {data.monitors.map((monitor) => (
                    <ServiceRow
                      key={monitor.id}
                      monitor={monitor}
                      timeoutMs={data.meta.timeoutMs}
                    />
                  ))}
                </div>
              )}
            </section>

            <section id="incidents" className="section" aria-labelledby="incidents-heading">
              <div className="section-head">
                <div>
                  <p className="section-kicker">02 / Incident log</p>
                  <h2 id="incidents-heading">What happened, in plain language</h2>
                </div>
                <p className="section-meta">
                  {activeIncidents.length} active · resolved incidents kept for 30 days
                </p>
              </div>

              {data.incidents.length === 0 ? (
                <div className="empty-state">
                  <h3>No incidents recorded.</h3>
                  <p>
                    This log starts with the current deployment. No past incident history
                    has been invented.
                  </p>
                </div>
              ) : (
                <div className="incident-list">
                  {data.incidents.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} />
                  ))}
                </div>
              )}
            </section>

            <section id="method" className="section method" aria-labelledby="method-heading">
              <div className="section-head">
                <div>
                  <p className="section-kicker">03 / Method</p>
                  <h2 id="method-heading">How these numbers are made</h2>
                </div>
              </div>
              <div className="method-grid">
                <div>
                  <h3>Checks</h3>
                  <p>
                    Each active service is requested over HTTPS every{" "}
                    {data.meta.checkIntervalMinutes} minutes with a{" "}
                    {Math.round(data.meta.timeoutMs / 1000)}-second timeout. Redirects are
                    not followed; a 3xx response is recorded as-is.
                  </p>
                </div>
                <div>
                  <h3>Success</h3>
                  <p>
                    A check is up when the response matches the monitor&apos;s status rule
                    (2xx/3xx by default). Timeouts, DNS, TLS, and connection errors are
                    down. Every completed check is stored.
                  </p>
                </div>
                <div>
                  <h3>Uptime</h3>
                  <p>
                    Percentages are calculated only from recorded checks in each window.
                    Paused monitors run no checks, so paused time is never counted as a
                    failure. Small samples are labelled provisional.
                  </p>
                </div>
                <div>
                  <h3>States</h3>
                  <ul className="state-legend">
                    <li>
                      <StateBadge state="operational" /> Latest check matched.
                    </li>
                    <li>
                      <StateBadge state="degraded" /> A recent failure ratio of 20% or a
                      latest response of 2 seconds or more.
                    </li>
                    <li>
                      <StateBadge state="down" /> Latest check failed.
                    </li>
                    <li>
                      <StateBadge state="incident" /> An owner-opened incident is active.
                    </li>
                    <li>
                      <StateBadge state="paused" /> Monitoring is intentionally off.
                    </li>
                    <li>
                      <StateBadge state="unknown" /> No completed check yet.
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>

      <footer className="footer">
        <div>
          <p className="footer-wordmark">PulseLedger</p>
          <p className="footer-note">
            An independent operations desk. Times are UTC. Checks retained for{" "}
            {data?.meta.retentionDays ?? 30} days.
          </p>
        </div>
        <div className="footer-links">
          <a href="/health">Worker health</a>
          <Link href="/admin">Owner desk</Link>
        </div>
      </footer>
    </div>
  );
}

function ServiceRow({ monitor, timeoutMs }: { monitor: MonitorView; timeoutMs: number }) {
  const [expanded, setExpanded] = useState(false);
  const detailId = `detail-${monitor.id}`;
  const last = monitor.lastCheck;
  const lastDescription = last
    ? `${describeCheck(last, timeoutMs)} · ${formatRelative(last.checked_at)}`
    : "No completed check yet";

  return (
    <article className={`service service-state-${monitor.state}`}>
      <div className="service-top">
        <div className="service-identity">
          <StateBadge state={monitor.state} />
          <h3>{monitor.name}</h3>
          <a
            className="service-url"
            href={monitor.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {hostOf(monitor.url)}
          </a>
        </div>
        <button
          type="button"
          className="button button-quiet service-toggle"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide details" : "Details"}
        </button>
      </div>

      <dl className="service-stats">
        <div>
          <dt>Uptime 24h</dt>
          <dd>{formatUptime(monitor.uptime.h24)}</dd>
        </div>
        <div>
          <dt>Uptime 7d</dt>
          <dd>{formatUptime(monitor.uptime.d7)}</dd>
        </div>
        <div>
          <dt>Latency p95</dt>
          <dd>{formatDuration(monitor.latency.p95)}</dd>
        </div>
        <div>
          <dt>Last check</dt>
          <dd className={last?.outcome === "down" ? "value-down" : undefined}>
            {lastDescription}
          </dd>
        </div>
      </dl>

      <div className="service-strip">
        <UptimeStrip daily={monitor.daily} name={monitor.name} />
        <p className="strip-caption">
          <span>30 days ago</span>
          <span>{formatUptime(monitor.uptime.d30)} uptime</span>
          <span>Today</span>
        </p>
      </div>

      <div id={detailId} className="service-detail" hidden={!expanded}>
        {expanded ? (
          <div className="detail-grid">
            <div>
              <h4>Response time</h4>
              <Sparkline points={monitor.trend} name={monitor.name} />
            </div>
            <div>
              <h4>Recent checks</h4>
              {monitor.recentChecks.length === 0 ? (
                <p className="muted">No checks recorded yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table compact">
                    <caption className="sr-only">
                      Recent checks for {monitor.name}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Time</th>
                        <th scope="col">Result</th>
                        <th scope="col">Response</th>
                        <th scope="col">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitor.recentChecks.map((check) => (
                        <tr key={check.id}>
                          <td className="mono">{formatShortTime(check.checked_at)}</td>
                          <td>
                            <span className={`result result-${check.outcome}`}>
                              {check.outcome === "up" ? "Up" : "Down"}
                            </span>
                          </td>
                          <td>{describeCheck(check, timeoutMs)}</td>
                          <td className="mono">{formatDuration(check.duration_ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function UptimeStrip({ daily, name }: { daily: DailyBucket[]; name: string }) {
  const total = daily.reduce((sum, day) => sum + day.total, 0);
  const up = daily.reduce((sum, day) => sum + day.up, 0);
  const summary =
    total === 0
      ? `No checks recorded in the last 30 days for ${name}.`
      : `Thirty-day check history for ${name}: ${up} up and ${
          total - up
        } down across ${total} checks.`;

  return (
    <div className="uptime-strip" role="img" aria-label={summary}>
      {daily.map((day) => {
        const className =
          day.total === 0
            ? "day-empty"
            : day.down === 0
              ? "day-up"
              : day.up === 0
                ? "day-down"
                : "day-mixed";
        return (
          <span
            key={day.date}
            className={`day ${className}`}
            title={`${day.date}: ${day.up} up, ${day.down} down`}
          />
        );
      })}
    </div>
  );
}

function Sparkline({ points, name }: { points: LatencyPoint[]; name: string }) {
  if (points.length < 2) {
    return <p className="muted">Not enough checks for a trend yet.</p>;
  }
  const width = 320;
  const height = 72;
  const padding = 4;
  const max = Math.max(...points.map((point) => point.ms), 1);
  const min = Math.min(...points.map((point) => point.ms), 0);
  const range = Math.max(1, max - min);
  const step = (width - padding * 2) / (points.length - 1);
  const coordinates = points.map((point, index) => {
    const x = padding + index * step;
    const y =
      height - padding - ((point.ms - min) / range) * (height - padding * 2);
    return { x, y, point };
  });
  const line = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const downPoints = coordinates.filter(({ point }) => point.outcome === "down");
  const latest = points[points.length - 1];
  const fastest = Math.min(...points.map((point) => point.ms));
  const slowest = Math.max(...points.map((point) => point.ms));

  return (
    <figure className="sparkline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Response time for ${name}: latest ${formatDuration(
          latest.ms,
        )}, fastest ${formatDuration(fastest)}, slowest ${formatDuration(slowest)} over ${
          points.length
        } checks.`}
        preserveAspectRatio="none"
      >
        <polygon className="spark-area" points={area} />
        <polyline className="spark-line" points={line} />
        {downPoints.map(({ x, y, point }) => (
          <circle key={point.at} className="spark-down" cx={x} cy={y} r={3} />
        ))}
      </svg>
      <figcaption>
        Latest {formatDuration(latest.ms)} · range {formatDuration(fastest)}–
        {formatDuration(slowest)}
      </figcaption>
    </figure>
  );
}

function IncidentCard({ incident }: { incident: PublicIncident }) {
  const latest = incident.updates[0];
  return (
    <article
      className={`incident incident-${incident.status} severity-${incident.severity}`}
    >
      <div className="incident-head">
        <div className="incident-title-row">
          <span className={`severity severity-${incident.severity}`}>
            {incident.severity}
          </span>
          <span className={`incident-status status-${incident.status}`}>
            {incident.status}
          </span>
        </div>
        <h3>{incident.title}</h3>
        <p className="incident-meta">
          {incident.monitorName ? `${incident.monitorName} · ` : ""}
          Opened {formatTimestamp(incident.startedAt)}
          {incident.resolvedAt ? ` · Resolved ${formatTimestamp(incident.resolvedAt)}` : ""}
        </p>
      </div>

      {latest ? (
        <div className="incident-latest">
          <p className="incident-update-meta">
            Latest update · {formatTimestamp(latest.createdAt)} ·{" "}
            <span className={`incident-status status-${latest.status}`}>
              {latest.status}
            </span>
          </p>
          <p>{latest.body}</p>
        </div>
      ) : null}

      {incident.updates.length > 1 ? (
        <details className="incident-history">
          <summary>
            Earlier updates ({incident.updates.length - 1})
          </summary>
          <ol>
            {incident.updates.slice(1).map((update) => (
              <li key={update.id}>
                <p className="incident-update-meta">
                  {formatTimestamp(update.createdAt)} ·{" "}
                  <span className={`incident-status status-${update.status}`}>
                    {update.status}
                  </span>
                </p>
                <p>{update.body}</p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </article>
  );
}
