-- PulseLedger schema: monitors, checks, incidents, owner sessions, audit trail.
-- All timestamps are ISO-8601 UTC strings so lexical ordering equals time ordering.

CREATE TABLE monitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  expected_status TEXT NOT NULL DEFAULT '2xx_3xx'
    CHECK (expected_status IN ('2xx_3xx', '2xx', '3xx', '200')),
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A URL may only be active once. Paused duplicates are permitted so an owner can
-- prepare a replacement monitor before resuming it.
CREATE UNIQUE INDEX idx_monitors_active_url ON monitors (url) WHERE paused = 0;

CREATE TABLE checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id TEXT NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
  checked_at TEXT NOT NULL,
  status_code INTEGER,
  outcome TEXT NOT NULL CHECK (outcome IN ('up', 'down')),
  error_category TEXT CHECK (
    error_category IS NULL OR error_category IN (
      'timeout', 'dns', 'tls', 'connection', 'http_status', 'invalid_url', 'unknown'
    )
  ),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  source TEXT NOT NULL DEFAULT 'scheduled' CHECK (source IN ('scheduled', 'manual')),
  -- 15-minute cron slot, NULL for manual checks. Used to make retried or
  -- overlapping scheduled runs idempotent.
  slot TEXT
);

CREATE INDEX idx_checks_monitor_time ON checks (monitor_id, checked_at DESC);
CREATE INDEX idx_checks_time ON checks (checked_at);
CREATE UNIQUE INDEX idx_checks_slot ON checks (monitor_id, slot) WHERE slot IS NOT NULL;

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  monitor_id TEXT REFERENCES monitors (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  status TEXT NOT NULL CHECK (
    status IN ('investigating', 'identified', 'monitoring', 'resolved')
  ),
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_incidents_status ON incidents (status, started_at DESC);
CREATE INDEX idx_incidents_started ON incidents (started_at DESC);

CREATE TABLE incident_updates (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN ('investigating', 'identified', 'monitoring', 'resolved')
  ),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_incident_updates_incident ON incident_updates (incident_id, created_at DESC);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  blocked_until TEXT
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_created ON audit_log (created_at DESC);

CREATE TABLE cron_runs (
  slot TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  monitors_checked INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0
);
