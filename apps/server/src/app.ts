import Fastify, { type FastifyInstance } from "fastify";
import { dataVersion } from "data";
import { createContext, HttpError, type AppDeps } from "./context";
import { registerRealtime } from "./realtime/socket";
import { registerAuthRoutes } from "./routes/auth";
import { registerGachaRoutes } from "./routes/gacha";
import { registerProfileRoutes } from "./routes/profile";
import { registerRunRoutes } from "./routes/runs";
import { registerShopRoutes } from "./routes/shop";

/** The HTTP API (`16`); `deps` are injected so tests control the clock and randomness. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  const ctx = createContext(deps, dataVersion(deps.data));

  // Every request but the health check must run the same game data (`16` §2).
  app.addHook("onRequest", async (request) => {
    // `/api/ws` authenticates via `hello` inside the socket, not headers (`16` §8.1).
    if (request.url === "/api/health" || request.url === "/api/ws") return;
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
  registerRealtime(app, ctx);
  return app;
}
