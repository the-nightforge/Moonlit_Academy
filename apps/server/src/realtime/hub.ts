import type { WebSocket } from "ws";
import type { CoopSide, PvpSide } from "rules";
import type { AppContext } from "../context";
import { BotPlayer, botCoopSide, botPvpSide } from "./bot-player";
import { MatchRoom, send, startCoopMatch, startPvpMatch, type MatchMode } from "./match-room";
import { clientMessageSchema, type ClientMessage, type ServerMessage } from "./protocol";
import { CoopQueue, RankedQueue } from "./queue";
import { resolveCoopSide, resolvePvpSide, RoomManager, type WaitingRoom } from "./rooms";

/** `16` §8.1: hello deadline, heartbeat period, misses tolerated, per-second cap. */
export const HELLO_TIMEOUT_MS = 10_000;
export const PING_INTERVAL_MS = 20_000;
export const PING_MISS_LIMIT = 2;
export const MAX_MESSAGES_PER_SECOND = 30;
export const MAX_MESSAGE_BYTES = 16 * 1024;

export const CLOSE_REPLACED = 4000;
export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_OUTDATED = 4409;
export const CLOSE_RATE_LIMITED = 4429;

export interface Connection {
  socket: WebSocket;
  accountId: number | null;
  username: string;
  missedPings: number;
  msgWindowStart: number;
  msgCount: number;
  helloHandle: unknown;
  pingHandle: unknown;
  /** Serialises `dispatch` — two quick messages never interleave mid-await. */
  chain: Promise<void>;
}

/**
 * Realtime hub (`17` §5): owns the connection-per-account registry, waiting
 * rooms and live matches; `match-room.ts` holds match state.
 */
export class RealtimeHub {
  private readonly byAccount = new Map<number, Connection>();
  private readonly matches = new Map<string, MatchRoom>();
  private readonly matchByAccount = new Map<number, MatchRoom>();
  private matchCounter = 0;
  readonly rooms: RoomManager;
  readonly queue: RankedQueue;
  readonly coopQueue: CoopQueue;

  constructor(private readonly ctx: AppContext) {
    this.rooms = new RoomManager(
      ctx,
      (accountId, message) => send(this.byAccount.get(accountId)?.socket, message),
      (room) => void this.beginPrivateMatch(room).catch((error: unknown) => console.error("beginPrivateMatch failed:", error)),
    );
    this.queue = new RankedQueue(
      ctx,
      (accountId, message) => send(this.byAccount.get(accountId)?.socket, message),
      (a, b) => {
        const seed = this.ctx.random(4).readUInt32BE(0);
        void this.launchMatch("ranked", seed, [
          { accountId: a.accountId, username: a.username, side: a.side, rating: a.rating },
          { accountId: b.accountId, username: b.username, side: b.side, rating: b.rating },
        ]).catch((error: unknown) => console.error("launchMatch ranked failed:", error));
      },
    );
    this.coopQueue = new CoopQueue(
      ctx,
      (accountId, message) => send(this.byAccount.get(accountId)?.socket, message),
      (a, b) => {
        const seed = this.ctx.random(4).readUInt32BE(0);
        void this.launchMatch("coop", seed, [
          { accountId: a.accountId, username: a.username, side: a.side },
          { accountId: b.accountId, username: b.username, side: b.side },
        ]).catch((error: unknown) => console.error("launchMatch coop failed:", error));
      },
    );
  }

  /** A new socket: unauthenticated until `hello` lands within 10 s. */
  connect(socket: WebSocket): void {
    const conn: Connection = {
      socket, accountId: null, username: "", missedPings: 0,
      msgWindowStart: this.ctx.clock(), msgCount: 0,
      helloHandle: this.ctx.scheduler.setTimeout(() => {
        if (conn.accountId === null) socket.close(CLOSE_UNAUTHORIZED, "unauthorized");
      }, HELLO_TIMEOUT_MS),
      pingHandle: undefined,
      chain: Promise.resolve(),
    };
    socket.on("message", (raw: Buffer | string) => this.onRaw(conn, raw));
    socket.on("close", () => this.onClose(conn));
  }

