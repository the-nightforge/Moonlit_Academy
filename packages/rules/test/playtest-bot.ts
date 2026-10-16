import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Action, CombatEvent, CombatState, GameData, RunAction, RunState } from "../src/index";
import { chooseCombatAction } from "../src/bot";
import { chooseRunAction } from "../src/bot/run-policy";
import type { BotContext, BotProfile } from "../src/bot/policy";
import { findNode, makeBotObservation, reachableNodeIds } from "../src/index";

/** The playtest bot shared by `run-playtest` and the economy simulation. */
// Phase 4a heuristic lives in `src/bot.ts` (chooseCombatAction) — shared with pvpBot.
// Playtest calls read combat through the seat observation only (`legacy` profile).
export function combatAction(
  gameData: GameData,
  state: CombatState,
  seat = 0,
  history: readonly CombatEvent[] = [],
  ownDeckCardIds: readonly string[] | null = null,
): Action {
  const obs = makeBotObservation(gameData, state, seat, "pve", history, ownDeckCardIds);
  return chooseCombatAction(gameData, obs.visibleState, seat);
}

export function hpRatio(run: RunState): number {
  const hp = run.heroes.reduce((sum, h) => sum + h.hp, 0);
  return hp / run.heroes.reduce((sum, h) => sum + h.maxHp, 0);
}

// Healthy: fight, then treasure, then rest, elite last. Below 60% HP: rest first, elite never if avoidable.
function nodeScore(run: RunState, nodeId: string): number {
  const low = hpRatio(run) < 0.6;
  const type = findNode(run, nodeId)!.type;
  if (type === "rest") return low ? 0 : 2;
  if (type === "treasure") return 1;
  if (type === "elite") return low ? 9 : 3;
  return low ? 5 : 1;
}

export function runAction(gameData: GameData, run: RunState): RunAction {
  switch (run.status) {
    case "map":
      return {
        type: "chooseNode",
        nodeId: reachableNodeIds(run).sort((a, b) => nodeScore(run, a) - nodeScore(run, b))[0]!,
      };
    case "combat":
      // The runner knows the deck it registered — the observation may use it.
      return { type: "combat", action: combatAction(gameData, run.combat!, 0, [], [...run.deck]) };
    case "reward":
      return { type: "pickAugment", augmentId: run.pendingReward!.augmentChoices[0] ?? null };
    case "rest": {
      if (hpRatio(run) < 0.6 || run.deck.length <= gameData.runConfig.minDeckSize) {
        return { type: "rest", choice: "heal" };
      }
      const cheapest = [...run.deck].sort(
        (a, b) => gameData.cards[a]!.cost - gameData.cards[b]!.cost,
      )[0]!;
      return { type: "rest", choice: "removeCard", cardId: cheapest };
    }
    case "treasure":
      return { type: "continue" };
    case "event":
      return { type: "event", choice: "rest" };
    case "won":
    case "lost":
      throw new Error("run is over");
  }
}

// --- Portfolio policies (Task 3) -------------------------------------------
// The production heuristics above stay the default; playtest runners opt into
// named profiles from docs/playtest/profiles.v1.json.

/** Loads and validates the pinned profile pool. */
export function loadProfiles(): BotProfile[] {
  const path = fileURLToPath(new URL("../../../docs/playtest/profiles.v1.json", import.meta.url));
  const raw = JSON.parse(readFileSync(path, "utf8")) as { profiles: BotProfile[] };
  for (const profile of raw.profiles) {
    if (typeof profile.id !== "string" || profile.id === "") throw new Error("profile without id");
    for (const field of ["skill", "style", "mistakeRate", "temperature", "weights", "search"] as const) {
      if (profile[field] === undefined) throw new Error(`profile "${profile.id}" missing ${field}`);
    }
  }
  return raw.profiles;
}

/** Portfolio run decision — combat sub-actions go through the sanitized observation. */
export function profileRunAction(
  gameData: GameData,
  run: RunState,
  profile: BotProfile,
  context: BotContext,
): RunAction {
  return chooseRunAction(gameData, run, profile, context);
}
