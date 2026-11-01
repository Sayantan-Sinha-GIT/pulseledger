import { pbkdf2Sync, randomBytes } from "node:crypto";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

const migrations = await readD1Migrations("./migrations");

// Per-run test credential. It is generated in memory, never stored, and has no
// relationship to the production owner password.
const testPassword = randomBytes(18).toString("base64url");
const salt = randomBytes(16);
const hash = pbkdf2Sync(testPassword, salt, 100_000, 32, "sha256");
const testHash = `pbkdf2-sha256$100000$${salt.toString("base64")}$${hash.toString("base64")}`;

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          TEST_OWNER_PASSWORD: testPassword,
          ADMIN_PASSWORD_HASH: testHash,
          OWNER_EMAIL: "owner@example.com",
          ENVIRONMENT: "test",
        },
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
  },
});
