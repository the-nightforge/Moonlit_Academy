import { resolveEffects } from "./effects";
import { awakenSummon } from "./summons";
import type {
  CombatEvent,
  CombatState,
  Effect,
  GameData,
  HeroState,
  LevelUpCounter,
  LevelUpPassive,
} from "./types/index";

/** The hero's level-up passive: the second form's when the loadout chose it (`01` §8). */
export function levelUpPassive(data: GameData, hero: HeroState): LevelUpPassive | undefined {
  const def = data.heroes[hero.defId];
  if (!def) return undefined;
  return hero.levelUpForm === "alt" ? def.altLevelUp.passive : def.levelUp.passive;
}

export function bumpCounter(
  data: GameData,
  hero: HeroState,
  counter: LevelUpCounter,
  amount: number,
): void {
  if (data.heroes[hero.defId]?.levelUp.counter === counter) {
    hero.levelUpCounter += amount;
  }
}

/** Seat-wide counters (`schemeCardsPlayed`, `cardsChosen`): every living hero of the seat is offered the bump. */
export function bumpSeat(data: GameData, state: CombatState, seat: number, counter: LevelUpCounter, amount: number): void {
  for (const hero of state.heroes) {
    if (hero.player === seat && hero.alive) bumpCounter(data, hero, counter, amount);
  }
}

/** Phong Ấn (`01` §5.6): credit `intentsSealed` to the hero who placed the mark when an intent/card is actually stripped. */
export function bumpIntentsSealed(
  data: GameData,
  state: CombatState,
  sealedBy: string,
  events: CombatEvent[],
): void {
  const sealer = state.heroes.find((hero) => hero.id === sealedBy);
  if (!sealer) return;
  bumpCounter(data, sealer, "intentsSealed", 1);
  checkLevelUps(data, state, events);
}

/** Phong Ấn (`01` §5.6): a sealed unit's intent/card/summon action keeps damage effects only. Emits `sealStripped` and credits the sealer when something is actually stripped. */
export function sealFilteredEffects(
  data: GameData,
  state: CombatState,
  unitId: string,
  sealedBy: string | undefined,
  effects: Effect[],
  refId: string,
  events: CombatEvent[],
): Effect[] {
  if (sealedBy === undefined) return effects;
  const kept = effects.filter((effect) => effect.type === "damage" || effect.type === "missingHpDamage" || effect.type === "scaledDamage");
  if (kept.length === effects.length) return effects;
  events.push({ type: "sealStripped", unitId, refId });
  bumpIntentsSealed(data, state, sealedBy, events);
  return kept;
}

export function checkLevelUps(
  data: GameData,
  state: CombatState,
  events: CombatEvent[],
): void {
  for (const hero of state.heroes) {
    if (!hero.alive || hero.leveledUp) continue;
    const def = data.heroes[hero.defId];
    if (!def) continue;
    const threshold = hero.constellation >= 2 && !hero.pvp ? def.levelUp.constellationThreshold : def.levelUp.threshold;
    if (hero.levelUpCounter >= threshold) {
      hero.leveledUp = true;
      events.push({ type: "heroLeveledUp", heroId: hero.id, name: def.name });
      const onLevelUp = hero.levelUpForm === "alt" ? def.altLevelUp.onLevelUp : def.levelUp.onLevelUp;
      if (onLevelUp) resolveEffects(data, state, onLevelUp, { source: hero, noHooks: true }, events);
      if (levelUpPassive(data, hero)?.type === "awakenSummons") awakenSummon(data, state, hero, events);
    }
  }
}
