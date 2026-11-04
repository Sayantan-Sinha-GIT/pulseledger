-- Keep public status reads bounded as the 30-day check history grows.
CREATE TABLE daily_check_counts (
  monitor_id TEXT NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  up INTEGER NOT NULL DEFAULT 0 CHECK (up >= 0),
  down INTEGER NOT NULL DEFAULT 0 CHECK (down >= 0),
  PRIMARY KEY (monitor_id, day)
);

-- Backfill existing data before installing the write-through triggers.
INSERT INTO daily_check_counts (monitor_id, day, up, down)
SELECT monitor_id, substr(checked_at, 1, 10),
  SUM(CASE WHEN outcome = 'up' THEN 1 ELSE 0 END),
  SUM(CASE WHEN outcome = 'down' THEN 1 ELSE 0 END)
FROM checks GROUP BY monitor_id, substr(checked_at, 1, 10);

CREATE TRIGGER checks_daily_insert AFTER INSERT ON checks BEGIN
  INSERT INTO daily_check_counts (monitor_id, day, up, down)
  VALUES (NEW.monitor_id, substr(NEW.checked_at, 1, 10),
    CASE WHEN NEW.outcome = 'up' THEN 1 ELSE 0 END,
    CASE WHEN NEW.outcome = 'down' THEN 1 ELSE 0 END)
  ON CONFLICT(monitor_id, day) DO UPDATE SET
    up = up + excluded.up, down = down + excluded.down;
END;

CREATE TRIGGER checks_daily_delete AFTER DELETE ON checks BEGIN
  UPDATE daily_check_counts SET
    up = up - CASE WHEN OLD.outcome = 'up' THEN 1 ELSE 0 END,
    down = down - CASE WHEN OLD.outcome = 'down' THEN 1 ELSE 0 END
  WHERE monitor_id = OLD.monitor_id AND day = substr(OLD.checked_at, 1, 10);
  DELETE FROM daily_check_counts
  WHERE monitor_id = OLD.monitor_id AND day = substr(OLD.checked_at, 1, 10)
    AND up = 0 AND down = 0;
END;

-- Cron's retry lookup filters by slot alone; the existing unique key starts
-- with monitor_id and cannot serve that query efficiently.
CREATE INDEX idx_checks_slot_lookup ON checks (slot) WHERE slot IS NOT NULL;

-- Match the bounded recent-history query's complete ORDER BY, including
-- the tie-breaker. Otherwise SQLite sorts each monitor's whole history.
DROP INDEX idx_checks_monitor_time;
CREATE INDEX idx_checks_monitor_time ON checks (monitor_id, checked_at DESC, id DESC);

-- The public endpoint reads one prepared snapshot instead of re-running
-- multi-monitor aggregation on every visitor request. Cron and owner writes
-- rebuild this row after changing source data.
CREATE TABLE public_status_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  generated_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
