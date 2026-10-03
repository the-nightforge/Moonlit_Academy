import type { CardDef, CardInstance, CombatEvent, CombatState } from "rules";

/** The settled outcome of a match (`16` §8.3) — the `match.end` payload. */
export interface MatchSettlement {
  result: "won" | "lost" | "draw";
  reason: string;
  rating?: { before: number; after: number };
  rewards?: { honor?: number; moonJade?: number; moonDust?: number; firstWin?: boolean } | null;
  profileRev?: number;
}

/**
 * Settlement lifecycle on a snapshot (`16` §8.4): a retained terminal room
 * keeps reporting it for ~60 s so a late reconnect still learns the outcome.
 */
export type SettlementState =
  | { status: "playing" | "pending" }
  | { status: "complete"; end: MatchSettlement }
  | { status: "failed"; error: string };

/**
 * Public record of a card just played (`16` §8.2): the instance and its
 * definition as they stood at cast time. Both seats may see it — a played
 * card is public even when it leaves the discard pile within the same batch
 * (Luân Hồi) and the redacted view drops it again.
 */
export interface PublicPlayedCard {
  instance: CardInstance;
  definition: CardDef;
}

/** `16` §8.2 — client mirror of the realtime protocol (`apps/server/src/realtime/protocol.ts`). */
export interface MatchSnapshot {
  matchId: string;
  mode: string;
  you: number;
  others: { seat: number; username: string; rating?: number; connected: boolean }[];
  view: CombatState;
  deadline: number | null;
  eventSeq: number;
  /** Next action `seq` the server accepts from this seat — each receiver sees its own. */
  nextActionSeq: number;
  settlement: SettlementState;
}

export type ServerMessage =
  | { type: "welcome"; account: { id: number; username: string }; serverTime: number; activeMatch?: MatchSnapshot }
  | { type: "queue.status"; mode: string; waitingSeconds: number }
  | { type: "room.created"; code: string; mode: string; players: { username: string; ready: boolean }[] }
  | { type: "room.updated"; code: string; mode: string; players: { username: string; ready: boolean }[] }
  | { type: "room.closed"; code: string }
  | ({ type: "match.start" } & MatchSnapshot)
  | ({ type: "match.snapshot" } & MatchSnapshot)
  | {
      type: "match.events";
      matchId: string;
      eventSeq: number;
      nextActionSeq: number;
      events: CombatEvent[];
      view: CombatState;
      deadline: number | null;
      /** Cast-time metadata of every `cardPlayed` in this batch, keyed by instanceId. */
      revealedCards?: Record<string, PublicPlayedCard>;
    }
  | { type: "match.rejected"; matchId: string; seq: number; nextActionSeq: number; reason: string }
  | ({ type: "match.end"; matchId: string } & MatchSettlement & {
      /** Present when the settlement write failed — the result stands, rewards did not (`16` §8.4). */
      settlementError?: string;
    })
  | { type: "match.emote"; matchId: string; from: number; emoteId: string }
  | { type: "error"; error: string }
  | { type: "ping" };
