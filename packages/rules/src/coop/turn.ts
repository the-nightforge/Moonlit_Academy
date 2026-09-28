import { refillHand } from "../draw";
import { checkCombatEnd, loseHp, processDeaths, tickUnitStatuses } from "../effects";
import { runEnemyTurn } from "../enemy-turn";
import { bumpCounter, checkLevelUps, levelUpPassive } from "../levelup";
import { baseMoonPower } from "../moon-power";
import { heroesOf } from "../players";
import { fireEventHooks, runRelicHooks } from "../run-relic-hooks";
import { hasStatus, removeStatus } from "../statuses";
import { endRound, endSeatTurn } from "../turn";
import { heroTurnStart, seatTurnStart } from "../turn-passives";
import type { CombatEvent, CombatState, GameData, PlayerState } from "../types/index";

/**
 * `01` §16.2 — start a shared co-op turn: all six heroes tick in position order
 * first, then each seat gets its moon power / refill / turn-start hooks. Both
 * seats may act until they mark themselves `done`.
 */
export function startCoopTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  state.status = "playerTurn";
  events.push({ type: "turnStarted", side: "hero", round: state.round });
  for (const seat of state.players) {
    seat.cardsPlayedThisTurn = 0;
    seat.done = false;
  }
  state.playedThisTurn = [];

  for (const hero of state.heroes) {
    if (hero.armor > 0) {
      hero.armor = 0;
      events.push({ type: "armorRemoved", targetId: hero.id });
    }
    removeStatus(hero, "reflect", events);
  }
  for (const seat of state.players) {
    const mine = heroesOf(state, seat.index);
    const anyAllyRegen = mine.some((hero) => hero.alive && hasStatus(hero, "regen"));
    for (const hero of mine) {
      if (!hero.alive) continue;
      if (anyAllyRegen) bumpCounter(data, hero, "turnsWithAllyRegen", 1);
      hero.firstCardDiscountUsedThisTurn = false;
      hero.comboBonusUsedThisTurn = false;
      hero.firstHitUsedThisTurn = false;
      hero.firstCardDiscountActive =
        hero.leveledUp && levelUpPassive(data, hero)?.type === "firstOwnCardDiscount";
      heroTurnStart(data, state, hero, events);
    }
  }
  checkLevelUps(data, state, events);
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    const start = events.length;
    tickUnitStatuses(data, state, hero, events);
    if (checkCombatEnd(state, events)) return;
    fireEventHooks(data, state, events, start, state.bloodMoonRounds, hero.player);
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
      fireEventHooks(data, state, events, start, state.bloodMoonRounds, hero.player);
      if (checkCombatEnd(state, events)) return;
    }
  }
  if (checkCombatEnd(state, events)) return;
  for (const seat of state.players) {
    const curve = data.combatConfig.moonPower;
    seat.moonPower = baseMoonPower(curve, curve.perRound, state.round) + seat.moonReserve + seat.moonPowerBonus;
    events.push({ type: "moonPowerChanged", value: seat.moonPower, player: seat.index });
    refillHand(data, state, seat, events);
    if (seat.hand.length === 0 && seat.drawPile.length === 0) {
      // §16.6: one seat decked out loses only its own heroes; the partner fights on.
      events.push({ type: "deckedOut", player: seat.index });
      for (const hero of heroesOf(state, seat.index)) {
        if (hero.alive) hero.hp = 0;
      }
      processDeaths(data, state, events, undefined);
      checkLevelUps(data, state, events);
      if (checkCombatEnd(state, events)) return;
    }
    runRelicHooks(data, state, events, { type: "playerTurnStart" }, seat.index);
    seatTurnStart(data, state, seat, events);
  }
  // A seat with no living heroes — forfeit, Cạn Bài, a wipe — can never act;
  // the shared turn must not wait on it (`01` §16.6).
  for (const seat of state.players) {
    if (heroesOf(state, seat.index).every((hero) => !hero.alive)) seat.done = true;
  }
}

/**
 * `01` §16.2 — one seat ends its half of the shared turn: a pending Chiêm Bài
 * takes its first option (the timer path), the seat is marked `done`, and only
 * when both seats are done does cleanup run (seat 0 then seat 1), followed by
 * the enemy turn, the round end, and the next shared turn.
 */
export function coopEndTurn(
  data: GameData,
  state: CombatState,
  seat: PlayerState,
  events: CombatEvent[],
): void {
  if (seat.pendingChoice !== null && seat.pendingChoice.kind === "chooseCard") {
    const options = seat.pendingChoice.options;
    const instanceId = options[0]!;
    const bottomed = options.filter((id) => id !== instanceId);
    state.cards[instanceId]!.heldTurns = 0;
    state.cards[instanceId]!.chosenThisTurn = true;
    seat.hand.push(instanceId);
    seat.drawPile.push(...bottomed);
    seat.pendingChoice = null;
    // A Chọn Pha queued behind the Chiêm Bài lapses with the turn.
    delete seat.moonChoicePending;
    events.push({ type: "cardChosen", instanceId, bottomed, player: seat.index });
  }
  if (seat.pendingChoice?.kind === "chooseMoon") {
    // The timer path keeps the moon where it is (`offset 0`).
    seat.pendingChoice = null;
    delete seat.moonChoicePending;
  }
  seat.done = true;
  // A seat whose heroes all fell mid-turn counts as done — it cannot act again.
  if (
    !state.players.every(
      (other) => other.done || heroesOf(state, other.index).every((hero) => !hero.alive),
    )
  ) {
    return;
  }
  for (const other of state.players) {
    endSeatTurn(data, state, other, events);
    if (state.status === "won" || state.status === "lost") return;
  }
  runEnemyTurn(data, state, events);
  if (state.status !== "enemyTurn") return;
  endRound(data, state, events);
  if (state.status !== "enemyTurn") return;
  startCoopTurn(data, state, events);
}
