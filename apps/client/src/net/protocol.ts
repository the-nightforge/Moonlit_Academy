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
  /** Next action `seq` the server accepts from this seat — each receiver sees its own. */
  nextActionSeq: number;
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
  | {
      type: "match.end";
      matchId: string;
      result: "won" | "lost" | "draw";
      reason: string;
      rating?: { before: number; after: number };
      /** Ranked pays `honor`; queue co-op pays `moonJade`/`moonDust` (`16` §8.8/§8.9). */
      rewards?: { honor?: number; moonJade?: number; moonDust?: number; firstWin?: boolean };
      profileRev?: number;
    }
  | { type: "match.emote"; matchId: string; from: number; emoteId: string }
  | { type: "error"; error: string }
  | { type: "ping" };
