import { expect, it } from "vitest";
import type { Action, Profile, PvpSide } from "rules";
import { dayKey, replayMatch } from "rules";
import { createContext } from "../src/context";
import { USERNAME_PATTERN } from "../src/auth";
import { startPvpMatch } from "../src/realtime/match-room";
import { resolvePvpSide } from "../src/realtime/rooms";
import { accountIdOf, call, giveStarterDeck, register, testServer } from "./helpers";
import { hello, schedulerOf, Ws } from "./helpers/realtime";

it("60s fallback presents a ranked opponent, persists rank changes and replays/reconnects once", async () => {
  const server = await testServer();
  const account = await register(server, "bot_arena");
  const id = await accountIdOf(server, account.token);
  await giveStarterDeck(server, id, ["m05", "f04", "m06"]);
  const read = async () => {
    const row = (await server.db.prepare<[number], { profile_json: string; rev: number }>("SELECT profile_json, rev FROM profiles WHERE account_id = ?").get(id))!;
    return { profile: JSON.parse(row.profile_json) as Profile, rev: row.rev };
  };
  const before = await read();
  const ws = await Ws.connect(server.app);
  await hello(server, ws, account.token);
  ws.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
  await ws.settle();
  server.now.value += 59_000;
  schedulerOf(server).advance(1000);
  await ws.settle();
  expect(ws.last("match.start")).toBeUndefined();
  server.now.value += 1000;
  schedulerOf(server).advance(1000);
  await ws.settle();
  const start = ws.last<{ matchId: string; mode: string; others: { username: string; rating: number }[] }>("match.start")!;
  expect(start).toMatchObject({ mode: "ranked" });
  expect(start.others).toHaveLength(1);
  const opponent = start.others[0]!;
  expect(opponent.rating).toBe(before.profile.arena.rating);
  expect(opponent.username).toBeTruthy();
  expect(opponent.username).toMatch(USERNAME_PATTERN);
  expect(opponent.username).not.toMatch(/máy|bot|Vọng Nguyệt/i);
  ws.send({ type: "match.resign", matchId: start.matchId });
  await ws.settle();
  expect(ws.last("match.end")).toMatchObject({ result: "lost", rating: { before: 1000, after: 980 }, rewards: { honor: 0 }, profileRev: before.rev + 1 });
  const after = await read();
  expect(after.profile.arena).toEqual({ ...before.profile.arena, rating: 980, losses: 1, rankedGames: 1, honorDay: { dayKey: dayKey(server.data, server.now.value), gained: 0 } });
  const history = await call(server, "GET", "/api/arena/history", { token: account.token });
  expect(history.body.entries).toMatchObject([{ matchId: start.matchId, mode: "ranked", opponent: opponent.username, ratingDelta: -20 }]);
  const players = await server.db.prepare<[string], { account_id: number | null; rating_before: number | null; rating_after: number | null }>(
    "SELECT account_id, rating_before, rating_after FROM match_players WHERE match_id = ? ORDER BY slot").all(start.matchId);
  expect(players).toEqual([{ account_id: id, rating_before: 1000, rating_after: 980 }, { account_id: null, rating_before: null, rating_after: null }]);
  const row = (await server.db.prepare<[string], { mode: string; status: string; setup_json: string; actions_json: string; seed: number }>(
    "SELECT mode, status, setup_json, actions_json, seed FROM matches WHERE id = ?").get(start.matchId))!;
  expect(row).toMatchObject({ mode: "ranked_bot", status: "finished" });
  expect(JSON.parse(row.setup_json).botNames["1"]).toBe(opponent.username);
  // Older stored matches have no alias metadata. Their public history still
  // gets a stable opponent name without altering their historical rewards.
  const legacySetup = JSON.stringify({ players: JSON.parse(row.setup_json).players });
  await server.db.prepare("UPDATE matches SET setup_json = ? WHERE id = ?").run(legacySetup, start.matchId);
  const legacyHistory = await call(server, "GET", "/api/arena/history", { token: account.token });
  expect(legacyHistory.body.entries[0]).toMatchObject({ mode: "ranked", opponent: opponent.username, ratingDelta: -20 });
  const replay = replayMatch(server.data, { seed: row.seed, players: JSON.parse(row.setup_json).players }, JSON.parse(row.actions_json) as { player: number; action: Action }[]);
  expect(replay.state.winner).toBe(1);
  ws.close();
  await ws.waitForClose();
  const reconnect = await Ws.connect(server.app);
  await hello(server, reconnect, account.token);
  expect(reconnect.last("welcome")).toMatchObject({ activeMatch: { mode: "ranked", others: [opponent], settlement: { status: "complete", end: { rating: { before: 1000, after: 980 }, rewards: { honor: 0 } } } } });
  reconnect.send({ type: "match.resign", matchId: start.matchId });
  reconnect.send({ type: "match.sync", matchId: start.matchId });
  await reconnect.settle();
  expect(await read()).toEqual(after);
}, 30_000);

