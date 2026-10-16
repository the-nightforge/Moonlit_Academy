import type { CoopSide, PvpSide } from "rules";
import { measurePvpPower } from "rules";
import type { AppContext } from "../context";

/** Ranked queue tuning (`17` §6.1). */
export const QUEUE_TICK_MS = 1_000;
export const QUEUE_BASE_RANGE = 0.10;
export const QUEUE_RANGE_PER_10S = 0.02;
export const QUEUE_MAX_RANGE = 0.20;
export const QUEUE_BOT_AFTER_MS = 60_000;
/** Never rematch an opponent met in the last 2 ranked matches of the last 10 min. */
export const REMATCH_WINDOW_MS = 10 * 60 * 1000;
export const REMATCH_MATCHES = 2;

/** One player waiting for an arena match; `side` is the validated actual loadout. */
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
 * `queue.status` to each waiter, then pairs the closest team power first.
 * Power tolerance widens from 10% by 2% per 10 s, capped at 20%; Elo only
 * breaks ties. Remaining players receive an arena bot after 60 s.
 */
export class RankedQueue {
  private readonly entries = new Map<number, QueueEntry>();
  private readonly recentOpponents: (accountId: number) => Promise<number[]>;

  constructor(
    private readonly ctx: AppContext,
    private readonly sendTo: (accountId: number, message: unknown) => void,
    private readonly startMatch: (a: QueueEntry, b: QueueEntry) => void,
    private readonly startBotMatch: (a: QueueEntry) => void,
  ) {
    const recent = ctx.db.prepare<[number, number], { opponent: number | null }>(
      `SELECT opp.account_id AS opponent
       FROM match_players mine
       JOIN matches m ON m.id = mine.match_id AND m.mode = 'ranked' AND m.status = 'finished'
       JOIN match_players opp ON opp.match_id = mine.match_id AND opp.slot <> mine.slot
       WHERE mine.account_id = ? AND m.finished_at > ?
       ORDER BY m.finished_at DESC LIMIT ${REMATCH_MATCHES}`,
    );
    this.recentOpponents = async (accountId) =>
      (await recent.all(accountId, ctx.clock() - REMATCH_WINDOW_MS))
        .flatMap((row) => (row.opponent === null ? [] : [row.opponent]));
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
    this.ctx.scheduler.setTimeout(() => void this.tick(), QUEUE_TICK_MS);
  }

  private async tick(): Promise<void> {
    try {
      await this.matchWaiting();
    } catch (error) {
      console.error("ranked queue tick failed:", error);
    } finally {
      // Arm after completion: a slow recent-opponent query cannot overlap ticks.
      this.arm();
    }
  }

  private async matchWaiting(): Promise<void> {
    const now = this.ctx.clock();
    const waiting = [...this.entries.values()];
    for (const entry of waiting) this.sendStatus(entry, Math.floor((now - entry.joinedAt) / 1000));
    const power = new Map(waiting.map(entry => [entry, measurePvpPower(this.ctx.data, entry.side)]));
    const current = (entry: QueueEntry) => this.entries.get(entry.accountId) === entry;
    const candidates: { a: QueueEntry; b: QueueEntry; gap: number }[] = [];
    for (let i = 0; i < waiting.length; i++) {
      for (let j = i + 1; j < waiting.length; j++) {
        const a = waiting[i]!;
        const b = waiting[j]!;
        const range = Math.min(QUEUE_MAX_RANGE, QUEUE_BASE_RANGE + QUEUE_RANGE_PER_10S * Math.floor(Math.max(now - a.joinedAt, now - b.joinedAt) / 10_000));
        const aPower = power.get(a)!;
        const bPower = power.get(b)!;
        const gap = Math.abs(aPower - bPower) / Math.max(1, aPower, bPower);
        if (gap <= range) candidates.push({ a, b, gap });
      }
    }
    candidates.sort((x, y) => x.gap - y.gap || Math.abs(x.a.rating - x.b.rating) - Math.abs(y.a.rating - y.b.rating));
    for (const { a, b } of candidates) {
      if (!current(a) || !current(b)) continue;
      const aRecent = await this.recentOpponents(a.accountId);
      if (!current(a) || !current(b) || aRecent.includes(b.accountId)) continue;
      const bRecent = await this.recentOpponents(b.accountId);
      if (!current(a) || !current(b) || bRecent.includes(a.accountId)) continue;
      this.entries.delete(a.accountId);
      this.entries.delete(b.accountId);
      this.startMatch(a, b);
    }
    // Human candidates always get the first chance, including the deadline tick.
    for (const entry of waiting) {
      if (!current(entry) || this.ctx.clock() - entry.joinedAt < QUEUE_BOT_AFTER_MS) continue;
      this.entries.delete(entry.accountId);
      this.startBotMatch(entry);
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
