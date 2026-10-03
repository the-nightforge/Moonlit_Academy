import { resolveEffects } from "./effects";
import { bumpCounter, levelUpPassive } from "./levelup";
import { applyStatusDecreed, decreeModifier } from "./moon";
import { heroesOf, seatTag } from "./players";
import { getEffectiveCost } from "./queries";
import { nextRandom } from "./rng";
import type { CombatEvent, CombatState, GameData, HeroState, LevelUpPassive, PlayerState } from "./types/index";

/** The hero's level-up passive while it is in effect: alive and leveled up (`01` §8). */
export function passiveOf(data: GameData, hero: HeroState): LevelUpPassive | undefined {
  return hero.alive && hero.leveledUp ? levelUpPassive(data, hero) : undefined;
}

/** Hộ Vệ: `guardian` takes a hit meant for a guarded ally (`01` §9.3.1 step 1b). */
export function interceptHit(data: GameData, guardian: HeroState, events: CombatEvent[]): void {
  bumpCounter(data, guardian, "hitsIntercepted", 1);
  const passive = passiveOf(data, guardian);
  if (passive?.type === "interceptArmor") {
    guardian.armor += passive.amount;
    events.push({ type: "armorGained", targetId: guardian.id, amount: passive.amount });
  }
}

/**
 * Per-hero turn-start work shared by PvE/PvP (`turn.ts`) and co-op (`coop/turn.ts`),
 * run after armor removal and before level-up checks (`01` §3.1).
 */
export function heroTurnStart(data: GameData, state: CombatState, hero: HeroState, events: CombatEvent[]): void {
  if (!hero.alive) return;
  const passive = passiveOf(data, hero);
  if (passive?.type === "armorPerTurn") {
    hero.armor += passive.amount;
    events.push({ type: "armorGained", targetId: hero.id, amount: passive.amount });
  }
  if (state.round >= 2) bumpCounter(data, hero, "turnsSurvived", 1);
  bumpCounter(data, hero, "studyPoints", 1);
  if (data.moonPhases[state.moonIndex]!.id === "full") bumpCounter(data, hero, "fullMoonsSeen", 1);
  delete hero.firstSchemeUsedThisTurn;
  delete hero.firstSealUsedThisTurn;
  if (passive?.type === "randomBuffPerTurn") {
    const table = data.combatConfig.levelUpRandomBuffs;
    const roll = nextRandom(state.rngState);
    state.rngState = roll.rngState;
    const buff = table[Math.floor(roll.value * table.length)]!;
    applyStatusDecreed(data, state, hero, buff.status, buff.amount, hero.id, events);
  }
}

/** Opens Chọn Pha when it is owed and no other choice is pending (`01` §3.1). */
export function openMoonChoice(state: CombatState, player: PlayerState, events: CombatEvent[]): void {
  if (player.moonChoicePending !== true || player.pendingChoice !== null) return;
  if (["won", "lost"].includes(state.status)) return;
  const options = [0, 1, 2];
  player.pendingChoice = { kind: "chooseMoon", options };
  // Co-op keeps the shared turn open while one seat answers (`01` §16.2).
  if (state.mode !== "coop") state.status = "choosing";
  events.push({ type: "moonChoiceOpened", options, ...seatTag(state, player.index) });
}

/**
 * Per-seat turn-start work after the turn-start hooks (`01` §3.1): Vạn Kim's
 * Chiêm Bài, then Chọn Pha (opened once the Chiêm Bài is answered).
 */
export function seatTurnStart(data: GameData, state: CombatState, player: PlayerState, events: CombatEvent[]): void {
  if (["won", "lost"].includes(state.status)) return;
  const heroes = heroesOf(state, player.index);
  for (const hero of heroes) {
    const passive = passiveOf(data, hero);
    if (passive?.type !== "cheapestCardDiscount" || player.hand.length === 0) continue;
    const cheapest = player.hand.reduce((best, id) =>
      getEffectiveCost(data, state, id) < getEffectiveCost(data, state, best) ? id : best);
    const instance = state.cards[cheapest]!;
    instance.turnDiscount = (instance.turnDiscount ?? 0) + passive.amount;
  }
  for (const hero of heroes) {
    const passive = passiveOf(data, hero);
    if (passive?.type !== "freeChooseCardPerTurn" || player.pendingChoice !== null) continue;
    resolveEffects(data, state, [{ type: "chooseCard", look: passive.look }], { source: hero, noHooks: true }, events);
  }
  // Bói Nguyệt (`01` §3.1 step 12): the decree's free Chiêm Bài opens after Vạn
  // Kim — when a choice is already open it queues on `omenPending` and fires
  // once that choice is answered (`applyAction` chooseCard), still before Chọn Pha.
  delete player.omenPending;
  const omen = decreeModifier(data, state, "freeChooseCard");
  const seer = heroes.find((hero) => hero.alive);
  if (omen !== undefined && seer !== undefined) {
    if (player.pendingChoice === null) {
      resolveEffects(data, state, [{ type: "chooseCard", look: omen.look }], { source: seer, noHooks: true }, events);
    } else {
      player.omenPending = omen.look;
    }
  }
  const owes = heroes.some((hero) => passiveOf(data, hero)?.type === "chooseMoon");
  // Co-op: one shared moon — when both seats owe, seat 0 chooses (`18` §2.2).
  const partnerChooses =
    state.mode === "coop" && player.index > 0 &&
    state.players.slice(0, player.index).some((seat) =>
      heroesOf(state, seat.index).some((hero) => passiveOf(data, hero)?.type === "chooseMoon"),
    );
  if (owes && !partnerChooses) player.moonChoicePending = true;
  else delete player.moonChoicePending;
  openMoonChoice(state, player, events);
}
