# D1 read budget and recovery

## 4 November 2026 incident

Cloudflare blocked this account's D1 row reads after the 5,000,000-row daily free-tier limit was exhausted. Wrangler returned error `7500`; stored rows were not lost. The limit resets at 00:00 UTC. The affected database was `pulseledger-db` (`82814e6f-e3fe-420e-b7c0-1cf9df759f8e`).

`wrangler d1 insights --sort-type sum --sort-by reads --limit 20 --time-period 1d --json` identified three public-status queries as the cause. Their reported totals were approximately 8.23 million rows for a window-function recent-check query, 4.02 million for a daily-history grouping, and 1.85 million for a 30-day uptime grouping. The endpoint ran roughly 1,700 times in the observed day because visible status pages refreshed every minute and tests also used it. These figures are query-insight observations, not a claim that all rows were charged on one UTC billing day.

## Bounded query model

- `daily_check_counts` stores one row per monitor and UTC day. Migration `0004_read_budget.sql` backfills existing checks, then insert/delete triggers keep the counts exact. An ignored scheduled retry does not fire the insert trigger.
- The public endpoint fetches at most 120 recent checks per monitor using `(monitor_id, checked_at DESC, id DESC)`. The old window function scanned the entire 30-day history on every request.
- Rolling 24-hour, 7-day, and 30-day uptime sums use the daily summary for complete UTC days and an indexed raw-check scan for only the three partial boundary days. The 30-day chart uses the summary table.
- Cron's `slot = ?` lookup now has its own index; the previous `(monitor_id, slot)` index could not efficiently serve a query with no monitor ID.
- A visible page auto-refreshes every five minutes. The public response is cached for five minutes per Cloudflare edge location; a manual refresh requests an uncached snapshot. Production code tolerates a cache failure and falls back to D1.

At the 12-monitor cap and 15-minute checks, a cold status request reads no more than roughly 1,440 recent checks, 3,456 boundary-day checks, and 372 daily summaries, plus small monitor and incident lookups. This is a conservative bound based on retained rows and the query shape, not a measured production row-read total. One five-minute refresh stream would be roughly 1.5 million read rows per day before cache reuse. Multiple edge locations, manual refreshes, and admin traffic still count; inspect Cloudflare's real usage after deployment and adjust the design if it approaches the cap.

## Safe deployment order

1. Wait for the D1 limit to reset at 00:00 UTC. Do not deploy the Worker code first: it queries the new summary table.
2. Run `npm run db:migrate:remote` and confirm `0004_read_budget.sql` applied successfully.
3. Run `npm run check` and `npm run check:secrets`, then `npm run deploy`.
4. Fetch `/health`, `/api/status`, `/api/status?fresh=1`, and the public page. Confirm the response is based on stored checks. Compare two ordinary status responses for a cache hit, then check D1 Insights and account usage after representative traffic.
5. If deployment fails, retain the migration and deploy the previous Worker revision. The added summary table and triggers are compatible with the old code. Do not claim the incident resolved until the live queries and read-rate trend have been checked.

Local verification: 68 Vitest cases, a separate SQLite migration/backfill/trigger/query-plan test, typecheck, build, `npm audit`, secret scan, and 16 Playwright cases passed before production migration. Production application was blocked by D1 error `7500` on 4 November; the live result must be recorded after reset.
