import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { formatTimestamp, truncate } from "../format";
import type { AuditRow } from "../../shared/types";
import { EmptyState, LoadingBlock, Notice } from "./ui";

export function AuditPage() {
  const [entries, setEntries] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.audit();
      setEntries(data.entries);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The audit log is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="admin-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Activity</p>
          <h1>Who changed what.</h1>
          <p className="page-lede">
            Administrative actions, sign-ins, manual checks, and incident changes. Secrets and
            passwords are never written here.
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

      {loading && !entries ? <LoadingBlock label="Loading activity" /> : null}

      {entries ? (
        entries.length === 0 ? (
          <EmptyState title="No activity recorded yet.">
            Sign-ins and administrative changes will appear here.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data-table admin-table">
              <caption className="sr-only">Recent administrative activity</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{formatTimestamp(entry.created_at)}</td>
                    <td>{entry.actor}</td>
                    <td>
                      <span className="action-tag">{entry.action.replaceAll("_", " ")}</span>
                    </td>
                    <td className="mono">{entry.target_id ?? entry.target_type ?? "—"}</td>
                    <td className="detail-cell">
                      {entry.detail ? truncate(entry.detail, 140) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
