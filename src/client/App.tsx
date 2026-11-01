import { usePathname } from "./router";
import { StatusPage } from "./public/StatusPage";
import { AdminApp } from "./admin/AdminApp";
import { Link } from "./router";

export function App() {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <AdminApp />;
  }
  if (pathname === "/" || pathname === "") {
    return <StatusPage />;
  }
  return (
    <div className="public-shell">
      <header className="masthead">
        <Link className="wordmark" href="/">
          Pulse<span>Ledger</span>
        </Link>
      </header>
      <main id="main" className="section">
        <p className="eyebrow">404</p>
        <h1>That page is not on the desk.</h1>
        <p className="hero-lede">
          Return to the <Link href="/">public status page</Link> or sign in to the{" "}
          <Link href="/admin">owner desk</Link>.
        </p>
      </main>
    </div>
  );
}
