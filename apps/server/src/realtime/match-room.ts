import type { WebSocket } from "ws";
import type { Action, CombatEvent, CombatState, CoopRewards, CoopSide, Profile, PvpSide } from "rules";
import {
  applyAction,
  applyCoopResult,
  applyPvpResult,
  autoChoiceAction,
  coopRedactEvents,
  coopViewFor,
  createCoopCombat,
  createPvpCombat,
  ratingChange,
  redactEvents,
  viewFor,
} from "rules";
import type { AppContext } from "../context";
import type { MatchSettlement, MatchSnapshot, SettlementState } from "./protocol";

export type MatchMode = "ranked" | "private" | "practice" | "coop" | "coop_private" | "coop_practice";

/** One participant of a live match; `accountId` null marks a bot seat (§5.4, 5c.3). */
export interface MatchSeat {
  seat: number;
  accountId: number | null;
  username: string;
  /** Arena rating at match start — shown in `others` and used as `rating_before`. */
  rating?: number;
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
  private writeChain: Promise<unknown> = Promise.resolve();
  private readonly disconnectHandles = new Map<number, unknown>();
  /** Settlement lifecycle (`16` §8.4): recovery reads it — it never re-awards. */
  private settlementStatus: "playing" | "pending" | "complete" | "failed" = "playing";
  private settlementError = "";
  private readonly settlements = new Map<number, MatchSettlement>();

  constructor(
    private readonly ctx: AppContext,
    readonly matchId: string,
    readonly mode: MatchMode,
    readonly seed: number,
    readonly seats: MatchSeat[],
    private state: CombatState,
    private readonly setupJson: string,
    private readonly drop: (room: MatchRoom) => void,
  ) {
    this.armClock();
  }

  /** Writes the `matches`/`match_players` rows; factories await this once. */
  async persist(): Promise<void> {
    const insertMatch = this.ctx.db.prepare(
      "INSERT INTO matches (id, mode, data_version, seed, setup_json, actions_json, status, created_at) VALUES (?, ?, ?, ?, ?, '[]', 'playing', ?)",
    );
    const insertPlayer = this.ctx.db.prepare(
      "INSERT INTO match_players (match_id, account_id, slot) VALUES (?, ?, ?)",
    );
    await this.ctx.db.transaction(async () => {
      await insertMatch.run(this.matchId, this.mode, this.ctx.dataVersion, this.seed, this.setupJson, this.ctx.clock());
      for (const seat of this.seats) await insertPlayer.run(this.matchId, seat.accountId, seat.seat);
    });
  }

  seatOf(accountId: number): MatchSeat | undefined {
    return this.seats.find((s) => s.accountId === accountId);
  }

  /** Co-op rooms share one view model (`17` §9.1) — partner hands stay visible. */
  private get isCoop(): boolean {
    return this.mode === "coop" || this.mode === "coop_private" || this.mode === "coop_practice";
  }

  private viewFor(seat: number): CombatState {
    return this.isCoop ? coopViewFor(this.state, seat) : viewFor(this.state, seat);
  }

  private redact(events: CombatEvent[], seat: number): CombatEvent[] {
    return this.isCoop ? coopRedactEvents(events, seat) : redactEvents(events, seat);
  }

  /** `16` §8.2 `match.start` / `welcome.activeMatch` snapshot for one seat. */
  snapshotFor(seat: number): MatchSnapshot {
    return {
      matchId: this.matchId,
      mode: this.mode,
      you: seat,
      others: this.seats
        .filter((s) => s.seat !== seat)
        .map((s) => ({ seat: s.seat, username: s.username, rating: s.rating, connected: s.connected })),
      view: this.viewFor(seat),
      deadline: this.deadline,
      eventSeq: this.eventSeq,
      nextActionSeq: this.seats[seat]!.nextSeq,
      settlement: this.settlementFor(seat),
    };
  }

  /** Per-seat settlement state for snapshots (`16` §8.4). */
  private settlementFor(seat: number): SettlementState {
    switch (this.settlementStatus) {
      case "playing":
      case "pending":
        return { status: this.settlementStatus };
      case "failed":
        return { status: "failed", error: this.settlementError };
      case "complete":
        return { status: "complete", end: this.settlements.get(seat)! };
    }
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
    const reconnectSeconds = this.isCoop ? this.ctx.data.coopConfig.reconnectSeconds : this.ctx.data.pvpConfig.reconnectSeconds;
    const handle = this.ctx.scheduler.setTimeout(() => {
      this.disconnectHandles.delete(seat.seat);
      this.applyLogged(seat, { type: "forfeit", player: seat.seat, reason: "disconnect", system: true });
    }, reconnectSeconds * 1000);
    this.disconnectHandles.set(seat.seat, handle);
  }