  matchOf(accountId: number): MatchRoom | undefined {
    return this.matchByAccount.get(accountId);
  }

  private onRaw(conn: Connection, raw: Buffer | string): void {
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    if (conn.accountId !== null && !this.rateLimit(conn)) return;
    if (text.length > MAX_MESSAGE_BYTES) {
      this.reply(conn, { type: "error", error: "bad message" });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.reply(conn, { type: "error", error: "bad message" });
      return;
    }
    const message = clientMessageSchema.safeParse(parsed);
    if (!message.success) {
      this.reply(conn, { type: "error", error: "bad message" });
      return;
    }
    if (conn.accountId === null) {
      if (message.data.type === "hello") void this.onHello(conn, message.data.token, message.data.dataVersion);
      else this.reply(conn, { type: "error", error: "bad message" });
      return;
    }
    // Serialise dispatches per connection: an awaited DB call must not let a
    // later message overtake an earlier one.
    conn.chain = conn.chain.then(() => this.dispatch(conn, message.data)).catch((error) => {
      console.error("dispatch failed:", error);
    });
  }

  private rateLimit(conn: Connection): boolean {
    const now = this.ctx.clock();
    if (now - conn.msgWindowStart >= 1000) {
      conn.msgWindowStart = now;
      conn.msgCount = 0;
    }
    conn.msgCount += 1;
    if (conn.msgCount > MAX_MESSAGES_PER_SECOND) {
      conn.socket.close(CLOSE_RATE_LIMITED, "rate limited");
      return false;
    }
    return true;
  }

