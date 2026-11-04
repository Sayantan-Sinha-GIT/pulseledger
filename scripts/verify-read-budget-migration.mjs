import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
db.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
db.prepare(`INSERT INTO monitors
  (id, name, url, expected_status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)`).run(
  "test-monitor", "Test", "https://example.com", "200",
  "2026-11-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z",
);

const insert = db.prepare(`INSERT INTO checks
  (monitor_id, checked_at, outcome, duration_ms, source, slot)
  VALUES (?, ?, ?, 100, 'scheduled', ?)`);
insert.run("test-monitor", "2026-11-01T01:00:00.000Z", "up", "slot-1");
insert.run("test-monitor", "2026-11-01T02:00:00.000Z", "down", "slot-2");

db.exec(readFileSync(new URL("../migrations/0004_read_budget.sql", import.meta.url), "utf8"));
const recentPlan = db.prepare(`EXPLAIN QUERY PLAN SELECT * FROM checks
  WHERE monitor_id = ? AND checked_at >= ?
  ORDER BY checked_at DESC, id DESC LIMIT 120`).all("test-monitor", "2026-10-01");
assert(recentPlan.some((step) => String(step.detail).includes("idx_checks_monitor_time")));
assert(recentPlan.every((step) => !String(step.detail).includes("TEMP B-TREE")));
const slotPlan = db.prepare("EXPLAIN QUERY PLAN SELECT monitor_id FROM checks WHERE slot = ?")
  .all("slot-1");
assert(slotPlan.some((step) => String(step.detail).includes("idx_checks_slot_lookup")));

const count = (day) => {
  const row = db.prepare(
    "SELECT up, down FROM daily_check_counts WHERE monitor_id = ? AND day = ?",
  ).get("test-monitor", day);
  return row ? { up: Number(row.up), down: Number(row.down) } : null;
};
assert.deepEqual(count("2026-11-01"), { up: 1, down: 1 }, "migration must backfill existing checks");

insert.run("test-monitor", "2026-11-01T03:00:00.000Z", "up", "slot-3");
assert.deepEqual(count("2026-11-01"), { up: 2, down: 1 }, "insert trigger must update counts");
db.prepare("INSERT OR IGNORE INTO checks (monitor_id, checked_at, outcome, duration_ms, source, slot) VALUES (?, ?, 'up', 100, 'scheduled', ?)")
  .run("test-monitor", "2026-11-01T03:00:00.000Z", "slot-3");
assert.deepEqual(count("2026-11-01"), { up: 2, down: 1 }, "ignored retry must not double-count");

db.prepare("DELETE FROM checks WHERE monitor_id = ? AND outcome = 'down'").run("test-monitor");
assert.deepEqual(count("2026-11-01"), { up: 2, down: 0 }, "delete trigger must update counts");
db.prepare("DELETE FROM monitors WHERE id = ?").run("test-monitor");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM daily_check_counts").get().n, 0);

db.close();
console.log("D1 migration backfill, idempotent insert, delete, and cascade checks passed.");
