import type { WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import type { Action } from "rules";
import { pvpBot, replayMatch } from "rules";
import { describe, expect, it } from "vitest";
import {
  accountIdOf, giveStarterDeck, register, testServer, type FakeScheduler, type TestServer,
} from "./helpers";

/** An injected `/api/ws` client collecting parsed server messages. */
class Ws {
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

const HELLO_MS = 10_000;
const PING_MS = 20_000;

function schedulerOf(server: TestServer): FakeScheduler {
  return server.deps.scheduler as FakeScheduler;
}

/**
 * Advances the fake scheduler while keeping sockets alive: each ≤15 s chunk is
 * followed by a settle so the auto-pong lands before the next 20 s heartbeat.
 */
async function advanceAlive(sched: FakeScheduler, ms: number, ...sockets: Ws[]): Promise<void> {
  for (let left = ms; left > 0; left -= 15_000) {
    sched.advance(Math.min(15_000, left));
    for (const ws of sockets) await ws.settle();
  }
}

async function hello(server: TestServer, ws: Ws, token: string): Promise<void> {
  ws.send({ type: "hello", token, dataVersion: server.version });
  await ws.settle();
}

/** Two signed-in players with starter decks, connected and in a private match. */
async function startPrivateMatch(server: TestServer) {
  const a = await register(server, "player_a");
  const b = await register(server, "player_b");
  await giveStarterDeck(server, await accountIdOf(server, a.token), ["m05", "f04", "m06"]);
  await giveStarterDeck(server, await accountIdOf(server, b.token), ["m06", "f03", "f02"]);
  const wsA = await Ws.connect(server.app);
  const wsB = await Ws.connect(server.app);
  await hello(server, wsA, a.token);
  await hello(server, wsB, b.token);
  wsA.send({ type: "room.create", mode: "pvp", deckId: "d1" });
  await wsA.settle();
  const created = wsA.last<{ code: string }>("room.created")!;
  wsB.send({ type: "room.join", code: created.code, deckId: "d1" });
  await wsA.settle();
  await wsB.settle();
  const startA = wsA.last<{ matchId: string; you: number }>("match.start")!;
  const startB = wsB.last<{ matchId: string; you: number }>("match.start")!;
  return { wsA, wsB, matchId: startA.matchId, a, b };
}

/**
 * A live seat of an in-progress match: the seat number, its next accepted `seq`,
 * and the latest view the server pushed.
 */
class SeatDriver {
  seq = 1;
  view: unknown;
  ended: Record<string, unknown> | null = null;
  constructor(
    readonly ws: Ws,
    readonly matchId: string,
    readonly seat: number,
  ) {}
  async refresh(): Promise<void> {
    await this.ws.settle();
    const start = this.ws.last<{ view: unknown }>("match.start");
    const events = this.ws.last<{ view: unknown }>("match.events");
    this.view = (events ?? start)?.view;
    this.ended = (this.ws.last("match.end") as Record<string, unknown> | undefined) ?? null;
  }
  sendAction(action: Action): void {
    this.ws.send({ type: "match.action", matchId: this.matchId, seq: this.seq, action });
  }
  /** True unless the server rejected this seq; consumes it on success. */
  async accepted(): Promise<boolean> {
    await this.ws.settle();
    const rejected = this.ws.last<{ seq: number }>("match.rejected");
    if (rejected && rejected.seq === this.seq) return false;
    this.seq += 1;
    return true;
  }
}

describe("realtime", () => {
  it("T231 hello: thiếu → 4401 sau 10 s; sai token → 4401; lệch dataVersion → 4409; hợp lệ → welcome", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { token } = await register(server, "nguoi_choi");

    const late = await Ws.connect(server.app);
    sched.advance(HELLO_MS);
    await late.waitForClose();
    expect(late.closeCode).toBe(4401);

    const bad = await Ws.connect(server.app);
    bad.send({ type: "hello", token: "khong-ton-tai", dataVersion: server.version });
    await bad.waitForClose();
    expect(bad.closeCode).toBe(4401);

    const stale = await Ws.connect(server.app);
    stale.send({ type: "hello", token, dataVersion: "0.0.0" });
    await stale.waitForClose();
    expect(stale.closeCode).toBe(4409);

    const ok = await Ws.connect(server.app);
    await hello(server, ok, token);
    const welcome = ok.last<{ account: { id: number; username: string }; serverTime: number }>("welcome");
    expect(welcome).toBeDefined();
    expect(welcome!.account.username).toBe("nguoi_choi");
    expect(welcome!.serverTime).toBe(server.now.value);
  });

  it("T233 tin sai schema / >16 KB → bad message không đóng; >30 tin/s → 4429; không pong 2 nhịp → ngắt", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { token } = await register(server, "nguoi_choi");

    const ws = await Ws.connect(server.app, { autoPong: false });
    await hello(server, ws, token);
    ws.inbox.length = 0;

    ws.send("không phải json");
    await ws.settle();
    expect(ws.last("error")).toMatchObject({ error: "bad message" });
    expect(ws.closeCode).toBeNull();

    ws.send(JSON.stringify({ type: "pong", pad: "x".repeat(17 * 1024) }));
    await ws.settle();
    expect(ws.last("error")).toMatchObject({ error: "bad message" });
    expect(ws.closeCode).toBeNull();

    // Heartbeat: ping mỗi 20 s; hai nhịp không trả lời → mất kết nối.
    sched.advance(PING_MS);
    await ws.settle();
    expect(ws.inbox.filter((m) => m.type === "ping")).toHaveLength(1);
    ws.send({ type: "pong" });
    await ws.settle(); // let the pong land before the next heartbeat fires
    sched.advance(PING_MS);
    await ws.settle();
    expect(ws.closeCode).toBeNull();
    sched.advance(PING_MS * 2); // bỏ lỡ 2 nhịp
    await ws.waitForClose();
    expect(ws.closeCode).not.toBeNull();

    const flooded = await Ws.connect(server.app);
    await hello(server, flooded, token);
    for (let i = 0; i < 31; i++) flooded.send({ type: "pong" });
    await flooded.waitForClose();
    expect(flooded.closeCode).toBe(4429);
  });

  it("T232 một kết nối/tài khoản: kết nối mới đóng cũ 4000 và welcome mang activeMatch", async () => {
    const server = await testServer();
    const { wsA, matchId, a } = await startPrivateMatch(server);
    expect(matchId).toBeTruthy();

    const ws2 = await Ws.connect(server.app);
    await hello(server, ws2, a.token);
    await wsA.waitForClose();
    expect(wsA.closeCode).toBe(4000);

    const welcome = ws2.last<{ activeMatch?: { matchId: string; you: number; eventSeq: number } }>("welcome")!;
    expect(welcome.activeMatch?.matchId).toBe(matchId);
    expect(welcome.activeMatch?.you).toBe(0);
  });

  it("phòng riêng: hai client đấu hết trận qua action log tuần tự", async () => {
    const server = await testServer();
    const { wsA, wsB, matchId } = await startPrivateMatch(server);
    const seatA = new SeatDriver(wsA, matchId, 0);
    const seatB = new SeatDriver(wsB, matchId, 1);
    const drivers = [seatA, seatB];

    let steps = 0;
    while (steps++ < 4000) {
      server.now.value += 250; // let the rate-limit window breathe between steps
      let acted = false;
      for (const driver of drivers) {
        await driver.refresh();
        if (driver.ended) continue;
        const view = driver.view as { status: string; players: { mulliganDone: boolean }[] };
        const mine =
          view.status === "mulligan"
            ? !view.players[driver.seat]!.mulliganDone
            : view.status === "playerTurn" || view.status === "choosing";
        if (!mine) continue;
        driver.sendAction(pvpBot(server.data, driver.view as never, driver.seat));
        if (await driver.accepted()) acted = true;
      }
      if (drivers.every((d) => d.ended)) break;
      if (!acted && drivers.every((d) => (d.view as { status: string }).status !== "mulligan")) break;
    }
    for (const driver of drivers) await driver.refresh();
    const end = seatA.ended ?? seatB.ended;
    expect(end).toBeTruthy();
    expect(["won", "lost", "draw"]).toContain(end!.result);
  }, 120_000);

  it("T234 seq: trùng → im lặng; nhảy cóc → bad seq; sai lượt → rejected", async () => {
    const server = await testServer();
    const { wsA, wsB, matchId } = await startPrivateMatch(server);
    const seatA = new SeatDriver(wsA, matchId, 0);
    const seatB = new SeatDriver(wsB, matchId, 1);
    await seatA.refresh();
    await seatB.refresh();

    // Qua Đổi Bài: cả hai mulligan rỗng để vào playerTurn.
    for (const driver of [seatA, seatB]) {
      driver.sendAction({ type: "mulligan", instanceIds: [] });
      expect(await driver.accepted()).toBe(true);
      await driver.refresh();
    }
    await seatA.refresh();
    await seatB.refresh();
    const view = seatA.view as { status: string };
    expect(view.status === "playerTurn" || view.status === "opponentTurn").toBe(true);

    const [active, waiting] = view.status === "playerTurn" ? [seatA, seatB] : [seatB, seatA];
    // Nhảy cóc seq → bad seq.
    waiting.ws.send({ type: "match.action", matchId, seq: 99, action: { type: "endTurn" } });
    await waiting.ws.settle();
    expect(waiting.ws.last("match.rejected")).toMatchObject({ seq: 99, reason: "bad seq" });
    // Sai lượt: seat đợi gửi seq đúng nhưng không phải lượt mình.
    waiting.sendAction({ type: "endTurn" });
    await waiting.ws.settle();
    expect(waiting.ws.last("match.rejected")).toMatchObject({ seq: waiting.seq });
    // Trùng seq < nextSeq → không áp lại; server trả snapshot hiện tại thay vì im lặng.
    const eventsBefore = active.ws.inbox.filter((m) => m.type === "match.events").length;
    active.ws.send({ type: "match.action", matchId, seq: 1, action: { type: "endTurn" } });
    await active.ws.settle();
    expect(active.ws.inbox.filter((m) => m.type === "match.events")).toHaveLength(eventsBefore);
    expect(active.ws.last("match.rejected")).toBeUndefined();
    const dupSnap = active.ws.last<{ matchId: string; nextActionSeq: number }>("match.snapshot")!;
    expect(dupSnap.matchId).toBe(matchId);
    expect(dupSnap.nextActionSeq).toBe(2);
  }, 60_000);

  it("N2 seq recovery: nextActionSeq trên snapshot/push; duplicate → snapshot; bad seq → expected", async () => {
    const server = await testServer();
    const { wsA, wsB, matchId } = await startPrivateMatch(server);
    const startA = wsA.last<{ nextActionSeq: number }>("match.start")!;
    const startB = wsB.last<{ nextActionSeq: number }>("match.start")!;
    expect(startA.nextActionSeq).toBe(1);
    expect(startB.nextActionSeq).toBe(1);

    // Chấp nhận seq 1: push tới A mang nextActionSeq=2; B vẫn ở 1 — seq là của từng ghế.
    wsA.send({ type: "match.action", matchId, seq: 1, action: { type: "mulligan", instanceIds: [] } });
    await wsA.settle();
    await wsB.settle();
    const eventsA = wsA.last<{ nextActionSeq: number }>("match.events")!;
    const eventsB = wsB.last<{ nextActionSeq: number }>("match.events")!;
    expect(eventsA.nextActionSeq).toBe(2);
    expect(eventsB.nextActionSeq).toBe(1);

    // Trùng seq 1 → không áp lại; server trả kèm snapshot.
    const pushesBefore = wsA.inbox.filter((m) => m.type === "match.events").length;
    wsA.send({ type: "match.action", matchId, seq: 1, action: { type: "mulligan", instanceIds: [] } });
    await wsA.settle();
    expect(wsA.inbox.filter((m) => m.type === "match.events")).toHaveLength(pushesBefore);
    const dup = wsA.last<{ matchId: string; nextActionSeq: number }>("match.snapshot")!;
    expect(dup.matchId).toBe(matchId);
    expect(dup.nextActionSeq).toBe(2);

    // Nhảy cóc seq → match.rejected mang expected seq.
    wsA.send({ type: "match.action", matchId, seq: 9, action: { type: "endTurn" } });
    await wsA.settle();
    expect(wsA.last("match.rejected")).toMatchObject({ seq: 9, reason: "bad seq", nextActionSeq: 2 });

    // match.sync trả snapshot của chính ghế mình.
    wsB.send({ type: "match.sync", matchId });
    await wsB.settle();
    expect(wsB.last("match.snapshot")).toMatchObject({ matchId, nextActionSeq: 1 });
    wsB.send({ type: "match.sync", matchId: "m_khong_ton_tai" });
    await wsB.settle();
    expect(wsB.last("error")).toMatchObject({ error: "no match" });
  }, 60_000);

  it("N2 matchId routing: frame matchId cũ không áp lên room mới; sync từ chối room người khác", async () => {
    const server = await testServer();
    const { wsA, wsB, matchId: oldMatchId } = await startPrivateMatch(server);
    wsA.send({ type: "match.resign", matchId: oldMatchId });
    await wsA.settle();
    await wsB.settle();

    // A vào trận mới (practice) trong khi room cũ còn được giữ lại.
    wsA.send({ type: "practice.start", mode: "pvp", deckId: "d1" });
    await wsA.settle();
    const start2 = wsA.last<{ matchId: string }>("match.start")!;
    expect(start2.matchId).not.toBe(oldMatchId);

    // Action mang matchId cũ → rơi vào room đã kết thúc, không đụng room mới.
    const eventsBefore = wsA.inbox.filter((m) => m.type === "match.events").length;
    wsA.send({ type: "match.action", matchId: oldMatchId, seq: 1, action: { type: "mulligan", instanceIds: [] } });
    await wsA.settle();
    expect(wsA.inbox.filter((m) => m.type === "match.events")).toHaveLength(eventsBefore);

    // match.sync được phép lên retained terminal room của chính account...
    wsA.send({ type: "match.sync", matchId: oldMatchId });
    await wsA.settle();
    expect(wsA.last<{ matchId: string }>("match.snapshot")!.matchId).toBe(oldMatchId);

    // ...nhưng không lên room mà account không ngồi.
    wsB.send({ type: "match.sync", matchId: start2.matchId });
    await wsB.settle();
    expect(wsB.last("match.snapshot")).toBeUndefined();
    expect(wsB.last("error")).toMatchObject({ error: "no match" });
  }, 60_000);

  it("N3 reconnect sau kết thúc: terminal snapshot settlement complete; sync/hello không award lại", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const a = await register(server, "rank_a");
    const b = await register(server, "rank_b");
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
    sched.advance(1_000); // một nhịp queue ghép cặp
    await wsA.settle();
    await wsB.settle();
    const start = wsA.last<{ matchId: string }>("match.start")!;
    const matchId = start.matchId;

    wsA.send({ type: "match.resign", matchId });
    await wsA.settle();
    await wsB.settle();
    const endA = wsA.last<{ result: string; profileRev?: number }>("match.end")!;
    expect(endA.result).toBe("lost");
    const revAfterSettle = endA.profileRev!;
    expect(revAfterSettle).toBeGreaterThan(0);

    // Reconnect trong retention: welcome.activeMatch là terminal snapshot.
    wsA.close();
    await wsA.waitForClose();
    const wsA2 = await Ws.connect(server.app);
    await hello(server, wsA2, a.token);
    const welcome = wsA2.last<{
      activeMatch?: {
        matchId: string;
        deadline: number | null;
        settlement: { status: string; end?: { result: string; rating?: unknown; profileRev?: number } };
      };
    }>("welcome")!;
    expect(welcome.activeMatch?.matchId).toBe(matchId);
    expect(welcome.activeMatch?.deadline).toBeNull();
    expect(welcome.activeMatch?.settlement.status).toBe("complete");
    expect(welcome.activeMatch?.settlement.end?.result).toBe("lost");
    expect(welcome.activeMatch?.settlement.end?.rating).toBeDefined();
    expect(welcome.activeMatch?.settlement.end?.profileRev).toBe(revAfterSettle);

    // Hello/sync chỉ đọc snapshot — không gửi lại match.end, không award thêm.
    wsA2.send({ type: "match.sync", matchId });
    await wsA2.settle();
    expect(wsA2.inbox.filter((m) => m.type === "match.end")).toHaveLength(0);
    expect(wsA2.last("match.snapshot")).toMatchObject({ matchId, settlement: { status: "complete" } });
    const wsA3 = await Ws.connect(server.app);
    await hello(server, wsA3, a.token);
    const again = wsA3.last<{ activeMatch?: { settlement: { end?: { profileRev?: number } } } }>("welcome")!;
    expect(again.activeMatch?.settlement.end?.profileRev).toBe(revAfterSettle);

    // Hết retention → không còn activeMatch.
    sched.advance(60_000);
    const wsA4 = await Ws.connect(server.app);
    await hello(server, wsA4, a.token);
    expect(wsA4.last<{ activeMatch?: unknown }>("welcome")!.activeMatch).toBeUndefined();
  }, 60_000);

  it("N3 settlement lỗi DB → failed không kẹt pending; result vẫn đến, phòng vẫn retention", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { wsA, wsB, matchId, a } = await startPrivateMatch(server);

    // Làm transaction settlement hỏng.
    const realTx = server.db.transaction.bind(server.db);
    server.db.transaction = (() => Promise.reject(new Error("db down"))) as typeof server.db.transaction;
    wsA.send({ type: "match.resign", matchId });
    await wsA.settle();
    await wsB.settle();
    server.db.transaction = realTx;

    // Result vẫn đến cả hai client; settlement phía server là failed.
    expect(wsA.last("match.end")).toMatchObject({ result: "lost", reason: "resign" });
    expect(wsB.last("match.end")).toMatchObject({ result: "won" });
    wsA.close();
    await wsA.waitForClose();
    const wsA2 = await Ws.connect(server.app);
    await hello(server, wsA2, a.token);
    const snap = wsA2.last<{ activeMatch?: { settlement: { status: string; error?: string } } }>("welcome")!
      .activeMatch;
    expect(snap?.settlement.status).toBe("failed");
    expect(snap?.settlement.error).toBeTruthy();

    // Phòng vẫn giữ retention rồi dọn đúng hạn.
    sched.advance(60_000);
    const wsA3 = await Ws.connect(server.app);
    await hello(server, wsA3, a.token);
    expect(wsA3.last<{ activeMatch?: unknown }>("welcome")!.activeMatch).toBeUndefined();
  }, 60_000);

  it("N4 settlement chậm >2s: snapshot báo pending, socket gắn lại nhận match.end khi xong", async () => {
    const server = await testServer();
    const { wsA, matchId, a } = await startPrivateMatch(server);

    // Gate the settlement transaction — the match stays `pending` until released.
    const realTx = server.db.transaction.bind(server.db);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.db.transaction = (async <T>(fn: () => Promise<T>) => {
      await gate;
      return realTx(fn);
    }) as typeof server.db.transaction;

    wsA.send({ type: "match.resign", matchId });
    await wsA.settle();
    wsA.close();
    await wsA.waitForClose();

    // Reconnect while settlement is pending: the room re-attaches and reports pending.
    const wsA2 = await Ws.connect(server.app);
    await hello(server, wsA2, a.token);
    const welcome = wsA2.last<{ activeMatch?: { settlement: { status: string } } }>("welcome")!.activeMatch;
    expect(welcome?.settlement.status).toBe("pending");

    // >2 giây vẫn chưa xong — sync cũng trả pending, không rơi về failed/complete.
    await new Promise((r) => setTimeout(r, 2100));
    wsA2.send({ type: "match.sync", matchId });
    await wsA2.settle();
    expect(wsA2.last<{ settlement: { status: string } }>("match.snapshot")!.settlement.status).toBe("pending");

    // Settlement lands on the already-attached socket — no second hello needed.
    release();
    await wsA2.settle();
    expect(wsA2.last("match.end")).toMatchObject({ result: "lost", reason: "resign" });
    wsA2.send({ type: "match.sync", matchId });
    await wsA2.settle();
    expect(wsA2.last<{ settlement: { status: string } }>("match.snapshot")!.settlement.status).toBe("complete");
  }, 60_000);

  it("A1 revealedCards: frame chứa cardPlayed mang instance+definition của lá đã public", async () => {
    const server = await testServer();
    const { wsA, wsB, matchId } = await startPrivateMatch(server);
    const a = new SeatDriver(wsA, matchId, 0);
    const b = new SeatDriver(wsB, matchId, 1);

    type Frame = {
      events: { type: string; instanceId?: string }[];
      revealedCards?: Record<string, { instance: { cardId: string }; definition: { name: string } }>;
    };
    const frameWithCard = (ws: Ws) =>
      ws.inbox.find(
        (m) =>
          m.type === "match.events" &&
          (m.events as { type: string }[]).some((e) => e.type === "cardPlayed"),
      ) as Frame | undefined;

    // Đấu tới khi một lá được đánh — bot lá mỗi lượt nên xuất hiện sớm.
    let frame: Frame | undefined;
    for (let i = 0; i < 20 && !frame; i++) {
      await a.refresh();
      await b.refresh();
      const viewA = a.view as { status: string; activePlayer?: number } | undefined;
      if (viewA?.status === "mulligan") {
        a.sendAction({ type: "mulligan", instanceIds: [] });
        b.sendAction({ type: "mulligan", instanceIds: [] });
        await a.accepted();
        await b.accepted();
        continue;
      }
      const active = viewA?.status === "playerTurn" ? (viewA.activePlayer ?? 0) : -1;
      if (active === 0) {
        a.sendAction(pvpBot(server.data, a.view as never, 0));
        await a.accepted();
      } else if (active === 1) {
        b.sendAction(pvpBot(server.data, b.view as never, 1));
        await b.accepted();
      }
      frame = frameWithCard(wsA);
    }
    expect(frame).toBeDefined();

    // Mỗi cardPlayed trong frame phải có metadata công khai — chỉ cardPlayed IDs.
    const playedIds = frame!.events.filter((e) => e.type === "cardPlayed").map((e) => e.instanceId!);
    expect(playedIds.length).toBeGreaterThan(0);
    expect(Object.keys(frame!.revealedCards ?? {})).toEqual(playedIds);
    for (const id of playedIds) {
      const revealed = frame!.revealedCards![id]!;
      expect(revealed.instance.cardId).toBeTruthy();
      expect(revealed.definition.name).toBeTruthy();
    }
    // Ghế đối diện nhận cùng metadata trên frame events tương ứng.
    const frameB = frameWithCard(wsB);
    expect(Object.keys(frameB?.revealedCards ?? {})).toEqual(playedIds);

    // Không rò instance kín: id tay đối thủ (hidden_* trong view của A) không lọt vào metadata.
    const viewA = a.view as { players: { hand: string[] }[] };
    const hiddenIds = viewA.players[1]!.hand;
    expect(hiddenIds.every((id) => id.startsWith("hidden_"))).toBe(true);
    for (const id of hiddenIds) {
      expect(frame!.revealedCards?.[id]).toBeUndefined();
      expect(JSON.stringify(frame!.revealedCards)).not.toContain(`"${id}"`);
    }
  }, 60_000);

  it("A4 match.start mang initialEvents riêng từng ghế; snapshot rejoin không", async () => {
    const server = await testServer();
    const { wsA, wsB, matchId } = await startPrivateMatch(server);
    type Start = { initialEvents?: { type: string; instanceIds?: string[]; player?: number }[] };
    const startA = wsA.last<Start>("match.start")!;
    const startB = wsB.last<Start>("match.start")!;
    expect(startA.initialEvents?.some((event) => event.type === "combatStarted")).toBe(true);
    const drawsA = startA.initialEvents!.filter((event) => event.type === "cardsDrawn");
    expect(drawsA.length).toBe(2);
    // Own draws keep real ids; the remote seat's draws are placeholder counts.
    expect(drawsA.find((event) => event.player === 0)!.instanceIds!.every((id) => !id.startsWith("hidden_"))).toBe(true);
    expect(drawsA.find((event) => event.player === 1)!.instanceIds!.every((id) => id.startsWith("hidden_"))).toBe(true);
    const drawsB = startB.initialEvents!.filter((event) => event.type === "cardsDrawn");
    expect(drawsB.find((event) => event.player === 1)!.instanceIds!.every((id) => !id.startsWith("hidden_"))).toBe(true);
    // Rejoin frames never replay the intro.
    wsA.send({ type: "match.sync", matchId });
    await wsA.settle();
    expect(wsA.last<Start>("match.snapshot")!.initialEvents).toBeUndefined();
  }, 60_000);

  it("T235 sau mỗi Action mỗi người nhận góc nhìn riêng: tay đối thủ chỉ còn số lượng", async () => {
    const server = await testServer();
    const { wsA, wsB, matchId } = await startPrivateMatch(server);
    const viewA = (wsA.last<{ view: { players: { hand: string[]; drawPile: string[] }[] } }>("match.start"))!.view;
    expect(viewA.players[0]!.hand.every((id) => !id.startsWith("hidden_"))).toBe(true);
    expect(viewA.players[1]!.hand.every((id) => id.startsWith("hidden_"))).toBe(true);
    expect(viewA.players[0]!.drawPile.every((id) => id.startsWith("hidden_"))).toBe(true);
    const viewB = (wsB.last<{ view: { players: { hand: string[] }[] } }>("match.start"))!.view;
    expect(viewB.players[0]!.hand.every((id) => id.startsWith("hidden_"))).toBe(true);
    expect(viewB.players[1]!.hand.every((id) => !id.startsWith("hidden_"))).toBe(true);
  });

  it("T236/T237 match.end ghi DB một transaction; replayMatch tái hiện trận; phòng xóa sau 60 s", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { wsA, wsB, matchId, a } = await startPrivateMatch(server);
    const seatA = new SeatDriver(wsA, matchId, 0);
    const seatB = new SeatDriver(wsB, matchId, 1);
    await seatA.refresh();
    await seatB.refresh();

    // Bỏ cuộc nhanh: seat 0 resign.
    wsA.send({ type: "match.resign", matchId });
    await wsA.settle();
    await wsB.settle();
    const endA = wsA.last<{ result: string; reason: string }>("match.end")!;
    const endB = wsB.last<{ result: string }>("match.end")!;
    expect(endA.result).toBe("lost");
    expect(endA.reason).toBe("resign");
    expect(endB.result).toBe("won");

    const matchRow = (await server.db
      .prepare<[string], { status: string; actions_json: string; result_json: string }>(
        "SELECT status, actions_json, result_json FROM matches WHERE id = ?",
      )
      .get(matchId))!;
    expect(matchRow.status).toBe("finished");
    const players = await server.db
      .prepare<[string], { slot: number; result: string }>(
        "SELECT slot, result FROM match_players WHERE match_id = ? ORDER BY slot",
      )
      .all(matchId);
    expect(players.map((p) => p.result)).toEqual(["lost", "won"]);

    // T237: replayMatch từ nhật ký đã lưu.
    const setup = (await server.db
      .prepare<[string], { setup_json: string; seed: number }>("SELECT setup_json, seed FROM matches WHERE id = ?")
      .get(matchId))!;
    const actions = JSON.parse(matchRow.actions_json) as { player: number; action: Action }[];
    const replay = replayMatch(server.data, { seed: setup.seed, players: JSON.parse(setup.setup_json).players }, actions);
    expect(replay.state.status).toBe("won");
    expect(replay.state.winner).toBe(1);

    // Phòng xóa khỏi bộ nhớ sau 60 s: reconnect không còn activeMatch.
    sched.advance(60_000);
    const ws2 = await Ws.connect(server.app);
    await hello(server, ws2, a.token);
    const welcome = ws2.last<{ activeMatch?: unknown }>("welcome")!;
    expect(welcome.activeMatch).toBeUndefined();
  });

  it("T239 đồng hồ: mulligan hết giờ → mulligan []; lượt hết giờ → endTurn; 3 lần liên tiếp → forfeit timeout", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { wsA, wsB, matchId } = await startPrivateMatch(server);

    // Đổi Bài hết 30 s: server gửi thay `mulligan []` cho cả hai.
    await advanceAlive(sched, 30_000, wsA, wsB);
    const viewA = wsA.last<{ view: { status: string; players: { mulliganDone: boolean }[] } }>("match.events")!;
    expect(viewA.view.players.every((p) => p.mulliganDone)).toBe(true);

    // Mỗi lượt hết 60 s → endTurn thay; seat đầu hết giờ 3 lần liên tiếp → forfeit.
    let end: { result: string; reason: string } | undefined;
    for (let i = 0; i < 10 && !end; i++) {
      await advanceAlive(sched, 60_000, wsA, wsB);
      end =
        (wsA.last<{ result: string; reason: string }>("match.end") as { result: string; reason: string } | undefined) ??
        (wsB.last<{ result: string; reason: string }>("match.end") as { result: string; reason: string } | undefined);
    }
    expect(end).toBeDefined();
    expect(end!.reason).toBe("timeout");
  }, 60_000);

  it("T239 kết nối lại: trong hạn nhận snapshot; quá hạn → forfeit disconnect; đồng hồ vẫn chạy", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { wsA, wsB, matchId, a } = await startPrivateMatch(server);
    const matchRow = async () =>
      (await server.db.prepare<[string], { status: string }>("SELECT status FROM matches WHERE id = ?").get(matchId))!;

    // Qua Đổi Bài bình thường để vào lượt.
    for (const ws of [wsA, wsB]) {
      ws.send({ type: "match.action", matchId, seq: 1, action: { type: "mulligan", instanceIds: [] } });
      await ws.settle();
    }

    // A mất kết nối → B nhận playerDisconnected; trận vẫn sống.
    wsA.close();
    await wsA.waitForClose();
    const sawDisconnect = () =>
      wsB.inbox.some((m) => (m.events as { type: string }[] | undefined)?.some((e) => e.type === "playerDisconnected"));
    for (let i = 0; i < 100 && !sawDisconnect(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(sawDisconnect()).toBe(true);
    expect((await matchRow()).status).toBe("playing");

    // A kết nối lại trong reconnectSeconds → welcome.activeMatch đầy đủ.
    await advanceAlive(sched, 10_000, wsB);
    const wsA2 = await Ws.connect(server.app);
    await hello(server, wsA2, a.token);
    const welcome = wsA2.last<{ activeMatch?: { matchId: string; you: number; view: { status: string } } }>("welcome")!;
    expect(welcome.activeMatch?.matchId).toBe(matchId);
    expect(welcome.activeMatch?.you).toBe(0);

    // Đồng hồ lượt vẫn chạy: hết 60 s kể từ khi vào lượt → server gửi action thay;
    // trận tiếp tục (đồng hồ reconnect của A đã bị hủy khi kết nối lại).
    await advanceAlive(sched, 60_000, wsA2, wsB);
    expect((await matchRow()).status).toBe("playing");

    // B mất kết nối và không quay lại → quá reconnectSeconds → forfeit disconnect.
    wsB.close();
    await wsB.waitForClose();
    await advanceAlive(sched, 70_000, wsA2);
    const end = wsA2.last<{ result: string; reason: string }>("match.end")!;
    expect(end.reason).toBe("disconnect");
    expect(end.result).toBe("won");
    expect((await matchRow()).status).toBe("finished");
  }, 60_000);

  it("T238 practice.start: đấu máy nhịp 600–1200 ms, mode practice, không Elo/thưởng", async () => {
    const server = await testServer();
    const sched = schedulerOf(server);
    const { token } = await register(server, "nguoi_tap");
    await giveStarterDeck(server, await accountIdOf(server, token), ["m05", "f04", "m06"]);
    const ws = await Ws.connect(server.app);
    await hello(server, ws, token);

    ws.send({ type: "practice.start", mode: "pvp", deckId: "d1" });
    await ws.settle();
    const start = ws.last<{
      matchId: string; mode: string; you: number;
      others: { seat: number; username: string; connected: boolean }[];
    }>("match.start")!;
    expect(start.mode).toBe("practice");
    expect(start.you).toBe(0);
    expect(start.others).toEqual([{ seat: 1, username: "Vọng Nguyệt", connected: true }]);
    const matchRow = (await server.db
      .prepare<[string], { mode: string }>("SELECT mode FROM matches WHERE id = ?")
      .get(start.matchId))!;
    expect(matchRow.mode).toBe("practice");

    // Đấu hết trận: người chơi hành động khi tới lượt; máy "nghĩ" 600–1200 ms.
    const seat = new SeatDriver(ws, start.matchId, 0);
    let end: { result: string; rating?: unknown } | undefined;
    for (let i = 0; i < 4000 && !end; i++) {
      server.now.value += 250;
      await seat.refresh();
      const view = seat.view as { status: string; players: { mulliganDone: boolean }[] } | undefined;
      if (view) {
        const mine =
          view.status === "mulligan" ? !view.players[0]!.mulliganDone : view.status === "playerTurn" || view.status === "choosing";
        if (mine) {
          seat.sendAction(pvpBot(server.data, view as never, 0));
          await seat.accepted();
        }
      }
      sched.advance(1_200); // một nhịp "nghĩ" tối đa của máy
      await seat.refresh();
      end = seat.ended as { result: string } | undefined ?? undefined;
    }
    expect(end).toBeDefined();
    expect(["won", "lost", "draw"]).toContain(end!.result);
    expect(end!.rating).toBeUndefined(); // Đấu Tập không chạm Elo/Vinh Dự
  }, 120_000);
});
