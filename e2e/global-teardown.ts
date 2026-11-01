import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Local E2E runs clean up their own records; live runs are cleaned explicitly. */
export default function globalTeardown(): void {
  if (process.env.E2E_BASE_URL) return;
  try {
    execFileSync(
      process.execPath,
      [resolve(process.cwd(), "scripts/clean-e2e.mjs")],
      { stdio: "pipe" },
    );
  } catch {
    console.warn("E2E cleanup did not complete; run npm run clean:e2e manually.");
  }
}
