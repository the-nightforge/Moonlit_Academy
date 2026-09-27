import { refillHand } from "./draw";
import { checkCombatEnd, loseHp, processDeaths, tickUnitStatuses } from "./effects";
import { runEnemyTurn } from "./enemy-turn";
import { planEnemyIntents } from "./intent";
import { bumpCounter, checkLevelUps, levelUpPassive } from "./levelup";
import { baseMoonPower } from "./moon-power";
import { heroesOf, seatTag } from "./players";
import { cardOwners } from "./queries";
import { fireEventHooks, runRelicHooks } from "./run-relic-hooks";
import { DURATION_STATUSES, hasStatus, removeStatus } from "./statuses";
import type { CombatEvent, CombatState, GameData, PlayerState } from "./types/index";

export function startPlayerTurn(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  events: CombatEvent[],
): void {
  state.status = "playerTurn";
  events.push({ type: "turnStarted", side: "hero", round: state.round, ...seatTag(state, player.index) });
  player.cardsPlayedThisTurn = 0;
  for (const hero of heroesOf(state, player.index)) {
    if (hero.armor > 0) {
      hero.armor = 0;
      events.push({ type: "armorRemoved", targetId: hero.id });
    }
    removeStatus(hero, "reflect", events);
  }
  const anyAllyRegen = heroesOf(state, player.index).some(
    (hero) => hero.alive && hasStatus(hero, "regen"),
  );
  for (const hero of heroesOf(state, player.index)) {
    if (!hero.alive) continue;
    if (anyAllyRegen) bumpCounter(data, hero, "turnsWithAllyRegen", 1);
    hero.firstCardDiscountUsedThisTurn = false;
    hero.comboBonusUsedThisTurn = false;
    hero.firstHitUsedThisTurn = false;
    hero.firstCardDiscountActive = hero.leveledUp && levelUpPassive(data, hero)?.type === "firstOwnCardDiscount";
  }
  checkLevelUps(data, state, events);
  for (const hero of heroesOf(state, player.index)) {
    if (!hero.alive) continue;
    const start = events.length;
    tickUnitStatuses(data, state, hero, events);
    if (checkCombatEnd(state, events)) return;
    fireEventHooks(data, state, events, start, state.bloodMoonRounds);
    if (checkCombatEnd(state, events)) return;
  }
  if (state.bloodMoonRounds > 0) {
    for (const hero of heroesOf(state, player.index)) {
      if (!hero.alive) continue;
      const start = events.length;
      loseHp(data, hero, data.combatConfig.bloodMoonHpLoss, "bloodMoon", events);
      processDeaths(data, state, events, undefined);
      checkLevelUps(data, state, events);
      if (checkCombatEnd(state, events)) return;
      fireEventHooks(data, state, events, start, state.bloodMoonRounds);
      if (checkCombatEnd(state, events)) return;
    }
  }
  if (checkCombatEnd(state, events)) return;
  const curve = data.combatConfig.moonPower;
  player.moonPower =
    baseMoonPower(curve, curve.perRound, state.round) + player.moonReserve + player.moonPowerBonus;
  // Fair Arena: the second player's first turn gets the catch-up bonus (`17` §4.2).
  if (state.mode === "pvp" && state.round === 1 && player.index !== state.firstPlayer) {
    player.moonPower += data.pvpConfig.secondPlayerBonus.moonPower;
  }
  events.push({ type: "moonPowerChanged", value: player.moonPower, ...seatTag(state, player.index) });
  refillHand(data, state, player, events);
  if (player.hand.length === 0 && player.drawPile.length === 0) {
    events.push({ type: "deckedOut", ...seatTag(state, player.index) });
    if (state.mode === "pvp") {
      const winner = (1 - player.index) as 0 | 1;
      state.winner = winner;
      state.status = "won";
      events.push({ type: "combatEnded", result: "won", winner });
    } else {
      state.status = "lost";
      events.push({ type: "combatEnded", result: "lost" });
    }
    return;
  }
  runRelicHooks(data, state, events, { type: "playerTurnStart" }, player.index);
}

/** Duration statuses tick down once per unit at the round's (PvE) or turn's (PvP) end. */
export function tickDurations(state: CombatState, events: CombatEvent[]): void {
  for (const unit of [...state.heroes, ...state.enemies]) {
    for (const entry of [...unit.statuses]) {
      if (!DURATION_STATUSES.has(entry.id)) continue;
      entry.value -= 1;
      if (entry.value <= 0) removeStatus(unit, entry.id, events);
    }
  }
}

/** The shared part of a round's end: moon phase advances, blood moon ticks, round++. */
export function advanceRound(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const from = state.moonIndex;
  state.moonIndex = (state.moonIndex + 1) % data.moonPhases.length;
  events.push({ type: "moonShifted", from, to: state.moonIndex, cause: "roundEnd" });
  fireEventHooks(data, state, events, events.length - 1, state.bloodMoonRounds);
  if (checkCombatEnd(state, events)) return;
  if (state.bloodMoonRounds > 0) {
    state.bloodMoonRounds -= 1;
    events.push({ type: "bloodMoonChanged", rounds: state.bloodMoonRounds, cause: "roundEnd" });
  }
  state.round += 1;
}

export function endRound(data: GameData, state: CombatState, events: CombatEvent[]): void {
  tickDurations(state, events);
  advanceRound(data, state, events);
  if (state.status === "won" || state.status === "lost") return;
  planEnemyIntents(data, state, events);
}

/**
 * §3.3 end-of-turn cleanup for one seat: turn-end hooks, discard of cards whose
 * owners died, held-turn counters, Moon Reserve, freeze removal. PvE, PvP and
 * co-op all run this per seat (co-op runs it for seat 0 then seat 1).
 */
export function endSeatTurn(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  events: CombatEvent[],
): void {
  runRelicHooks(data, state, events, { type: "playerTurnEnd" }, player.index);
  // Combat may end inside playerTurnEnd hooks. Written as a won/lost check so
  // TS keeps `status` un-narrowed for the identical guards after runEnemyTurn.
  if (state.status === "won" || state.status === "lost") return;
  const broken = player.hand.filter((id) =>
    cardOwners(state, state.cards[id]!).some((owner) => !owner?.alive),
  );
  if (broken.length > 0) {
    player.hand = player.hand.filter((id) => !broken.includes(id));
    player.discardPile.push(...broken);
    events.push({ type: "cardDiscarded", instanceIds: broken, ...seatTag(state, player.index) });
  }
  for (const id of player.hand) state.cards[id]!.heldTurns += 1;
  for (const instance of Object.values(state.cards)) delete instance.chosenThisTurn;
  const reserve = Math.min(data.combatConfig.moonReserveMax, player.moonPower);
  if (reserve !== player.moonReserve) {
    player.moonReserve = reserve;
    events.push({ type: "moonReserveChanged", side: "hero", value: reserve, ...seatTag(state, player.index) });
  }
  for (const hero of heroesOf(state, player.index)) removeStatus(hero, "freeze", events);
}

export function runEndTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const player = state.players[state.activePlayer]!;
  endSeatTurn(data, state, player, events);
  if (state.status === "won" || state.status === "lost") return;
  runEnemyTurn(data, state, events);
  if (state.status !== "enemyTurn") return;
  endRound(data, state, events);
  if (state.status !== "enemyTurn") return;
  startPlayerTurn(data, state, player, events);
}
