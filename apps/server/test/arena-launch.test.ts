import { expect, it, vi } from "vitest";
import { accountIdOf, giveStarterDeck, register, testServer } from "./helpers";
import { hello, schedulerOf, Ws } from "./helpers/realtime";

it("reserves selected accounts while match persistence is pending", async () => {
  const server = await testServer();
  const account = await register(server, "launch_arena");
  await giveStarterDeck(server, await accountIdOf(server, account.token), ["m05", "f04", "m06"]);
  const ws = await Ws.connect(server.app);
  await hello(server, ws, account.token);
  ws.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
  await ws.settle();
  const original = server.db.prepare.bind(server.db);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let inserting = false;
  const spy = vi.spyOn(server.db, "prepare").mockImplementation((sql: string) => {
    const statement = original(sql);
    if (!sql.startsWith("INSERT INTO matches")) return statement;
    return { ...statement, run: async (...args: unknown[]) => { inserting = true; await gate; return await statement.run(...args); } };
  });
  server.now.value += 60_000;
  schedulerOf(server).advance(1000);
  await ws.settle();
  expect(inserting).toBe(true);
  expect(ws.last("match.start")).toBeUndefined();
  for (const message of [
    { type: "practice.start", mode: "pvp", deckId: "d1" },
    { type: "queue.join", mode: "ranked", deckId: "d1" },
    { type: "room.create", mode: "pvp", deckId: "d1" },
  ]) { ws.send(message); await ws.settle(); expect(ws.last("error")).toMatchObject({ error: "already in match" }); }
  release();
  await ws.settle();
  expect(ws.inbox.filter(m => m.type === "match.start")).toHaveLength(1);
  expect(ws.last("match.start")).toMatchObject({ mode: "ranked" });
  spy.mockRestore();
}, 30_000);

it("reports a failed fallback launch and allows another queue attempt", async () => {
  const server = await testServer();
  const account = await register(server, "failed_arena");
  await giveStarterDeck(server, await accountIdOf(server, account.token), ["m05", "f04", "m06"]);
  const ws = await Ws.connect(server.app);
  await hello(server, ws, account.token);
  ws.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
  await ws.settle();
  const original = server.db.prepare.bind(server.db);
  const spy = vi.spyOn(server.db, "prepare").mockImplementation((sql: string) => {
    const statement = original(sql);
    return sql.startsWith("INSERT INTO matches") ? { ...statement, run: async () => { throw new Error("test launch failure"); } } : statement;
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const timersBefore = schedulerOf(server).pending();
    server.now.value += 60_000;
    schedulerOf(server).advance(1000);
    await ws.settle();
    expect(ws.last("error")).toMatchObject({ error: "match unavailable" });
    expect(schedulerOf(server).pending()).toBe(timersBefore);
    expect(ws.last("match.start")).toBeUndefined();
    spy.mockRestore();
    ws.send({ type: "queue.join", mode: "ranked", deckId: "d1" });
    await ws.settle();
    expect(ws.last("queue.status")).toMatchObject({ waitingSeconds: 0 });
    server.now.value += 60_000;
    schedulerOf(server).advance(1000);
    await ws.settle();
    expect(ws.last("match.start")).toMatchObject({ mode: "ranked" });
  } finally { spy.mockRestore(); log.mockRestore(); }
}, 30_000);
