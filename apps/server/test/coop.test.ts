import type { WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import type { Action, CombatState } from "rules";
import { coopBot, getValidTargets, isCardPlayable } from "rules";
import { describe, expect, it } from "vitest";
import {
  accountIdOf, call, giveStarterDeck, register, testServer, type FakeScheduler, type TestServer,
} from "./helpers";

/** An injected `/api/ws` client collecting parsed server messages. */
class Ws {
  readonly inbox: Record<string, unknown>[] = [];
  closeCode: number | null = null;
  private constructor(private readonly socket: WebSocket) {}

  static async connect(app: FastifyInstance): Promise<Ws> {
    await app.ready();
    const socket = await app.injectWS("/api/ws");
    const ws = new Ws(socket);
    socket.on("message", (raw: Buffer) => {
      const message = JSON.parse(raw.toString()) as Record<string, unknown>;
      ws.inbox.push(message);
      if (message.type === "ping") socket.send(JSON.stringify({ type: "pong" }));
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

  /** Waits until the inbox stays quiet for two ticks — async handlers (DB) need several macrotasks. */
  async settle(): Promise<void> {
    let quiet = 0;
    let seen = -1;
    for (let i = 0; i < 100 && (quiet < 3 || i < 10); i++) {
      await new Promise((resolve) => setImmediate(resolve));
      quiet = this.inbox.length === seen ? quiet + 1 : 0;
      seen = this.inbox.length;
    }
  }

  last<T = Record<string, unknown>>(type: string): T | undefined {
    return [...this.inbox].reverse().find((m) => m.type === type) as T | undefined;
  }
}

function schedulerOf(server: TestServer): FakeScheduler {
  return server.deps.scheduler as FakeScheduler;
}

async function hello(server: TestServer, ws: Ws, token: string): Promise<void> {
  ws.send({ type: "hello", token, dataVersion: server.version });
  await ws.settle();
}

/**
 * A live co-op seat: the seat number, its next accepted `seq`, and the latest
 * seat view the server pushed. `coopBot` decides on the redacted view — the
 * same contract the server-side `BotPlayer` uses.
 */
class CoopDriver {
  seq = 1;
  view: CombatState | undefined;
  ended: Record<string, unknown> | null = null;
  constructor(
    readonly ws: Ws,
    readonly matchId: string,
    readonly seat: number,
  ) {}
  async refresh(): Promise<void> {
    await this.ws.settle();
    const start = this.ws.last<{ matchId: string; view: CombatState }>("match.start");
    const events = this.ws.last<{ matchId: string; view: CombatState }>("match.events");
    const eventsView = events?.matchId === this.matchId ? events.view : undefined;
    const startView = start?.matchId === this.matchId ? start.view : undefined;
    this.view = eventsView ?? startView;
    // Stale `match.end` frames from an earlier match must not count.
    this.ended =
      (this.ws.inbox
        .filter((m) => m.type === "match.end" && m.matchId === this.matchId)
        .at(-1) as Record<string, unknown> | undefined) ?? null;
  }
  /** True while this seat may still act in the shared turn / mulligan. */
  mayAct(): boolean {
    const view = this.view;
    if (!view || this.ended) return false;
    if (view.status === "mulligan") return !view.players[this.seat]!.mulliganDone;
    return view.status === "playerTurn" && !view.players[this.seat]!.done;
  }
  sendAction(action: Action): void {
    this.ws.send({ type: "match.action", matchId: this.matchId, seq: this.seq, action });
  }
}

/** Two signed-in players with starter decks, connected over `/api/ws`. */
async function coopPair(server: TestServer) {
  const a = await register(server, "coop_a");
  const b = await register(server, "coop_b");
  await giveStarterDeck(server, await accountIdOf(server, a.token), ["m05", "f04", "m06"]);
  await giveStarterDeck(server, await accountIdOf(server, b.token), ["m05", "f04", "m06"]);
  const wsA = await Ws.connect(server.app);
  const wsB = await Ws.connect(server.app);
  await hello(server, wsA, a.token);
  await hello(server, wsB, b.token);
  return { a, b, wsA, wsB };
}

/** Queues both players for co-op; returns the started match and its drivers. */
async function queueCoopMatch(server: TestServer, wsA: Ws, wsB: Ws) {
  wsA.send({ type: "queue.join", mode: "coop", deckId: "d1" });
  await wsA.settle();
  wsB.send({ type: "queue.join", mode: "coop", deckId: "d1" });
  await wsB.settle();
  schedulerOf(server).advance(1_000); // one queue tick pairs the two arrivals
  await wsA.settle();
  await wsB.settle();
  const startA = wsA.last<{ matchId: string; mode: string; you: number }>("match.start")!;
  const startB = wsB.last<{ matchId: string; mode: string; you: number }>("match.start")!;
  expect(startA.mode).toBe("coop");
  expect(startB.matchId).toBe(startA.matchId);
  return {
    matchId: startA.matchId,
    seatA: new CoopDriver(wsA, startA.matchId, startA.you),
    seatB: new CoopDriver(wsB, startA.matchId, startB.you),
  };
}

/** Shrinks the raid boss so test matches finish in a few rounds. */
function shrinkBoss(server: TestServer, maxHp: number): void {
  server.data.enemies["eclipse_lord"]!.maxHp = maxHp;
}

/** Drives both seats with `coopBot` until both have received `match.end`. */
async function driveToEnd(server: TestServer, seats: CoopDriver[]): Promise<void> {
  for (let step = 0; step < 3_000; step++) {
    server.now.value += 250; // let the per-second message window breathe
    let acted = false;
    for (const seat of seats) {
      await seat.refresh();
      if (!seat.mayAct()) continue;
      seat.sendAction(coopBot(server.data, seat.view!, seat.seat));
      await seat.ws.settle();
      const rejected = seat.ws.last<{ seq: number }>("match.rejected");
      if (rejected && rejected.seq === seat.seq) continue;
      seat.seq += 1;
      acted = true;
    }
    if (seats.every((seat) => seat.ended)) return;
    if (!acted && seats.every((seat) => seat.view?.status !== "mulligan" && seat.view?.status !== "playerTurn")) break;
  }
  for (const seat of seats) await seat.refresh();
  expect(seats.every((seat) => seat.ended)).toBe(true);
}

interface CoopEnd {
  result: string;
  reason: string;
  rewards: { moonJade: number; moonDust: number; firstWin: boolean } | null;
  profileRev?: number;
}

describe("co-op realtime (`17` §9)", () => {
  it("T260: queue co-op pays both winners; the fourth match of the day is playable but unrewarded", async () => {
    const server = await testServer();
    shrinkBoss(server, 10);
    const { a, wsA, wsB } = await coopPair(server);

    const ends: [CoopEnd, CoopEnd][] = [];
    for (let match = 0; match < 4; match++) {
      const { matchId, seatA, seatB } = await queueCoopMatch(server, wsA, wsB);
      expect(matchId).toBeTruthy();
      await driveToEnd(server, [seatA, seatB]);
      ends.push([seatA.ended as unknown as CoopEnd, seatB.ended as unknown as CoopEnd]);
    }

    // Wins pay 40/3; the first win of the day adds 10 more jade (`17` §9.2).
    expect(ends[0]![0]).toMatchObject({ result: "won", rewards: { moonJade: 50, moonDust: 3, firstWin: true } });
    expect(ends[0]![1]).toMatchObject({ result: "won", rewards: { moonJade: 50, moonDust: 3, firstWin: true } });
    expect(ends[1]![0].rewards).toMatchObject({ moonJade: 40, firstWin: false });
    expect(ends[2]![0].rewards).toMatchObject({ moonJade: 40, firstWin: false });
    // Match four exceeds rewardedMatchesPerDay: played normally, pays nothing.
    expect(ends[3]![0]).toMatchObject({ result: "won", rewards: null });
    expect(ends[3]![1].rewards).toBeNull();

    const me = await call(server, "GET", "/api/coop/me", { token: a.token });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ clearsToday: 4, rewardClaimsLeft: 0 });

    const row = (await server.db
      .prepare<[number], { profile_json: string }>(
        "SELECT profile_json FROM profiles WHERE account_id = ?",
      )
      .get(await accountIdOf(server, a.token)))!;
    const profile = JSON.parse(row.profile_json) as {
      currencies: { moonJade: number; moonDust: number };
      coop: { clears: number; rewarded: number };
    };
    // Starter gift (2400) plus the three paid wins (50 + 40 + 40); match 4 unpaid.
    expect(profile.currencies.moonJade).toBe(server.data.economyConfig.starterGift.moonJade + 130);
    expect(profile.currencies.moonDust).toBe(9);
    expect(profile.coop).toMatchObject({ clears: 4, rewarded: 3 });
  }, 120_000);

  it("T261: a forfeiter gets nothing while the surviving partner wins alone and is paid", async () => {
    const server = await testServer();
    shrinkBoss(server, 6);
    const { a, b, wsA, wsB } = await coopPair(server);
    const { matchId, seatA, seatB } = await queueCoopMatch(server, wsA, wsB);
    expect(seatA.seat).toBe(0);
    expect(seatB.seat).toBe(1);

    // Both clear the mulligan, then seat 0 forfeits the raid.
    for (const seat of [seatA, seatB]) {
      for (let i = 0; i < 10 && !seat.view; i++) await seat.refresh();
      seat.sendAction({ type: "mulligan", instanceIds: [] });
      seat.seq += 1;
      await seat.ws.settle();
    }
    wsA.send({ type: "match.resign", matchId });
    await wsA.settle();
    await wsB.settle();
    // Seat 0's heroes fell but the match lives on for the partner.
    await seatB.refresh();
    const viewB = seatB.view!;
    expect(viewB.status).toBe("playerTurn");
    expect(viewB.heroes.filter((h) => h.player === 0).every((h) => h.hp <= 0)).toBe(true);

    // The survivor plays on alone until the boss falls.
    await driveToEnd(server, [seatB]);
    await seatA.refresh();
    const endA = seatA.ended as unknown as CoopEnd;
    const endB = seatB.ended as unknown as CoopEnd;
    expect(endA).toMatchObject({ result: "lost", rewards: null });
    expect(endB).toMatchObject({ result: "won", rewards: { moonJade: 50, moonDust: 3, firstWin: true } });

    // The forfeiter's day counters stay untouched; the survivor's advance.
    const meA = await call(server, "GET", "/api/coop/me", { token: a.token });
    expect(meA.body).toMatchObject({ clearsToday: 0, rewardClaimsLeft: 3 });
    const meB = await call(server, "GET", "/api/coop/me", { token: b.token });
    expect(meB.body).toMatchObject({ clearsToday: 1, rewardClaimsLeft: 2 });

    const rows = await server.db
      .prepare<[string], { slot: number; result: string }>(
        "SELECT slot, result FROM match_players WHERE match_id = ? ORDER BY slot",
      )
      .all(matchId);
    expect(rows.map((row) => row.result)).toEqual(["lost", "won"]);
  }, 120_000);

  it("T262: the seat view shows the partner's hand but hides both draw piles and rngState", async () => {
    const server = await testServer();
    const { wsA, wsB } = await coopPair(server);
    const { seatA, seatB } = await queueCoopMatch(server, wsA, wsB);
    await seatA.refresh();
    await seatB.refresh();
    const viewA = seatA.view!;
    expect(viewA.mode).toBe("coop");
    expect(viewA.rngState).toBe(0);
    // The partner's hand is fully visible — real instance ids, not placeholders.
    expect(viewA.players[1]!.hand.length).toBeGreaterThan(0);
    expect(viewA.players[1]!.hand.every((id) => !id.startsWith("hidden_"))).toBe(true);
    for (const id of viewA.players[1]!.hand) expect(viewA.cards[id]).toBeDefined();
    // Both draw piles stay count-only — including the viewer's own.
    for (const seat of viewA.players) {
      expect(seat.drawPile.every((id) => id.startsWith("hidden_deck_"))).toBe(true);
    }
    // The shared turn reads playerTurn for both seats, not opponentTurn.
    expect(viewA.status).toBe("mulligan"); // still choosing; no opponent remap
    await seatB.refresh();
    const viewB = seatB.view!;
    expect(viewB.players[0]!.hand.every((id) => !id.startsWith("hidden_"))).toBe(true);

    // Partner draw events keep their instance ids — the hand is public.
    for (const seat of [seatA, seatB]) {
      seat.sendAction({ type: "mulligan", instanceIds: [] });
      seat.seq += 1;
      await seat.ws.settle();
    }
    await seatA.refresh();
    // A partner play is public: `cardPlayed` carries the real instance id.
    // Drive seat 1 until it plays a card (endTurn rounds if the hand is dry).
    let played: { instanceId?: string } | undefined;
    for (let step = 0; step < 40 && played === undefined; step++) {
      await seatB.refresh();
      await seatA.refresh();
      if (!seatB.mayAct() && seatA.mayAct()) {
        seatA.sendAction({ type: "endTurn" });
        seatA.seq += 1;
        await seatA.ws.settle();
        continue;
      }
      const view = seatB.view!;
      const playable = view.players[1]!.hand.find((id) => isCardPlayable(server.data, view, id));
      if (playable === undefined) {
        seatB.sendAction({ type: "endTurn" });
        seatB.seq += 1;
        await seatB.ws.settle();
        continue;
      }
      const instance = view.cards[playable]!;
      const def = server.data.cards[instance.cardId]!;
      const targetId = def.target === "none" ? undefined : getValidTargets(server.data, view, playable)[0];
      seatB.sendAction({ type: "playCard", instanceId: playable, targetId });
      seatB.seq += 1;
      await seatB.ws.settle();
      played = wsA.inbox
        .flatMap((m) => ((m.events as { type: string; player?: number; instanceId?: string }[] | undefined) ?? []))
        .find((e) => e.type === "cardPlayed" && e.player === 1);
    }
    expect(played).toBeDefined();
    expect(played!.instanceId).not.toMatch(/^hidden_/);
    expect(viewA.cards[played!.instanceId!]).toBeDefined();
  }, 60_000);

  it("private and practice co-op matches run but never pay rewards", async () => {
    const server = await testServer();
    shrinkBoss(server, 6);
    const sched = schedulerOf(server);
    const { a, wsA, wsB } = await coopPair(server);

    // Private co-op room.
    wsA.send({ type: "room.create", mode: "coop", deckId: "d1" });
    await wsA.settle();
    const created = wsA.last<{ code: string; mode: string }>("room.created")!;
    expect(created.mode).toBe("coop");
    wsB.send({ type: "room.join", code: created.code, deckId: "d1" });
    await wsA.settle();
    await wsB.settle();
    const startA = wsA.last<{ matchId: string; mode: string; you: number }>("match.start")!;
    const startB = wsB.last<{ matchId: string; mode: string; you: number }>("match.start")!;
    expect(startA.mode).toBe("coop_private");
    expect(startB.matchId).toBe(startA.matchId);
    await driveToEnd(server, [new CoopDriver(wsA, startA.matchId, 0), new CoopDriver(wsB, startA.matchId, 1)]);
    const endA = wsA.last<{ rewards?: unknown }>("match.end")!;
    expect(endA.rewards === null || endA.rewards === undefined).toBe(true);
    let me = await call(server, "GET", "/api/coop/me", { token: a.token });
    expect(me.body).toMatchObject({ clearsToday: 0, rewardClaimsLeft: 3 });

    // Practice co-op against the bot seat.
    wsA.send({ type: "practice.start", mode: "coop", deckId: "d1" });
    await wsA.settle();
    const practice = wsA.last<{ matchId: string; mode: string; others: { username: string }[] }>("match.start")!;
    expect(practice.mode).toBe("coop_practice");
    expect(practice.others[0]!.username).toBe("Đồng Hành");
    const driver = new CoopDriver(wsA, practice.matchId, 0);
    // Drive the human seat; the bot acts on scheduler time.
    for (let step = 0; step < 3_000; step++) {
      server.now.value += 250;
      sched.advance(1_300);
      await driver.refresh();
      if (driver.ended) break;
      if (driver.mayAct()) {
        driver.sendAction(coopBot(server.data, driver.view!, 0));
        await driver.ws.settle();
        if (!(wsA.last<{ seq: number }>("match.rejected")?.seq === driver.seq)) driver.seq += 1;
      }
    }
    await driver.refresh();
    expect(driver.ended).toBeTruthy();
    me = await call(server, "GET", "/api/coop/me", { token: a.token });
    expect(me.body).toMatchObject({ rewardClaimsLeft: 3 });
  }, 120_000);

  it("N3 settlement đúng ghế: forfeiter thua không thưởng, partner thắng có thưởng; sync trả đúng từng ghế", async () => {
    const server = await testServer();
    shrinkBoss(server, 10);
    const { wsA, wsB } = await coopPair(server);
    const { matchId, seatA, seatB } = await queueCoopMatch(server, wsA, wsB);

    // A bỏ cuộc — A forfeited; B đánh tiếp một mình tới thắng.
    wsA.send({ type: "match.resign", matchId });
    await wsA.settle();
    await wsB.settle();
    await driveToEnd(server, [seatB]);
    const endA = wsA.last<CoopEnd>("match.end")!;
    const endB = wsB.last<CoopEnd>("match.end")!;
    expect(endA.result).toBe("lost");
    expect(endB.result).toBe("won");

    // `match.sync` trả settlement của chính ghế — forfeiter không có thưởng.
    wsA.send({ type: "match.sync", matchId });
    wsB.send({ type: "match.sync", matchId });
    await wsA.settle();
    await wsB.settle();
    const snapA = wsA.last<{
      you: number;
      settlement: { status: string; end?: { result: string; rewards?: unknown } };
    }>("match.snapshot")!;
    const snapB = wsB.last<{
      you: number;
      settlement: { status: string; end?: { result: string; rewards?: unknown } };
    }>("match.snapshot")!;
    expect(snapA.you).toBe(seatA.seat);
    expect(snapB.you).toBe(seatB.seat);
    expect(snapA.settlement).toMatchObject({ status: "complete", end: { result: "lost" } });
    expect(snapA.settlement.end?.rewards ?? null).toBeNull();
    expect(snapB.settlement).toMatchObject({ status: "complete", end: { result: "won" } });
    expect(snapB.settlement.end?.rewards).not.toBeNull();
  }, 120_000);
});
