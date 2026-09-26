import fastifyWebsocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context";
import { RealtimeHub } from "./hub";

/**
 * `GET /api/ws` — the realtime endpoint (`16` §8.1). The `hello` handshake,
 * heartbeat, rate limit and message dispatch live in `RealtimeHub`.
 */
export function registerRealtime(app: FastifyInstance, ctx: AppContext): void {
  // ws-level payload cap sits above the app-level 16 KB check so an oversized
  // frame gets `error "bad message"` instead of an abrupt close.
  void app.register(fastifyWebsocket, { options: { maxPayload: 64 * 1024 } });
  const hub = new RealtimeHub(ctx);
  // Nested plugin so the route is declared after fastify-websocket's onRoute
  // hook is installed — otherwise the handler is treated as plain HTTP.
  void app.register(async (instance) => {
    instance.get("/api/ws", { websocket: true }, (socket) => hub.connect(socket));
  });
}
