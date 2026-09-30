import { cloneState } from "./clone";
import { fireCoopCombos } from "./coop/combos";
import { coopEndTurn, startCoopTurn } from "./coop/turn";
import { addToHand } from "./draw";
import { checkCombatEnd, processDeaths, resolveEffects } from "./effects";
import { guardianOf } from "./enemy-turn";
import { cardDefOf } from "./gear";
import { bumpCounter, bumpSeat, checkLevelUps, levelUpPassive, sealFilteredEffects } from "./levelup";
import { activePlayerState, heroesOf, seatTag } from "./players";
import { pvpEndTurn } from "./pvp/turn";
import { cardOwners, firstCardDiscount, getEffectiveCost, getValidTargets, ownerError } from "./queries";
import { shuffle } from "./rng";
import { runRelicHooks } from "./run-relic-hooks";
import { getStatus, removeStatus } from "./statuses";
import { runEndTurn, startPlayerTurn } from "./turn";
import { interceptHit, openMoonChoice, passiveOf } from "./turn-passives";
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
  if (state.mode === "coop") {
    if (player.done) return "already done";
    if (player.pendingChoice !== null) return "choice pending";
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

  if (card.tags.includes("scheme")) {
    bumpSeat(data, state, player.index, "schemeCardsPlayed", 1);
    if (!card.bond) bumpCounter(data, owner, "studyPoints", 1);
  }

  // Tàn Ảnh: the owner's first Liên Hoàn card each turn counts one more card played.
  let comboBonus = 0;
  const passive = !card.bond && owner.leveledUp ? levelUpPassive(data, owner) : undefined;
  if (passive?.type === "firstComboCountsExtra" && card.keywords?.includes("lien_hoan") && !owner.comboBonusUsedThisTurn) {
    owner.comboBonusUsedThisTurn = true;
    comboBonus = passive.amount;
  }

  // Fair Arena Mê Hoặc: the charmed owner's first single-target attack hits its
  // own highest-HP ally (`01` §15.5).
  let chosenIdOverride: string | undefined;
  if (state.mode === "pvp" && card.type === "attack" && card.target === "enemy" && !card.bond) {
    const charm = getStatus(owner, "charm");
    if (charm) {
      const allies = heroesOf(state, player.index).filter((hero) => hero.alive && hero !== owner);
      const victim =
        allies.reduce<HeroState | undefined>((best, hero) => (best === undefined || hero.hp > best.hp ? hero : best), undefined) ?? owner;
      chosenIdOverride = victim.id;
      charm.value -= 1;
      if (charm.value <= 0) removeStatus(owner, "charm", events);
    }
  }

  // Fair Arena: a single-target card aimed at a guarded hero hits the guardian (`01` §15.4).
  // A Mê Hoặc-redirected hit already landed on the attacker's own side — no Hộ Vệ.
  let chosenId = chosenIdOverride ?? action.targetId;
  if (state.mode === "pvp" && card.target === "enemy" && chosenId !== undefined && chosenIdOverride === undefined) {
    const guardian = guardianOf(state, chosenId);
    if (guardian && guardian.player !== player.index) {
      chosenId = guardian.id;
      interceptHit(data, guardian, events);
    }
  }

  const ctx = { source: owner, actors: owners, card, chosenId, instanceId: instance.instanceId, comboBonus };
  // Phong Ấn (`01` §5.6): a card owned by a sealed hero keeps damage only —
  // the mark covers the whole seat turn, like an enemy's intent chain.
  const sealedOwner = owners.find((hero) => hero.sealedBy !== undefined);
  const cardEffects = sealFilteredEffects(
    data,
    state,
    sealedOwner?.id ?? owner.id,
    sealedOwner?.sealedBy,
    card.effects,
    instance.instanceId,
    events,
  );
  // Bác Học: the owner's first scheme card each turn resolves twice; the first pass skips Chiêm Bài.
  if (passive?.type === "firstSchemeRepeats" && card.tags.includes("scheme") && !owner.firstSchemeUsedThisTurn) {
    owner.firstSchemeUsedThisTurn = true;
    resolveEffects(data, state, cardEffects.filter((effect) => effect.type !== "chooseCard"), ctx, events);
  }
  if (!["won", "lost"].includes(state.status) && owners.every((hero) => hero.alive)) {
    resolveEffects(data, state, cardEffects, ctx, events);
  }

  if (card.type === "attack") {
    for (const attacker of attackCleanupTargets(card, owners)) {
      removeStatus(attacker, "empower", events);
      removeStatus(attacker, "stealth", events);
    }
  }
  runRelicHooks(data, state, events, { type: "cardPlayed", card, heroId: owner.id }, player.index);
  if (state.mode === "coop" && !["won", "lost"].includes(state.status)) {
    // `01` §16.4 — journal the card, then see if it completes a Hợp Kích with a
    // partner's earlier card; combos fire before the card hits the discard pile.
    const entry = {
      player: player.index,
      instanceId: instance.instanceId,
      cardId: instance.cardId,
      moonAfter: state.moonIndex,
    };
    state.playedThisTurn!.push(entry);
    fireCoopCombos(data, state, player, entry, owner, events);
  }
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
      if (effect.type === "damage" || effect.type === "missingHpDamage" || effect.type === "scaledDamage") damageActors.add(actor);
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
  if (state.mode === "coop") {
    // Both seats mulligan in parallel (`01` §16.1); the second one opens the
    // shared turn, then combatStart hooks fire in seat order.
    if (!state.players.every((seat) => seat.mulliganDone)) return;
    startCoopTurn(data, state, events);
    for (const seat of state.players) {
      runRelicHooks(data, state, events, { type: "combatStart" }, seat.index);
    }
    return;
  }
  startPlayerTurn(data, state, player, events);
  runRelicHooks(data, state, events, { type: "combatStart" }, player.index);
}

