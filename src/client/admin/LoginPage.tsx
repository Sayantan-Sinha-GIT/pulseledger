import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api } from "../api";
import { navigate } from "../router";
import type { AdminSessionResponse } from "../../shared/types";

const OWNER_EMAIL = "srimantasutapa123@gmail.com";

export function LoginPage({
  onSignedIn,
}: {
  onSignedIn: (session: AdminSessionResponse) => void;
}) {
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api.login(email, password);
      setPassword("");
      onSignedIn(session);
      navigate("/admin", { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Sign-in failed. Check the connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <a className="skip-link" href="#login">
        Skip to sign in
      </a>
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="PulseLedger public status page">
          Pulse<span>Ledger</span>
        </a>
        <a className="owner-link" href="/">
          Public status
        </a>
      </header>

      <main id="login" className="login-main">
        <div className="login-intro">
          <p className="eyebrow">Owner desk</p>
          <h1>Sign in to the operations desk.</h1>
          <p className="hero-lede">
            Manage HTTPS monitors, read check history, and write the incident record.
            This area is private and excluded from search indexing.
          </p>
          <dl className="login-facts">
            <div>
              <dt>Owner</dt>
              <dd>{OWNER_EMAIL}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>12 hours, HttpOnly cookie</dd>
            </div>
            <div>
              <dt>Sign-in limit</dt>
              <dd>5 attempts per 15 minutes</dd>
            </div>
          </dl>
        </div>

        <form className="panel login-form" onSubmit={submit} noValidate>
          <h2>Owner sign in</h2>
          {error ? (
            <div className="notice notice-warning" role="alert">
              {error}
            </div>
          ) : null}

          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              spellCheck={false}
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
            />
          </label>

          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="form-note">
            The password was generated locally at setup. It is never stored in plain text
            on the server or in git.
          </p>
        </form>
      </main>

      <footer className="footer">
        <div>
          <p className="footer-wordmark">PulseLedger</p>
          <p className="footer-note">Owner access only. All times UTC.</p>
        </div>
        <div className="footer-links">
          <a href="/">Public status</a>
          <a href="/health">Worker health</a>
        </div>
      </footer>
    </div>
  );
}
