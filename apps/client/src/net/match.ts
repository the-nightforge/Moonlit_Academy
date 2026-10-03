import type { Action, CombatEvent, CombatState } from "rules";
import type { NetSocket } from "./socket";
import type { MatchSettlement, MatchSnapshot, ServerMessage, SettlementState } from "./protocol";

/**
 * One network match (`16` §8.2/§8.3): the seat's action `seq`, the latest
 * server view, and the event stream routed to the combat scene. The server is
 * authoritative — this class never applies rules itself.
 */
export class NetMatch {
  readonly matchId: string;
  readonly mode: string;
  readonly you: number;
  readonly others: { seat: number; username: string; connected: boolean }[];
  view: CombatState;
  deadline: number | null;
  /** The settled outcome once it arrives — from `match.end` or a terminal snapshot (`16` §8.4). */
  ended: MatchSettlement | null = null;
  /** Settlement lifecycle as last reported by a snapshot (`16` §8.4). */
  settlement: SettlementState = { status: "playing" };

  private seq: number;
  private lastEventSeq: number;
  /** The action `seq` in flight — at most one (`16` §8.3). */
  private pendingSeq: number | null = null;
  /** Scene hooks — set while the combat scene is active. */
  onPush: (events: CombatEvent[], view: CombatState) => void = () => {};
  onEnd: (result: "won" | "lost" | "draw", reason: string) => void = () => {};
  onRejected: (reason: string) => void = () => {};
  onEmote: (from: number, emoteId: string) => void = () => {};
  /** A `match.snapshot` answer to `match.sync` resynced the seat like a rejoin. */
  onRejoin: (snapshot: MatchSnapshot, lostPending: boolean) => void = () => {};

  constructor(
    private readonly net: NetSocket,
    snapshot: MatchSnapshot,
  ) {
    this.matchId = snapshot.matchId;
    this.mode = snapshot.mode;
    this.you = snapshot.you;
    this.others = snapshot.others;
    this.view = snapshot.view;
    this.deadline = snapshot.deadline;
    this.lastEventSeq = snapshot.eventSeq;
    this.seq = snapshot.nextActionSeq;
    this.settlement = snapshot.settlement;
    if (snapshot.settlement.status === "complete") this.ended = snapshot.settlement.end;
  }

  /**
   * One pending action at a time (`16` §8.3). `seq` is only consumed when the
   * frame actually leaves — offline sends return false and keep the seq.
   */
  sendAction(action: Action): boolean {
    if (this.pendingSeq !== null) return false;
    const seq = this.seq;
    if (!this.net.sendMatch({ type: "match.action", matchId: this.matchId, seq, action })) return false;
    this.seq += 1;
    this.pendingSeq = seq;
    return true;
  }

  /** `true` while the sent action awaits the server's `nextActionSeq` ack (`16` §8.3). */
  get pending(): boolean {
    return this.pendingSeq !== null;
  }

  /** Asks the server for a fresh snapshot — recovery without waiting for `welcome`. */
  requestSync(): boolean {
    return this.net.sendMatch({ type: "match.sync", matchId: this.matchId });
  }

  resign(): void {
    this.net.sendMatch({ type: "match.resign", matchId: this.matchId });
  }

  /** Fixed chat emote (`17` §7.3); the client throttles to one per 3 s. */
  sendEmote(emoteId: string): void {
    this.net.sendMatch({ type: "match.emote", matchId: this.matchId, emoteId });
  }

  /** `true` while the seat may legally act from its own view. */
  canAct(): boolean {
    const status = this.view.status;
    const seat = this.view.players[this.you]!;
    if (status === "mulligan") return !seat.mulliganDone;
    // Co-op keeps `playerTurn` open for both seats; a finished seat is done.
    if (this.view.mode === "coop" && seat.done) return false;
    return status === "playerTurn" || status === "choosing";
  }

  /** Routes a server message; returns false when it belongs to another match. */
  handle(message: ServerMessage): boolean {
    if (!("matchId" in message) || message.matchId !== this.matchId) return false;
    switch (message.type) {
      case "match.events":
        // The server's next expected seq acknowledges our pending action and
        // resyncs `seq` — even on a replayed push the ack must land.
        if (this.pendingSeq !== null && message.nextActionSeq > this.pendingSeq) this.pendingSeq = null;
        this.seq = Math.max(this.seq, message.nextActionSeq);
        if (message.eventSeq <= this.lastEventSeq) return true; // replay on rejoin
        this.lastEventSeq = message.eventSeq;
        this.deadline = message.deadline;
        this.view = message.view;
        this.onPush(message.events, message.view);
        return true;
      case "match.rejected":
        // The server never consumed this seq — `nextActionSeq` is where to retry.
        if (message.seq === this.pendingSeq) this.pendingSeq = null;
        this.seq = message.nextActionSeq;
        this.onRejected(message.reason);
        return true;
      case "match.snapshot": {
        const lostPending = this.rejoin(message);
        this.onRejoin(message, lostPending);
        return true;
      }
      case "match.end": {
        const end: MatchSettlement = {
          result: message.result,
          reason: message.reason,
          rating: message.rating,
          rewards: message.rewards,
          profileRev: message.profileRev,
        };
        this.ended = end;
        // A `settlementError` means the result stands but the reward write failed.
        this.settlement =
          message.settlementError !== undefined
            ? { status: "failed", error: message.settlementError }
            : { status: "complete", end };
        this.onEnd(message.result, message.reason);
        return true;
      }
      case "match.emote":
        this.onEmote(message.from, message.emoteId);
        return true;
      default:
        return true; // future match.* frames for this id
    }
  }

  /**
   * Reconnect/sync: the server resent the whole snapshot — take its state and
   * its `nextActionSeq`. A pending the server never accepted is dropped, not
   * replayed; returns true when such an unconfirmed action was discarded.
   */
  rejoin(snapshot: MatchSnapshot): boolean {
    const lostPending = this.pendingSeq !== null && snapshot.nextActionSeq <= this.pendingSeq;
    this.view = snapshot.view;
    this.deadline = snapshot.deadline;
    this.lastEventSeq = snapshot.eventSeq;
    this.seq = snapshot.nextActionSeq;
    this.pendingSeq = null;
    this.settlement = snapshot.settlement;
    // A terminal snapshot restores the settled outcome; pending/failed keeps the
    // terminal view's provisional result instead (`16` §8.4).
    this.ended = snapshot.settlement.status === "complete" ? snapshot.settlement.end : null;
    for (const other of snapshot.others) {
      const known = this.others.find((o) => o.seat === other.seat);
      if (known) known.connected = other.connected;
    }
    return lostPending;
  }
}