it("fallback win updates rating, ranked record and capped Honor without reading or saving a bot profile", async () => {
  const server = await testServer();
  const account = await register(server, "bot_winner");
  const id = await accountIdOf(server, account.token);
  await giveStarterDeck(server, id, ["m05", "f04", "m06"]);
  const ctx = createContext(server.deps, server.version);
  const initial = await ctx.readProfile(id);
  const today = dayKey(server.data, server.now.value);
  initial.profile.arena = { rating: 1700, rankedGames: 34, wins: 20, losses: 12, draws: 2, honorDay: { dayKey: today, gained: 115 } };
  await server.db.prepare("UPDATE profiles SET profile_json = ? WHERE account_id = ?").run(JSON.stringify(initial.profile), id);
  const side = await resolvePvpSide(ctx, id, "d1");
  if (!side.ok) throw new Error("test deck invalid");
  const read = ctx.readProfile.bind(ctx), save = ctx.saveProfile.bind(ctx);
  const reads: number[] = [], writes: number[] = [];
  ctx.readProfile = async accountId => { reads.push(accountId); return await read(accountId); };
  ctx.saveProfile = async (accountId, profile) => { writes.push(accountId); return await save(accountId, profile); };
  const room = await startPvpMatch(ctx, "ranked_bot", 77, [
    { accountId: id, username: "bot_winner", side: side.side as PvpSide, rating: 1700 },
    { accountId: null, username: "Thanh Sơn", side: side.side as PvpSide, rating: 1700 },
  ], "honor_bot", () => {});
  room.botAction(room.seats[1]!, { type: "forfeit", player: 1, reason: "resign", system: true });
  for (let i = 0; i < 40; i++) await new Promise(resolve => setImmediate(resolve));
  expect(room.snapshotFor(0).settlement).toMatchObject({ status: "complete", end: { result: "won", rating: { before: 1700, after: 1712 }, rewards: { honor: 5 }, profileRev: initial.rev + 1 } });
  expect(reads).toEqual([id]);
  expect(writes).toEqual([id]);
  const paid = await read(id);
  expect(paid.profile.arena).toEqual({ ...initial.profile.arena, rating: 1712, wins: 21, rankedGames: 35, honorDay: { dayKey: today, gained: 120 } });
  expect(paid.profile.currencies.honor).toBe(initial.profile.currencies.honor + 5);
  room.handleResign(room.seats[0]!);
  room.snapshotFor(0);
  expect(await read(id)).toEqual(paid);
}, 30_000);

