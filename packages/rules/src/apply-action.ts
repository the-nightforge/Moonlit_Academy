import { cloneState } from "./clone";
import { resolveEffects } from "./effects";
import { cardOwners, getEffectiveCost, getValidTargets, isFreeByPassive, ownerError } from "./queries";
import { runRelicHooks } from "./run-relic-hooks";
import { removeStatus } from "./statuses";
import { runEndTurn } from "./turn";
import type {
  Action,
  ActionResult,
  CardDef,
  CombatEvent,
  CombatState,
  Effect,
  GameData,
  HeroState,
} from "./types/index";

export function getPlayCardError(
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
  const ownerProblem = ownerError(state, instance);
  if (ownerProblem !== null) return ownerProblem;
  if (card.requiresBloodMoon && state.bloodMoonRounds === 0) return "requires blood moon";
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
  const owners = cardOwners(state, instance) as HeroState[];
  const owner = owners[0]!;
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
    { source: owner, actors: owners, card, chosenId: action.targetId },
    events,
  );

  if (card.type === "attack") {
    for (const attacker of attackCleanupTargets(card, owners)) {
      removeStatus(attacker, "empower", events);
      removeStatus(attacker, "stealth", events);
    }
  }
  runRelicHooks(data, state, events, { type: "cardPlayed", card, heroId: owner.id });
  state.discardPile.push(instance.instanceId);
}

/** Owner(s) losing empower/stealth after an attack card: a bond card's damage actors. */
function attackCleanupTargets(card: CardDef, owners: HeroState[]): HeroState[] {
  if (!card.bond) return owners;
  const damageActors = new Set<number>();
  const walk = (effects: Effect[], inherited: number): void => {
    for (const effect of effects) {
      const actor = effect.actor ?? inherited;
      if (effect.type === "damage") damageActors.add(actor);
      if (effect.type === "conditional") {
        walk(effect.then, actor);
        walk(effect.else ?? [], actor);
      }
    }
  };
  walk(card.effects, 0);
  return owners.filter((_, index) => damageActors.has(index));
}

export function applyAction(data: GameData, state: CombatState, action: Action): ActionResult {
  if (state.status !== "playerTurn") {
    return { ok: false, error: "not the player turn" };
  }
  switch (action.type) {
    case "playCard": {
      const error = getPlayCardError(data, state, action);
      if (error !== null) return { ok: false, error };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      playCard(data, next, action, events);
      return { ok: true, state: next, events };
    }
    case "endTurn": {
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      runEndTurn(data, next, events);
      return { ok: true, state: next, events };
    }
    default: {
      const exhaustive: never = action;
      return { ok: false, error: `unknown action ${JSON.stringify(exhaustive)}` };
    }
  }
}
