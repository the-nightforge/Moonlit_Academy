import type { Action, CombatEvent, CombatState } from "rules";
import type { NetSocket } from "./socket";
import type { MatchSnapshot, ServerMessage } from "./protocol";

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
  /** Ranked and queue co-op matches carry rewards and the new profile rev (`16` §8.8/§8.9). */
  ended: {
    result: "won" | "lost" | "draw";
    reason: string;
    rating?: { before: number; after: number };
    rewards?: { honor?: number; moonJade?: number; moonDust?: number; firstWin?: boolean };
    profileRev?: number;
  } | null = null;

  private seq = 1;
  private lastEventSeq: number;
  /** Scene hooks — set while the combat scene is active. */
  onPush: (events: CombatEvent[], view: CombatState) => void = () => {};
  onEnd: (result: "won" | "lost" | "draw", reason: string) => void = () => {};
  onRejected: (reason: string) => void = () => {};
  onEmote: (from: number, emoteId: string) => void = () => {};

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
  }

  /** `seq` is only consumed on acceptance; a rejection rolls it back (`16` §8.3). */
  sendAction(action: Action): void {
    const seq = this.seq;
    this.seq += 1;
    this.net.send({ type: "match.action", matchId: this.matchId, seq, action });
    this.pendingSeq = seq;
  }

  private pendingSeq: number | null = null;

  resign(): void {
    this.net.send({ type: "match.resign", matchId: this.matchId });
  }

  /** Fixed chat emote (`17` §7.3); the client throttles to one per 3 s. */
  sendEmote(emoteId: string): void {
    this.net.send({ type: "match.emote", matchId: this.matchId, emoteId });
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
        if (message.eventSeq <= this.lastEventSeq) return true; // replay on rejoin
        this.lastEventSeq = message.eventSeq;
        this.deadline = message.deadline;
        this.view = message.view;
        this.onPush(message.events, message.view);
        return true;
      case "match.rejected":
        if (message.seq === this.pendingSeq) {
          this.seq = this.pendingSeq; // never consumed — the client may resend
          this.pendingSeq = null;
        }
        this.onRejected(message.reason);
        return true;
      case "match.end":
        this.ended = {
          result: message.result,
          reason: message.reason,
          rating: message.rating,
          rewards: message.rewards,
          profileRev: message.profileRev,
        };
        this.onEnd(message.result, message.reason);
        return true;
      case "match.emote":
        this.onEmote(message.from, message.emoteId);
        return true;
      default:
        return true; // future match.* frames for this id
    }
  }

  /** Reconnect: the server resent the whole snapshot — take its state. */
  rejoin(snapshot: MatchSnapshot): void {
    this.view = snapshot.view;
    this.deadline = snapshot.deadline;
    this.lastEventSeq = snapshot.eventSeq;
    for (const other of snapshot.others) {
      const known = this.others.find((o) => o.seat === other.seat);
      if (known) known.connected = other.connected;
    }
  }
}
