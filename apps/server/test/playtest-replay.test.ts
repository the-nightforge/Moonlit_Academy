import { describe, expect, it } from "vitest";
import type { Action } from "rules";
import { captureValidatedReplay } from "../src/playtest/replay-capture";
import { exportTesterReplays, pseudonym } from "../src/playtest/export";
import { accountIdOf, call, giveStarterDeck, playRun, playStory, register, testServer, withServerStory } from "./helpers";

const cohort = { groupId: "pilot", salt: "test-salt" };
const starter = { deckId: "starter" as const, heroIds: ["m05", "f04", "m06"] as [string, string, string] };

type Db = Awaited<ReturnType<typeof testServer>>["db"];

/** Inserts a finished + an incomplete + a wrong-version match with two seats. */
async function seedMatches(db: Db, a1: number, a2: number, dataVersion: string) {
  const insertMatch = db.prepare(
    "INSERT INTO matches (id, mode, data_version, seed, setup_json, actions_json, status, result_json, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPlayer = db.prepare("INSERT INTO match_players (match_id, account_id, slot, result) VALUES (?, ?, ?, ?)");
  const actions = JSON.stringify([
    { player: 0, action: { type: "mulligan", instanceIds: [] } },
    { player: 1, action: { type: "mulligan", instanceIds: [] } },
    { player: 0, action: { type: "playCard", instanceId: "p0_c1" } },
    { player: 0, action: { type: "endTurn" } },
    { player: 1, action: { type: "endTurn" } },
  ]);
  const setup = JSON.stringify({ seed: 7 });
  await insertMatch.run("m_done", "ranked", dataVersion, 7, setup, actions, "finished",
    JSON.stringify({ winner: 0, reason: "combat", rounds: 9 }), 100, 200);
  await insertPlayer.run("m_done", a1, 0, "won");
  await insertPlayer.run("m_done", a2, 1, "lost");
  await insertMatch.run("m_open", "ranked", dataVersion, 8, setup, "[]", "playing", null, 110, null);
  await insertPlayer.run("m_open", a1, 0, null);
  await insertPlayer.run("m_open", a2, 1, null);
  await insertMatch.run("m_old", "ranked", "v_old", 9, setup, actions, "finished",
    JSON.stringify({ winner: 1, reason: "resign", rounds: 4 }), 120, 300);
  await insertPlayer.run("m_old", a1, 0, "lost");
  await insertPlayer.run("m_old", a2, 1, "won");
  // A disconnect finish: the last entry is a system-substituted forfeit.
  const dropout = JSON.stringify([
    { player: 0, action: { type: "mulligan", instanceIds: [] } },
    { player: 1, action: { type: "mulligan", instanceIds: [] } },
    { player: 1, action: { type: "forfeit", player: 1, reason: "disconnect", system: true } },
  ]);
  await insertMatch.run("m_drop", "ranked", dataVersion, 10, setup, dropout, "finished",
    JSON.stringify({ winner: 0, reason: "disconnect", rounds: 2 }), 130, 400);
  await insertPlayer.run("m_drop", a1, 0, "won");
  await insertPlayer.run("m_drop", a2, 1, "lost");
}

describe("playtest replay export", () => {
  it("reconstructs completed PvP order, seats and pseudonyms; counts rejects", async () => {
    const server = await testServer();
    const { token: t1 } = await register(server, "tester_mot", "trang-sang-8");
    const { token: t2 } = await register(server, "tester_hai", "trang-sang-8");
    const a1 = await accountIdOf(server, t1);
    const a2 = await accountIdOf(server, t2);
    await seedMatches(server.db, a1, a2, server.version);

    const { replays, quality } = await exportTesterReplays(server.db, cohort, server.version);
    expect(replays).toHaveLength(2);
    const replay = replays[0]!;
    expect(replay.id).toBe("match:m_done");
    expect(replay.mode).toBe("pvp");
    expect(replay.termination).toBe("combat");
    expect(replay.humanSeats).toEqual([0, 1]);
    expect(replay.participantIds).toEqual([pseudonym("test-salt", a1), pseudonym("test-salt", a2)]);
    for (const id of replay.participantIds) {
      expect(id.startsWith("pt_")).toBe(true);
      expect(id).not.toContain("tester");
    }
    // No usernames or credential-shaped fields anywhere in the export.
    expect(JSON.stringify(replay)).not.toMatch(/tester_mot|tester_hai|password|token/i);
    // Accepted action order is exactly the stored log.
    expect(replay.actions.map((a) => a.type)).toEqual(["mulligan", "mulligan", "playCard", "endTurn", "endTurn"]);
    expect(replay.actionSources).toEqual(["human", "human", "human", "human", "human"]);
    // Wrong-version + incomplete counted, not exported.
    expect(quality).toEqual({ exported: 2, versionRejected: 1, incomplete: 1 });

    // The dropout match keeps its outcome stratum but marks the system action.
    const dropped = replays[1]!;
    expect(dropped.id).toBe("match:m_drop");
    expect(dropped.termination).toBe("disconnect");
    expect(dropped.actionSources).toEqual(["human", "human", "system"]);
  });

  it("a stored replay row is immutable across exports and version changes", async () => {
    const server = await testServer({ playtestReplayCapture: true });
    const { token } = await register(server);
    const accountId = await accountIdOf(server, token);
    const stored = await captureValidatedReplay(server.db, "run", accountId, {
      schemaVersion: 1, id: "run:immut", groupId: "pilot",
      participantIds: [`acct:${accountId}`], humanSeats: [0], skillLabels: [],
      mode: "run", dataHash: "v_a", engineHash: "e_a",
      setup: { seed: 1 }, actions: [{ type: "endTurn" }] as Action[],
      actionSources: ["human"], result: "won", termination: "combat",
    }, 0);
    expect(stored.quality).toBe("accepted");
    const before = (await server.db
      .prepare("SELECT replay_json FROM playtest_replays WHERE id = ?")
      .get("run:immut")) as { replay_json: string };

    // A later "upgrade" only changes which exports accept it — never the bytes.
    const { quality } = await exportTesterReplays(server.db, cohort, "v_b");
    expect(quality.versionRejected).toBe(1);
    const { replays } = await exportTesterReplays(server.db, cohort, "v_a");
    expect(replays).toHaveLength(1);
    const after = (await server.db
      .prepare("SELECT replay_json FROM playtest_replays WHERE id = ?")
      .get("run:immut")) as { replay_json: string };
    expect(after.replay_json).toBe(before.replay_json);
  });

  it("excludes bot seats from human action-fit but keeps them as participants", async () => {
    const server = await testServer();
    const { token } = await register(server);
    const a1 = await accountIdOf(server, token);
    const insertMatch = server.db.prepare(
      "INSERT INTO matches (id, mode, data_version, seed, setup_json, actions_json, status, result_json, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const insertPlayer = server.db.prepare("INSERT INTO match_players (match_id, account_id, slot, result) VALUES (?, ?, ?, ?)");
    await insertMatch.run("m_bot", "practice", server.version, 1, "{}", JSON.stringify([
      { player: 0, action: { type: "endTurn" } },
      { player: 1, action: { type: "endTurn" } },
    ]), "finished", JSON.stringify({ winner: 0, reason: "combat" }), 100, 200);
    await insertPlayer.run("m_bot", a1, 0, "won");
    await insertPlayer.run("m_bot", null, 1, "lost"); // bot seat

    const { replays } = await exportTesterReplays(server.db, cohort, server.version);
    expect(replays).toHaveLength(1);
    const replay = replays[0]!;
    expect(replay.humanSeats).toEqual([0]);
    expect(replay.participantIds[1]).toBe("bot");
    expect(replay.actionSources).toEqual(["human", "system"]);
  });
});

describe("playtest replay capture", () => {
  const finishFirstRun = async (server: Awaited<ReturnType<typeof testServer>>, token: string) => {
    const accountId = await accountIdOf(server, token);
    await giveStarterDeck(server, accountId, ["m05", "f04", "m06"]);
    const created = await call(server, "POST", "/api/runs", { token, body: starter });
    expect(created.status).toBe(201);
    const { run, actions } = playRun(server.data, created.body.setup);
    expect(["won", "lost"]).toContain(run.status);
    const finished = await call(server, "POST", `/api/runs/${created.body.runId}/finish`, { token, rev: 1, body: { actions } });
    return { accountId, created, finished };
  };

  it("captures a validated run when the flag is on; flag off writes nothing", async () => {
    const on = await testServer({ playtestReplayCapture: true });
    const { token } = await register(on);
    const { finished } = await finishFirstRun(on, token);
    expect(finished.status).toBe(200);
    const rows = await on.db.prepare("SELECT * FROM playtest_replays").all();
    expect(rows).toHaveLength(1);
    const row = rows[0] as { quality: string; mode: string; replay_json: string };
    expect(row.quality).toBe("accepted");
    expect(row.mode).toBe("run");
    const stored = JSON.parse(row.replay_json) as { actions: unknown[]; humanSeats: number[] };
    expect(stored.humanSeats).toEqual([0]);
    expect(stored.actions.length).toBeGreaterThan(0);

    const off = await testServer();
    const { token: t2 } = await register(off);
    await finishFirstRun(off, t2);
    expect(await off.db.prepare("SELECT * FROM playtest_replays").all()).toHaveLength(0);
  });

  it("failed validation stores a rejected row but no accepted replay", async () => {
    const server = await testServer();
    const { token } = await register(server);
    const accountId = await accountIdOf(server, token);
    const bad = await captureValidatedReplay(server.db, "run", accountId, {
      schemaVersion: 1, id: "run:bad", groupId: "pilot",
      participantIds: [`acct:${accountId}`], humanSeats: [0], skillLabels: [],
      mode: "run", dataHash: "d", engineHash: "e",
      setup: {}, actions: [], actionSources: [],
      result: "won", termination: "combat",
    }, 0);
    expect(bad.quality).toBe("rejected");
    const rows = await server.db.prepare("SELECT quality, replay_json FROM playtest_replays").all();
    expect(rows).toHaveLength(1);
    expect((rows[0] as { quality: string }).quality).toBe("rejected");
    expect((rows[0] as { replay_json: null }).replay_json).toBeNull();
    // Export counts it as incomplete, never as an accepted trajectory.
    const { quality } = await exportTesterReplays(server.db, cohort, "d");
    expect(quality.incomplete).toBe(1);
    expect(quality.exported).toBe(0);
  });

  it("a capture-storage failure cannot change rewards or settlement", async () => {
    const server = await testServer({ playtestReplayCapture: true });
    const { token } = await register(server);
    const accountId = await accountIdOf(server, token);
    await giveStarterDeck(server, accountId, ["m05", "f04", "m06"]);
    const created = await call(server, "POST", "/api/runs", { token, body: starter });
    const { actions } = playRun(server.data, created.body.setup);
    // Break the capture table mid-flight — settlement must still land.
    await server.db.exec("DROP TABLE playtest_replays");
    const finished = await call(server, "POST", `/api/runs/${created.body.runId}/finish`, { token, rev: 1, body: { actions } });
    expect(finished.status).toBe(200);
    const run = await server.db
      .prepare("SELECT status FROM runs WHERE id = ?")
      .get(created.body.runId);
    expect((run as { status: string }).status).toBe("finished");
  });

  it("captures story finishes for both win and loss", async () => {
    const server = await testServer();
    const { token } = await register(server);
    const accountId = await accountIdOf(server, token);
    const replay = (result: string) => ({
      schemaVersion: 1 as const, id: `story:t_${result}`, groupId: "pilot",
      participantIds: [`acct:${accountId}`], humanSeats: [0], skillLabels: [],
      mode: "story" as const, dataHash: "d", engineHash: "e",
      setup: { stageId: "s1" },
      actions: [{ type: "endTurn" }] as Action[],
      actionSources: ["human" as const],
      result, termination: "combat" as const,
    });
    expect((await captureValidatedReplay(server.db, "story", accountId, replay("won"), 0)).quality).toBe("accepted");
    expect((await captureValidatedReplay(server.db, "story", accountId, replay("lost"), 0)).quality).toBe("accepted");
    const { replays } = await exportTesterReplays(server.db, cohort, "d");
    expect(replays.map((r) => r.result).sort()).toEqual(["lost", "won"]);
  });

  it("a story finish through the route stores one row; retries do not duplicate", async () => {
    const server = await testServer({ playtestReplayCapture: true });
    withServerStory(server);
    const { token } = await register(server);
    const accountId = await accountIdOf(server, token);
    await giveStarterDeck(server, accountId, ["m05", "f04", "m06"]);
    const created = await call(server, "POST", `/api/story/t_a1s1/tickets`, { token, body: starter });
    expect(created.status).toBe(201);
    const { actions } = playStory(server.data, created.body.setup, created.body.loadout);
    const finished = await call(server, "POST", `/api/story/tickets/${created.body.ticketId}/finish`, { token, rev: 1, body: { actions } });
    expect(finished.status).toBe(200);
    const rows = await server.db.prepare("SELECT * FROM playtest_replays").all();
    expect(rows).toHaveLength(1);
    // A second finish attempt is rejected by the ticket itself — still one row.
    const again = await call(server, "POST", `/api/story/tickets/${created.body.ticketId}/finish`, { token, rev: 2, body: { actions } });
    expect(again.status).toBe(409);
    expect(await server.db.prepare("SELECT * FROM playtest_replays").all()).toHaveLength(1);
  });
});
