import type { GameData, Profile } from "../types/index";
import { dayKey } from "./periods";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface CoopResultOpts {
  /** Shared team outcome — co-op has no draws (`01` §16.6). */
  result: "won" | "lost";
  /**
   * This seat personally left the match (resign/disconnect/timeout forfeit in
   * the action log). A forfeiter is never rewarded (`17` §9.2); the partner who
   * fights on is settled normally.
   */
  forfeited: boolean;
  now: number;
}

export interface CoopRewards {
  moonJade: number;
  moonDust: number;
  /** `firstWinOfDay` was part of this payout. */
  firstWin: boolean;
}

/**
 * `14` §15 — settles one queue co-op match into a profile. Wins count as
 * `clears` of the day; at most `rewardedMatchesPerDay` matches pay out, and a
 * forfeited seat is skipped entirely (the claim is not consumed either).
 * Private/practice co-op never reaches here — the server settles only `coop`.
 */
export function applyCoopResult(
  data: GameData,
  profile: Profile,
  opts: CoopResultOpts,
): { ok: true; profile: Profile; rewards: CoopRewards | null } {
  const next = clone(profile);
  const today = dayKey(data, opts.now);
  if (next.coop.dayKey !== today) next.coop = { dayKey: today, clears: 0, rewarded: 0 };
  if (opts.result === "won") next.coop.clears += 1;
  if (opts.forfeited || next.coop.rewarded >= data.coopConfig.rewardedMatchesPerDay) {
    return { ok: true, profile: next, rewards: null };
  }
  next.coop.rewarded += 1;
  const rewards = data.coopConfig.rewards;
  const base = opts.result === "won" ? rewards.win : rewards.loss;
  const firstWin = opts.result === "won" && next.coop.clears === 1;
  const granted: CoopRewards = {
    moonJade: base.moonJade + (firstWin ? rewards.firstWinOfDay.moonJade : 0),
    moonDust: base.moonDust + (firstWin ? rewards.firstWinOfDay.moonDust : 0),
    firstWin,
  };
  next.currencies.moonJade += granted.moonJade;
  next.currencies.moonDust += granted.moonDust;
  return { ok: true, profile: next, rewards: granted };
}
