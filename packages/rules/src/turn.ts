import { drawCards } from "./draw";
import { checkCombatEnd, loseHp, processDeaths, tickUnitStatuses } from "./effects";
import { runEnemyTurn } from "./enemy-turn";
import { announceIntents } from "./intent";
import { bumpCounter, checkLevelUps } from "./levelup";
import { DURATION_STATUSES, hasStatus, removeStatus } from "./statuses";
import type { CombatEvent, CombatState, GameData } from "./types/index";

const BLOOD_MOON_HP_LOSS = 2;

export function startPlayerTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  state.status = "playerTurn";
  events.push({ type: "turnStarted", side: "hero", round: state.round });
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
    hero.freeCardUsedThisTurn = false;
    hero.freeCardActive =
      hero.leveledUp &&
      data.heroes[hero.defId]?.levelUp.passive.type === "firstOwnCardFreeEachTurn";
  }
  checkLevelUps(data, state, events);
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    tickUnitStatuses(data, state, hero, events);
    if (checkCombatEnd(state, events)) return;
  }
  if (state.bloodMoonRounds > 0) {
    for (const hero of state.heroes) {
      if (!hero.alive) continue;
      loseHp(data, hero, BLOOD_MOON_HP_LOSS, "bloodMoon", events);
      processDeaths(data, state, events, undefined);
      checkLevelUps(data, state, events);
      if (checkCombatEnd(state, events)) return;
    }
  }
  if (checkCombatEnd(state, events)) return;
  state.moonPower = 3;
  drawCards(state, 5, events);
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
  if (state.bloodMoonRounds > 0) {
    state.bloodMoonRounds -= 1;
    events.push({ type: "bloodMoonChanged", rounds: state.bloodMoonRounds, cause: "roundEnd" });
  }
  state.round += 1;
  announceIntents(data, state, events);
}

export function runEndTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  if (state.hand.length > 0) {
    const discarded = [...state.hand];
    state.discardPile.push(...discarded);
    state.hand = [];
    events.push({ type: "cardDiscarded", instanceIds: discarded });
  }
  for (const hero of state.heroes) removeStatus(hero, "freeze", events);
  runEnemyTurn(data, state, events);
  if (state.status !== "enemyTurn") return;
  endRound(data, state, events);
  startPlayerTurn(data, state, events);
}