  handleAction(seat: MatchSeat, seq: number, action: Action): void {
    // A stale frame on a retained terminal room gets the settled snapshot back.
    if (this.ended) {
      this.handleSync(seat);
      return;
    }
    // A duplicate is never applied twice — the seat gets its current snapshot
    // back so a lost ack can reconcile (`16` §8.3).
    if (seq < seat.nextSeq) {
      this.handleSync(seat);
      return;
    }
    if (seq > seat.nextSeq) {
      send(seat.socket, {
        type: "match.rejected",
        matchId: this.matchId,
        seq,
        nextActionSeq: seat.nextSeq,
        reason: "bad seq",
      });
      return;
    }
    // The server stamps the seat; a client cannot act for another player.
    const stamped = { ...action, player: seat.seat };
    const result = applyAction(this.ctx.data, this.state, stamped);
    if (!result.ok) {
      send(seat.socket, {
        type: "match.rejected",
        matchId: this.matchId,
        seq,
        nextActionSeq: seat.nextSeq,
        reason: result.error,
      });
      return;
    }
    seat.nextSeq += 1;
    seat.consecutiveTimeouts = 0; // an action of their own resets the clock count
    this.commit(seat, action, result.state, result.events);
  }

  /** `match.sync` — answers with this seat's snapshot (rejoin recovery). */
  handleSync(seat: MatchSeat): void {
    send(seat.socket, { type: "match.snapshot", ...this.snapshotFor(seat.seat) });
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
    if (this.isCoop) {
      // The shared co-op turn is open to both seats until each is done.
      return this.state.status === "playerTurn" && !this.state.players[seat]!.done;
    }
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
    // Serialise actions_json writes so a later commit cannot lose to an earlier one.
    const actionsJson = JSON.stringify(this.actions);
    const matchId = this.matchId;
    this.writeChain = this.writeChain.then(async () => {
      try {
        await this.ctx.db.prepare("UPDATE matches SET actions_json = ? WHERE id = ?").run(actionsJson, matchId);
      } catch (error) {
        console.error("persist actions failed", error);
      }
    });
    this.armClock();
    this.push(events);
    if (this.state.status === "won" || this.state.status === "lost") {
      // Settlement starts now — recovery reads "pending" until it lands.
      this.settlementStatus = "pending";
      // Settlement waits for the final actions_json write to land first.
      void this.writeChain.then(() => this.finish()).catch((error) => {
        console.error("finish failed:", error);
      });
    }
  }

