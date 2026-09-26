import type { WebSocket } from "ws";
import type { AppContext } from "../context";
import { MatchRoom, send, startPvpMatch, type MatchSeat } from "./match-room";
import { clientMessageSchema, type ClientMessage, type ServerMessage } from "./protocol";
import { RoomManager, type WaitingRoom } from "./rooms";

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

  constructor(private readonly ctx: AppContext) {
    this.rooms = new RoomManager(
      ctx,
      (accountId, message) => send(this.byAccount.get(accountId)?.socket, message),
      (room) => this.beginPrivateMatch(room),
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
      if (message.data.type === "hello") this.onHello(conn, message.data.token, message.data.dataVersion);
      else this.reply(conn, { type: "error", error: "bad message" });
      return;
    }
    this.dispatch(conn, message.data);
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

  private onHello(conn: Connection, token: string, dataVersion: string): void {
    const accountId = this.ctx.accountByToken(token);
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
    conn.username = this.rooms.usernameOf(accountId);
    // One connection per account: a newer socket replaces the old one (`17` §5.1).
    const old = this.byAccount.get(accountId);
    if (old && old !== conn) {
      this.ctx.scheduler.clearTimeout(old.pingHandle);
      const stale = old.socket;
      old.accountId = null; // its late close event must not detach the new connection
      stale.close(CLOSE_REPLACED, "replaced");
    }
    this.byAccount.set(accountId, conn);
    // Reconnecting mid-match hands the seat's socket to this connection.
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
    const room = this.matchByAccount.get(conn.accountId);
    const seat = room?.seatOf(conn.accountId);
    if (room && seat) room.detach(seat);
  }

  private dispatch(conn: Connection, message: ClientMessage): void {
    const accountId = conn.accountId!;
    switch (message.type) {
      case "pong":
        conn.missedPings = 0;
        return;
      case "room.create":
        this.rooms.create(accountId, message.mode, message.deckId);
        return;
      case "room.join":
        this.rooms.join(accountId, message.code, message.deckId);
        return;
      case "room.leave":
        this.rooms.leave(accountId);
        return;
      case "match.action": {
        const room = this.matchByAccount.get(accountId);
        const seat = room?.seatOf(accountId);
        if (!room || !seat) {
          this.reply(conn, { type: "error", error: "no match" });
          return;
        }
        room.handleAction(seat, message.seq, message.action);
        return;
      }
      case "match.resign": {
        const room = this.matchByAccount.get(accountId);
        const seat = room?.seatOf(accountId);
        if (room && seat) room.handleResign(seat);
        return;
      }
      case "match.emote": {
        const room = this.matchByAccount.get(accountId);
        const seat = room?.seatOf(accountId);
        if (room && seat) room.handleEmote(seat, message.emoteId);
        return;
      }
      case "queue.join":
      case "queue.leave":
      case "practice.start":
        this.reply(conn, { type: "error", error: "not implemented" });
        return;
      default:
        this.reply(conn, { type: "error", error: "bad message" });
    }
  }

  private beginPrivateMatch(room: WaitingRoom): void {
    const [a, b] = room.members;
    if (!a || !b) return;
    const seed = this.ctx.random(4).readUInt32BE(0);
    const matchId = `m_${this.ctx.random(6).toString("hex")}_${this.matchCounter++}`;
    const match = startPvpMatch(
      this.ctx, "private", seed,
      [
        { accountId: a.accountId, username: a.username, side: a.side },
        { accountId: b.accountId, username: b.username, side: b.side },
      ],
      matchId,
      (finished) => this.dropMatch(finished),
    );
    this.matches.set(matchId, match);
    for (const seat of match.seats) {
      if (seat.accountId !== null) {
        this.matchByAccount.set(seat.accountId, match);
        const conn = this.byAccount.get(seat.accountId);
        if (conn) {
          match.attach(seat, conn.socket);
          this.reply(conn, { type: "match.start", ...match.snapshotFor(seat.seat) });
        }
      }
    }
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
