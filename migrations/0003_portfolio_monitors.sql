-- Project grouping keeps a growing public monitor list readable. Existing Haan
-- history stays attached to the same monitor IDs.
ALTER TABLE monitors ADD COLUMN project TEXT NOT NULL DEFAULT 'Other';
UPDATE monitors SET project = 'Haan' WHERE id IN ('mon_haan_web', 'mon_haan_api');

-- Each endpoint returned HTTP 200 on 2026-11-01. Availability is established
-- only by PulseLedger's subsequently recorded scheduled or manual checks.
INSERT OR IGNORE INTO monitors
  (id, name, project, url, expected_status, paused, created_at, updated_at)
VALUES
  ('mon_styleshopz_web', 'StyleShopZ website', 'StyleShopZ', 'https://styleshopz.srimantasutapa123.workers.dev/', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('mon_styleshopz_api', 'StyleShopZ API version', 'StyleShopZ', 'https://styleshopz.srimantasutapa123.workers.dev/api/version', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('mon_codesense_web', 'CodeSense website', 'CodeSense', 'https://pr-reviewer-omega-liard.vercel.app/', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('mon_codesense_api', 'CodeSense API health', 'CodeSense', 'https://pr-reviewer-omega-liard.vercel.app/api/health', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('mon_grepless_web', 'Grepless website', 'Grepless', 'https://grepless.vercel.app/', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('mon_grepless_api', 'Grepless API keep-alive', 'Grepless', 'https://grepless.vercel.app/api/keep-alive', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('mon_arthasetu_web', 'ArthaSetu website', 'ArthaSetu', 'https://arthasetu-sigma.vercel.app/', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('mon_arthasetu_api', 'ArthaSetu API health', 'ArthaSetu', 'https://arthasetu-sigma.vercel.app/api/health', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('mon_dispatch_web', 'Dispatch website', 'Dispatch', 'https://dispatch-delivery.vercel.app/', '200', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
