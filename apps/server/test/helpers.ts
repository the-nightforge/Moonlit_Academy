import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { dataVersion, loadGameData } from "data";
import type { Action, CombatState, GameData, Loadout, RunAction, RunSetup, RunState, StorySetup, StoryStageDef } from "rules";
import { applyAction, applyRunAction, autoChoiceAction, cardDefOf, chooseCombatAction, createRun, createStoryCombat, getValidTargets, isCardPlayable, reachableNodeIds, starterDeck } from "rules";
import { hashToken } from "../src/auth";
import { buildApp } from "../src/app";
import type { ServerConfig } from "../src/config";
import type { AppDeps } from "../src/context";
import { dbFromRunner, migrate, type Db, type SqlRunner } from "../src/db";
import type { Scheduler } from "../src/scheduler";
import { newDb } from "pg-mem";

export interface TestServer {
  app: FastifyInstance;
  db: Db;
  data: GameData;
  /** Current fake time (ms); tests move it forward. */
  now: { value: number };
  version: string;
  deps: AppDeps;
}

/**
 * pg-mem `createPg` client as a `SqlRunner`. Cross-call transactions aren't
 * supported by the adapter, so `begin` snapshots the whole database with
 * `mem.backup()` and restores on failure — sequential tests never interleave
 * transactions, and no transaction mutates the schema after migrations run.
 */
function memRunner(): SqlRunner {
  const mem = newDb();
  const client = new (mem.adapters.createPg().Client)();
  return {
    async unsafe(query, params = []) {
      const result = await client.query(query, params as unknown[]);
      const rows = result.rows as unknown[] & { count?: number };
      rows.count = result.rowCount ?? undefined;
      return rows;
    },
    async begin(fn) {
      const backup = mem.backup();
      try {
        return await fn(this);
      } catch (error) {
        backup.restore();
        throw error;
      }
    },
    end: () => client.end(),
  };
}

/** In-memory Postgres (pg-mem) migrated like production — replaces `:memory:` SQLite. */
export async function openTestDb(): Promise<Db> {
  const db = dbFromRunner(memRunner());
  await migrate(db);
  return db;
}

/** App on an in-memory database with a fake clock and deterministic "random" bytes. */
export async function testServer(config?: Partial<ServerConfig>): Promise<TestServer> {
  const data = loadGameData();
  const db = await openTestDb();
  const now = { value: Date.UTC(2026, 8, 27, 12) };
  let counter = 0;
  const random = (bytes: number) => {
    const out = Buffer.alloc(bytes);
    for (let offset = 0; offset < bytes; offset += 32) {
      createHash("sha256").update(`test-random-${counter++}`).digest().copy(out, offset);
    }
    return out;
  };
  const deps: AppDeps = { db, data, clock: () => now.value, random, scheduler: fakeScheduler(), config };
  const app = buildApp(deps);
  return { app, db, data, now, version: dataVersion(data), deps };
}

export interface FakeScheduler extends Scheduler {
  /** Moves the fake clock forward and fires every due task, in order. */
  advance(ms: number): void;
  pending(): number;
}

/** Deterministic timers for realtime tests (`16` §8.1). */
export function fakeScheduler(): FakeScheduler {
  let now = 0;
  let nextId = 1;
  const tasks: { id: number; at: number; fn: () => void }[] = [];
  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      tasks.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout(handle) {
      const index = tasks.findIndex((t) => t.id === handle);
      if (index >= 0) tasks.splice(index, 1);
    },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = tasks.filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        now = Math.max(now, due.at);
        tasks.splice(tasks.indexOf(due), 1);
        due.fn();
      }
      now = until;
    },
    pending: () => tasks.length,
  };
}

/** Writes a valid starter deck (18 cards, no gear) into the account's profile. */
export async function giveStarterDeck(server: TestServer, accountId: number, heroIds: [string, string, string]): Promise<void> {
  const row = (await server.db
    .prepare<[number], { profile_json: string }>("SELECT profile_json FROM profiles WHERE account_id = ?")
    .get(accountId))!;
  const profile = JSON.parse(row.profile_json) as { decks: unknown[] };
  profile.decks = [{ id: "d1", name: "Phòng", heroIds, cardIds: starterDeck(server.data, heroIds) }];
  await server.db.prepare("UPDATE profiles SET profile_json = ? WHERE account_id = ?").run(JSON.stringify(profile), accountId);
}

export async function call(
  server: TestServer,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  options: { body?: unknown; token?: string; rev?: number; version?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { "x-data-version": options.version ?? server.version, ...options.headers };
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

export async function accountIdOf(server: TestServer, token: string): Promise<number> {
  const row = await server.db
    .prepare<[string], { account_id: number }>("SELECT account_id FROM sessions WHERE token_hash = ?")
    .get(hashToken(token));
  if (!row) throw new Error("no session for token");
  return row.account_id;
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
        // The run action log stores combat actions without the `player` stamp.
        const { player: _seat, ...action } = autoChoiceAction(state, 0)! as Exclude<Action, { type: "forfeit" }>;
        return { type: "combat", action };
      }
      for (const instanceId of state.players[0]!.hand) {
        if (!isCardPlayable(data, state, instanceId)) continue;
        if (cardDefOf(data, state, state.cards[instanceId]!)!.target === "none") {
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

/** Two arcs × two stages on existing encounters (same shape as the rules helper `withTestStory`). */
export function withServerStory(server: TestServer): void {
  const stage = (id: string, arcId: string, encounterId: string): StoryStageDef => ({
    id, arcId, name: id, encounterId, before: [], after: [], firstClear: { moonJade: 40, darkIron: 1, masteryXp: 30 },
  });
  server.data.storyArcs = {
    t_arc1: { id: "t_arc1", name: "Arc 1", stageIds: ["t_a1s1", "t_a1s2"], rewardHeroId: "m10" },
    t_arc2: { id: "t_arc2", name: "Arc 2", stageIds: ["t_a2s1", "t_a2s2"], rewardHeroId: "f02" },
  };
  server.data.storyStages = {
    t_a1s1: stage("t_a1s1", "t_arc1", "enc_01"),
    t_a1s2: stage("t_a1s2", "t_arc1", "enc_02"),
    t_a2s1: stage("t_a2s1", "t_arc2", "enc_03"),
    t_a2s2: stage("t_a2s2", "t_arc2", "enc_01"),
  };
}

/** Plays a story combat to the end with the heuristic bot; returns the actions sent. */
export function playStory(data: GameData, setup: StorySetup, loadout?: Loadout): { state: CombatState; actions: Action[] } {
  let state = createStoryCombat(data, setup, loadout).state;
  const actions: Action[] = [];
  while (state.status !== "won" && state.status !== "lost") {
    const action = chooseCombatAction(data, state, 0);
    const result = applyAction(data, state, action);
    if (!result.ok) throw new Error(result.error);
    actions.push(action);
    state = result.state;
    if (actions.length > 2000) throw new Error("playStory: combat did not end");
  }
  return { state, actions };
}
