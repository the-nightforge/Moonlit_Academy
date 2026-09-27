import { chooseCombatAction } from "../bot";
import { cardDefOf } from "../gear";
import { getValidTargets } from "../queries";
import type { Action, CardDef, CombatState, GameData } from "../types/index";
import { comboHintFor } from "./combos";

/** Hero ids that enemy intent chains currently aim at (`17` §8.8 — guard the marked ally). */
function threatenedHeroes(state: CombatState): Set<string> {
  const marked = new Set<string>();
  for (const enemy of state.enemies) {
    for (const planned of enemy.plannedIntents) {
      if (planned.targetId !== null) marked.add(planned.targetId);
    }
  }
  return marked;
}

function pickTarget(data: GameData, state: CombatState, card: CardDef, instanceId: string): string | undefined {
  const targets = getValidTargets(data, state, instanceId);
  if (card.target === "none" || targets.length === 0) return undefined;
  const unitOf = (id: string) =>
    state.heroes.find((unit) => unit.id === id) ?? state.enemies.find((unit) => unit.id === id)!;
  if (card.target === "enemy") {
    return [...targets].sort((a, b) => unitOf(a).hp - unitOf(b).hp)[0];
  }
  // Ally targets cover the intent-marked hero first, else the lowest hp ratio.
  const marked = threatenedHeroes(state);
  const ranked = [...targets].sort(
    (a, b) => unitOf(a).hp / unitOf(a).maxHp - unitOf(b).hp / unitOf(b).maxHp,
  );
  return ranked.find((id) => marked.has(id)) ?? ranked[0];
}

/**
 * A card in `seat`'s hand that completes a Hợp Kích half-finished by the
 * partner (`17` §8.8) — `comboHintFor` finds them in file order.
 */
function comboCompletion(data: GameData, state: CombatState, seatIndex: number): Action | null {
  for (const instanceId of comboHintFor(data, state, seatIndex).keys()) {
    const card = cardDefOf(data, state, state.cards[instanceId]!)!;
    const targetId = pickTarget(data, state, card, instanceId);
    if (card.target !== "none" && targetId === undefined) continue;
    return { type: "playCard", instanceId, ...(targetId !== undefined ? { targetId } : {}) };
  }
  return null;
}

/**
 * `17` §8.8 — a co-op seat's heuristic bot: finish the partner's combo halves,
 * point heals and guards at the heroes enemy intents mark, and otherwise fall
 * back to the shared combat heuristic. Only reads the given view.
 */
export function coopBot(data: GameData, view: CombatState, player: number): Action {
  const seat = view.players[player]!;
  if (view.status === "playerTurn" && !seat.done && seat.pendingChoice === null) {
    const completion = comboCompletion(data, view, player);
    if (completion !== null) return { ...completion, player } as Action;
  }
  const action = { ...chooseCombatAction(data, view, player), player } as Action;
  if (view.status === "playerTurn" && action.type === "playCard") {
    const card = cardDefOf(data, view, view.cards[action.instanceId]!);
    if (card?.target === "ally") {
      const marked = threatenedHeroes(view);
      const covered = getValidTargets(data, view, action.instanceId).filter((id) => marked.has(id));
      if (covered.length > 0 && action.targetId !== covered[0]) {
        const heroOf = (id: string) => view.heroes.find((hero) => hero.id === id)!;
        covered.sort((a, b) => heroOf(a).hp / heroOf(a).maxHp - heroOf(b).hp / heroOf(b).maxHp);
        action.targetId = covered[0];
      }
    }
  }
  return action;
}
