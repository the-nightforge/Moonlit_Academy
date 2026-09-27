/** Per-IP sliding-window limits (`16` §7.2) — in-memory, keyed by `request.ip`. */
export const REGISTER_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
export const LOGIN_LIMIT = { limit: 20, windowMs: 60 * 1000 };
export const WS_CONNECT_LIMIT = { limit: 3, windowMs: 10 * 1000 };

/** Sliding-window counter over `clock` (the app clock, so tests can advance it). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly clock: () => number) {}

  /** True when this hit stays within `limit` per `windowMs` for `key`. */
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = this.clock();
    const cutoff = now - windowMs;
    const list = (this.hits.get(key) ?? []).filter((at) => at > cutoff);
    if (list.length >= limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
}
