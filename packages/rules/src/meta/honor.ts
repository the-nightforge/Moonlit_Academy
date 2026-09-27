import type { GameData, Profile } from "../types/index";
import { checkAchievements } from "./economy";
import { grantGearItem, grantHeroItem } from "./gacha";
import { dayKey, monthKey, weekKey } from "./periods";

/** Honor per result and the per-day cap (`17` §6.4). */
export const HONOR_WON = 20;
export const HONOR_DRAW = 12;
export const HONOR_LOST = 8;
export const HONOR_PER_DAY = 120;
/** A loss by forfeit/disconnect/timeout before this round pays no honor (`17` §6.4). */
export const EARLY_FORFEIT_ROUND = 3;
const EARLY_FORFEIT_REASONS = new Set(["resign", "disconnect", "timeout"]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface PvpResultOpts {
  result: "won" | "lost" | "draw";
  /** `"combat"` | `"resign"` | `"disconnect"` | `"timeout"` — the match's end reason. */
  reason: string;
  /** Round the match ended on — early forfeits grant the loser no honor. */
  round: number;
  now: number;
  /** Elo delta already computed for this side via `ratingChange`. */
  ratingDelta: number;
}

/**
 * Applies a finished ranked match to one profile (`14` §14.3): arena record, Elo
 * (clamped ≥ 0), and honor capped at 120 per game day. The server calls this once
 * per side inside the match transaction; non-ranked modes never reach here.
 */
export function applyPvpResult(
  data: GameData,
  profile: Profile,
  opts: PvpResultOpts,
): { ok: true; profile: Profile; honor: number } {
  const next = clone(profile);
  const today = dayKey(data, opts.now);
  if (next.arena.honorDay.dayKey !== today) next.arena.honorDay = { dayKey: today, gained: 0 };
  next.arena.rating = Math.max(0, next.arena.rating + opts.ratingDelta);
  next.arena.rankedGames += 1;
  if (opts.result === "won") next.arena.wins += 1;
  else if (opts.result === "lost") next.arena.losses += 1;
  else next.arena.draws += 1;
  const base = opts.result === "won" ? HONOR_WON : opts.result === "draw" ? HONOR_DRAW : HONOR_LOST;
  const denied =
    opts.result === "lost" && EARLY_FORFEIT_REASONS.has(opts.reason) && opts.round < EARLY_FORFEIT_ROUND;
  const honor = denied ? 0 : Math.min(base, HONOR_PER_DAY - next.arena.honorDay.gained);
  next.currencies.honor += honor;
  next.arena.honorDay.gained += honor;
  return { ok: true, profile: next, honor };
}

/**
 * Buys an honor shop entry (`14` §14.4): limits count per week/month period;
 * `pick.heroId`/`pick.relicId` choose the item for `heroChoice`/`relicChoice`.
 */
export function buyHonorItem(
  data: GameData,
  profile: Profile,
  itemId: string,
  now: number,
  pick?: { heroId?: string; relicId?: string },
): { ok: true; profile: Profile; achievements: string[] } | { ok: false; error: string } {
  const item = (data.pvpConfig.honorShop ?? []).find((entry) => entry.id === itemId);
  if (!item) return { ok: false, error: "unknown item" };
  const next = clone(profile);
  const shop = next.honorShop;
  const week = weekKey(data, now);
  const month = monthKey(data, now);
  if (shop.weekKey !== week) {
    shop.weekKey = week;
    shop.bought = {};
  }
  if (shop.monthKey !== month) {
    shop.monthKey = month;
    shop.boughtMonth = {};
  }
  if (item.limitPerWeek !== undefined && (shop.bought[itemId] ?? 0) >= item.limitPerWeek) {
    return { ok: false, error: "weekly limit" };
  }
  if (item.limitPerMonth !== undefined && (shop.boughtMonth[itemId] ?? 0) >= item.limitPerMonth) {
    return { ok: false, error: "monthly limit" };
  }
  if (next.currencies.honor < item.cost) return { ok: false, error: "not enough honor" };
  switch (item.item.type) {
    case "moonJade":
      next.currencies.moonJade += item.item.amount;
      break;
    case "heroChoice": {
      const heroId = pick?.heroId;
      if (heroId === undefined) return { ok: false, error: "hero required" };
      const hero = data.heroes[heroId];
      if (!hero || hero.rarity !== item.item.rarity || next.heroes[heroId]) return { ok: false, error: "invalid hero" };
      grantHeroItem(data, next, heroId);
      break;
    }
    case "relicChoice": {
      const relicId = pick?.relicId;
      if (relicId === undefined) return { ok: false, error: "relic required" };
      const relic = data.relics[relicId];
      if (!relic || relic.rarity !== item.item.rarity) return { ok: false, error: "invalid relic" };
      grantGearItem(data, next, "relic", relicId);
      break;
    }
    default: {
      const exhaustive: never = item.item;
      throw new Error(`unknown honor shop item: ${JSON.stringify(exhaustive)}`);
    }
  }
  next.currencies.honor -= item.cost;
  shop.bought[itemId] = (shop.bought[itemId] ?? 0) + 1;
  shop.boughtMonth[itemId] = (shop.boughtMonth[itemId] ?? 0) + 1;
  return checkAchievements(data, next);
}
