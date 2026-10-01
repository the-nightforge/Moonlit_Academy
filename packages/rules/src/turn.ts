import { tickBossRevive } from "./coop/boss";
import { discardUnplayed, drawCards, refillHand } from "./draw";
import { checkCombatEnd, loseHp, processDeaths, tickUnitStatuses } from "./effects";
import { runEnemyTurn } from "./enemy-turn";
import { planEnemyIntents } from "./intent";
import { bumpCounter, checkLevelUps, levelUpPassive } from "./levelup";
import { applyStatusDecreed, decreeModifier, enterPhase } from "./moon";
import { baseMoonPower } from "./moon-power";
import { heroesOf, seatTag, summonsOf } from "./players";
import { cardOwners } from "./queries";
import { fireEventHooks, runRelicHooks } from "./run-relic-hooks";
import { DURATION_STATUSES, hasStatus, removeStatus } from "./statuses";
import { runSummonActions } from "./summons";
import { heroTurnStart, passiveOf, seatTurnStart } from "./turn-passives";
import type { CombatEvent, CombatState, GameData, PlayerState, UnitState } from "./types/index";

export function startPlayerTurn(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  events: CombatEvent[],
): void {
  state.status = "playerTurn";
  events.push({ type: "turnStarted", side: "hero", round: state.round, ...seatTag(state, player.index) });
  player.cardsPlayedThisTurn = 0;
  // Liên Kích + Tập Kích (`01` §7.5): the seat's chain counter and its first-hit
  // key reset when its turn starts. Xả Thân / Huyết Tế flags reset too (`01` §3.1).
  delete player.attackCardsThisTurn;
  delete player.discardsThisTurn;
  delete player.bloodPactUsed;
  state.firstHitKeys = (state.firstHitKeys ?? []).filter((key) => key !== `p${player.index}`);
  const mySummons = summonsOf(state).filter((summon) => summon.player === player.index);
  // Giữ Giáp (`01` §3.1 step 1): the decree skips the armor wipe and the Phản Đòn strip.
  if (!decreeModifier(data, state, "keepArmor")) {
    for (const unit of [...heroesOf(state, player.index), ...mySummons]) {
      if (unit.armor > 0) {
        unit.armor = 0;
        events.push({ type: "armorRemoved", targetId: unit.id });
      }
      removeStatus(unit, "reflect", events);
    }
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
    heroTurnStart(data, state, hero, events);
  }
  checkLevelUps(data, state, events);
  for (const unit of [...heroesOf(state, player.index), ...mySummons]) {
    if (!unit.alive) continue;
    const start = events.length;
    tickUnitStatuses(data, state, unit, events);
    if (checkCombatEnd(state, events)) return;
    fireEventHooks(data, state, events, start, state.bloodMoonRounds);
    if (checkCombatEnd(state, events)) return;
  }
  if (state.bloodMoonRounds > 0) {
    for (const hero of heroesOf(state, player.index)) {
      if (!hero.alive) continue;
      if (passiveOf(data, hero)?.type === "bloodMoonImmune") continue;
      const start = events.length;
      loseHp(data, hero, data.combatConfig.bloodMoonHpLoss, "bloodMoon", events);
      processDeaths(data, state, events, undefined);
      checkLevelUps(data, state, events);
      if (checkCombatEnd(state, events)) return;
      fireEventHooks(data, state, events, start, state.bloodMoonRounds);
      if (checkCombatEnd(state, events)) return;
    }
  }
  // Decree turn-start effects (`01` §3.1 step 5): Mầm Sống / Đoàn Viên heal,
  // then Thế Cân weakens the highest-HP units — both after Huyết Nguyệt.
  decreeTurnHeal(data, state, [...heroesOf(state, player.index), ...mySummons], events);
  decreeWeakHighest(data, state, events);
  if (checkCombatEnd(state, events)) return;
  const curve = data.combatConfig.moonPower;
  player.moonPower =
    baseMoonPower(curve, curve.perRound, state.round) + player.moonReserve + player.moonPowerBonus +
    // Nguyệt Sinh (`01` §7.5): the decree tops up the turn's fund.
    (decreeModifier(data, state, "turnMoonPowerBonus")?.amount ?? 0);
  // Fair Arena: the second player's first turn gets the catch-up bonus (`17` §4.2).
  if (state.mode === "pvp" && state.round === 1 && player.index !== state.firstPlayer) {
    player.moonPower += data.pvpConfig.secondPlayerBonus.moonPower;
  }
  events.push({ type: "moonPowerChanged", value: player.moonPower, ...seatTag(state, player.index) });
  refillHand(data, state, player, events);
  // Khai Trí (`01` §3.1 step 8): one extra draw after the refill — `handLimit` still applies.
  const decreeDraw = decreeModifier(data, state, "turnStartDraw");
  if (decreeDraw) drawCards(data, state, player, decreeDraw.amount, events);
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
  seatTurnStart(data, state, player, events);
}

