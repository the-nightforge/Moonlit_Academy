import { Ws, hello, schedulerOf } from "./helpers/realtime";
import type { Profile } from "rules";
import { describe, expect, it } from "vitest";
import {
  accountIdOf, call, giveStarterDeck, register, testServer, type TestServer,
} from "./helpers";




/** Patches `profile.arena` of the account straight in the DB (ranked setup only). */
async function setArena(server: TestServer, accountId: number, arena: Partial<Profile["arena"]>): Promise<void> {
  const row = (await server.db.prepare<[number], { profile_json: string }>("SELECT profile_json FROM profiles WHERE account_id = ?").get(accountId))!;
  const profile = JSON.parse(row.profile_json) as Profile;
  profile.arena = { ...profile.arena, ...arena };
  await server.db.prepare("UPDATE profiles SET profile_json = ? WHERE account_id = ?").run(JSON.stringify(profile), accountId);
}

async function readArena(server: TestServer, accountId: number): Promise<Profile["arena"] & { honor: number }> {
  const row = (await server.db.prepare<[number], { profile_json: string }>("SELECT profile_json FROM profiles WHERE account_id = ?").get(accountId))!;
  const profile = JSON.parse(row.profile_json) as Profile;
  return { ...profile.arena, honor: profile.currencies.honor };
}

/** Inserts a finished ranked match between two accounts `ageMs` ago (rematch window setup). */
async function insertRankedMatch(server: TestServer, id: string, aId: number, bId: number, ageMs: number): Promise<void> {
  const at = server.now.value - ageMs;
  await server.db
    .prepare(
      "INSERT INTO matches (id, mode, data_version, seed, setup_json, actions_json, status, created_at, finished_at) VALUES (?, 'ranked', ?, 0, '{}', '[]', 'finished', ?, ?)",
    )
    .run(id, server.version, at, at);
  const player = await server.db.prepare("INSERT INTO match_players (match_id, account_id, slot, result) VALUES (?, ?, ?, ?)");
  await player.run(id, aId, 0, "won");
  await player.run(id, bId, 1, "lost");
}

/** Two queued players with starter decks; returns sockets after `queue.join` went out. */
async function queueTwo(server: TestServer) {
  const a = await register(server, "player_a");
  const b = await register(server, "player_b");
  await giveStarterDeck(server, await accountIdOf(server, a.token), ["m05", "f04", "m06"]);
  await giveStarterDeck(server, await accountIdOf(server, b.token), ["m06", "f03", "f02"]);
  const wsA = await Ws.connect(server.app);
  const wsB = await Ws.connect(server.app);
  await hello(server, wsA, a.token);
  await hello(server, wsB, b.token);
  wsA.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
  wsB.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
  await wsA.settle();
  await wsB.settle();
  return { wsA, wsB, a, b };
}

