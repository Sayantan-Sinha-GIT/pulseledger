# Progress — PulseLedger

Last updated: 2026-11-01

## Decisions

- Stack: Cloudflare Worker (TypeScript) serving a React 19 + Vite SPA from Workers Static Assets, with D1. One Worker, one origin, no external APIs or paid services.
- Auth: single owner email + PBKDF2-SHA256 password hash (100,000 iterations, the Workers WebCrypto maximum) stored as a Worker secret (`ADMIN_PASSWORD_HASH`). Server-side D1 sessions with HttpOnly/SameSite=Strict cookies, hashed tokens, CSRF token bound to each session, Origin/Sec-Fetch-Site checks, and D1-backed login rate limiting.
- Checks: `fetch` with `redirect: "manual"`, 10 s AbortSignal timeout, HTTPS-only URL validation, 2xx/3xx success rules, one row per completed check, 15-minute cron slot dedupe, 30-day retention.
- Dev workflow: `npm run build` + `wrangler dev` (single origin, mirrors production). E2E via Playwright against the built Worker.
- Seeded monitors (verified live 2026-11-01: both returned HTTP 200):
  - https://haan-kolkata-pilot.pages.dev/
  - https://haan-api.srimantasutapa123.workers.dev/health
- Worker name `pulseledger`; D1 `pulseledger-db` (`82814e6f-e3fe-420e-b7c0-1cf9df759f8e`, APAC).
- Portfolio expansion: nine additional HTTP 200 endpoints across StyleShopZ, CodeSense, Grepless, ArthaSetu, and Dispatch, for 11 monitors in six project groups. HTTP checks establish only endpoint reachability; they cannot prove full application health. Same-zone StyleShopZ probes initially returned 404 and were corrected with Cloudflare's `global_fetch_strictly_public` compatibility flag; live manual checks then returned 200. Dispatch returned 200 slowly and is visibly degraded.

## Phases

1. Scaffold, shared domain logic (status, uptime, URL safety), D1 migrations — complete
2. Worker API: public status, auth/session/CSRF, monitor CRUD, manual checks, incidents, audit, cron — complete
3. Public status page and admin UI, responsive editorial design — complete
4. Tests (unit + integration + Playwright desktop/mobile), typecheck, build — complete
5. Local scheduled-trigger verification, secret scan, GitHub repository + CI — complete
6. Cloudflare D1 + Worker deployment, live public/admin verification, cleanup, README live URL — complete

## Publication check

- Live scheduled checks, owner workflows, responsive screenshots, and both GitHub CI runs verified.
- Final mobile owner overview uses readable service cards. The repository is public after the final CI and secret scan passed.

## Feature ledger

| ID | Behavior | Status | Evidence |
| --- | --- | --- | --- |
| P1 | Public overview with real checks, latency, uptime, incidents | done | Live local `/api/status`; Playwright public flow |
| P2 | Six distinct monitor states + incident-active | done | `deriveMonitorState`; state legend; Playwright label check |
| P3 | Auto-refresh, manual refresh, last-updated, API failure/empty states | done | 60 s interval + Refresh now + alert/last-snapshot copy; Playwright refresh test |
| P4 | Accessible responsive public page (keyboard, contrast, reduced motion, no overflow) | done | Skip link focus test; 390 px and 1440 px overflow checks; mobile detail-grid fix |
| M1 | Haan and portfolio monitors seeded | in verification | `migrations/0002_seed_monitors.sql`, `0003_portfolio_monitors.sql`; live scheduled results pending |
| M2 | Check storage (time, status/error, duration, outcome), 2xx/3xx success | done | `checks` schema; real 200 checks recorded locally |
| M3 | SSRF-safe HTTPS-only URL validation, bounded timeout, no redirect following | done | `src/shared/urlSafety.ts`; 10 s timeout; `redirect: "manual"` |
| M4 | Idempotent scheduled checks, 30-day retention, manual check same path | done | Slot unique index + skip logic; `pruneOldData`; shared `runCheck` |
| M5 | Uptime from stored checks with insufficient-data copy | done | `summarizeUptime`; "Provisional · N checks" UI |
| A1 | /admin login/logout/session expiry, owner email | done | D1 sessions, 12 h TTL; Playwright sign-in/out/reload |
| A2 | Strong generated password, PBKDF2 hash secret, ignored local credential file | done | `scripts/setup-local.mjs`; `.dev.vars` + `secrets/` ignored |
| A3 | HttpOnly/SameSite cookies, CSRF, origin checks, login rate limit | done | `src/worker/auth.ts`, `http.ts`; Vitest auth tests |
| A4 | Monitor CRUD with confirmation, server validation, duplicate active URL prevention | done | `MonitorsPage`; Playwright create/edit/pause/remove + cancel |
| A5 | Check logs, response times, failure diagnostics, manual check | done | Admin check log; manual source row verified in Playwright |
| A6 | Incident open/update/resolve with timestamps | done | `IncidentsPage`; Playwright open → monitoring → resolved → public |
| A7 | Audit trail of admin actions | done | `audit_log` + Activity page; Playwright checks actions |
| S1 | No secrets in git, .dev.vars.example, setup guide | done | Ignore rules; secret scan script; README setup |
| S2 | CSP + security headers, same-origin CORS, prepared SQL | done | `securityHeaders`; live local header check |
| S3 | Worker /health endpoint | done | Returns ok + D1 status locally |
| S4 | D1 migrations + indexes, reproducible local/remote apply | done | `0001_init.sql` through `0003_portfolio_monitors.sql`; reset script |
| S5 | GitHub Actions CI: typecheck, tests, build, audit | done | `.github/workflows/ci.yml` |
| S6 | README: architecture, screenshots, live URL, setup, deploy, limitations | done | README includes live URL and screenshots |
| V1 | Unit/integration tests for status, URL safety, auth/CSRF, incidents, APIs | done | 66/66 Vitest tests pass |
| V2 | Playwright E2E desktop + mobile | done | 8/8 desktop, 6/6 mobile (2 destructive mobile flows skipped) |
| V3 | Local scheduled-trigger run | done | `/cdn-cgi/local/scheduled` returned ok; both monitors recorded HTTP 200 |
| V4 | Live deployment, both monitors record fresh results | done | Live cron slot 2026-11-01T08:15Z: both monitors `scheduled`/`up`/HTTP 200 (59 ms, 61 ms) |
| V5 | Live owner sign-in + CRUD/incident flow, cleanup | done | Live Playwright flow passed; remote E2E rows removed |
| V6 | Live desktop/mobile UI audit, secret scan, repository push | done | Live screenshots reviewed; mobile owner cards; secret scan passed; CI verified |

## Blockers

- None.
