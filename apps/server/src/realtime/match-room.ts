import type { WebSocket } from "ws";
import type { Action, CombatEvent, CombatState, GameData, PvpSide } from "rules";
import { applyAction, createPvpCombat, redactEvents, viewFor } from "rules";
import type { AppContext } from "../context";
import type { MatchSnapshot } from "./protocol";

export type MatchMode = "ranked" | "private" | "practice" | "coop" | "coop_private" | "coop_practice";

/** One participant of a live match; `accountId` null marks a bot seat (§5.4, 5c.3). */
export interface MatchSeat {
  seat: number;
  accountId: number | null;
  username: string;
  socket?: WebSocket;
  /** Next `seq` this seat may send: accepted actions + 1 (`16` §8.2). */
  nextSeq: number;
  connected: boolean;
}

/** Rows go through `matchDb`; every mutating step is one SQL statement. */
export function send(socket: WebSocket | undefined, message: unknown): void {
  if (!socket) return;
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // The socket is closing; the close handler reconciles state.
  }
}

/**
 * One live match (`17` §5.3): full state, action log, per-seat connections.
 * Actions are applied serially — `applyAction` is synchronous, so no awaits sit
 * between reading and writing `state`.
 */
export class MatchRoom {
  readonly actions: { player: number; action: Action }[] = [];
  eventSeq = 0;
  ended = false;
  /** Turn deadline in ms UTC shown to clients; the clock itself arms in 5c.3. */
  deadline: number | null = null;
  private cleanupHandle: unknown;
  private endReason = "combat";

  constructor(
    private readonly ctx: AppContext,
    readonly matchId: string,
    readonly mode: MatchMode,
    readonly seed: number,
    readonly seats: MatchSeat[],
    private state: CombatState,
    setupJson: string,
    private readonly drop: (room: MatchRoom) => void,
  ) {
    const insertMatch = ctx.db.prepare(
      "INSERT INTO matches (id, mode, data_version, seed, setup_json, actions_json, status, created_at) VALUES (?, ?, ?, ?, ?, '[]', 'playing', ?)",
    );
    const insertPlayer = ctx.db.prepare(
      "INSERT INTO match_players (match_id, account_id, slot) VALUES (?, ?, ?)",
    );
    ctx.db.transaction(() => {
      insertMatch.run(matchId, mode, ctx.dataVersion, seed, setupJson, ctx.clock());
      for (const seat of seats) insertPlayer.run(matchId, seat.accountId, seat.seat);
    })();
    this.refreshDeadline();
  }

  seatOf(accountId: number): MatchSeat | undefined {
    return this.seats.find((s) => s.accountId === accountId);
  }

  /** `16` §8.2 `match.start` / `welcome.activeMatch` snapshot for one seat. */
  snapshotFor(seat: number): MatchSnapshot {
    return {
      matchId: this.matchId,
      mode: this.mode,
      you: seat,
      others: this.seats.filter((s) => s.seat !== seat).map((s) => ({ seat: s.seat, username: s.username, connected: s.connected })),
      view: viewFor(this.state, seat),
      deadline: this.deadline,
      eventSeq: this.eventSeq,
    };
  }

  attach(seat: MatchSeat, socket: WebSocket): void {
    seat.socket = socket;
    seat.connected = true;
  }

  /** A seat's socket closed: the room stays, the turn clock keeps running (`17` §5.5). */
  detach(seat: MatchSeat): void {
    seat.socket = undefined;
    seat.connected = false;
    if (!this.ended) this.push([{ type: "playerDisconnected", player: seat.seat }]);
  }

  handleAction(seat: MatchSeat, seq: number, action: Action): void {
    if (this.ended) return;
    if (seq < seat.nextSeq) return; // duplicate — ignore silently (`16` §8.3)
    if (seq > seat.nextSeq) {
      send(seat.socket, { type: "match.rejected", matchId: this.matchId, seq, reason: "bad seq" });
      return;
    }
    // The server stamps the seat; a client cannot act for another player.
    const result = applyAction(this.ctx.data, this.state, { ...action, player: seat.seat });
    if (!result.ok) {
      send(seat.socket, { type: "match.rejected", matchId: this.matchId, seq, reason: result.error });
      return;
    }
    seat.nextSeq += 1;
    this.state = result.state;
    this.actions.push({ player: seat.seat, action });
    this.ctx.db.prepare("UPDATE matches SET actions_json = ? WHERE id = ?").run(JSON.stringify(this.actions), this.matchId);
    this.refreshDeadline();
    this.push(result.events);
    if (this.state.status === "won" || this.state.status === "lost") this.finish();
  }

