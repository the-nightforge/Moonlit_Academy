import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { dataVersion, loadGameData } from "data";
import type { GameData, Loadout, RunAction, RunSetup, RunState } from "rules";
import { applyRunAction, createRun, getValidTargets, isCardPlayable, reachableNodeIds } from "rules";
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

/** Plays a run to the end with the simplest legal policy; returns the actions sent. */
export function playRun(data: GameData, setup: RunSetup, loadout?: Loadout): { run: RunState; actions: RunAction[] } {
  let run = createRun(data, setup, loadout).run;
  const actions: RunAction[] = [];
  while (run.status !== "won" && run.status !== "lost") {
    const action = botAction(data, run);
    const result = applyRunAction(data, run, action);
    if (!result.ok) throw new Error(result.error);
    actions.push(action);
    run = result.run;
  }
  return { run, actions };
}

function botAction(data: GameData, run: RunState): RunAction {
  switch (run.status) {
    case "map":
      return { type: "chooseNode", nodeId: reachableNodeIds(run)[0]! };
    case "combat": {
      const state = run.combat!;
      if (state.status === "mulligan") return { type: "combat", action: { type: "mulligan", instanceIds: [] } };
      if (state.status === "choosing") {
        return { type: "combat", action: { type: "chooseCard", instanceId: state.pendingChoice!.options[0]! } };
      }
      for (const instanceId of state.hand) {
        if (!isCardPlayable(data, state, instanceId)) continue;
        if (data.cards[state.cards[instanceId]!.cardId]!.target === "none") {
          return { type: "combat", action: { type: "playCard", instanceId } };
        }
        const targetId = getValidTargets(data, state, instanceId)[0];
        if (targetId !== undefined) return { type: "combat", action: { type: "playCard", instanceId, targetId } };
      }
      return { type: "combat", action: { type: "endTurn" } };
    }
    case "reward":
      return { type: "pickAugment", augmentId: run.pendingReward!.augmentChoices[0] ?? null };
    case "rest":
      return { type: "rest", choice: "heal" };
    case "treasure":
      return { type: "continue" };
    case "won":
    case "lost":
      throw new Error("run is over");
  }
}
