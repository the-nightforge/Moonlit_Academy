import type { CombatEvent, CombatState } from "rules";

/** `16` §8.2 — client mirror of the realtime protocol (`apps/server/src/realtime/protocol.ts`). */
export interface MatchSnapshot {
  matchId: string;
  mode: string;
  you: number;
  others: { seat: number; username: string; rating?: number; connected: boolean }[];
  view: CombatState;
  deadline: number | null;
  eventSeq: number;
}

export type ServerMessage =
  | { type: "welcome"; account: { id: number; username: string }; serverTime: number; activeMatch?: MatchSnapshot }
  | { type: "queue.status"; mode: string; waitingSeconds: number }
  | { type: "room.created"; code: string; mode: string; players: { username: string; ready: boolean }[] }
  | { type: "room.updated"; code: string; mode: string; players: { username: string; ready: boolean }[] }
  | { type: "room.closed"; code: string }
  | ({ type: "match.start" } & MatchSnapshot)
  | { type: "match.events"; matchId: string; eventSeq: number; events: CombatEvent[]; view: CombatState; deadline: number | null }
  | { type: "match.rejected"; matchId: string; seq: number; reason: string }
  | {
      type: "match.end";
      matchId: string;
      result: "won" | "lost" | "draw";
      reason: string;
      rating?: { before: number; after: number };
      rewards?: { honor: number };
      profileRev?: number;
    }
  | { type: "match.emote"; matchId: string; from: number; emoteId: string }
  | { type: "error"; error: string }
  | { type: "ping" };
