import type { CoopSide, PvpSide } from "rules";
import type { AppContext } from "../context";

/** Ranked queue tuning (`17` §6.1). */
export const QUEUE_TICK_MS = 1_000;
export const QUEUE_BASE_RANGE = 100;
export const QUEUE_RANGE_PER_10S = 50;
/** Never rematch an opponent met in the last 2 ranked matches of the last 10 min. */
export const REMATCH_WINDOW_MS = 10 * 60 * 1000;
export const REMATCH_MATCHES = 2;

/** One player waiting for a ranked match; `side` is already pvp-normalized. */
export interface QueueEntry {
  accountId: number;
  username: string;
  deckId: string;
  side: PvpSide;
  rating: number;
  joinedAt: number;
}

/**
 * The ranked queue (`17` §6.1, `16` §8.8): ticks every second — pushes
 * `queue.status` to each waiter, then pairs the closest-rated two players whose
 * rating gap fits `±100 + 50 × (longest wait / 10 s)` and who have not met in
 * their last 2 ranked matches of the past 10 minutes.
 */
export class RankedQueue {
  private readonly entries = new Map<number, QueueEntry>();
  private readonly recentOpponents: (accountId: number) => number[];

  constructor(
    private readonly ctx: AppContext,
    private readonly sendTo: (accountId: number, message: unknown) => void,
    private readonly startMatch: (a: QueueEntry, b: QueueEntry) => void,
  ) {
    const recent = ctx.db.prepare<[number, number], { opponent: number | null }>(
      `SELECT opp.account_id AS opponent
       FROM match_players mine
       JOIN matches m ON m.id = mine.match_id AND m.mode = 'ranked' AND m.status = 'finished'
       JOIN match_players opp ON opp.match_id = mine.match_id AND opp.slot <> mine.slot
       WHERE mine.account_id = ? AND m.finished_at > ?
       ORDER BY m.finished_at DESC LIMIT ${REMATCH_MATCHES}`,
    );
    this.recentOpponents = (accountId) =>
      recent.all(accountId, ctx.clock() - REMATCH_WINDOW_MS).flatMap((row) => (row.opponent === null ? [] : [row.opponent]));
    this.arm();
  }

  entryOf(accountId: number): QueueEntry | undefined {
    return this.entries.get(accountId);
  }

  /** Queues the player (the hub validates deck/mode first); no-op if already waiting. */
  join(entry: QueueEntry): void {
    if (this.entries.has(entry.accountId)) return;
    this.entries.set(entry.accountId, entry);
    this.sendStatus(entry, 0);
  }

  leave(accountId: number): void {
    this.entries.delete(accountId);
  }

  private arm(): void {
    this.ctx.scheduler.setTimeout(() => this.tick(), QUEUE_TICK_MS);
  }

  private tick(): void {
    this.arm();
    const now = this.ctx.clock();
    const waiting = [...this.entries.values()];
    for (const entry of waiting) this.sendStatus(entry, Math.floor((now - entry.joinedAt) / 1000));

    // Every in-range pair is a candidate; the closest rating match wins.
    const candidates: { a: QueueEntry; b: QueueEntry; gap: number }[] = [];
    for (let i = 0; i < waiting.length; i++) {
      for (let j = i + 1; j < waiting.length; j++) {
        const a = waiting[i]!;
        const b = waiting[j]!;
        const range = QUEUE_BASE_RANGE + QUEUE_RANGE_PER_10S * Math.floor(Math.max(now - a.joinedAt, now - b.joinedAt) / 10_000);
        const gap = Math.abs(a.rating - b.rating);
        if (gap <= range) candidates.push({ a, b, gap });
      }
    }
    candidates.sort((x, y) => x.gap - y.gap);
    for (const { a, b } of candidates) {
      if (!this.entries.has(a.accountId) || !this.entries.has(b.accountId)) continue;
      if (this.recentOpponents(a.accountId).includes(b.accountId)) continue;
      this.entries.delete(a.accountId);
      this.entries.delete(b.accountId);
      this.startMatch(a, b);
    }
  }

  private sendStatus(entry: QueueEntry, waitingSeconds: number): void {
    this.sendTo(entry.accountId, { type: "queue.status", mode: "ranked", waitingSeconds });
  }
}

/** One player waiting for a co-op match; `side` is the full PvE-strength loadout. */
export interface CoopQueueEntry {
  accountId: number;
  username: string;
  deckId: string;
  side: CoopSide;
  joinedAt: number;
}

/**
 * The co-op queue (`17` §9.1): no rating and no rematch rules — partners are
 * allies, so the two longest-waiting entries pair up in arrival order.
 * `queue.status` ticks every second exactly like the ranked queue.
 */
export class CoopQueue {
  private readonly entries = new Map<number, CoopQueueEntry>();

  constructor(
    private readonly ctx: AppContext,
    private readonly sendTo: (accountId: number, message: unknown) => void,
    private readonly startMatch: (a: CoopQueueEntry, b: CoopQueueEntry) => void,
  ) {
    this.arm();
  }

  entryOf(accountId: number): CoopQueueEntry | undefined {
    return this.entries.get(accountId);
  }

  join(entry: CoopQueueEntry): void {
    if (this.entries.has(entry.accountId)) return;
    this.entries.set(entry.accountId, entry);
    this.sendTo(entry.accountId, { type: "queue.status", mode: "coop", waitingSeconds: 0 });
  }

  leave(accountId: number): void {
    this.entries.delete(accountId);
  }

  private arm(): void {
    this.ctx.scheduler.setTimeout(() => this.tick(), QUEUE_TICK_MS);
  }

  private tick(): void {
    this.arm();
    const now = this.ctx.clock();
    const waiting = [...this.entries.values()];
    for (const entry of waiting) {
      this.sendTo(entry.accountId, {
        type: "queue.status",
        mode: "coop",
        waitingSeconds: Math.floor((now - entry.joinedAt) / 1000),
      });
    }
    // Map iteration order is insertion order — the two earliest arrivals pair.
    while (this.entries.size >= 2) {
      const [a, b] = [...this.entries.values()];
      this.entries.delete(a!.accountId);
      this.entries.delete(b!.accountId);
      this.startMatch(a!, b!);
    }
  }
}
