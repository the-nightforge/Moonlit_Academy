import { cloneState } from "./clone";
import { resolveEffects } from "./effects";
import { getEffectiveCost, getValidTargets, isFreeByPassive } from "./queries";
import { hasStatus, removeStatus } from "./statuses";
import type {
  Action,
  ActionResult,
  CombatEvent,
  CombatState,
  GameData,
} from "./types/index";

function validatePlayCard(
  data: GameData,
  state: CombatState,
  action: { type: "playCard"; instanceId: string; targetId?: string },
): string | null {
  const instance = state.cards[action.instanceId];
  if (!instance || !state.hand.includes(action.instanceId)) {
    return "card is not in hand";
  }
  const card = data.cards[instance.cardId];
  if (!card) return "unknown card";
  const owner = state.heroes.find((hero) => hero.defId === instance.ownerId);
  if (!owner?.alive) return "card is broken (owner is dead)";
  if (hasStatus(owner, "freeze")) return "owner is frozen";
  if (state.moonPower < getEffectiveCost(data, state, action.instanceId)) {
    return "not enough moonPower";
  }
  if (card.target === "none") {
    if (action.targetId !== undefined) return "card takes no target";
  } else {
    if (action.targetId === undefined) return "card requires a target";
    if (!getValidTargets(data, state, action.instanceId).includes(action.targetId)) {
      return "invalid target";
    }
  }
  return null;
}

function playCard(
  data: GameData,
  state: CombatState,
  action: { type: "playCard"; instanceId: string; targetId?: string },
  events: CombatEvent[],
): void {
  const instance = state.cards[action.instanceId]!;
  const card = data.cards[instance.cardId]!;
  const owner = state.heroes.find((hero) => hero.defId === instance.ownerId)!;
  const freeByPassive = isFreeByPassive(data, state, instance.instanceId);
  const cost = getEffectiveCost(data, state, instance.instanceId);

  state.moonPower -= cost;
  events.push({ type: "moonPowerChanged", value: state.moonPower });
  state.hand = state.hand.filter((id) => id !== instance.instanceId);
  events.push({
    type: "cardPlayed",
    instanceId: instance.instanceId,
    cost,
    ...(action.targetId !== undefined ? { targetId: action.targetId } : {}),
  });
  if (freeByPassive) owner.freeCardUsedThisTurn = true;

  resolveEffects(
    data,
    state,
    card.effects,
    { source: owner, card, chosenId: action.targetId },
    events,
  );

  if (card.type === "attack") {
    removeStatus(owner, "empower", events);
    removeStatus(owner, "stealth", events);
  }
  state.discardPile.push(instance.instanceId);
}

export function applyAction(data: GameData, state: CombatState, action: Action): ActionResult {
  if (state.status !== "playerTurn") {
    return { ok: false, error: "not the player turn" };
  }
  switch (action.type) {
    case "playCard": {
      const error = validatePlayCard(data, state, action);
      if (error !== null) return { ok: false, error };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      playCard(data, next, action, events);
      return { ok: true, state: next, events };
    }
    case "endTurn":
      return { ok: false, error: "endTurn is not implemented yet" };
    default: {
      const exhaustive: never = action;
      return { ok: false, error: `unknown action ${JSON.stringify(exhaustive)}` };
    }
  }
}