/**
 * Mầm Sống / Đoàn Viên (`01` §3.1 step 5, §9.3): a flat heal — no heal
 * multiplier — of every living unit the decree targets: all of them
 * (`target: "all"`), or only the lowest-HP-ratio one (`"lowestRatio"`, HP ties
 * break to the lower position). Runs for the side whose turn is starting.
 */
export function decreeTurnHeal(
  data: GameData,
  state: CombatState,
  units: UnitState[],
  events: CombatEvent[],
): void {
  const heal = decreeModifier(data, state, "turnStartHeal");
  if (!heal) return;
  const living = units.filter((unit) => unit.alive && unit.hp > 0);
  const targets =
    heal.target === "all"
      ? living
      : living.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.position - b.position).slice(0, 1);
  for (const unit of targets) {
    const healed = Math.min(unit.maxHp - unit.hp, heal.amount);
    if (healed <= 0) continue;
    unit.hp += healed;
    events.push({ type: "healed", targetId: unit.id, amount: healed });
  }
}

/**
 * Thế Cân (`01` §3.1 step 5): Suy Yếu on the highest-HP living unit(s). PvE and
 * co-op fire once per round — at seat 0's turn start — against every seat's
 * highest-HP hero plus the highest-HP enemy; PvP fires at each seat's own turn
 * start and only hits that seat's hero (durations store 2 × rounds, `17` §4.3).
 * HP ties break to the lower position.
 */
export function decreeWeakHighest(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const modifier = decreeModifier(data, state, "turnStartStatusOnHighestHp");
  if (!modifier) return;
  if (state.mode !== "pvp" && state.activePlayer !== 0) return;
  const amount =
    modifier.amount * (state.mode === "pvp" && DURATION_STATUSES.has(modifier.status) ? 2 : 1);
  const highestOf = (units: UnitState[]): UnitState | undefined =>
    units
      .filter((unit) => unit.alive)
      .sort((a, b) => b.hp - a.hp || a.position - b.position)[0];
  if (state.mode === "pvp") {
    const target = highestOf(heroesOf(state, state.activePlayer));
    if (target) applyStatusDecreed(data, state, target, modifier.status, amount, target.id, events);
    return;
  }
  for (const seat of state.players) {
    const target = highestOf(heroesOf(state, seat.index));
    if (target) applyStatusDecreed(data, state, target, modifier.status, amount, target.id, events);
  }
  const enemy = highestOf(state.enemies);
  if (enemy) applyStatusDecreed(data, state, enemy, modifier.status, amount, enemy.id, events);
}

/** Duration statuses tick down once per unit at the round's (PvE) or turn's (PvP) end. */
export function tickDurations(state: CombatState, events: CombatEvent[]): void {
  for (const unit of [...state.heroes, ...summonsOf(state), ...state.enemies]) {
    for (const entry of [...unit.statuses]) {
      if (!DURATION_STATUSES.has(entry.id)) continue;
      entry.value -= 1;
      if (entry.value <= 0) removeStatus(unit, entry.id, events);
    }
  }
}

