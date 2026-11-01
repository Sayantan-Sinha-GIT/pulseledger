import { beforeAll, beforeEach } from "vitest";
import { applyD1Migrations, env } from "cloudflare:test";
import { resetDatabase } from "./helpers";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await resetDatabase();
});
