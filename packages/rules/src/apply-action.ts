import { cloneState } from "./clone";
import { resolveEffects } from "./effects";
import { cardDefOf } from "./gear";
import { levelUpPassive } from "./levelup";
import { activePlayerState, seatTag } from "./players";
import { pvpEndTurn } from "./pvp/turn";
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
  PlayerState,
} from "./types/index";

export function getPlayCardError(
  data: GameData,
  state: CombatState,
  action: { type: "playCard"; instanceId: string; targetId?: string },
  player: PlayerState = activePlayerState(state),
): string | null {
  const instance = state.cards[action.instanceId];
  if (!instance || instance.player !== player.index || !player.hand.includes(action.instanceId)) {
    return "card is not in hand";
  }
  const card = cardDefOf(data, state, instance);
  if (!card) return "unknown card";
  const ownerProblem = ownerError(state, instance);
  if (ownerProblem !== null) return ownerProblem;
  if (card.requiresBloodMoon && state.bloodMoonRounds === 0) return "requires blood moon";
  if (player.moonPower < getEffectiveCost(data, state, action.instanceId)) {
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
  player: PlayerState,
  action: { type: "playCard"; instanceId: string; targetId?: string },
  events: CombatEvent[],
): void {
  const instance = state.cards[action.instanceId]!;
  const card = cardDefOf(data, state, instance)!;
  const owners = cardOwners(state, instance) as HeroState[];
  const owner = owners[0]!;
  const discounted = firstCardDiscount(data, state, instance.instanceId) > 0;
  const cost = getEffectiveCost(data, state, instance.instanceId);

  player.moonPower -= cost;
  events.push({ type: "moonPowerChanged", value: player.moonPower, ...seatTag(state, player.index) });
  player.hand = player.hand.filter((id) => id !== instance.instanceId);
  events.push({
    type: "cardPlayed",
    instanceId: instance.instanceId,
    cost,
    ...(action.targetId !== undefined ? { targetId: action.targetId } : {}),
    ...seatTag(state, player.index),
  });
  if (discounted) owner.firstCardDiscountUsedThisTurn = true;

  // Tàn Ảnh: the owner's first Liên Hoàn card each turn counts one more card played.
  let comboBonus = 0;
  const passive = !card.bond && owner.leveledUp ? levelUpPassive(data, owner) : undefined;
  if (passive?.type === "firstComboCountsExtra" && card.keywords?.includes("lien_hoan") && !owner.comboBonusUsedThisTurn) {
    owner.comboBonusUsedThisTurn = true;
    comboBonus = passive.amount;
  }

  resolveEffects(
    data,
    state,
    card.effects,
    { source: owner, actors: owners, card, chosenId: action.targetId, instanceId: instance.instanceId, comboBonus },
    events,
  );

  if (card.type === "attack") {
    for (const attacker of attackCleanupTargets(card, owners)) {
      removeStatus(attacker, "empower", events);
      removeStatus(attacker, "stealth", events);
    }
  }
  runRelicHooks(data, state, events, { type: "cardPlayed", card, heroId: owner.id }, player.index);
  player.discardPile.push(instance.instanceId);
  player.cardsPlayedThisTurn += 1;
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

export function getMulliganError(
  data: GameData,
  state: CombatState,
  instanceIds: string[],
  player: PlayerState = activePlayerState(state),
): string | null {
  if (instanceIds.length > data.combatConfig.maxMulligan) return "too many cards to mulligan";
  if (new Set(instanceIds).size !== instanceIds.length) return "duplicate card in mulligan";
  if (instanceIds.some((id) => !player.hand.includes(id))) return "card is not in hand";
  return null;
}

function mulligan(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  instanceIds: string[],
  events: CombatEvent[],
): void {
  const drawn = player.drawPile.splice(0, instanceIds.length);
  for (const id of drawn) state.cards[id]!.heldTurns = 0;
  let drawIndex = 0;
  player.hand = player.hand.flatMap((id) => {
    if (!instanceIds.includes(id)) return [id];
    const replacement = drawn[drawIndex++];
    return replacement === undefined ? [] : [replacement];
  });
  events.push({ type: "mulliganed", returned: [...instanceIds], drawn, ...seatTag(state, player.index) });
  if (instanceIds.length > 0) {
    const shuffled = shuffle([...player.drawPile, ...instanceIds], state.rngState);
    player.drawPile = shuffled.items;
    state.rngState = shuffled.rngState;
    events.push({ type: "deckShuffled", ...seatTag(state, player.index) });
  }
  player.mulliganDone = true;
  if (state.mode === "pvp") {
    // Both seats mulligan in parallel (`17` §4.1); when the second finishes, the
    // first player opens the match and combatStart hooks fire in play order.
    if (!state.players.every((seat) => seat.mulliganDone)) return;
    state.activePlayer = state.firstPlayer!;
    startPlayerTurn(data, state, state.players[state.firstPlayer!]!, events);
    for (const seat of [state.firstPlayer!, 1 - state.firstPlayer!]) {
      runRelicHooks(data, state, events, { type: "combatStart" }, seat);
    }
    return;
  }
  startPlayerTurn(data, state, player, events);
  runRelicHooks(data, state, events, { type: "combatStart" }, player.index);
}

function chooseCard(state: CombatState, player: PlayerState, instanceId: string, events: CombatEvent[]): void {
  const options = player.pendingChoice!.options;
  const bottomed = options.filter((id) => id !== instanceId);
  state.cards[instanceId]!.heldTurns = 0;
  state.cards[instanceId]!.chosenThisTurn = true;
  player.hand.push(instanceId);
  player.drawPile.push(...bottomed);
  player.pendingChoice = null;
  state.status = "playerTurn";
  events.push({ type: "cardChosen", instanceId, bottomed, ...seatTag(state, player.index) });
}

function statusError(state: CombatState, action: Action, player: PlayerState): string | null {
  if (action.type === "mulligan") {
    return state.status === "mulligan" && !player.mulliganDone ? null : "mulligan already done";
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
    case "opponentTurn":
      return "not the player turn";
    default: {
      const exhaustive: never = state.status;
      return `unknown status ${String(exhaustive)}`;
    }
  }
}

/**
 * `17` §4.6 — a forfeit resolves the match. `system: true` is set by the server
 * (resign command, timeout, disconnect); a client-originated action never has it.
 */
function forfeit(data: GameData, state: CombatState, action: Extract<Action, { type: "forfeit" }>): ActionResult {
  if (state.mode !== "pvp") return { ok: false, error: "forfeit is only valid in pvp" };
  if (state.status === "won" || state.status === "lost") {
    return { ok: false, error: "match already ended" };
  }
  const loser = state.players[action.player];
  if (!loser) return { ok: false, error: "unknown player" };
  const winner = state.players.find((seat) => seat.index !== loser.index)!;
  const next = cloneState(state);
  next.winner = winner.index;
  next.status = "won";
  const events: CombatEvent[] = [
    { type: "playerForfeited", player: loser.index, reason: action.reason },
    { type: "combatEnded", result: "won", winner: winner.index },
  ];
  return { ok: true, state: next, events };
}

export function applyAction(data: GameData, state: CombatState, action: Action): ActionResult {
  if (action.type === "forfeit") {
    // `system` is runtime-checked, not just typed: a forged client action must not resign anyone.
    if (action.system !== true) return { ok: false, error: "forfeit is a system action" };
    return forfeit(data, state, action);
  }
  const seat = state.players[action.player ?? state.activePlayer];
  if (!seat) return { ok: false, error: "unknown player" };
  // Only the active seat acts (`17` §4.2) — except a seat that still owes its
  // mulligan while the mulligan phase is open.
  const ownMulliganPending = state.status === "mulligan" && !seat.mulliganDone;
  if (seat.index !== state.activePlayer && !ownMulliganPending) {
    return { ok: false, error: "not your turn" };
  }
  const blocked = statusError(state, action, seat);
  if (blocked !== null) return { ok: false, error: blocked };
  switch (action.type) {
    case "mulligan": {
      const error = getMulliganError(data, state, action.instanceIds, seat);
      if (error !== null) return { ok: false, error };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      mulligan(data, next, next.players[seat.index]!, action.instanceIds, events);
      return { ok: true, state: next, events };
    }
    case "playCard": {
      const error = getPlayCardError(data, state, action, seat);
      if (error !== null) return { ok: false, error };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      playCard(data, next, next.players[seat.index]!, action, events);
      return { ok: true, state: next, events };
    }
    case "chooseCard": {
      if (!seat.pendingChoice!.options.includes(action.instanceId)) {
        return { ok: false, error: "not a choice option" };
      }
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      chooseCard(next, next.players[seat.index]!, action.instanceId, events);
      return { ok: true, state: next, events };
    }
    case "endTurn": {
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      if (next.mode === "pvp") {
        pvpEndTurn(data, next, events);
      } else {
        runEndTurn(data, next, events);
      }
      return { ok: true, state: next, events };
    }
    default: {
      const exhaustive: never = action;
      return { ok: false, error: `unknown action ${JSON.stringify(exhaustive)}` };
    }
  }
}