  private async onHello(conn: Connection, token: string, dataVersion: string): Promise<void> {
    const accountId = await this.ctx.accountByToken(token);
    if (accountId === null) {
      conn.socket.close(CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }
    if (dataVersion !== this.ctx.dataVersion) {
      conn.socket.close(CLOSE_OUTDATED, "outdated client");
      return;
    }
    this.ctx.scheduler.clearTimeout(conn.helloHandle);
    conn.accountId = accountId;
    conn.username = await this.rooms.usernameOf(accountId);
    // One connection per account: a newer socket replaces the old one (`17` §5.1).
    const old = this.byAccount.get(accountId);
    if (old && old !== conn) {
      this.ctx.scheduler.clearTimeout(old.pingHandle);
      const stale = old.socket;
      old.accountId = null; // its late close event must not detach the new connection
      stale.close(CLOSE_REPLACED, "replaced");
    }
    this.byAccount.set(accountId, conn);
    // Reconnecting hands the seat's socket to this connection. A finished room
    // lingers ~60 s and still answers with its terminal snapshot — including a
    // settlement still pending — but never re-arms a clock (`16` §8.4).
    const room = this.matchByAccount.get(accountId);
    const seat = room?.seatOf(accountId);
    if (room && seat) room.attach(seat, conn.socket);
    this.reply(conn, {
      type: "welcome",
      account: { id: accountId, username: conn.username },
      serverTime: this.ctx.clock(),
      ...(room && seat ? { activeMatch: room.snapshotFor(seat.seat) } : {}),
    });
    this.schedulePing(conn);
  }

  private schedulePing(conn: Connection): void {
    conn.pingHandle = this.ctx.scheduler.setTimeout(() => {
      conn.missedPings += 1;
      if (conn.missedPings > PING_MISS_LIMIT) {
        conn.socket.close();
        this.onClose(conn);
        return;
      }
      this.reply(conn, { type: "ping" });
      this.schedulePing(conn);
    }, PING_INTERVAL_MS);
  }

  private onClose(conn: Connection): void {
    this.ctx.scheduler.clearTimeout(conn.helloHandle);
    this.ctx.scheduler.clearTimeout(conn.pingHandle);
    if (conn.accountId === null) return;
    // Only the currently registered connection detaches seats; a stale
    // "replaced" socket closing late must not mark the player offline.
    if (this.byAccount.get(conn.accountId) === conn) this.byAccount.delete(conn.accountId);
    else return;
    this.rooms.disconnect(conn.accountId);
    this.queue.leave(conn.accountId);
    this.coopQueue.leave(conn.accountId);
    const room = this.matchByAccount.get(conn.accountId);
    const seat = room?.seatOf(conn.accountId);
    if (room && seat) room.detach(seat);
  }

  private async dispatch(conn: Connection, message: ClientMessage): Promise<void> {
    const accountId = conn.accountId!;
    switch (message.type) {
      case "pong":
        conn.missedPings = 0;
        return;
      case "room.create":
        this.queue.leave(accountId); // another mode means leaving the queue
        this.coopQueue.leave(accountId);
        await this.rooms.create(accountId, message.mode, message.deckId);
        return;
      case "room.join":
        this.queue.leave(accountId);
        this.coopQueue.leave(accountId);
        await this.rooms.join(accountId, message.code, message.deckId);
        return;
      case "room.leave":
        this.rooms.leave(accountId);
        return;
      // Every match.* frame routes by its `matchId` + seat membership: a stale
      // frame can only land on the room it names, never on the account's new
      // match, and another account's room is unreachable (`16` §8.3).
      case "match.action": {
        const seat = this.matches.get(message.matchId)?.seatOf(accountId);
        if (!seat) {
          this.reply(conn, { type: "error", error: "no match" });
          return;
        }
        this.matches.get(message.matchId)!.handleAction(seat, message.seq, message.action);
        return;
      }
      case "match.resign": {
        const room = this.matches.get(message.matchId);
        const seat = room?.seatOf(accountId);
        if (room && seat) room.handleResign(seat);
        return;
      }
      case "match.emote": {
        const room = this.matches.get(message.matchId);
        const seat = room?.seatOf(accountId);
        if (room && seat) room.handleEmote(seat, message.emoteId);
        return;
      }
      case "match.sync": {
        // Own-seat recovery — also allowed on a retained terminal room so a
        // late reconnect can still fetch the settled snapshot.
        const room = this.matches.get(message.matchId);
        const seat = room?.seatOf(accountId);
        if (!room || !seat) {
          this.reply(conn, { type: "error", error: "no match" });
          return;
        }
        room.handleSync(seat);
        return;
      }
      case "practice.start": {
        // A finished room lingers ~60 s for late frames — only a live match blocks.
        const live = this.matchByAccount.get(accountId);
        if (live && !live.ended) {
          this.reply(conn, { type: "error", error: "already in match" });
          return;
        }
        this.queue.leave(accountId);
        this.coopQueue.leave(accountId);
        const seed = this.ctx.random(4).readUInt32BE(0);
        // Practice matches never touch Elo / Vinh Dự / rewards (`17` §5.4).
        if (message.mode === "coop") {
          const coop = await resolveCoopSide(this.ctx, accountId, message.deckId);
          if (!coop.ok) {
            this.reply(conn, { type: "error", error: "invalid deck" });
            return;
          }
          await this.launchMatch("coop_practice", seed, [
            { accountId, username: conn.username, side: coop.side },
            { accountId: null, username: "Đồng Hành", side: botCoopSide(this.ctx, seed) },
          ]);
          return;
        }
        const side = await resolvePvpSide(this.ctx, accountId, message.deckId);
        if (!side.ok) {
          this.reply(conn, { type: "error", error: "invalid deck" });
          return;
        }
        await this.launchMatch("practice", seed, [
          { accountId, username: conn.username, side: side.side },
          { accountId: null, username: "Vọng Nguyệt", side: botPvpSide(this.ctx, seed) },
        ]);
        return;
      }
      case "queue.join": {
        const live = this.matchByAccount.get(accountId);
        if (live && !live.ended) {
          this.reply(conn, { type: "error", error: "already in match" });
          return;
        }
        if (this.rooms.roomOf(accountId) !== undefined) {
          this.reply(conn, { type: "error", error: "already in room" });
          return;
        }
        if (message.mode === "coop") {
          if (this.coopQueue.entryOf(accountId) !== undefined) {
            this.reply(conn, { type: "error", error: "already in queue" });
            return;
          }
          this.queue.leave(accountId); // switching queues leaves the other one
          const side = await resolveCoopSide(this.ctx, accountId, message.deckId);
          if (!side.ok) {
            this.reply(conn, { type: "error", error: "invalid deck", errors: side.errors } as ServerMessage);
            return;
          }
          this.coopQueue.join({
            accountId,
            username: conn.username,
            deckId: message.deckId,
            side: side.side,
            joinedAt: this.ctx.clock(),
          });
          return;
        }
        if (this.queue.entryOf(accountId) !== undefined) {
          this.reply(conn, { type: "error", error: "already in queue" });
          return;
        }
        this.coopQueue.leave(accountId);
        const side = await resolvePvpSide(this.ctx, accountId, message.deckId);
        if (!side.ok) {
          this.reply(conn, { type: "error", error: "invalid deck", errors: side.errors } as ServerMessage);
          return;
        }
        const { profile } = await this.ctx.readProfile(accountId);
        this.queue.join({
          accountId,
          username: conn.username,
          deckId: message.deckId,
          side: side.side,
          rating: profile.arena.rating,
          joinedAt: this.ctx.clock(),
        });
        return;
      }
      case "queue.leave":
        this.queue.leave(accountId);
        this.coopQueue.leave(accountId);
        return;
      default:
        this.reply(conn, { type: "error", error: "bad message" });
    }
  }

  private async beginPrivateMatch(room: WaitingRoom): Promise<void> {
    const [a, b] = room.members;
    if (!a || !b) return;
    const seed = this.ctx.random(4).readUInt32BE(0);
    // Private rooms never pay out — PvP Elo and co-op rewards both stay off.
    await this.launchMatch(room.mode === "coop" ? "coop_private" : "private", seed, [
      { accountId: a.accountId, username: a.username, side: a.side },
      { accountId: b.accountId, username: b.username, side: b.side },
    ]);
  }

  /**
   * Creates and registers a match, arms a `BotPlayer` for `null` seats and
   * notifies every connected human (`17` §5.3/§5.4, §9.1).
   */
  private async launchMatch(
    mode: MatchMode,
    seed: number,
    players: [
      { accountId: number | null; username: string; side: PvpSide | CoopSide; rating?: number },
      { accountId: number | null; username: string; side: PvpSide | CoopSide; rating?: number },
    ],
  ): Promise<MatchRoom> {
    const matchId = `m_${this.ctx.random(6).toString("hex")}_${this.matchCounter++}`;
    const coop = mode === "coop" || mode === "coop_private" || mode === "coop_practice";
    const match = await (coop
      ? startCoopMatch(
          this.ctx,
          mode,
          seed,
          players as [
            { accountId: number | null; username: string; side: CoopSide; rating?: number },
            { accountId: number | null; username: string; side: CoopSide; rating?: number },
          ],
          matchId,
          (finished) => this.dropMatch(finished),
        )
      : startPvpMatch(
          this.ctx,
          mode,
          seed,
          players as [
            { accountId: number | null; username: string; side: PvpSide; rating?: number },
            { accountId: number | null; username: string; side: PvpSide; rating?: number },
          ],
          matchId,
          (finished) => this.dropMatch(finished),
        ));
    this.matches.set(matchId, match);
    for (const seat of match.seats) {
      if (seat.accountId === null) {
        new BotPlayer(this.ctx, match, seat.seat, seed);
        continue;
      }
      this.matchByAccount.set(seat.accountId, match);
      const conn = this.byAccount.get(seat.accountId);
      if (conn) {
        match.attach(seat, conn.socket);
        this.reply(conn, { type: "match.start", ...match.snapshotFor(seat.seat) });
      }
    }
    return match;
  }

  private dropMatch(room: MatchRoom): void {
    this.matches.delete(room.matchId);
    for (const seat of room.seats) {
      if (seat.accountId !== null && this.matchByAccount.get(seat.accountId) === room) {
        this.matchByAccount.delete(seat.accountId);
      }
    }
  }

  private reply(conn: Connection, message: ServerMessage): void {
    send(conn.socket, message);
  }
}
