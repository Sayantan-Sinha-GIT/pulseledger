import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { formatCount, formatRelative, formatTimestamp, hostOf } from "../format";
import { Link } from "../router";
import { formatUptime } from "../../shared/status";
import type { AdminMonitorView, PublicIncident } from "../../shared/types";
import { LoadingBlock, Notice } from "./ui";

export function OverviewPage() {
  const [monitors, setMonitors] = useState<AdminMonitorView[] | null>(null);
  const [incidents, setIncidents] = useState<PublicIncident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [monitorData, incidentData] = await Promise.all([
        api.monitors(),
        api.incidents(),
      ]);
      setMonitors(monitorData.monitors);
      setIncidents(incidentData.incidents);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The owner API is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeIncidents = incidents?.filter((incident) => incident.status !== "resolved") ?? [];
  const activeMonitors = monitors?.filter((monitor) => !monitor.paused) ?? [];
  const checks24h = monitors?.reduce((sum, monitor) => sum + monitor.checks24h, 0) ?? 0;
  const failures24h = monitors?.reduce((sum, monitor) => sum + monitor.failures24h, 0) ?? 0;

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Owner overview</p>
          <h1>Operations at a glance.</h1>
          <p className="page-lede">
            Actual checks from the last 24 hours, the state of every monitor, and the
            incidents that still need a resolution.
          </p>
        </div>
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error ? (
        <Notice tone="warning">
          {error}{" "}
          <button type="button" className="text-button" onClick={() => void load()}>
            Try again
          </button>
        </Notice>
      ) : null}

      {loading && !monitors ? <LoadingBlock label="Loading owner overview" /> : null}

      {monitors && incidents ? (
        <>
          <section className="stat-strip" aria-label="Owner summary">
            <div className="stat">
              <p className="stat-label">Active incidents</p>
              <p className="stat-value">{activeIncidents.length}</p>
              <p className="stat-note">
                {activeIncidents.length === 0 ? "Nothing open" : "Needs attention"}
              </p>
            </div>
            <div className="stat">
              <p className="stat-label">Active monitors</p>
              <p className="stat-value">
                {activeMonitors.length}
                <span className="stat-suffix">/{monitors.length}</span>
              </p>
              <p className="stat-note">Paused monitors run no checks</p>
            </div>
            <div className="stat">
              <p className="stat-label">Checks, 24 hours</p>
              <p className="stat-value">{formatCount(checks24h)}</p>
              <p className="stat-note">Manual and scheduled combined</p>
            </div>
            <div className="stat">
              <p className="stat-label">Failed, 24 hours</p>
              <p className={`stat-value ${failures24h > 0 ? "value-down" : ""}`}>
                {formatCount(failures24h)}
              </p>
              <p className="stat-note">
                {checks24h === 0
                  ? "No checks yet"
                  : `${((failures24h / checks24h) * 100).toFixed(1)}% of checks`}
              </p>
            </div>
          </section>

          {activeIncidents.length > 0 ? (
            <section className="admin-section" aria-labelledby="active-incidents">
              <div className="section-head compact">
                <div>
                  <p className="section-kicker">Open incidents</p>
                  <h2 id="active-incidents">Still in progress</h2>
                </div>
                <Link className="text-link" href="/admin/incidents">
                  Manage incidents
                </Link>
              </div>
              <div className="incident-list">
                {activeIncidents.map((incident) => (
                  <article key={incident.id} className={`incident compact-incident severity-${incident.severity}`}>
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
                      </p>
                      {incident.updates[0] ? <p>{incident.updates[0].body}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="admin-section" aria-labelledby="monitor-table">
            <div className="section-head compact">
              <div>
                <p className="section-kicker">Monitors</p>
                <h2 id="monitor-table">Current state</h2>
              </div>
              <Link className="text-link" href="/admin/monitors">
                Manage monitors
              </Link>
            </div>

            {monitors.length === 0 ? (
              <div className="empty-state">
                <h3>No monitors yet.</h3>
                <p>
                  Add the first HTTPS monitor from the{" "}
                  <Link href="/admin/monitors">monitors page</Link>.
                </p>
              </div>
            ) : (
              <div className="table-scroll overview-desktop-table">
                <table className="data-table admin-table">
                  <caption className="sr-only">Monitor state and recent performance</caption>
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col">State</th>
                      <th scope="col">Last check</th>
                      <th scope="col">Uptime 24h</th>
                      <th scope="col">Checks</th>
                      <th scope="col">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitors.map((monitor) => (
                      <tr key={monitor.id}>
                        <td>
                          <span className="table-primary">{monitor.name}</span>
                          <span className="table-secondary">{hostOf(monitor.url)}</span>
                        </td>
                        <td data-label="State">
                          <span className={`state state-${monitor.state}`}>
                            <span className="state-mark" aria-hidden="true" />
                            {monitor.state}
                          </span>
                        </td>
                        <td data-label="Last check">
                          {monitor.lastCheck
                            ? `${formatRelative(monitor.lastCheck.checked_at)} · ${monitor.lastCheck.outcome}`
                            : "No checks yet"}
                        </td>
                        <td data-label="Uptime 24h" className="mono">{formatUptime(monitor.uptime.h24)}</td>
                        <td data-label="Checks" className="mono">{formatCount(monitor.checks24h)}</td>
                        <td data-label="Failed" className={`mono ${monitor.failures24h > 0 ? "value-down" : ""}`}>
                          {formatCount(monitor.failures24h)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {monitors.length > 0 ? (
              <div className="overview-mobile-list">
                {monitors.map((monitor) => (
                  <article className="overview-mobile-card" key={monitor.id} aria-label={monitor.name}>
                    <div className="overview-mobile-head">
                      <div>
                        <h3>{monitor.name}</h3>
                        <p className="overview-mobile-host">{hostOf(monitor.url)}</p>
                      </div>
                      <span className={`state state-${monitor.state}`}>
                        <span className="state-mark" aria-hidden="true" />
                        {monitor.state}
                      </span>
                    </div>
                    <dl className="overview-mobile-metrics">
                      <div><dt>Last check</dt><dd>{monitor.lastCheck
                        ? `${formatRelative(monitor.lastCheck.checked_at)} · ${monitor.lastCheck.outcome}`
                        : "No checks yet"}</dd></div>
                      <div><dt>Uptime 24h</dt><dd>{formatUptime(monitor.uptime.h24)}</dd></div>
                      <div><dt>Checks, 24h</dt><dd>{formatCount(monitor.checks24h)}</dd></div>
                      <div><dt>Failed, 24h</dt><dd className={monitor.failures24h > 0 ? "value-down" : ""}>{formatCount(monitor.failures24h)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
