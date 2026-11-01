import { handleApi } from "./api";
import { runScheduledChecks } from "./checks";
import type { Env } from "./env";
import { fail, securityHeaders, withHeaders } from "./http";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return fail("method_not_allowed", "Use GET for health checks.", 405);
      }
      return health(env);
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    return serveAsset(request, env, url);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runScheduledChecks(env, controller.scheduledTime).catch((error) => {
        console.error(
          "Scheduled run failed",
          error instanceof Error ? error.message : error,
        );
      }),
    );
  },
} satisfies ExportedHandler<Env>;

async function serveAsset(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return fail("method_not_allowed", "Use GET for this page.", 405);
  }

  const response = await env.ASSETS.fetch(request);
  const contentType = response.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");
  const headers = securityHeaders(isHtml);
  headers["x-robots-tag"] = url.pathname.startsWith("/admin")
    ? "noindex, nofollow"
    : "index, follow";
  if (isHtml) {
    headers["cache-control"] = "no-cache";
  }
  return withHeaders(response, headers);
}

async function health(env: Env): Promise<Response> {
  const time = new Date().toISOString();
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "pulseledger",
        database: "ok",
        time,
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "Health check database failure",
      error instanceof Error ? error.message : error,
    );
    return new Response(
      JSON.stringify({
        status: "degraded",
        service: "pulseledger",
        database: "error",
        time,
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }
}
