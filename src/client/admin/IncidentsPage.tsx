import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api } from "../api";
import { formatTimestamp } from "../format";
import type {
  AdminMonitorView,
  IncidentSeverity,
  IncidentStatus,
  PublicIncident,
} from "../../shared/types";
import { FieldError, LoadingBlock, Notice } from "./ui";

const SEVERITIES: IncidentSeverity[] = ["minor", "major", "critical"];
const STATUSES: IncidentStatus[] = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
];

interface CreateState {
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  monitorId: string;
  body: string;
}

const EMPTY_CREATE: CreateState = {
  title: "",
  severity: "major",
  status: "investigating",
  monitorId: "",
  body: "",
};

interface UpdateState {
  status: IncidentStatus;
  body: string;
}

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<PublicIncident[] | null>(null);
  const [monitors, setMonitors] = useState<AdminMonitorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [create, setCreate] = useState<CreateState>(EMPTY_CREATE);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const [updates, setUpdates] = useState<Record<string, UpdateState>>({});
  const [updateErrors, setUpdateErrors] = useState<Record<string, Record<string, string>>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [incidentData, monitorData] = await Promise.all([
        api.incidents(),
        api.monitors(),
      ]);
      setIncidents(incidentData.incidents);
      setMonitors(monitorData.monitors);
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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setCreateErrors({});
    try {
      await api.createIncident({
        title: create.title,
        severity: create.severity,
        status: create.status,
        monitorId: create.monitorId || null,
        body: create.body,
      });
      setCreate(EMPTY_CREATE);
      setToast("Incident opened and published to the status page.");
      await load(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setCreateErrors(
          Object.keys(caught.fields).length > 0 ? caught.fields : { form: caught.message },
        );
      } else {
        setCreateErrors({ form: "The incident could not be opened." });
      }
    } finally {
      setCreating(false);
    }
  };

  const submitUpdate = async (event: FormEvent, incident: PublicIncident) => {
    event.preventDefault();
    const state = updates[incident.id] ?? {
      status: incident.status,
      body: "",
    };
    setSubmittingId(incident.id);
    setUpdateErrors((current) => ({ ...current, [incident.id]: {} }));
    try {
      await api.updateIncident(incident.id, state);
      setUpdates((current) => {
        const next = { ...current };
        delete next[incident.id];
        return next;
      });
      setToast(
        state.status === "resolved"
          ? "Incident resolved. It remains in the public log."
          : "Incident update published.",
      );
      await load(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setUpdateErrors((current) => ({
          ...current,
          [incident.id]:
            Object.keys(caught.fields).length > 0
              ? caught.fields
              : { form: caught.message },
        }));
      } else {
        setUpdateErrors((current) => ({
          ...current,
          [incident.id]: { form: "The update could not be published." },
        }));
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const active = incidents?.filter((incident) => incident.status !== "resolved") ?? [];

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Incidents</p>
          <h1>Write the record while it happens.</h1>
          <p className="page-lede">
            Opening an incident marks the public page as incident-active. Every update is
            timestamped and appears on the public timeline.
          </p>
        </div>
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {toast ? (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="text-button" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <Notice tone="warning">
          {error}{" "}
          <button type="button" className="text-button" onClick={() => void load()}>
            Try again
          </button>
        </Notice>
      ) : null}

      <section className="panel" aria-labelledby="open-incident">
        <div className="panel-head">
          <div>
            <p className="section-kicker">New incident</p>
            <h2 id="open-incident">Open an incident</h2>
          </div>
          <p className="panel-note">
            The first update is required and becomes the public explanation.
          </p>
        </div>
        <form className="form-grid" onSubmit={submitCreate} noValidate>
          <label className="field field-wide">
            <span className="field-label">Title</span>
            <input
              type="text"
              value={create.title}
              maxLength={120}
              required
              placeholder="Elevated API latency"
              onChange={(event) => setCreate({ ...create, title: event.target.value })}
              aria-invalid={Boolean(createErrors.title)}
            />
            <FieldError message={createErrors.title} />
          </label>
          <label className="field">
            <span className="field-label">Severity</span>
            <select
              value={create.severity}
              onChange={(event) =>
                setCreate({ ...create, severity: event.target.value as IncidentSeverity })
              }
            >
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
            <FieldError message={createErrors.severity} />
          </label>
          <label className="field">
            <span className="field-label">Opening status</span>
            <select
              value={create.status}
              onChange={(event) =>
                setCreate({ ...create, status: event.target.value as IncidentStatus })
              }
            >
              {STATUSES.filter((status) => status !== "resolved").map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <FieldError message={createErrors.status} />
          </label>
          <label className="field">
            <span className="field-label">Affected monitor (optional)</span>
            <select
              value={create.monitorId}
              onChange={(event) => setCreate({ ...create, monitorId: event.target.value })}
            >
              <option value="">Not monitor-specific</option>
              {monitors.map((monitor) => (
                <option key={monitor.id} value={monitor.id}>
                  {monitor.name}
                </option>
              ))}
            </select>
            <FieldError message={createErrors.monitorId} />
          </label>
          <label className="field field-wide">
            <span className="field-label">First update</span>
            <textarea
              value={create.body}
              rows={4}
              maxLength={2000}
              required
              placeholder="What is affected, what is known, and what happens next?"
              onChange={(event) => setCreate({ ...create, body: event.target.value })}
              aria-invalid={Boolean(createErrors.body)}
            />
            <FieldError message={createErrors.body} />
          </label>
          <div className="form-actions field-wide">
            <button type="submit" className="button button-primary" disabled={creating}>
              {creating ? "Opening…" : "Open incident"}
            </button>
            {createErrors.form ? <FieldError message={createErrors.form} /> : null}
          </div>
        </form>
      </section>

      {loading && !incidents ? <LoadingBlock label="Loading incidents" /> : null}

      {incidents ? (
        <section className="admin-section" aria-labelledby="incident-list">
          <div className="section-head compact">
            <div>
              <p className="section-kicker">Incident log</p>
              <h2 id="incident-list">
                {active.length} active · {incidents.length} total
              </h2>
            </div>
          </div>

          {incidents.length === 0 ? (
            <div className="empty-state">
              <h3>No incidents recorded.</h3>
              <p>Open the first incident above when something needs an explanation.</p>
            </div>
          ) : (
            <div className="incident-list">
              {incidents.map((incident) => {
                const updateState = updates[incident.id] ?? {
                  status: incident.status,
                  body: "",
                };
                const errors = updateErrors[incident.id] ?? {};
                const resolved = incident.status === "resolved";
                return (
                  <article
                    key={incident.id}
                    className={`incident admin-incident severity-${incident.severity}`}
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
                        {incident.resolvedAt
                          ? ` · Resolved ${formatTimestamp(incident.resolvedAt)}`
                          : ""}
                      </p>
                    </div>

                    <ol className="incident-updates">
                      {incident.updates.map((update) => (
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

                    {resolved ? (
                      <p className="resolved-note">
                        This incident is closed. Open a new incident for a new problem.
                      </p>
                    ) : (
                      <form
                        className="update-form"
                        onSubmit={(event) => void submitUpdate(event, incident)}
                        noValidate
                      >
                        <h4>Post an update</h4>
                        <div className="update-grid">
                          <label className="field">
                            <span className="field-label">Status</span>
                            <select
                              value={updateState.status}
                              onChange={(event) =>
                                setUpdates((current) => ({
                                  ...current,
                                  [incident.id]: {
                                    ...updateState,
                                    status: event.target.value as IncidentStatus,
                                  },
                                }))
                              }
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field field-wide">
                            <span className="field-label">Update</span>
                            <textarea
                              value={updateState.body}
                              rows={3}
                              maxLength={2000}
                              required
                              placeholder="What changed since the last update?"
                              onChange={(event) =>
                                setUpdates((current) => ({
                                  ...current,
                                  [incident.id]: { ...updateState, body: event.target.value },
                                }))
                              }
                            />
                          </label>
                        </div>
                        {updateState.status === "resolved" ? (
                          <p className="form-warning">
                            Resolving closes this incident permanently and sets the resolved
                            time. Make sure the final update explains the resolution.
                          </p>
                        ) : null}
                        <div className="form-actions">
                          <button
                            type="submit"
                            className="button button-primary"
                            disabled={submittingId === incident.id}
                          >
                            {submittingId === incident.id ? "Publishing…" : "Publish update"}
                          </button>
                          {errors.form ? <FieldError message={errors.form} /> : null}
                          {errors.body ? <FieldError message={errors.body} /> : null}
                          {errors.status ? <FieldError message={errors.status} /> : null}
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
