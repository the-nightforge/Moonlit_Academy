import Fastify, { type FastifyInstance } from "fastify";
import { dataVersion } from "data";
import { createContext, HttpError, type AppDeps } from "./context";
import { registerAuthRoutes } from "./routes/auth";

/** The HTTP API (`16`); `deps` are injected so tests control the clock and randomness. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  const ctx = createContext(deps, dataVersion(deps.data));

  // Every request but the health check must run the same game data (`16` §2).
  app.addHook("onRequest", async (request) => {
    if (request.url === "/api/health") return;
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
  return app;
}