it("disconnect removes a waiter and a reconnect starts a fresh 60s wait", async () => {
  const server = await testServer();
  const account = await register(server, "rejoin_arena");
  await giveStarterDeck(server, await accountIdOf(server, account.token), ["m05", "f04", "m06"]);
  const ws = await Ws.connect(server.app);
  await hello(server, ws, account.token);
  ws.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
  await ws.settle();
  server.now.value += 59_000;
  schedulerOf(server).advance(1000);
  await ws.settle();
  ws.close();
  await ws.waitForClose();
  const next = await Ws.connect(server.app);
  await hello(server, next, account.token);
  next.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
  await next.settle();
  expect(next.last("queue.status")).toMatchObject({ waitingSeconds: 0 });
  for (const elapsed of [1000, 58_000]) {
    server.now.value += elapsed;
    schedulerOf(server).advance(1000);
    await next.settle();
    expect(next.last("match.start")).toBeUndefined();
  }
  server.now.value += 1000;
  schedulerOf(server).advance(1000);
  await next.settle();
  expect(next.last("match.start")).toMatchObject({ mode: "ranked" });
  expect(next.inbox.filter(message => message.type === "match.start")).toHaveLength(1);
}, 30_000);

it("records a deck-out as its own end reason, distinct from a knockout", async () => {
  const server = await testServer();
  const account = await register(server, "deckout_arena");
  const id = await accountIdOf(server, account.token);
  await giveStarterDeck(server, id, ["m05", "f04", "m06"]);
  const ctx = createContext(server.deps, server.version);
  const side = await resolvePvpSide(ctx, id, "d1");
  if (!side.ok) throw new Error("test deck invalid");
  const room = await startPvpMatch(ctx, "ranked_bot", 11, [
    { accountId: id, username: "deckout_arena", side: side.side, rating: 1000 },
    { accountId: null, username: "Bích Ngọc", side: side.side, rating: 1000 },
  ], "deckout_ranked", () => {});
  for (const player of [0, 1]) room.botAction(room.seats[player]!, { type: "mulligan", player, instanceIds: [] });
  // Seat 1 must reach a turn start with an empty hand and an empty draw pile.
  let guard = 0;
  while (room.combatState.status === "playerTurn" && guard++ < 20) {
    room.combatState.players[1]!.drawPile = [];
    room.combatState.players[1]!.hand = [];
    const player = room.combatState.activePlayer;
    room.botAction(room.seats[player]!, { type: "endTurn", player });
  }
  for (let i = 0; i < 40; i++) await new Promise(resolve => setImmediate(resolve));
  const row = (await server.db.prepare<[string], { result_json: string }>(
    "SELECT result_json FROM matches WHERE id = ?").get(room.matchId))!;
  expect(JSON.parse(row.result_json)).toMatchObject({ winner: 0, reason: "deckOut" });
}, 30_000);

it("fallback draws use the normal ranked draw result", async () => {
  const server = await testServer();
  server.data.pvpConfig.roundCap = 1;
  const account = await register(server, "draw_arena");
  const id = await accountIdOf(server, account.token);
  await giveStarterDeck(server, id, ["m05", "f04", "m06"]);
  const ctx = createContext(server.deps, server.version);
  const before = await ctx.readProfile(id);
  const side = await resolvePvpSide(ctx, id, "d1");
  if (!side.ok) throw new Error("test deck invalid");
  const room = await startPvpMatch(ctx, "ranked_bot", 7, [
    { accountId: id, username: "draw_arena", side: side.side, rating: 1000 },
    { accountId: null, username: "Trúc Lâm", side: side.side, rating: 1000 },
  ], "draw_ranked", () => {});
  for (const player of [0, 1]) room.botAction(room.seats[player]!, { type: "mulligan", player, instanceIds: [] });
  for (let i = 0; i < 2; i++) {
    const player = room.combatState.activePlayer;
    room.botAction(room.seats[player]!, { type: "endTurn", player });
  }
  for (let i = 0; i < 40; i++) await new Promise(resolve => setImmediate(resolve));
  expect(room.snapshotFor(0).settlement).toMatchObject({ status: "complete", end: { result: "draw", rating: { before: 1000, after: 1000 }, rewards: { honor: 12 } } });
  const after = await ctx.readProfile(id);
  expect(after.profile.arena).toMatchObject({ rating: 1000, draws: 1, rankedGames: 1 });
  expect(after.profile.currencies.honor).toBe(before.profile.currencies.honor + 12);
}, 30_000);
