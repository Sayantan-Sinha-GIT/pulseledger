export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  OWNER_EMAIL: string;
  ADMIN_PASSWORD_HASH: string;
  ENVIRONMENT?: string;
}
