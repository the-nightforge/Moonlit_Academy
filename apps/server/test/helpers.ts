import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { dataVersion, loadGameData } from "data";
import type { GameData } from "rules";
import { buildApp } from "../src/app";
import type { AppDeps } from "../src/context";
import { openDb, type Db } from "../src/db";

export interface TestServer {
  app: FastifyInstance;
  db: Db;
  data: GameData;
  /** Current fake time (ms); tests move it forward. */
  now: { value: number };
  version: string;
  deps: AppDeps;
}

/** App on an in-memory database with a fake clock and deterministic "random" bytes. */
export function testServer(): TestServer {
  const data = loadGameData();
  const db = openDb(":memory:");
  const now = { value: Date.UTC(2026, 8, 27, 12) };
  let counter = 0;
  const random = (bytes: number) => {
    const out = Buffer.alloc(bytes);
    for (let offset = 0; offset < bytes; offset += 32) {
      createHash("sha256").update(`test-random-${counter++}`).digest().copy(out, offset);
    }
    return out;
  };
  const deps: AppDeps = { db, data, clock: () => now.value, random };
  const app = buildApp(deps);
  return { app, db, data, now, version: dataVersion(data), deps };
}

export async function call(
  server: TestServer,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  options: { body?: unknown; token?: string; rev?: number; version?: string } = {},
) {
  const headers: Record<string, string> = { "x-data-version": options.version ?? server.version };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.rev !== undefined) headers["if-match"] = String(options.rev);
  const response = await server.app.inject({
    method, url, headers, ...(options.body !== undefined ? { payload: options.body as object } : {}),
  });
  return { status: response.statusCode, body: response.body ? response.json() : undefined };
}

export async function register(server: TestServer, username = "linh_lung", password = "trang-sang-8") {
  const response = await call(server, "POST", "/api/auth/register", { body: { username, password } });
  return response.body as { token: string; profile: unknown; rev: number };
}
