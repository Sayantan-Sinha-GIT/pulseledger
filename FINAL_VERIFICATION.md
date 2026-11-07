# Final verification: PulseLedger 1.0.1

Verified on 6 November 2026. This is a complete web product for the scope in PRD.md.

## Repairs included

- Public incident records now expose severity, actual lifecycle status, affected service and timestamped updates using semantic articles. They remain readable independently of the decorative broadsheet scenes.
- The verification seal's SVG dash length now matches its real circumference, making the stroke visibly draw instead of appearing complete throughout the animation.
- Scroll-scene progress attributes now reflect the GSAP scene state instead of being overwritten by a second calculation. Reduced-motion content remains complete and readable.
- The owner-login wordmark and telemetry badge retain their intrinsic widths while wrapping. Responsive tests wait for fonts before measuring settled geometry.
- Incident tests no longer depend on a monitor being created by a different test.
- Production E2E cleanup removes only synthetic E2E records; it no longer deletes every owner session or resets production login protections.

## Executed checks

| Check | Result |
| --- | --- |
| TypeScript checks | App, Worker, tests and tooling passed |
| Backend unit/integration tests | 73 passed |
| D1 migration/aggregate verification | Backfill, insert idempotency, delete and cascade checks passed |
| Production build | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Desktop/mobile browser suite | 30 cases passed locally; 2 deliberately skipped duplicate mobile destructive flows |
| Live browser verification | Final full suite: 30 passed, 2 deliberately skipped duplicate mobile destructive flows. Covers owner sign-in/out, monitor CRUD/check/pause/resume/remove, incident open/update/resolve/public visibility, refresh/navigation/motion/typography, and settled responsive login layout |
| Live deployment | Worker and 15-minute cron deployed successfully; eleven portfolio monitors preserved |
| Data cost | Existing persisted public-status snapshot and read-budget migration retained; public polling does not rescan raw history |
| Secret scan | Tracked source passed; owner credentials and local variables remain ignored |

Synthetic remote records are removed after the live lifecycle tests. Genuine failures and slow responses from the monitored projects remain genuine history; they are not erased to make the page look healthy.

## Reproduce

`npm ci`, `npm run setup:local`, `npm run db:reset:local`, `npm run check`.
Then `npm run test:e2e` (or target individual `e2e/*.spec.ts` files).
For a live run, set `E2E_BASE_URL` and provide the existing ignored owner credentials.
Reference-fidelity tests honestly skip when the owner's private design is absent.

## Operational limits

- Single owner, maximum twelve monitors, 15-minute checks from Cloudflare's network.
- No email/SMS/webhook alerting and no team access; both are stated non-goals of this version.
- An HTTP check proves a configured URL's response, not login, checkout or other private flows in the monitored product.
- The RECOVERY folder in the owner's desktop copy includes a dated database export. The source and migrations do not reproduce the cloud account or Worker secret. Keep the live D1 database and Worker secret when redeploying this instance.
- Physical mobile devices were not tested; responsive browser emulation was used.
