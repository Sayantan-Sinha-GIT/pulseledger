#!/usr/bin/env node
/**
 * Removes records created by the Playwright flows.
 * Local by default; pass --remote after live verification.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const remote = process.argv.includes("--remote");
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");

const sql = [
  "DELETE FROM audit_log WHERE detail LIKE '%[E2E]%'",
  "OR target_id IN (SELECT id FROM monitors WHERE name LIKE '[E2E]%')",
  "OR target_id IN (SELECT id FROM incidents WHERE title LIKE '[E2E]%');",
  "DELETE FROM checks WHERE monitor_id IN (SELECT id FROM monitors WHERE name LIKE '[E2E]%');",
  "DELETE FROM incident_updates WHERE incident_id IN (SELECT id FROM incidents WHERE title LIKE '[E2E]%');",
  "DELETE FROM incidents WHERE title LIKE '[E2E]%';",
  "DELETE FROM monitors WHERE name LIKE '[E2E]%';",
  "DELETE FROM sessions;",
  "DELETE FROM login_attempts;",
].join(" ");

execFileSync(
  process.execPath,
  [
    wrangler,
    "d1",
    "execute",
    "pulseledger-db",
    remote ? "--remote" : "--local",
    "--command",
    sql,
    "--yes",
  ],
  { cwd: root, stdio: "inherit" },
);

console.log(`Removed E2E records from the ${remote ? "remote" : "local"} database.`);
