import type { WebSocket } from "ws";
import type { Action, CombatEvent, CombatState, PvpSide } from "rules";
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
  /** Consecutive turns ended by the timeout clock (`17` §4.7). */
  consecutiveTimeouts: number;
}

export function send(socket: WebSocket | undefined, message: unknown): void {
  if (!socket) return;
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // The socket is closing; the close handler reconciles state.
  }
}

/**
 * One live match (`17` §5.3): full state, action log, per-seat connections and
 * clocks. Actions are applied serially — `applyAction` is synchronous, so no
 * awaits sit between reading and writing `state`.
 */
export class MatchRoom {
  readonly actions: { player: number; action: Action }[] = [];
  eventSeq = 0;
  ended = false;
  /** Turn deadline in ms UTC shown to clients; enforced by `turnHandle`. */
  deadline: number | null = null;
  /** Called after every event push — the bot driver hooks here (§5.4). */
  onPushed?: () => void;
  private cleanupHandle: unknown;
  private endReason = "combat";
  private turnHandle: unknown;
  private readonly disconnectHandles = new Map<number, unknown>();

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
    this.armClock();
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

  /** Reconnecting re-arms the seat's socket and cancels its disconnect clock. */
  attach(seat: MatchSeat, socket: WebSocket): void {
    const pending = this.disconnectHandles.get(seat.seat);
    if (pending !== undefined) {
      this.ctx.scheduler.clearTimeout(pending);
      this.disconnectHandles.delete(seat.seat);
    }
    seat.socket = socket;
    seat.connected = true;
  }

  /**
   * A seat's socket closed: the room and its turn clock keep running
   * (`17` §5.5); over `reconnectSeconds` the seat forfeits as `disconnect`.
   */
  detach(seat: MatchSeat): void {
    seat.socket = undefined;
    seat.connected = false;
    if (this.ended) return;
    this.push([{ type: "playerDisconnected", player: seat.seat }]);
    const handle = this.ctx.scheduler.setTimeout(() => {
      this.disconnectHandles.delete(seat.seat);
      this.applyLogged(seat, { type: "forfeit", player: seat.seat, reason: "disconnect", system: true });
    }, this.ctx.data.pvpConfig.reconnectSeconds * 1000);
    this.disconnectHandles.set(seat.seat, handle);
  }

  handleAction(seat: MatchSeat, seq: number, action: Action): void {
    if (this.ended) return;
    if (seq < seat.nextSeq) return; // duplicate — ignore silently (`16` §8.3)
    if (seq > seat.nextSeq) {
      send(seat.socket, { type: "match.rejected", matchId: this.matchId, seq, reason: "bad seq" });
      return;
    }
    // The server stamps the seat; a client cannot act for another player.
    const stamped = { ...action, player: seat.seat };
    const result = applyAction(this.ctx.data, this.state, stamped);
    if (!result.ok) {
      send(seat.socket, { type: "match.rejected", matchId: this.matchId, seq, reason: result.error });
      return;
    }
    seat.nextSeq += 1;
    seat.consecutiveTimeouts = 0; // an action of their own resets the clock count
    this.commit(seat, action, result.state, result.events);
  }

  /** `match.resign` → the seat's own forfeit as a system action (`17` §4.6). */
  handleResign(seat: MatchSeat): void {
    if (this.ended) return;
    this.applyLogged(seat, { type: "forfeit", player: seat.seat, reason: "resign", system: true });
  }

  handleEmote(seat: MatchSeat, emoteId: string): void {
    if (this.ended) return;
    for (const s of this.seats) send(s.socket, { type: "match.emote", matchId: this.matchId, from: seat.seat, emoteId });
  }

  /** A bot seat's action: no seq check — the server chooses it (`17` §5.4). */
  botAction(seat: MatchSeat, action: Action): void {
    if (this.ended) return;
    this.applyLogged(seat, { ...action, player: seat.seat } as Action);
  }

  /** `true` while `seat` may legally act (its mulligan or its turn). */
  canAct(seat: number): boolean {
    if (this.ended) return false;
    if (this.state.status === "mulligan") return !this.state.players[seat]!.mulliganDone;
    return (this.state.status === "playerTurn" || this.state.status === "choosing") && this.state.activePlayer === seat;
  }

