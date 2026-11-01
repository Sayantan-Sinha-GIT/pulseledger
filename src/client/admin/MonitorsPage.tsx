import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api } from "../api";
import { describeCheck, EXPECTED_STATUS_LABELS } from "../describe";
import {
  formatCount,
  formatDuration,
  formatPercent,
  formatRelative,
  formatShortTime,
  formatTimestamp,
  hostOf,
} from "../format";
import type { AdminMonitorView, CheckRow, ExpectedStatus } from "../../shared/types";
import { formatUptime, MAX_MONITORS } from "../../shared/status";
import { ConfirmDialog, FieldError, LoadingBlock, Notice } from "./ui";

interface MonitorFormState {
  name: string;
  project: string;
  url: string;
  expectedStatus: ExpectedStatus;
}

const EMPTY_FORM: MonitorFormState = {
  name: "",
  project: "",
  url: "",
  expectedStatus: "2xx_3xx",
};

export function MonitorsPage() {
  const [monitors, setMonitors] = useState<AdminMonitorView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState<MonitorFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MonitorFormState>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, CheckRow[]>>({});
  const [checksLoading, setChecksLoading] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminMonitorView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await api.monitors();
      setMonitors(data.monitors);
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

  const createMonitor = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setFormErrors({});
    try {
      await api.createMonitor({
        name: form.name,
        project: form.project,
        url: form.url,
        expectedStatus: form.expectedStatus,
      });
      setForm(EMPTY_FORM);
      setToast("Monitor added. Its first check will arrive on the next run or when you check now.");
      await load(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFormErrors(
          Object.keys(caught.fields).length > 0 ? caught.fields : { form: caught.message },
        );
      } else {
        setFormErrors({ form: "The monitor could not be created." });
      }
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (monitor: AdminMonitorView) => {
    setEditingId(monitor.id);
    setEditErrors({});
    setEditForm({
      name: monitor.name,
      project: monitor.project,
      url: monitor.url,
      expectedStatus: monitor.expectedStatus,
    });
  };

  const saveEdit = async (event: FormEvent, id: string) => {
    event.preventDefault();
    setSavingEdit(true);
    setEditErrors({});
    try {
      await api.updateMonitor(id, editForm);
      setEditingId(null);
      setToast("Monitor updated.");
      await load(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setEditErrors(
          Object.keys(caught.fields).length > 0 ? caught.fields : { form: caught.message },
        );
      } else {
        setEditErrors({ form: "The monitor could not be updated." });
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const togglePause = async (monitor: AdminMonitorView) => {
    try {
      await api.updateMonitor(monitor.id, { paused: !monitor.paused });
      setToast(monitor.paused ? `${monitor.name} resumed.` : `${monitor.name} paused.`);
      await load(true);
    } catch (caught) {
      setToast(caught instanceof ApiError ? caught.message : "Could not change the monitor.");
    }
  };

  const runManualCheck = async (monitor: AdminMonitorView) => {
    setCheckingId(monitor.id);
    try {
      const result = await api.checkMonitor(monitor.id);
      setToast(
        `${monitor.name}: ${result.check.outcome} · ${describeCheck(
          result.check,
        )} · ${formatDuration(result.check.duration_ms)}`,
      );
      setChecks((current) => {
        const next = { ...current };
        delete next[monitor.id];
        return next;
      });
      if (expandedId === monitor.id) {
        setChecksLoading(monitor.id);
        const data = await api.checks(monitor.id, 50);
        setChecks((current) => ({ ...current, [monitor.id]: data.checks }));
        setChecksLoading(null);
      }
      await load(true);
    } catch (caught) {
      setToast(caught instanceof ApiError ? caught.message : "The manual check failed.");
    } finally {
      setCheckingId(null);
    }
  };

  const toggleChecks = async (monitor: AdminMonitorView) => {
    if (expandedId === monitor.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(monitor.id);
    if (checks[monitor.id]) return;
    setChecksLoading(monitor.id);
    try {
      const data = await api.checks(monitor.id, 50);
      setChecks((current) => ({ ...current, [monitor.id]: data.checks }));
    } catch (caught) {
      setToast(caught instanceof ApiError ? caught.message : "Check history is unavailable.");
    } finally {
      setChecksLoading(null);
    }
  };

  const removeMonitor = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteMonitor(deleteTarget.id);
      setToast(`${deleteTarget.name} removed.`);
      setDeleteTarget(null);
      if (expandedId === deleteTarget.id) setExpandedId(null);
      await load(true);
    } catch (caught) {
      setToast(caught instanceof ApiError ? caught.message : "The monitor could not be removed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Monitors</p>
          <h1>Decide what gets checked.</h1>
          <p className="page-lede">
            HTTPS only, one active monitor per URL. Each monitor uses the same check path
            for scheduled and manual runs, so the history stays honest.
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

      <section className="panel" aria-labelledby="add-monitor">
        <div className="panel-head">
          <div>
            <p className="section-kicker">New monitor</p>
            <h2 id="add-monitor">Add an HTTPS service</h2>
          </div>
          <p className="panel-note">
            Maximum {MAX_MONITORS} monitors. First state is unknown until a check completes.
          </p>
        </div>
        <form className="form-grid" onSubmit={createMonitor} noValidate>
          <label className="field">
            <span className="field-label">Project</span>
            <input type="text" value={form.project} maxLength={40} required
              onChange={(event) => setForm({ ...form, project: event.target.value })}
              placeholder="CodeSense" aria-invalid={Boolean(formErrors.project)} />
            <FieldError message={formErrors.project} />
          </label>
          <label className="field">
            <span className="field-label">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={60}
              required
              placeholder="Haan website"
              aria-invalid={Boolean(formErrors.name)}
              aria-describedby={formErrors.name ? "create-name-error" : undefined}
            />
            <span id="create-name-error">
              <FieldError message={formErrors.name} />
            </span>
          </label>
          <label className="field field-wide">
            <span className="field-label">URL</span>
            <input
              type="url"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              maxLength={2048}
              required
              placeholder="https://example.com/health"
              spellCheck={false}
              aria-invalid={Boolean(formErrors.url)}
              aria-describedby={formErrors.url ? "create-url-error" : undefined}
            />
            <span id="create-url-error">
              <FieldError message={formErrors.url} />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Success rule</span>
            <select
              value={form.expectedStatus}
              onChange={(event) =>
                setForm({ ...form, expectedStatus: event.target.value as ExpectedStatus })
              }
            >
              {Object.entries(EXPECTED_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions field-wide">
            <button type="submit" className="button button-primary" disabled={creating}>
              {creating ? "Adding…" : "Add monitor"}
            </button>
            {formErrors.form ? <FieldError message={formErrors.form} /> : null}
          </div>
        </form>
      </section>

      {loading && !monitors ? <LoadingBlock label="Loading monitors" /> : null}

      {monitors ? (
        <section className="admin-section" aria-labelledby="monitor-list">
          <div className="section-head compact">
            <div>
              <p className="section-kicker">All monitors</p>
              <h2 id="monitor-list">
                {monitors.length} service{monitors.length === 1 ? "" : "s"}
              </h2>
            </div>
          </div>

          {monitors.length === 0 ? (
            <div className="empty-state">
              <h3>No monitors yet.</h3>
              <p>Add the first service above. Nothing is invented before a real check.</p>
            </div>
          ) : (
            <div className="monitor-list">
              {monitors.map((monitor) => (
                <article key={monitor.id} className={`monitor-card state-edge-${monitor.state}`}>
                  <div className="monitor-card-head">
                    <div className="monitor-card-identity">
                      <span className={`state state-${monitor.state}`}>
                        <span className="state-mark" aria-hidden="true" />
                        {monitor.state}
                      </span>
                      <h3>{monitor.name}</h3>
                      <span className="rule-note">{monitor.project}</span>
                      <a
                        className="service-url"
                        href={monitor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {hostOf(monitor.url)}
                      </a>
                      <span className="rule-note">
                        {EXPECTED_STATUS_LABELS[monitor.expectedStatus]}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => void runManualCheck(monitor)}
                        disabled={checkingId === monitor.id}
                      >
                        {checkingId === monitor.id ? "Checking…" : "Check now"}
                      </button>
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => void togglePause(monitor)}
                      >
                        {monitor.paused ? "Resume" : "Pause"}
                      </button>
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => startEdit(monitor)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button-small button-danger-quiet"
                        onClick={() => setDeleteTarget(monitor)}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="button button-small"
                        aria-expanded={expandedId === monitor.id}
                        onClick={() => void toggleChecks(monitor)}
                      >
                        {expandedId === monitor.id ? "Hide log" : "Check log"}
                      </button>
                    </div>
                  </div>

                  <dl className="monitor-meta">
                    <div>
                      <dt>Last check</dt>
                      <dd>
                        {monitor.lastCheck
                          ? `${formatRelative(monitor.lastCheck.checked_at)} · ${describeCheck(
                              monitor.lastCheck,
                            )}`
                          : "No completed check yet"}
                      </dd>
                    </div>
                    <div>
                      <dt>Uptime 24h</dt>
                      <dd>{formatUptime(monitor.uptime.h24)}</dd>
                    </div>
                    <div>
                      <dt>p95 latency</dt>
                      <dd>{formatDuration(monitor.latency.p95)}</dd>
                    </div>
                    <div>
                      <dt>24h checks</dt>
                      <dd>
                        {formatCount(monitor.checks24h)} total ·{" "}
                        <span className={monitor.failures24h > 0 ? "value-down" : undefined}>
                          {formatCount(monitor.failures24h)} failed
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Uptime 30d</dt>
                      <dd>{formatUptime(monitor.uptime.d30)}</dd>
                    </div>
                    <div>
                      <dt>Success rate, 24h</dt>
                      <dd>
                        {monitor.uptime.h24.percent === null
                          ? "—"
                          : formatPercent(monitor.uptime.h24.percent)}
                      </dd>
                    </div>
                  </dl>

                  {editingId === monitor.id ? (
                    <form
                      className="inline-edit"
                      onSubmit={(event) => void saveEdit(event, monitor.id)}
                      noValidate
                    >
                      <h4>Edit monitor</h4>
                      <div className="form-grid">
                        <label className="field">
                          <span className="field-label">Project</span>
                          <input type="text" value={editForm.project} maxLength={40}
                            onChange={(event) => setEditForm({ ...editForm, project: event.target.value })}
                            aria-invalid={Boolean(editErrors.project)} />
                          <FieldError message={editErrors.project} />
                        </label>
                        <label className="field">
                          <span className="field-label">Name</span>
                          <input
                            type="text"
                            value={editForm.name}
                            maxLength={60}
                            onChange={(event) =>
                              setEditForm({ ...editForm, name: event.target.value })
                            }
                            aria-invalid={Boolean(editErrors.name)}
                          />
                          <FieldError message={editErrors.name} />
                        </label>
                        <label className="field field-wide">
                          <span className="field-label">URL</span>
                          <input
                            type="url"
                            value={editForm.url}
                            maxLength={2048}
                            spellCheck={false}
                            onChange={(event) =>
                              setEditForm({ ...editForm, url: event.target.value })
                            }
                            aria-invalid={Boolean(editErrors.url)}
                          />
                          <FieldError message={editErrors.url} />
                        </label>
                        <label className="field">
                          <span className="field-label">Success rule</span>
                          <select
                            value={editForm.expectedStatus}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                expectedStatus: event.target.value as ExpectedStatus,
                              })
                            }
                          >
                            {Object.entries(EXPECTED_STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="form-actions field-wide">
                          <button type="submit" className="button button-primary" disabled={savingEdit}>
                            {savingEdit ? "Saving…" : "Save changes"}
                          </button>
                          <button
                            type="button"
                            className="button"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                          {editErrors.form ? <FieldError message={editErrors.form} /> : null}
                        </div>
                      </div>
                    </form>
                  ) : null}

                  {expandedId === monitor.id ? (
                    <div className="check-log">
                      <h4>Recent checks</h4>
                      {checksLoading === monitor.id ? (
                        <p className="muted">Loading check history…</p>
                      ) : checks[monitor.id]?.length ? (
                        <div className="table-scroll">
                          <table className="data-table compact">
                            <caption className="sr-only">
                              Recent checks for {monitor.name}
                            </caption>
                            <thead>
                              <tr>
                                <th scope="col">Time</th>
                                <th scope="col">Source</th>
                                <th scope="col">Result</th>
                                <th scope="col">Response</th>
                                <th scope="col">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {checks[monitor.id].map((check) => (
                                <tr key={check.id}>
                                  <td className="mono" title={formatTimestamp(check.checked_at)}>
                                    {formatShortTime(check.checked_at)}
                                  </td>
                                  <td>{check.source}</td>
                                  <td>
                                    <span className={`result result-${check.outcome}`}>
                                      {check.outcome}
                                    </span>
                                  </td>
                                  <td>{describeCheck(check)}</td>
                                  <td className="mono">{formatDuration(check.duration_ms)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="muted">No checks recorded for this monitor yet.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget ? `Remove ${deleteTarget.name}?` : "Remove monitor?"}
        description={
          <>
            <p>
              This deletes the monitor, its stored checks, and its uptime history. Incidents
              remain in the record but are no longer linked to a monitor.
            </p>
            <p>This cannot be undone.</p>
          </>
        }
        confirmLabel="Remove monitor"
        busy={deleting}
        onConfirm={() => void removeMonitor()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