/** The shared part of a round's end: moon phase advances, blood moon ticks, round++. */
export function advanceRound(data: GameData, state: CombatState, events: CombatEvent[]): void {
  // Thế Thủ (`01` §7.5): every unit's first-single-hit shield rearms each round.
  for (const unit of [...state.heroes, ...summonsOf(state), ...state.enemies]) {
    delete unit.shieldUsed;
  }
  const from = state.moonIndex;
  state.moonIndex = (state.moonIndex + 1) % data.moonPhases.length;
  // Hook scan starts at the moonShifted event — enterPhase may append
  // statusRemoved (Nguyệt Chiếu) between it and the hook pass.
  const hookStart = events.length;
  events.push({ type: "moonShifted", from, to: state.moonIndex, cause: "roundEnd" });
  enterPhase(data, state, events);
  fireEventHooks(data, state, events, hookStart, state.bloodMoonRounds);
  if (checkCombatEnd(state, events)) return;
  if (state.bloodMoonRounds > 0) {
    // A `bloodMoonWhileActive` boss phase keeps Blood Moon at 1+ (`01` §16.5).
    const enemy = state.boss !== undefined ? state.enemies.find((e) => e.id === state.boss!.enemyId) : undefined;
    const floor =
      enemy !== undefined && data.enemies[enemy.defId]?.phases?.[state.boss!.phase - 1]?.bloodMoonWhileActive === true
        ? 1
        : 0;
    const rounds = Math.max(floor, state.bloodMoonRounds - 1);
    if (rounds !== state.bloodMoonRounds) {
      state.bloodMoonRounds = rounds;
      events.push({ type: "bloodMoonChanged", rounds, cause: "roundEnd" });
    }
  }
  state.round += 1;
}

export function endRound(data: GameData, state: CombatState, events: CombatEvent[]): void {
  tickDurations(state, events);
  advanceRound(data, state, events);
  if (state.status === "won" || state.status === "lost") return;
  tickBossRevive(data, state, events);
  if (["won", "lost"].includes(state.status)) return;
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
    // Tàn Chiêu cards leave unplayed — Đoạn Tuyệt still cuts for each (`01` §3.3).
    discardUnplayed(data, state, player, broken, events);
    if (["won", "lost"].includes(state.status)) return;
  }
  // Luân Hồi (`01` §3.3 step 1): the newest discards return under the draw pile.
  const recycle = decreeModifier(data, state, "recycleDiscard");
  if (recycle && player.discardPile.length > 0) {
    const back = player.discardPile.splice(-recycle.count);
    player.drawPile.push(...back);
    events.push({ type: "cardsRecycled", instanceIds: back, ...seatTag(state, player.index) });
  }
  for (const id of player.hand) state.cards[id]!.heldTurns += 1;
  for (const instance of Object.values(state.cards)) {
    if (instance.player !== player.index) continue;
    delete instance.chosenThisTurn;
    delete instance.turnDiscount;
  }
  const reserve = Math.min(data.combatConfig.moonReserveMax, player.moonPower);
  if (reserve !== player.moonReserve) {
    player.moonReserve = reserve;
    events.push({ type: "moonReserveChanged", side: "hero", value: reserve, ...seatTag(state, player.index) });
  }
  // Phong Ấn (`01` §5.6): the mark expires with the seat's turn, used or not.
  for (const hero of heroesOf(state, player.index)) {
    delete hero.sealedBy;
    removeStatus(hero, "freeze", events);
  }
}

export function runEndTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const player = state.players[state.activePlayer]!;
  endSeatTurn(data, state, player, events);
  if (state.status === "won" || state.status === "lost") return;
  runSummonActions(data, state, [player.index], events);
  if (["won", "lost"].includes(state.status)) return;
  runEnemyTurn(data, state, events);
  if (state.status !== "enemyTurn") return;
  endRound(data, state, events);
  if (state.status !== "enemyTurn") return;
  startPlayerTurn(data, state, player, events);
}
