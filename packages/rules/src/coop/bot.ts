import { chooseCombatAction } from "../bot";
import { cardDefOf } from "../gear";
import { summonsOf } from "../players";
import { getValidTargets } from "../queries";
import type { Action, CardDef, CombatState, GameData } from "../types/index";
import { comboHintFor } from "./combos";

function pickTarget(data: GameData, state: CombatState, card: CardDef, instanceId: string): string | undefined {
  const targets = getValidTargets(data, state, instanceId);
  if (card.target === "none" || targets.length === 0) return undefined;
  const unitOf = (id: string) =>
    state.heroes.find((unit) => unit.id === id) ??
    summonsOf(state).find((unit) => unit.id === id) ??
    state.enemies.find((unit) => unit.id === id)!;
  if (card.target === "enemy") {
    return [...targets].sort((a, b) => unitOf(a).hp - unitOf(b).hp)[0];
  }
  // Ally targets: the lowest hp ratio (enemy chains stay hidden, `01` §9.2).
  return [...targets].sort(
    (a, b) => unitOf(a).hp / unitOf(a).maxHp - unitOf(b).hp / unitOf(b).maxHp,
  )[0];
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
 * otherwise fall back to the shared combat heuristic. Only reads the given view.
 */
export function coopBot(data: GameData, view: CombatState, player: number): Action {
  const seat = view.players[player]!;
  if (view.status === "playerTurn" && !seat.done && seat.pendingChoice === null) {
    const completion = comboCompletion(data, view, player);
    if (completion !== null) return { ...completion, player } as Action;
  }
  return { ...chooseCombatAction(data, view, player), player } as Action;
}
