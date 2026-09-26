import { refillHand } from "./draw";
import { checkCombatEnd, loseHp, processDeaths, tickUnitStatuses } from "./effects";
import { runEnemyTurn } from "./enemy-turn";
import { planEnemyIntents } from "./intent";
import { bumpCounter, checkLevelUps, levelUpPassive } from "./levelup";
import { baseMoonPower } from "./moon-power";
import { cardOwners } from "./queries";
import { fireEventHooks, runRelicHooks } from "./run-relic-hooks";
import { DURATION_STATUSES, hasStatus, removeStatus } from "./statuses";
import type { CombatEvent, CombatState, GameData } from "./types/index";

export function startPlayerTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  state.status = "playerTurn";
  events.push({ type: "turnStarted", side: "hero", round: state.round });
  state.cardsPlayedThisTurn = 0;
  for (const hero of state.heroes) {
    if (hero.armor > 0) {
      hero.armor = 0;
      events.push({ type: "armorRemoved", targetId: hero.id });
    }
    removeStatus(hero, "reflect", events);
  }
  const anyAllyRegen = state.heroes.some(
    (hero) => hero.alive && hasStatus(hero, "regen"),
  );
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    if (anyAllyRegen) bumpCounter(data, hero, "turnsWithAllyRegen", 1);
    hero.firstCardDiscountUsedThisTurn = false;
    hero.comboBonusUsedThisTurn = false;
    hero.firstHitUsedThisTurn = false;
    hero.firstCardDiscountActive = hero.leveledUp && levelUpPassive(data, hero)?.type === "firstOwnCardDiscount";
  }
  checkLevelUps(data, state, events);
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    const start = events.length;
    tickUnitStatuses(data, state, hero, events);
    if (checkCombatEnd(state, events)) return;
    fireEventHooks(data, state, events, start, state.bloodMoonRounds);
    if (checkCombatEnd(state, events)) return;
  }
  if (state.bloodMoonRounds > 0) {
    for (const hero of state.heroes) {
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
  state.moonPower =
    baseMoonPower(curve, curve.perRound, state.round) + state.moonReserve + state.moonPowerBonus;
  events.push({ type: "moonPowerChanged", value: state.moonPower });
  refillHand(data, state, events);
  if (state.hand.length === 0 && state.drawPile.length === 0) {
    state.status = "lost";
    events.push({ type: "deckedOut" }, { type: "combatEnded", result: "lost" });
    return;
  }
  runRelicHooks(data, state, events, { type: "playerTurnStart" });
}

export function endRound(data: GameData, state: CombatState, events: CombatEvent[]): void {
  for (const unit of [...state.heroes, ...state.enemies]) {
    for (const entry of [...unit.statuses]) {
      if (!DURATION_STATUSES.has(entry.id)) continue;
      entry.value -= 1;
      if (entry.value <= 0) removeStatus(unit, entry.id, events);
    }
  }
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
  planEnemyIntents(data, state, events);
}

export function runEndTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  runRelicHooks(data, state, events, { type: "playerTurnEnd" });
  // Combat may end inside playerTurnEnd hooks. Written as a won/lost check so
  // TS keeps `status` un-narrowed for the identical guards after runEnemyTurn.
  if (state.status === "won" || state.status === "lost") return;
  const broken = state.hand.filter((id) =>
    cardOwners(state, state.cards[id]!).some((owner) => !owner?.alive),
  );
  if (broken.length > 0) {
    state.hand = state.hand.filter((id) => !broken.includes(id));
    state.discardPile.push(...broken);
    events.push({ type: "cardDiscarded", instanceIds: broken });
  }
  for (const id of state.hand) state.cards[id]!.heldTurns += 1;
  for (const instance of Object.values(state.cards)) delete instance.chosenThisTurn;
  const reserve = Math.min(data.combatConfig.moonReserveMax, state.moonPower);
  if (reserve !== state.moonReserve) {
    state.moonReserve = reserve;
    events.push({ type: "moonReserveChanged", side: "hero", value: reserve });
  }
  for (const hero of state.heroes) removeStatus(hero, "freeze", events);
  runEnemyTurn(data, state, events);
  if (state.status !== "enemyTurn") return;
  endRound(data, state, events);
  if (state.status !== "enemyTurn") return;
  startPlayerTurn(data, state, events);
}