  get combatState(): CombatState {
    return this.state;
  }

  /**
   * Applies `action` for `seat` without a `seq` (clock substitutes, system
   * forfeit, bot turns), logs it, pushes views, and finishes the match if done.
   */
  private applyLogged(seat: MatchSeat, action: Action): boolean {
    const result = applyAction(this.ctx.data, this.state, action);
    if (!result.ok) return false;
    this.commit(seat, action, result.state, result.events);
    return true;
  }

  private commit(seat: MatchSeat, action: Action, state: CombatState, events: CombatEvent[]): void {
    this.state = state;
    this.actions.push({ player: seat.seat, action });
    this.ctx.db.prepare("UPDATE matches SET actions_json = ? WHERE id = ?").run(JSON.stringify(this.actions), this.matchId);
    this.armClock();
    this.push(events);
    if (this.state.status === "won" || this.state.status === "lost") this.finish();
  }

  /** Re-arms the turn/mulligan clock to match the current state (`17` §4.7). */
  private armClock(): void {
    if (this.turnHandle !== undefined) {
      this.ctx.scheduler.clearTimeout(this.turnHandle);
      this.turnHandle = undefined;
    }
    const seconds =
      this.state.status === "mulligan"
        ? this.ctx.data.pvpConfig.mulliganSeconds
        : this.state.status === "playerTurn" || this.state.status === "choosing"
          ? this.ctx.data.pvpConfig.turnSeconds
          : 0;
    this.deadline = seconds === 0 ? null : this.ctx.clock() + seconds * 1000;
    if (seconds > 0 && !this.ended) {
      this.turnHandle = this.ctx.scheduler.setTimeout(() => this.clockExpired(), seconds * 1000);
    }
  }

  /**
   * `17` §4.7 — the clock plays for whoever timed out: `mulligan []`, or
   * `chooseCard` (first option) then `endTurn`. Three consecutive timed-out
   * turns forfeit the seat.
   */
  private clockExpired(): void {
    this.turnHandle = undefined;
    if (this.ended) return;
    if (this.state.status === "mulligan") {
      for (const seat of this.seats) {
        if (this.state.players[seat.seat]!.mulliganDone) continue;
        this.timedOut(seat);
        if (this.ended) return;
        this.applyLogged(seat, { type: "mulligan", instanceIds: [], player: seat.seat });
        if (this.ended) return;
      }
      return;
    }
    const seat = this.seats[this.state.activePlayer];
    if (!seat) return;
    this.timedOut(seat);
    if (this.ended) return;
    const pending = this.state.players[seat.seat]!.pendingChoice;
    if (this.state.status === "choosing" && pending && pending.options[0] !== undefined) {
      if (!this.applyLogged(seat, { type: "chooseCard", instanceId: pending.options[0], player: seat.seat })) return;
    }
    if (this.state.status === "playerTurn" && this.state.activePlayer === seat.seat) {
      this.applyLogged(seat, { type: "endTurn", player: seat.seat });
    }
  }

  private timedOut(seat: MatchSeat): void {
    seat.consecutiveTimeouts += 1;
    if (seat.consecutiveTimeouts >= this.ctx.data.pvpConfig.timeoutsToForfeit) {
      this.applyLogged(seat, { type: "forfeit", player: seat.seat, reason: "timeout", system: true });
    }
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
    this.onPushed?.();
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.deadline = null;
    if (this.turnHandle !== undefined) {
      this.ctx.scheduler.clearTimeout(this.turnHandle);
      this.turnHandle = undefined;
    }
    for (const handle of this.disconnectHandles.values()) this.ctx.scheduler.clearTimeout(handle);
    this.disconnectHandles.clear();
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
    seat, accountId: p.accountId, username: p.username, nextSeq: 1,
    connected: p.accountId === null, consecutiveTimeouts: 0,
  }));
  const setupJson = JSON.stringify({ players: [players[0].side, players[1].side] });
  return new MatchRoom(ctx, matchId, mode, seed, seats, state, setupJson, drop);
}
