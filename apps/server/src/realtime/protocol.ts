import { z } from "zod";
import type { CombatEvent, CombatState } from "rules";

/** `16` §8.2 — messages the client may send. `forfeit` is system-only (`01` §15.6). */
const id = z.string().max(64);
const combatAction = z.union([
  z.object({ type: z.literal("playCard"), instanceId: id, targetId: id.optional() }),
  z.object({ type: z.literal("mulligan"), instanceIds: z.array(id).max(16) }),
  z.object({ type: z.literal("chooseCard"), instanceId: id }),
  z.object({ type: z.literal("chooseMoon"), offset: z.union([z.literal(0), z.literal(1), z.literal(2)]) }),
  // `01` §5.8–5.9: decree actions — legality (phase, limits) is the replay's job.
  z.object({ type: z.literal("discardCard"), instanceId: id }),
  z.object({ type: z.literal("bloodPact"), heroId: id }),
  z.object({ type: z.literal("endTurn") }),
]);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), token: z.string().min(1).max(256), dataVersion: z.string().max(64) }),
  z.object({ type: z.literal("queue.join"), mode: z.enum(["ranked", "coop"]), deckId: id }),
  z.object({ type: z.literal("queue.leave") }),
  z.object({ type: z.literal("room.create"), mode: z.enum(["pvp", "coop"]), deckId: id }),
  z.object({ type: z.literal("room.join"), code: z.string().min(4).max(8), deckId: id }),
  z.object({ type: z.literal("room.leave") }),
  z.object({ type: z.literal("practice.start"), mode: z.enum(["pvp", "coop"]), deckId: id }),
  z.object({ type: z.literal("match.action"), matchId: id, seq: z.number().int().nonnegative(), action: combatAction }),
  z.object({ type: z.literal("match.resign"), matchId: id }),
  z.object({ type: z.literal("match.emote"), matchId: id, emoteId: z.string().max(64) }),
  z.object({ type: z.literal("match.sync"), matchId: id }),
  z.object({ type: z.literal("pong") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** The settled outcome of a match (`16` §8.3) — the `match.end` payload. */
export interface MatchSettlement {
  result: "won" | "lost" | "draw";
  reason: string;
  rating?: { before: number; after: number };
  rewards?: unknown;
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

/** The per-seat snapshot of a live match (`17` §5.2). */
export interface MatchSnapshot {
  matchId: string;
  mode: string;
  /** The receiver's seat. */
  you: number;
  /** Other participants (PvP: the opponent; co-op: the partner), in seat order. */
  others: { seat: number; username: string; rating?: number; connected: boolean }[];
  view: CombatState;
  /** Turn deadline in ms UTC; null until the turn clock is armed (5c.3). */
  deadline: number | null;
  eventSeq: number;
  /** Next action `seq` the server accepts from this seat — each receiver sees its own (`16` §8.3). */
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
    }
  | { type: "match.rejected"; matchId: string; seq: number; nextActionSeq: number; reason: string }
  | ({ type: "match.end"; matchId: string } & MatchSettlement & {
      /** Present when the settlement write failed — the result stands, rewards did not (`16` §8.4). */
      settlementError?: string;
    })
  | { type: "match.emote"; matchId: string; from: number; emoteId: string }
  | { type: "error"; error: string }
  | { type: "ping" };
