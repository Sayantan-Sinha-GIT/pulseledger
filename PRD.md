# PulseLedger — Product Requirements

## Purpose

Build and deploy a production-quality uptime and incident dashboard for an independent developer or small team. It must be genuinely useful to this owner: monitor public endpoints for Haan and the owner's other deployed projects, make failures visible, and let the owner manage monitors and incidents. The final public GitHub repository should demonstrate thoughtful product design, secure full-stack engineering, automated checks, and a real live deployment. This PRD overrides PLAYBOOK.txt wherever they differ.

## Portfolio scope update (2026-11-01)

Monitor the publicly reachable websites and available health/version endpoints for Haan, StyleShopZ, CodeSense, Grepless, ArthaSetu, and Dispatch. Group endpoints by editable project label and show those groups on the public page. The CodeSense demo repository is a sample shop; its deployed review service is the monitored product. Each HTTP check proves only the response of that exact endpoint, not an entire application's user journey. Keep a 12-monitor cap, leaving one spare slot.

## Users and jobs

- A visitor needs to see whether the owner's services are operational, how they performed recently, and what happened during incidents.
- The owner needs to add/edit/pause/remove HTTPS monitors, see checks and latency, run a manual check, open/update/resolve an incident, and sign in safely.
- A developer reading the repository needs to understand the architecture, run it locally, test it, and deploy it without hidden source files.

## Stack and hosting

- Cloudflare Worker using TypeScript, with static React/Vite assets served by the same Worker and a Cloudflare D1 database.
- Cloudflare scheduled trigger every 15 minutes to check monitors. Stay within Workers Free plan limits; enforce a documented small maximum monitored services if needed.
- Public deployment at a new `*.workers.dev` URL. Use the owner's currently authenticated Wrangler account. Do not modify the existing Haan project or its deployment.
- GitHub repository under the authenticated `Sayantan-Sinha-GIT` account. Keep it private while building and testing; make it public only after the live system and secret scan pass.
- No paid services, external API keys, or framework-specific lock-in beyond the selected stack. Do not reuse Haan's provider keys.

## Functional requirements

### Public status page

- Responsive and distinctive interface with a useful overview, monitor health, last check times, latency trends, uptime percentages, and incident timeline. Use real data. No fake uptime or invented historical checks.
- Separate states for operational, degraded, down, paused, unknown, and incident-active. A new monitor is unknown until its first completed check.
- Show current incident details and updates, not merely a color badge.
- Auto-refresh with an accessible manual refresh and visible last-updated time. Handle API failure and empty data honestly.
- Any interactive diagnostic must identify whether it replays a stored check or makes a new request. Display only measured or persisted status, latency, source, timestamps, and errors. An illustrative waveform may interpolate real samples if labelled as illustrative; do not present random timing stages, locations, or hashes as observations.
- Accessible keyboard use, text contrast, small screens, reduced motion, semantic HTML, and no horizontal overflow.

### Monitoring

- Seed `https://haan-kolkata-pilot.pages.dev/` and `https://haan-api.srimantasutapa123.workers.dev/health`, then add the verified live portfolio endpoints. If one is unavailable, keep it but reflect actual state.
- Store each completed check with timestamp, HTTP status or network error category, duration, and outcome. A successful check requires a 2xx or 3xx status. Timeouts and failures are down.
- Set a bounded timeout and do not follow arbitrary redirects to non-HTTPS or private hosts. Validate monitor URLs to avoid SSRF and reject local/private IPs, credentials in URLs, and non-HTTPS schemes.
- Scheduled checks are idempotent enough to tolerate retries and overlap. Bound retention (e.g. 30 days) and document it. Manual check must use the same check logic and appear in history.
- Calculate uptime from actual stored checks, with insufficient-data copy when appropriate; do not count paused periods as failures.

### Owner area

- Private owner routes and UI under `/admin`, with login, logout, and session expiry. The owner login email is `srimantasutapa123@gmail.com`.
- Generate a unique strong owner password locally for this new product. Never commit it or print it in logs. Store it in an ignored local file. Store a slow password hash (not plaintext) as a Worker secret or protected binding. Use secure, HttpOnly, SameSite cookies, CSRF/origin protection, rate limiting for login, and authentication on every admin API route.
- Add/edit/pause/delete monitors with confirmation for destructive removal. Validate names, URLs, and expected status rules server-side. Prevent duplicate active URLs.
- View recent check logs and response times, with clear failure diagnostics. Allow a manual check.
- Open, update, and resolve incidents. Incident updates must have timestamps and visible status. Keep a basic audit trail of administrative actions.
- Provide good form validation and empty/loading/error states.

## Design direction

An editorial operations desk: precise, calm, human-readable, and trustworthy. Give actual checks and incidents visual prominence. Avoid stock dashboard clichés (a wall of same-sized cards, giant vanity numbers, glowing gradients, emoji icons). Distinct typography, useful data graphics, a restrained color system, and polished responsive behavior. Public page should be worthy of a portfolio screenshot. The admin interface should prioritize speed and clarity.

## Security and operations

- Never commit secrets, password hashes, tokens, database files, or `.dev.vars`. Provide `.dev.vars.example` and a setup guide that uses chat-friendly steps.
- Server-side input validation, prepared SQL, restrictive CORS (same origin), CSP and other appropriate security headers. No personal visitor data tracking or analytics required.
- Health endpoint for the PulseLedger Worker itself that does not expose secrets.
- D1 migrations with reproducible local and remote apply steps. Database indexes for queries used by the dashboard.
- Keep the free-tier D1 row-read budget viable as 30-day history grows: bound recent-history queries, maintain compact aggregates for uptime, use matching indexes, and serve public status from one persisted snapshot refreshed after scheduled checks and owner changes. Public polling must not repeatedly scan all checks. Verify query plans and provider usage after deployment.
- GitHub Actions CI for typecheck, tests, build, and dependency audit. Do not add a deployment job that needs a missing secret.
- README with architecture diagram, screenshots, live URL, setup, deployment and limitations. Add license and sensible gitignore.

## Verification and acceptance

- Automated tests cover status calculation, URL safety, authentication/session and CSRF behavior, incident lifecycle, and API responses. Meaningful tests, not snapshots of implementation.
- Run typecheck, unit/integration tests, production build, and an end-to-end browser test for desktop and mobile.
- Run a scheduled-trigger check locally, then check that the live deployment records fresh results from the portfolio monitors. Verify owner sign-in and at least one CRUD/incident flow live, then clean up test incidents/monitors.
- Audit the live UI on a desktop and mobile viewport, fix material issues, confirm once. Verify no secrets in git and no credentials in client bundle.
- Record actual test results and any remaining limitations in README. Do not claim a feature works without a live check.

## Build process

Read PLAYBOOK.txt through `END OF PLAYBOOK.TXT` for design guidance. Keep PROGRESS.md updated. Work autonomously through implementation, tests, debugging, and deployment. Ask the owner only if an account action or decision truly cannot be completed through already authenticated tools. Give the owner exactly one actionable step at a time if that occurs. Do not stop for routine plan reviews.
