-- Seed the two Haan services. Both URLs returned HTTP 200 when this migration
-- was authored (2026-11-01), so the monitors start as "unknown" and become
-- operational only after a real completed check.
INSERT OR IGNORE INTO monitors (id, name, url, expected_status, paused, created_at, updated_at)
VALUES
  (
    'mon_haan_web',
    'Haan website',
    'https://haan-kolkata-pilot.pages.dev/',
    '2xx_3xx',
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),
  (
    'mon_haan_api',
    'Haan API health',
    'https://haan-api.srimantasutapa123.workers.dev/health',
    '200',
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  );
