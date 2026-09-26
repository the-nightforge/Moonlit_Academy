import { cloneState } from "./clone";
import { resolveEffects } from "./effects";
import { cardDefOf } from "./gear";
import { cardOwners, firstCardDiscount, getEffectiveCost, getValidTargets, ownerError } from "./queries";
import { shuffle } from "./rng";
import { runRelicHooks } from "./run-relic-hooks";
import { removeStatus } from "./statuses";
import { runEndTurn, startPlayerTurn } from "./turn";
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
  const card = cardDefOf(data, state, instance);
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
  const card = cardDefOf(data, state, instance)!;
  const owners = cardOwners(state, instance) as HeroState[];
  const owner = owners[0]!;
  const discounted = firstCardDiscount(data, state, instance.instanceId) > 0;
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
  if (discounted) owner.firstCardDiscountUsedThisTurn = true;

  resolveEffects(
    data,
    state,
    card.effects,
    { source: owner, actors: owners, card, chosenId: action.targetId, instanceId: instance.instanceId },
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
  state.cardsPlayedThisTurn += 1;
}

/** Owner(s) losing empower/stealth after an attack card: a bond card's damage actors. */
function attackCleanupTargets(card: CardDef, owners: HeroState[]): HeroState[] {
  if (!card.bond) return owners;
  const damageActors = new Set<number>();
  const walk = (effects: Effect[], inherited: number): void => {
    for (const effect of effects) {
      const actor = effect.actor ?? inherited;
      if (effect.type === "damage" || effect.type === "missingHpDamage") damageActors.add(actor);
      if (effect.type === "conditional") {
        walk(effect.then, actor);
        walk(effect.else ?? [], actor);
      }
    }
  };
  walk(card.effects, 0);
  return owners.filter((_, index) => damageActors.has(index));
}

export function getMulliganError(data: GameData, state: CombatState, instanceIds: string[]): string | null {
  if (instanceIds.length > data.combatConfig.maxMulligan) return "too many cards to mulligan";
  if (new Set(instanceIds).size !== instanceIds.length) return "duplicate card in mulligan";
  if (instanceIds.some((id) => !state.hand.includes(id))) return "card is not in hand";
  return null;
}

function mulligan(data: GameData, state: CombatState, instanceIds: string[], events: CombatEvent[]): void {
  const drawn = state.drawPile.splice(0, instanceIds.length);
  for (const id of drawn) state.cards[id]!.heldTurns = 0;
  let drawIndex = 0;
  state.hand = state.hand.flatMap((id) => {
    if (!instanceIds.includes(id)) return [id];
    const replacement = drawn[drawIndex++];
    return replacement === undefined ? [] : [replacement];
  });
  events.push({ type: "mulliganed", returned: [...instanceIds], drawn });
  if (instanceIds.length > 0) {
    const shuffled = shuffle([...state.drawPile, ...instanceIds], state.rngState);
    state.drawPile = shuffled.items;
    state.rngState = shuffled.rngState;
    events.push({ type: "deckShuffled" });
  }
  startPlayerTurn(data, state, events);
  runRelicHooks(data, state, events, { type: "combatStart" });
}

function chooseCard(state: CombatState, instanceId: string, events: CombatEvent[]): void {
  const options = state.pendingChoice!.options;
  const bottomed = options.filter((id) => id !== instanceId);
  state.cards[instanceId]!.heldTurns = 0;
  state.cards[instanceId]!.chosenThisTurn = true;
  state.hand.push(instanceId);
  state.drawPile.push(...bottomed);
  state.pendingChoice = null;
  state.status = "playerTurn";
  events.push({ type: "cardChosen", instanceId, bottomed });
}

function statusError(state: CombatState, action: Action): string | null {
  if (action.type === "mulligan") {
    return state.status === "mulligan" ? null : "mulligan already done";
  }
  switch (state.status) {
    case "mulligan":
      return "mulligan pending";
    case "choosing":
      return action.type === "chooseCard" ? null : "choice pending";
    case "playerTurn":
      return action.type === "chooseCard" ? "no pending choice" : null;
    case "enemyTurn":
    case "won":
    case "lost":
      return "not the player turn";
    default: {
      const exhaustive: never = state.status;
      return `unknown status ${String(exhaustive)}`;
    }
  }
}

export function applyAction(data: GameData, state: CombatState, action: Action): ActionResult {
  const blocked = statusError(state, action);
  if (blocked !== null) return { ok: false, error: blocked };
  switch (action.type) {
    case "mulligan": {
      const error = getMulliganError(data, state, action.instanceIds);
      if (error !== null) return { ok: false, error };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      mulligan(data, next, action.instanceIds, events);
      return { ok: true, state: next, events };
    }
    case "playCard": {
      const error = getPlayCardError(data, state, action);
      if (error !== null) return { ok: false, error };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      playCard(data, next, action, events);
      return { ok: true, state: next, events };
    }
    case "chooseCard": {
      if (!state.pendingChoice!.options.includes(action.instanceId)) {
        return { ok: false, error: "not a choice option" };
      }
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      chooseCard(next, action.instanceId, events);
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
