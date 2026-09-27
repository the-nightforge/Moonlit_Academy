import type { ArenaStats, GameData } from "../types/index";

/** Placement provisional period — the first `RANKED_PROVISIONAL` games use K=40 (`14` §14.2). */
export const RANKED_PROVISIONAL = 10;
export const RATING_K_PROVISIONAL = 40;
export const RATING_K = 24;
export const RATING_START = 1000;

/**
 * Elo delta for the seat holding `a` who scored `score` (1 / 0.5 / 0) against `b`
 * (`17` §6.3). K follows the updated player's `rankedGames`, so the two sides of
 * one match may move by different amounts. The new rating is clamped at 0 by the
 * caller (`applyPvpResult`).
 */
export function ratingChange(a: ArenaStats, b: ArenaStats, score: 1 | 0.5 | 0): number {
  const expected = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
  const k = a.rankedGames < RANKED_PROVISIONAL ? RATING_K_PROVISIONAL : RATING_K;
  return Math.round(k * (score - expected));
}

/** The display tier of `rating` — the last tier with `minRating ≤ rating` (`14` §14.2). */
export function tierFor(data: GameData, rating: number): { id: string; name: string; minRating: number } | null {
  const tiers = data.pvpConfig.tiers ?? [];
  let best: (typeof tiers)[number] | null = null;
  for (const tier of tiers) {
    if (rating >= tier.minRating && (best === null || tier.minRating > best.minRating)) best = tier;
  }
  return best;
}
