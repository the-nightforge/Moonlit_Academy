import Fastify, { type FastifyInstance } from "fastify";
import { dataVersion } from "data";
import { startBackups } from "./backup";
import { createContext, HttpError, type AppDeps } from "./context";
import { WS_CONNECT_LIMIT } from "./rate-limit";
import { registerRealtime } from "./realtime/socket";
import { registerArenaRoutes } from "./routes/arena";
import { registerAuthRoutes } from "./routes/auth";
import { registerCoopRoutes } from "./routes/coop";
import { registerGachaRoutes } from "./routes/gacha";
import { registerProfileRoutes } from "./routes/profile";
import { registerRunRoutes } from "./routes/runs";
import { registerShopRoutes } from "./routes/shop";

/** The HTTP API (`16`); `deps` are injected so tests control the clock and randomness. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const ctx = createContext(deps, dataVersion(deps.data));
  const app = Fastify({ logger: ctx.config.production, trustProxy: ctx.config.trustProxy });

  // CORS (cross-origin client hosting, e.g. Vercel → Render): the API answers
  // browser preflights and echoes `Access-Control-Allow-Origin` only for
  // origins in `allowedOrigins` (`16` §7.3). Same-origin dev has no list and
  // emits nothing.
  app.addHook("onSend", async (request, reply) => {
    const origin = request.headers.origin;
    if (typeof origin === "string" && ctx.config.allowedOrigins.includes(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("vary", "Origin");
    }
  });
  app.options("/*", async (_request, reply) =>
    reply
      .code(204)
      .header("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS")
      .header("access-control-allow-headers", "authorization,content-type,if-match,x-data-version")
      .header("access-control-max-age", "86400")
      .send(),
  );

  // Every request but the health check must run the same game data (`16` §2).
  app.addHook("onRequest", async (request) => {
    if (request.method === "OPTIONS") return; // CORS preflight — answered above
    // Production: a foreign `Origin` cannot mutate profiles or open a socket —
    // requests without `Origin` (curl, non-browser clients) pass (`16` §7.3).
    if (ctx.config.allowedOrigins.length > 0) {
      const origin = request.headers.origin;
      const guarded = request.method !== "GET" && request.method !== "HEAD" || request.url === "/api/ws";
      if (guarded && typeof origin === "string" && !ctx.config.allowedOrigins.includes(origin)) {
        throw new HttpError(403, "forbidden origin");
      }
    }
    if (request.url === "/api/health") return;
    if (request.url === "/api/ws") {
      // `/api/ws` authenticates via `hello` inside the socket, not headers (`16` §8.1).
      // Per-IP connect limit is a production gate (`16` §7.2).
      if (ctx.config.production && !ctx.limiter.allow(`ws:${request.ip}`, WS_CONNECT_LIMIT.limit, WS_CONNECT_LIMIT.windowMs)) {
        throw new HttpError(429, "rate limited");
      }
      return;
    }
    if (request.headers["x-data-version"] !== ctx.dataVersion) {
      throw new HttpError(409, "outdated client", { dataVersion: ctx.dataVersion });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: error.code, ...error.extra });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== undefined && status >= 400 && status < 500) {
      return reply.code(status).send({ error: "bad request" });
    }
    reply.log.error(error);
    return reply.code(500).send({ error: "internal error" });
  });

  app.get("/api/health", async () => ({ ok: true, dataVersion: ctx.dataVersion }));
  registerAuthRoutes(app, ctx);
  registerProfileRoutes(app, ctx);
  registerRunRoutes(app, ctx);
  registerGachaRoutes(app, ctx);
  registerShopRoutes(app, ctx);
  registerArenaRoutes(app, ctx);
  registerCoopRoutes(app, ctx);
  registerRealtime(app, ctx);
  startBackups(ctx);
  return app;
}