describe("arena", () => {
  it("T241 hàng chờ: ghép cặp trong khoảng điểm; khoảng nới theo thời gian chờ; không ghép lại đối thủ gần nhất", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);

    // --- same rating → paired on the first tick ---
    const { wsA, wsB } = await queueTwo(server);
    expect(wsA.last("queue.status")).toMatchObject({ mode: "ranked", waitingSeconds: 0 });
    sched.advance(1_000);
    await wsA.settle();
    await wsB.settle();
    const startA = wsA.last<{ mode: string; others: { rating?: number }[] }>("match.start")!;
    const startB = wsB.last<{ mode: string; others: { rating?: number }[] }>("match.start")!;
    expect(startA.mode).toBe("ranked");
    expect(startA.others[0]!.rating).toBe(1000);
    expect(startB.others[0]!.rating).toBe(1000);
    wsA.send({ type: "match.resign", matchId: (wsA.last<{ matchId: string }>("match.start"))!.matchId });
    await wsA.settle();
    await wsB.settle();
    wsA.close();
    wsB.close();
    await wsA.waitForClose();
    await wsB.waitForClose();

    // --- gap 250 > ±100 → no pair; after 30 s of waiting the window reaches 250 ---
    const c = await register(server, "player_c");
    const d = await register(server, "player_d");
    await giveStarterDeck(server, await accountIdOf(server, c.token), ["m05", "f04", "m06"]);
    await giveStarterDeck(server, await accountIdOf(server, d.token), ["m06", "f03", "f02"]);
    await setArena(server, await accountIdOf(server, d.token), { rating: 1250 });
    const wsC = await Ws.connect(server.app);
    const wsD = await Ws.connect(server.app);
    await hello(server, wsC, c.token);
    await hello(server, wsD, d.token);
    wsC.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    wsD.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    await wsC.settle();
    sched.advance(2_000);
    await wsC.settle();
    await wsD.settle();
    expect(wsC.last("match.start")).toBeUndefined(); // 250 > 100
    server.now.value += 30_000; // 30 s of waiting → ±100 + 50×3 = 250
    sched.advance(1_000);
    await wsC.settle();
    await wsD.settle();
    expect(wsC.last<{ mode: string }>("match.start")!.mode).toBe("ranked");
    wsC.send({ type: "match.resign", matchId: (wsC.last<{ matchId: string }>("match.start"))!.matchId });
    await wsC.settle();
    await wsD.settle();
    wsC.close();
    wsD.close();
    await wsC.waitForClose();
    await wsD.waitForClose();

    // --- rematch guard: A and B met 2 min ago in ranked → they don't pair; a third queues instead ---
    const e = await register(server, "player_e");
    const f = await register(server, "player_f");
    const g = await register(server, "player_g");
    await giveStarterDeck(server, await accountIdOf(server, e.token), ["m05", "f04", "m06"]);
    await giveStarterDeck(server, await accountIdOf(server, f.token), ["m06", "f03", "f02"]);
    await giveStarterDeck(server, await accountIdOf(server, g.token), ["m05", "f04", "m06"]);
    await insertRankedMatch(server, "m_recent", await accountIdOf(server, e.token), await accountIdOf(server, f.token), 2 * 60_000);
    const wsE = await Ws.connect(server.app);
    const wsF = await Ws.connect(server.app);
    const wsG = await Ws.connect(server.app);
    await hello(server, wsE, e.token);
    await hello(server, wsF, f.token);
    await hello(server, wsG, g.token);
    wsE.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    wsF.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    wsG.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    await wsE.settle();
    sched.advance(1_000);
    await wsE.settle();
    await wsF.settle();
    await wsG.settle();
    // E–F is excluded (met 2 min ago): the queue pairs E–G or F–G instead.
    const paired = [wsE, wsF, wsG].filter((ws) => ws.last("match.start") !== undefined);
    expect(paired).toHaveLength(2);
    expect(wsE.last("match.start") !== undefined && wsF.last("match.start") !== undefined).toBe(false);
  }, 60_000);

  it("T241 hàng chờ: đối thủ cũ quá 10 phút → ghép lại được; lỗi deck/bảo vệ khác chế độ", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);

    const a = await register(server, "player_a");
    const b = await register(server, "player_b");
    await giveStarterDeck(server, await accountIdOf(server, a.token), ["m05", "f04", "m06"]);
    await giveStarterDeck(server, await accountIdOf(server, b.token), ["m06", "f03", "f02"]);
    // Their last ranked match ended 11 minutes ago — outside the rematch window.
    await insertRankedMatch(server, "m_old", await accountIdOf(server, a.token), await accountIdOf(server, b.token), 11 * 60_000);
    const wsA = await Ws.connect(server.app);
    const wsB = await Ws.connect(server.app);
    await hello(server, wsA, a.token);
    await hello(server, wsB, b.token);
    wsA.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    wsB.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    await wsA.settle();
    sched.advance(1_000);
    await wsA.settle();
    expect(wsA.last("match.start")).toBeDefined();

    // Deck validation and guards.
    const c = await register(server, "player_c"); // no saved deck
    const wsC = await Ws.connect(server.app);
    await hello(server, wsC, c.token);
    wsC.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    await wsC.settle();
    expect(wsC.last("error")).toMatchObject({ error: "invalid deck" });
    // The co-op queue exists now (T260); a player without a saved deck still can't join.
    wsC.send({ type: "queue.join", mode: "coop", deckId: "d1" });
    await wsC.settle();
    expect(wsC.last("error")).toMatchObject({ error: "invalid deck" });

    // queue.leave removes the entry (re-join does not hit "already in queue").
    const d = await register(server, "player_d");
    await giveStarterDeck(server, await accountIdOf(server, d.token), ["m05", "f04", "m06"]);
    const wsD = await Ws.connect(server.app);
    await hello(server, wsD, d.token);
    wsD.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    await wsD.settle();
    wsD.send({ type: "queue.leave" });
    await wsD.settle();
    wsD.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    await wsD.settle();
    expect(wsD.last("error")).toBeUndefined();
    // Entering a private room drops the queue entry silently.
    wsD.send({ type: "room.create", mode: "pvp", deckId: "d1" });
    await wsD.settle();
    expect(wsD.last("room.created")).toBeDefined();
    wsD.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    await wsD.settle();
    expect(wsD.last("error")).toMatchObject({ error: "already in room" });
  }, 60_000);

  it("T244 trận xếp hạng: Elo hai phía + Vinh Dự + match_players trong một transaction; match.end đầy đủ", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { wsA, wsB, a, b } = await queueTwo(server);
    sched.advance(1_000);
    await wsA.settle();
    await wsB.settle();
    const matchId = wsA.last<{ matchId: string }>("match.start")!.matchId;

    wsA.send({ type: "match.resign", matchId });
    await wsA.settle();
    await wsB.settle();

    const endA = wsA.last<{ result: string; reason: string; rating?: { before: number; after: number }; rewards?: { honor: number }; profileRev?: number }>("match.end")!;
    const endB = wsB.last<{ result: string; rating?: { before: number; after: number }; rewards?: { honor: number }; profileRev?: number }>("match.end")!;
    // Seat 0 resigned before round 3 → lost, −20 (K=40), no Vinh Dự.
    expect(endA).toMatchObject({ result: "lost", reason: "resign", rating: { before: 1000, after: 980 }, rewards: { honor: 0 }, profileRev: 2 });
    // Seat 1 won → +20 Elo, +20 Vinh Dự.
    expect(endB).toMatchObject({ result: "won", rating: { before: 1000, after: 1020 }, rewards: { honor: 20 }, profileRev: 2 });

    // The DB rows and both profiles landed together.
    const players = await server.db
      .prepare<[string], { slot: number; result: string; rating_before: number; rating_after: number }>(
        "SELECT slot, result, rating_before, rating_after FROM match_players WHERE match_id = ? ORDER BY slot",
      )
      .all(matchId);
    expect(players).toEqual([
      { slot: 0, result: "lost", rating_before: 1000, rating_after: 980 },
      { slot: 1, result: "won", rating_before: 1000, rating_after: 1020 },
    ]);
    const arenaA = await readArena(server, await accountIdOf(server, a.token));
    const arenaB = await readArena(server, await accountIdOf(server, b.token));
    expect(arenaA).toMatchObject({ rating: 980, losses: 1, rankedGames: 1, honor: 0 });
    expect(arenaB).toMatchObject({ rating: 1020, wins: 1, rankedGames: 1, honor: 20 });
  }, 60_000);

  it("route: /api/arena/me, /history, /leaderboard và POST /api/shop/honor/:itemId/buy", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { wsA, wsB, a, b } = await queueTwo(server);
    sched.advance(1_000);
    await wsA.settle();
    const matchId = wsA.last<{ matchId: string }>("match.start")!.matchId;
    wsA.send({ type: "match.resign", matchId });
    await wsA.settle();
    await wsB.settle();
    const aId = await accountIdOf(server, a.token);
    const bId = await accountIdOf(server, b.token);

    // /me
    const me = await call(server, "GET", "/api/arena/me", { token: a.token });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      arena: { rating: 980, losses: 1, rankedGames: 1 },
      tier: { id: "dong_sinh" },
      honorToday: { gained: 0, cap: 120 },
    });
    const meB = await call(server, "GET", "/api/arena/me", { token: b.token });
    expect(meB.body).toMatchObject({ arena: { rating: 1020, wins: 1 }, honorToday: { gained: 20 } });

    // /history — the ranked match appears for both, with Δ rating.
    const history = await call(server, "GET", "/api/arena/history", { token: a.token });
    expect(history.body.entries).toEqual([
      { matchId, mode: "ranked", opponent: "player_b", result: "lost", ratingDelta: -20, createdAt: server.now.value },
    ]);

    // /leaderboard — under 5 ranked games nobody qualifies; patch games in.
    const board = await call(server, "GET", "/api/arena/leaderboard", { token: a.token });
    expect(board.body).toMatchObject({ entries: [], me: { username: "player_a", rating: 980, rank: null } });
    await setArena(server, aId, { rankedGames: 5 });
    await setArena(server, bId, { rankedGames: 10 });
    const board2 = await call(server, "GET", "/api/arena/leaderboard", { token: a.token });
    expect(board2.body.entries.map((e: { username: string }) => e.username)).toEqual(["player_b", "player_a"]);
    expect(board2.body.me).toMatchObject({ rank: 2, rating: 980 });

    // honor shop route: If-Match enforced, rules enforced.
    expect((await call(server, "POST", "/api/shop/honor/honor_pull/buy", { token: b.token })).status).toBe(428);
    expect((await call(server, "POST", "/api/shop/honor/honor_pull/buy", { token: b.token, rev: 2 })).status).toBe(400);
    const row = (await server.db.prepare<[number], { profile_json: string }>("SELECT profile_json FROM profiles WHERE account_id = ?").get(bId))!;
    const rich = JSON.parse(row.profile_json) as Profile;
    rich.currencies.honor = 500;
    rich.currencies.moonJade = 0;
    await server.db.prepare("UPDATE profiles SET profile_json = ? WHERE account_id = ?").run(JSON.stringify(rich), bId);
    const bought = await call(server, "POST", "/api/shop/honor/honor_pull/buy", { token: b.token, rev: 2, body: {} });
    expect(bought.status).toBe(200);
    expect(bought.body.profile.currencies).toMatchObject({ honor: 350, moonJade: 160 });
    expect(bought.body.rev).toBe(3);
  }, 60_000);
});