  /** Re-arms the turn/mulligan clock to match the current state (`17` §4.7). */
  private armClock(): void {
    if (this.turnHandle !== undefined) {
      this.ctx.scheduler.clearTimeout(this.turnHandle);
      this.turnHandle = undefined;
    }
    const seconds =
      this.state.status === "mulligan"
        ? this.isCoop
          ? this.ctx.data.coopConfig.turnSeconds
          : this.ctx.data.pvpConfig.mulliganSeconds
        : this.state.status === "playerTurn" || this.state.status === "choosing"
          ? this.isCoop
            ? this.ctx.data.coopConfig.turnSeconds
            : this.ctx.data.pvpConfig.turnSeconds
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
    if (this.isCoop) {
      // `17` §9.1 — the shared 45 s clock ends every unfinished seat: resolve a
      // pending Chiêm Bài with its first option, then a system `endTurn`.
      for (const seat of this.seats) {
        if (this.state.status !== "playerTurn" || this.state.players[seat.seat]!.done) continue;
        this.timedOut(seat);
        if (this.ended) return;
        // Answer pending choices — a Chiêm Bài answer can owe Chọn Pha next (at most two).
        for (let i = 0; i < 2; i++) {
          const answer = autoChoiceAction(this.state, seat.seat);
          if (answer === null) break;
          if (!this.applyLogged(seat, answer)) return;
        }
        if (this.state.status !== "playerTurn" || this.state.players[seat.seat]!.done) continue;
        if (!this.applyLogged(seat, { type: "endTurn", player: seat.seat, system: true })) return;
      }
      return;
    }
    const seat = this.seats[this.state.activePlayer];
    if (!seat) return;
    this.timedOut(seat);
    if (this.ended) return;
    // Answer pending choices — a Chiêm Bài answer can owe Chọn Pha next (at most two).
    for (let i = 0; i < 2 && this.state.status === "choosing"; i++) {
      const answer = autoChoiceAction(this.state, seat.seat);
      if (answer === null) break;
      if (!this.applyLogged(seat, answer)) return;
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

  /** Sends every seated human the redacted events + their own seat view. */
  private push(events: CombatEvent[]): void {
    this.eventSeq += 1;
    for (const seat of this.seats) {
      send(seat.socket, {
        type: "match.events",
        matchId: this.matchId,
        eventSeq: this.eventSeq,
        nextActionSeq: seat.nextSeq,
        events: this.redact(events, seat.seat),
        view: this.viewFor(seat.seat),
        deadline: this.deadline,
      });
    }
    this.onPushed?.();
  }

  private async finish(): Promise<void> {
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
    // Co-op: which seats personally abandoned the match (`17` §9.2).
    const forfeited = new Set(
      this.actions.filter((a) => a.action.type === "forfeit").map((a) => a.player),
    );
    const winner = this.state.winner;
    const resultJson = this.isCoop
      ? JSON.stringify({
          winner: this.state.status === "won" ? "players" : "boss",
          reason: this.endReason,
          rounds: this.state.round,
        })
      : JSON.stringify({ winner: winner ?? "draw", reason: this.endReason, rounds: this.state.round });
    const finishMatch = this.ctx.db.prepare(
      "UPDATE matches SET status = 'finished', finished_at = ?, result_json = ? WHERE id = ?",
    );
    const seatResult = this.ctx.db.prepare("UPDATE match_players SET result = ? WHERE match_id = ? AND slot = ?");
    const seatResultRanked = this.ctx.db.prepare(
      "UPDATE match_players SET result = ?, rating_before = ?, rating_after = ? WHERE match_id = ? AND slot = ?",
    );
    const resultOf = (seat: number): "won" | "lost" | "draw" => {
      if (this.isCoop) {
        // A forfeiting seat loses personally even if the partner wins alone.
        if (this.state.status === "won" && !forfeited.has(seat)) return "won";
        return "lost";
      }
      return winner === "draw" || winner === undefined ? "draw" : seat === winner ? "won" : "lost";
    };
    // Ranked matches settle Elo and Vinh Dự for both players; queue co-op pays
    // the §9.2 rewards; private and practice matches only record the result.
    const ranked = this.mode === "ranked" && this.seats.every((seat) => seat.accountId !== null);
    const rewardedCoop = this.mode === "coop";
    // Settlement runs exactly once (`16` §8.4): a failed transaction leaves the
    // room "failed" for recovery reads — it is never retried silently.
    this.settlementStatus = "pending";
    try {
      // Elo deltas compare pre-match ratings — capture both profiles first.
      const profiles = new Map<number, Profile>();
      if (ranked || rewardedCoop) {
        for (const seat of this.seats) {
          if (seat.accountId !== null) profiles.set(seat.seat, (await this.ctx.readProfile(seat.accountId)).profile);
        }
      }
      const settled = new Map<number, { before: number; after: number; honor: number; rev: number }>();
      const coopPaid = new Map<number, { rewards: CoopRewards | null; rev: number }>();
      // The match record, seat results and both profile updates land in one
      // transaction (`16` §8.3): a crash mid-write leaves the row consistent.
      await this.ctx.db.transaction(async () => {
        await finishMatch.run(this.ctx.clock(), resultJson, this.matchId);
        for (const seat of this.seats) {
          const result = resultOf(seat.seat);
          const mine = profiles.get(seat.seat);
          if (mine === undefined) {
            await seatResult.run(result, this.matchId, seat.seat);
            continue;
          }
          if (rewardedCoop) {
            // §9.2 — a forfeited seat is settled as a personal loss with no reward.
            const applied = applyCoopResult(this.ctx.data, mine, {
              result: result === "won" ? "won" : "lost",
              forfeited: forfeited.has(seat.seat),
              now: this.ctx.clock(),
            });
            const rev = await this.ctx.saveProfile(seat.accountId!, applied.profile);
            await seatResult.run(result, this.matchId, seat.seat);
            coopPaid.set(seat.seat, { rewards: applied.rewards, rev });
            continue;
          }
          const opponent = this.seats.find((s) => s.seat !== seat.seat)!;
          const theirs = profiles.get(opponent.seat)!;
          const score = result === "won" ? 1 : result === "lost" ? 0 : 0.5;
          const before = mine.arena.rating;
          const delta = ratingChange(mine.arena, theirs.arena, score);
          const applied = applyPvpResult(this.ctx.data, mine, {
            result,
            reason: this.endReason,
            round: this.state.round,
            now: this.ctx.clock(),
            ratingDelta: delta,
          });
          const rev = await this.ctx.saveProfile(seat.accountId!, applied.profile);
          await seatResultRanked.run(result, before, applied.profile.arena.rating, this.matchId, seat.seat);
          settled.set(seat.seat, { before, after: applied.profile.arena.rating, honor: applied.honor, rev });
        }
      });
      for (const seat of this.seats) {
        const extras = settled.get(seat.seat);
        const coop = coopPaid.get(seat.seat);
        const end: MatchSettlement = {
          result: resultOf(seat.seat),
          reason: this.endReason,
          ...(extras
            ? { rating: { before: extras.before, after: extras.after }, rewards: { honor: extras.honor }, profileRev: extras.rev }
            : {}),
          ...(coop ? { rewards: coop.rewards, profileRev: coop.rev } : {}),
        };
        this.settlements.set(seat.seat, end);
        send(seat.socket, { type: "match.end", matchId: this.matchId, ...end });
      }
      this.settlementStatus = "complete";
    } catch (error) {
      console.error("finish failed:", error);
      this.settlementStatus = "failed";
      this.settlementError = error instanceof Error ? error.message : String(error);
      // The result stands even when the reward write did not — tell each seat.
      for (const seat of this.seats) {
        send(seat.socket, {
          type: "match.end",
          matchId: this.matchId,
          result: resultOf(seat.seat),
          reason: this.endReason,
          settlementError: this.settlementError,
        });
      }
    }
    // The room lives 60 s so clients can fetch late messages, then leaves memory.
    this.cleanupHandle = this.ctx.scheduler.setTimeout(() => this.drop(this), 60_000);
  }
}

/** Creates a `pvp` match room and its `matches`/`match_players` rows (`17` §5.3). */
export async function startPvpMatch(
  ctx: AppContext,
  mode: MatchMode,
  seed: number,
  players: [
    { accountId: number | null; username: string; side: PvpSide; rating?: number },
    { accountId: number | null; username: string; side: PvpSide; rating?: number },
  ],
  matchId: string,
  drop: (room: MatchRoom) => void,
): Promise<MatchRoom> {
  const { state } = createPvpCombat(ctx.data, { seed, players: [players[0].side, players[1].side] });
  const seats: MatchSeat[] = players.map((p, seat) => ({
    seat, accountId: p.accountId, username: p.username, rating: p.rating, nextSeq: 1,
    connected: p.accountId === null, consecutiveTimeouts: 0,
  }));
  const setupJson = JSON.stringify({ players: [players[0].side, players[1].side] });
  const room = new MatchRoom(ctx, matchId, mode, seed, seats, state, setupJson, drop);
  await room.persist();
  return room;
}

/**
 * Creates a co-op match room (`17` §9.1) on the configured encounter. The
 * setup row carries `mode`/`encounterId` so `replayMatch` rebuilds it exactly.
 */
export async function startCoopMatch(
  ctx: AppContext,
  mode: MatchMode,
  seed: number,
  players: [
    { accountId: number | null; username: string; side: CoopSide; rating?: number },
    { accountId: number | null; username: string; side: CoopSide; rating?: number },
  ],
  matchId: string,
  drop: (room: MatchRoom) => void,
): Promise<MatchRoom> {
  const encounterId = ctx.data.coopConfig.encounterId;
  const { state } = createCoopCombat(ctx.data, {
    seed,
    players: [players[0].side, players[1].side],
    encounterId,
  });
  const seats: MatchSeat[] = players.map((p, seat) => ({
    seat, accountId: p.accountId, username: p.username, rating: p.rating, nextSeq: 1,
    connected: p.accountId === null, consecutiveTimeouts: 0,
  }));
  const setupJson = JSON.stringify({ mode: "coop", encounterId, players: [players[0].side, players[1].side] });
  const room = new MatchRoom(ctx, matchId, mode, seed, seats, state, setupJson, drop);
  await room.persist();
  return room;
}