function chooseCard(data: GameData, state: CombatState, player: PlayerState, instanceId: string, options: string[], events: CombatEvent[]): void {
  const bottomed = options.filter((id) => id !== instanceId);
  state.cards[instanceId]!.heldTurns = 0;
  state.cards[instanceId]!.chosenThisTurn = true;
  addToHand(data, state, player, instanceId, events);
  player.drawPile.push(...bottomed);
  player.pendingChoice = null;
  state.status = "playerTurn";
  events.push({ type: "cardChosen", instanceId, bottomed, ...seatTag(state, player.index) });
}

/** Chọn Pha answer (`01` §5.5): `offset` shifts the moon with the passive's hero as source. */
function chooseMoon(data: GameData, state: CombatState, player: PlayerState, offset: number, events: CombatEvent[]): void {
  player.pendingChoice = null;
  delete player.moonChoicePending;
  if (state.mode !== "coop") state.status = "playerTurn";
  if (offset === 0) return;
  // Co-op keeps the shared turn open while the choice is pending, so the
  // chooser may have died before the answer — the choice still resolves.
  const chooser = heroesOf(state, player.index).find((hero) => passiveOf(data, hero)?.type === "chooseMoon");
  if (chooser === undefined) return;
  resolveEffects(data, state, [{ type: "shiftMoon", amount: offset }], { source: chooser }, events);
}

function statusError(state: CombatState, action: Action, player: PlayerState): string | null {
  if (action.type === "mulligan") {
    return state.status === "mulligan" && !player.mulliganDone ? null : "mulligan already done";
  }
  if (state.mode === "coop") {
    // `01` §16.2: the turn is shared — a pending Chiêm Bài still answers first
    // (an endTurn auto-picks it), and a seat that pressed Xong is out.
    if (state.status === "mulligan") return "mulligan pending";
    if (action.type === "chooseCard" || action.type === "chooseMoon") {
      return player.pendingChoice === null ? "no pending choice" : null;
    }
    if (player.pendingChoice !== null && action.type !== "endTurn") return "choice pending";
    if (state.status === "playerTurn") return player.done ? "already done" : null;
    return "not the player turn";
  }
  switch (state.status) {
    case "mulligan":
      return "mulligan pending";
    case "choosing":
      return action.type === "chooseCard" || action.type === "chooseMoon" ? null : "choice pending";
    case "playerTurn":
      return action.type === "chooseCard" || action.type === "chooseMoon" ? "no pending choice" : null;
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
 * `17` §4.6 — a forfeit resolves a PvP match; in co-op the seat's three heroes
 * fall and the partner fights on (`01` §16.6). `system: true` is set by the
 * server (resign command, timeout, disconnect); a client action never has it.
 */
function forfeit(data: GameData, state: CombatState, action: Extract<Action, { type: "forfeit" }>): ActionResult {
  if (state.mode !== "pvp" && state.mode !== "coop") {
    return { ok: false, error: "forfeit is only valid in pvp or coop" };
  }
  if (state.status === "won" || state.status === "lost") {
    return { ok: false, error: "match already ended" };
  }
  const loser = state.players[action.player];
  if (!loser) return { ok: false, error: "unknown player" };
  if (state.mode === "coop") {
    const next = cloneState(state);
    const events: CombatEvent[] = [
      { type: "playerForfeited", player: loser.index, reason: action.reason },
    ];
    const seat = next.players[loser.index]!;
    seat.done = true;
    seat.mulliganDone = true;
    if (seat.pendingChoice !== null) {
      if (seat.pendingChoice.kind === "chooseCard") {
        seat.drawPile.push(...seat.pendingChoice.options);
      }
      seat.pendingChoice = null;
      delete seat.moonChoicePending;
    }
    for (const hero of heroesOf(next, seat.index)) {
      if (hero.alive) hero.hp = 0;
    }
    processDeaths(data, next, events, undefined);
    checkCombatEnd(next, events);
    return { ok: true, state: next, events };
  }
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
  // mulligan while the mulligan phase is open, or either co-op seat during the
  // shared turn (`01` §16.2).
  const ownMulliganPending = state.status === "mulligan" && !seat.mulliganDone;
  const coopSharedTurn = state.mode === "coop" && state.status === "playerTurn";
  if (seat.index !== state.activePlayer && !ownMulliganPending && !coopSharedTurn) {
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
      const pending = seat.pendingChoice;
      if (pending?.kind !== "chooseCard") return { ok: false, error: "no pending choice" };
      if (!pending.options.includes(action.instanceId)) return { ok: false, error: "not a choice option" };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      const nextSeat = next.players[seat.index]!;
      chooseCard(data, next, nextSeat, action.instanceId, pending.options, events);
      bumpSeat(data, next, seat.index, "cardsChosen", 1);
      checkLevelUps(data, next, events);
      openMoonChoice(next, nextSeat, events);
      return { ok: true, state: next, events };
    }
    case "chooseMoon": {
      const pending = seat.pendingChoice;
      if (pending?.kind !== "chooseMoon") return { ok: false, error: "no pending choice" };
      if (!pending.options.includes(action.offset)) return { ok: false, error: "not a choice option" };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      chooseMoon(data, next, next.players[seat.index]!, action.offset, events);
      return { ok: true, state: next, events };
    }
    case "endTurn": {
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      if (next.mode === "coop") {
        coopEndTurn(data, next, next.players[seat.index]!, events);
      } else if (next.mode === "pvp") {
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
