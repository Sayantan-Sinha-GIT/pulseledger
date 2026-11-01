#!/usr/bin/env node
/** Removes local Wrangler D1 state and reapplies migrations for a clean run. */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
rmSync(resolve(root, ".wrangler/state/v3/d1"), { recursive: true, force: true });
rmSync(resolve(root, ".wrangler/state/v3/cache"), { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    resolve(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1",
    "migrations",
    "apply",
    "pulseledger-db",
    "--local",
  ],
  { cwd: root, stdio: "inherit" },
);
