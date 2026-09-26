import type { Action, CombatState, Effect, GameData, RunAction, RunState } from "../src/index";
import { findNode, getEffectiveCost, getValidTargets, isCardPlayable, reachableNodeIds } from "../src/index";

/** The playtest bot shared by `run-playtest` and the economy simulation. */
// Phase 4a heuristic: mulligan cards above the doubling curve, Chiêm Bài picks
// the most expensive card affordable next round, plays costliest first,
// focuses lowest-HP enemy / lowest-ratio ally.
export function combatAction(gameData: GameData, state: CombatState): Action {
  if (state.status === "mulligan") {
    const expensive = state.hand.filter(
      (id) => gameData.cards[state.cards[id]!.cardId]!.cost > 5,
    );
    return {
      type: "mulligan",
      instanceIds: expensive.slice(0, gameData.combatConfig.maxMulligan),
    };
  }
  if (state.status === "choosing") {
    const curve = gameData.combatConfig.moonPower;
    const nextFund =
      Math.min(curve.cap, curve.start + state.round * curve.perRound) +
      gameData.combatConfig.moonReserveMax;
    const options = [...state.pendingChoice!.options].sort(
      (a, b) =>
        gameData.cards[state.cards[b]!.cardId]!.cost -
        gameData.cards[state.cards[a]!.cardId]!.cost,
    );
    const pick =
      options.find(
        (id) => gameData.cards[state.cards[id]!.cardId]!.cost <= nextFund,
      ) ?? options[0]!;
    return { type: "chooseCard", instanceId: pick };
  }
  const keywordsOf = (id: string) => gameData.cards[state.cards[id]!.cardId]!.keywords ?? [];
  const heldThreshold = (id: string): number => {
    let best = 0;
    const walk = (effects: Effect[]) => {
      for (const effect of effects) {
        if (effect.type !== "conditional") continue;
        if (effect.condition.type === "heldTurnsAtLeast") best = Math.max(best, effect.condition.turns);
        walk(effect.then);
        walk(effect.else ?? []);
      }
    };
    walk(gameData.cards[state.cards[id]!.cardId]!.effects);
    return best;
  };
  const playable = state.hand.filter((id) => isCardPlayable(gameData, state, id));
  const ready = playable.filter((id) => state.cards[id]!.heldTurns >= heldThreshold(id));
  const candidates = ready.length > 0 || state.hand.length < gameData.combatConfig.handSize ? ready : playable;
  const ordered = [...candidates].sort((a, b) => {
    const comboA = keywordsOf(a).includes("lien_hoan") ? 1 : 0;
    const comboB = keywordsOf(b).includes("lien_hoan") ? 1 : 0;
    if (comboA !== comboB) return comboA - comboB; // non-combo cards first
    return getEffectiveCost(gameData, state, b) - getEffectiveCost(gameData, state, a);
  });
  for (const instanceId of ordered) {
    const card = gameData.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const targets = getValidTargets(gameData, state, instanceId);
    let targetId: string | undefined;
    if (card.target === "enemy") {
      const drains = keywordsOf(instanceId).some((k) => k === "toa_nguyet" || k === "doat_nguyet");
      const chainCost = (id: string) => state.enemies.find((e) => e.id === id)!.plannedIntents.reduce((s, p) => s + p.cost, 0);
      const hp = (id: string) => state.enemies.find((e) => e.id === id)!.hp;
      targetId = [...targets].sort((a, b) => (drains ? chainCost(b) - chainCost(a) : hp(a) - hp(b)))[0];
    } else {
      const burst = keywordsOf(instanceId).includes("tu_duoc");
      const regen = (id: string) => state.heroes.find((h) => h.id === id)!.statuses.find((s) => s.id === "regen")?.value ?? 0;
      const ratio = (id: string) => { const h = state.heroes.find((u) => u.id === id)!; return h.hp / h.maxHp; };
      const pool = burst ? targets.filter((id) => regen(id) >= 3) : targets;
      targetId = [...pool].sort((a, b) => ratio(a) - ratio(b))[0];
    }
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
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
      return { type: "combat", action: combatAction(gameData, run.combat!) };
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
    case "won":
    case "lost":
      throw new Error("run is over");
  }
}
