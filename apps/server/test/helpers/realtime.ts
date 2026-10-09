import type { WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import type { FakeScheduler, TestServer } from "../helpers";

/** Injected websocket with controllable heartbeats, raw messages and disconnections. */
export class Ws {
  readonly inbox: Record<string, unknown>[] = [];
  closeCode: number | null = null;
  private constructor(private readonly socket: WebSocket) {}

  static async connect(app: FastifyInstance, opts: { autoPong?: boolean } = {}): Promise<Ws> {
    await app.ready();
    const socket = await app.injectWS("/api/ws");
    const ws = new Ws(socket);
    const autoPong = opts.autoPong ?? true;
    socket.on("message", (raw: Buffer) => {
      const message = JSON.parse(raw.toString()) as Record<string, unknown>;
      ws.inbox.push(message);
      // A real client answers every heartbeat (`16` §8.1).
      if (autoPong && message.type === "ping") socket.send(JSON.stringify({ type: "pong" }));
    });
    socket.on("close", (code: number) => {
      ws.closeCode = code;
    });
    await ws.settle();
    return ws;
  }

  send(message: unknown): void {
    this.socket.send(typeof message === "string" ? message : JSON.stringify(message));
  }

  /** Abrupt disconnect: drops the socket like a lost network (`17` §5.5). */
  close(): void {
    this.socket.terminate();
  }

  /** Waits until the inbox stays quiet for three ticks — async handlers (DB) need several macrotasks. */
  async settle(): Promise<void> {
    let quiet = 0;
    let seen = -1;
    for (let i = 0; i < 100 && (quiet < 3 || i < 10); i++) {
      await new Promise((resolve) => setImmediate(resolve));
      quiet = this.inbox.length === seen ? quiet + 1 : 0;
      seen = this.inbox.length;
    }
  }

  /** Polls until `closeCode` is set (close frames travel several stream ticks). */
  async waitForClose(): Promise<void> {
    for (let i = 0; i < 100 && this.closeCode === null; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  last<T = Record<string, unknown>>(type: string): T | undefined {
    return [...this.inbox].reverse().find((m) => m.type === type) as T | undefined;
  }
}

export function schedulerOf(server: TestServer): FakeScheduler {
  return server.deps.scheduler as FakeScheduler;
}

export async function hello(server: TestServer, ws: Ws, token: string): Promise<void> {
  ws.send({ type: "hello", token, dataVersion: server.version });
  await ws.settle();
}
