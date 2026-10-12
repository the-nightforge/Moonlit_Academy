import { nextRandom } from "../rng";
import type { Action, GameData } from "../types/index";
import { canonicalActionKey, enumerateBotActions } from "./actions";
import { actionFeatures, FEATURE_NAMES, type FeatureName } from "./features";
import type { BotObservation } from "./observation";
import { searchBotAction } from "./search";

/** Skill tiers — how far a profile plans ahead. */
export type Skill = "novice" | "regular" | "advanced";
/** Play styles — which benefits a profile values. */
export type Style = "aggressive" | "defensive" | "combo" | "tempo";

/**
 * One named way to play (`17`-style playtest portfolio). `weights` are a
 * hypothesis, not a measured population — they get calibrated on human replays
 * in a later phase. `search` budgets are per-decision totals; `novice` keeps
 * them at 0 (pure heuristic). `mistakeRate`/`temperature` start at 0 and are
 * only enabled once real data justifies them.
 */
export interface BotProfile {
  id: string;
  version: string;
  skill: Skill;
  style: Style;
  mistakeRate: number;
  temperature: number;
  weights: Partial<Record<FeatureName, number>>;
  search: { maxExpansions: number; depth: number; beamWidth: number; samples: number };
}

/** Independent RNG streams for one decision — engine RNG is never touched. */
export interface BotContext {
  policySeed: number;
  beliefSeed: number;
}

export interface BotDecision {
  action: Action;
  /** Why this action won — for trace/debug (e.g. "argmax", "noise-softmax", "mistake"). */
  reason: string;
  /** Search expansions spent; 0 for the pure heuristic path. */
  expansions: number;
  /** Every candidate's score, keyed canonically — the explainable trail. */
  actionScores: readonly { key: string; score: number }[];
}

/** Dot product of the action's feature vector with the profile weights. */
export function scoreBotAction(
  data: GameData,
  obs: BotObservation,
  action: Action,
  profile: BotProfile,
): number {
  const vec = actionFeatures(data, obs, action);
  let score = 0;
  for (const name of FEATURE_NAMES) {
    const weight = profile.weights[name];
    const value = vec[name];
    if (weight !== undefined && value !== undefined) score += weight * value;
  }
  return score;
}

/**
 * The portfolio entry point. Enumerates legal actions on the observation,
 * scores them, then picks — argmax with seeded noise when `temperature` > 0,
 * a uniform legal pick when the `mistakeRate` roll fires. Returns null when the
 * seat has no legal action (should not happen mid-decision; callers treat it
 * as a tool error). Task 4 routes through `searchBotAction` when the profile
 * carries a non-zero search budget.
 */
export function chooseBotAction(
  data: GameData,
  obs: BotObservation,
  profile: BotProfile,
  context: BotContext,
): BotDecision | null {
  if (profile.search.maxExpansions > 0) {
    const searched = searchBotAction(data, obs, profile, context);
    if (searched !== null) return searched;
  }
  const legal = enumerateBotActions(data, obs);
  if (legal.length === 0) return null;

  const scored = legal.map((action) => ({
    action,
    key: canonicalActionKey(action),
    score: scoreBotAction(data, obs, action, profile),
  }));
  const actionScores = scored.map(({ key, score }) => ({ key, score }));

  // Noise draws from `policySeed` — a dedicated stream, not the engine's.
  let rng = { state: context.policySeed >>> 0 };
  const roll = () => {
    const next = nextRandom(rng.state);
    rng.state = next.rngState;
    return next.value;
  };

  if (profile.mistakeRate > 0 && roll() < profile.mistakeRate) {
    const pick = scored[Math.floor(roll() * scored.length)]!;
    return { action: pick.action, reason: "mistake-uniform", expansions: 0, actionScores };
  }

  if (profile.temperature > 0) {
    // Seeded softmax over scores.
    const max = Math.max(...scored.map((s) => s.score));
    const exps = scored.map((s) => Math.exp((s.score - max) / profile.temperature));
    const total = exps.reduce((a, b) => a + b, 0);
    let dart = roll() * total;
    for (let i = 0; i < scored.length; i++) {
      dart -= exps[i]!;
      if (dart <= 0) {
        return { action: scored[i]!.action, reason: "noise-softmax", expansions: 0, actionScores };
      }
    }
    const last = scored[scored.length - 1]!;
    return { action: last.action, reason: "noise-softmax", expansions: 0, actionScores };
  }

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  return { action: best.action, reason: "argmax", expansions: 0, actionScores };
}
