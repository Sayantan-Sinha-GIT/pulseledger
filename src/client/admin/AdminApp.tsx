import { useEffect, useState } from "react";
import { ApiError, api, setCsrfToken } from "../api";
import { Link, navigate, usePathname } from "../router";
import type { AdminSessionResponse } from "../../shared/types";
import { LoginPage } from "./LoginPage";
import { OverviewPage } from "./OverviewPage";
import { MonitorsPage } from "./MonitorsPage";
import { IncidentsPage } from "./IncidentsPage";
import { AuditPage } from "./AuditPage";
import { LoadingBlock } from "./ui";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/monitors", label: "Monitors" },
  { href: "/admin/incidents", label: "Incidents" },
  { href: "/admin/audit", label: "Activity" },
];

export function AdminApp() {
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSessionResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .session()
      .then((next) => {
        if (!alive) return;
        setCsrfToken(next.csrfToken);
        setSession(next);
      })
      .catch(() => {
        if (alive) setSession(null);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });

    const onUnauthorized = () => {
      setCsrfToken(null);
      setSession(null);
    };
    window.addEventListener("pl:unauthorized", onUnauthorized);
    return () => {
      alive = false;
      window.removeEventListener("pl:unauthorized", onUnauthorized);
    };
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await api.logout();
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 401) {
        // A failed sign-out should still clear the local view.
        setCsrfToken(null);
      }
    } finally {
      setSession(null);
      setSigningOut(false);
      navigate("/admin", { replace: true });
    }
  };

  if (checking) {
    return (
      <div className="admin-shell telemetric-world">
        <main className="admin-main">
          <LoadingBlock label="Checking owner session" />
        </main>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onSignedIn={setSession} />;
  }

  let page = <OverviewPage />;
  if (pathname === "/admin/monitors") page = <MonitorsPage />;
  else if (pathname === "/admin/incidents") page = <IncidentsPage />;
  else if (pathname === "/admin/audit") page = <AuditPage />;
  else if (pathname !== "/admin" && pathname !== "/admin/") {
    page = <AdminNotFound />;
  }

  return (
    <div className="admin-shell telemetric-world">
      <a className="skip-link" href="#admin-main">
        Skip to owner content
      </a>
      <header className="admin-header">
        <div className="admin-header-top">
          <div className="admin-brand-wrap">
            <span className="brand-dot" aria-hidden="true" />
            <Link className="wordmark" href="/" aria-label="PulseLedger public status page">
              Pulse<span>Ledger</span>
            </Link>
          </div>
          <span className="admin-tag">
            <span className="admin-tag-pip" aria-hidden="true" />
            Owner desk
          </span>
          <div className="admin-account">
            <span className="admin-email">{session.email}</span>
            <a className="text-link" href="/">
              Public view
            </a>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => void signOut()}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
        <nav className="admin-nav" aria-label="Owner desk">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "admin-nav-link is-active" : "admin-nav-link"}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main id="admin-main" className="admin-main">
        {page}
      </main>

      <footer className="admin-footer">
        <div className="admin-footer-left">
          <span className="admin-footer-dot" aria-hidden="true" />
          <span>PulseLedger owner desk · Live Edge Telemetry</span>
        </div>
        <span className="mono">Session expires {new Date(session.expiresAt).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
      </footer>
    </div>
  );
}

function AdminNotFound() {
  return (
    <section className="admin-page">
      <p className="eyebrow">404</p>
      <h1>That owner page does not exist.</h1>
      <p>
        Return to the <Link href="/admin">overview</Link> to manage monitors and incidents.
      </p>
    </section>
  );
}