  /** `match.resign` → the seat's own forfeit as a system action (`17` §4.6). */
  handleResign(seat: MatchSeat): void {
    if (this.ended) return;
    const result = applyAction(this.ctx.data, this.state, {
      type: "forfeit", player: seat.seat, reason: "resign", system: true,
    });
    if (!result.ok) return;
    this.state = result.state;
    this.actions.push({ player: seat.seat, action: { type: "forfeit", player: seat.seat, reason: "resign", system: true } });
    this.ctx.db.prepare("UPDATE matches SET actions_json = ? WHERE id = ?").run(JSON.stringify(this.actions), this.matchId);
    this.push(result.events);
    if (this.state.status === "won" || this.state.status === "lost") this.finish();
  }

  handleEmote(seat: MatchSeat, emoteId: string): void {
    if (this.ended) return;
    for (const s of this.seats) send(s.socket, { type: "match.emote", matchId: this.matchId, from: seat.seat, emoteId });
  }

  /** Sends every seated human `redactEvents` + `viewFor` from their own seat. */
  private push(events: CombatEvent[]): void {
    this.eventSeq += 1;
    for (const seat of this.seats) {
      send(seat.socket, {
        type: "match.events",
        matchId: this.matchId,
        eventSeq: this.eventSeq,
        events: redactEvents(events, seat.seat),
        view: viewFor(this.state, seat.seat),
        deadline: this.deadline,
      });
    }
  }

  private refreshDeadline(): void {
    const seconds =
      this.state.status === "mulligan"
        ? this.ctx.data.pvpConfig.mulliganSeconds
        : this.state.status === "playerTurn" || this.state.status === "choosing"
          ? this.ctx.data.pvpConfig.turnSeconds
          : 0;
    this.deadline = seconds === 0 ? null : this.ctx.clock() + seconds * 1000;
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.deadline = null;
    const forfeit = [...this.actions].reverse().find((a) => a.action.type === "forfeit");
    if (forfeit && forfeit.action.type === "forfeit") this.endReason = forfeit.action.reason;
    const winner = this.state.winner;
    const resultJson = JSON.stringify({ winner: winner ?? "draw", reason: this.endReason, rounds: this.state.round });
    const finishMatch = this.ctx.db.prepare(
      "UPDATE matches SET status = 'finished', finished_at = ?, result_json = ? WHERE id = ?",
    );
    const seatResult = this.ctx.db.prepare("UPDATE match_players SET result = ? WHERE match_id = ? AND slot = ?");
    // The match record and every seat result land in one transaction (`16` §8.3).
    this.ctx.db.transaction(() => {
      finishMatch.run(this.ctx.clock(), resultJson, this.matchId);
      for (const seat of this.seats) {
        const result = winner === "draw" || winner === undefined ? "draw" : seat.seat === winner ? "won" : "lost";
        seatResult.run(result, this.matchId, seat.seat);
      }
    })();
    for (const seat of this.seats) {
      const result = winner === "draw" || winner === undefined ? "draw" : seat.seat === winner ? "won" : "lost";
      send(seat.socket, { type: "match.end", matchId: this.matchId, result, reason: this.endReason });
    }
    // The room lives 60 s so clients can fetch late messages, then leaves memory.
    this.cleanupHandle = this.ctx.scheduler.setTimeout(() => this.drop(this), 60_000);
  }
}

/** Creates a `pvp` match room and its `matches`/`match_players` rows (`17` §5.3). */
export function startPvpMatch(
  ctx: AppContext,
  mode: MatchMode,
  seed: number,
  players: [{ accountId: number | null; username: string; side: PvpSide }, { accountId: number | null; username: string; side: PvpSide }],
  matchId: string,
  drop: (room: MatchRoom) => void,
): MatchRoom {
  const { state } = createPvpCombat(ctx.data, { seed, players: [players[0].side, players[1].side] });
  const seats: MatchSeat[] = players.map((p, seat) => ({
    seat, accountId: p.accountId, username: p.username, nextSeq: 1, connected: p.accountId !== null,
  }));
  const setupJson = JSON.stringify({ players: [players[0].side, players[1].side] });
  return new MatchRoom(ctx, matchId, mode, seed, seats, state, setupJson, drop);
}

export type { GameData };
