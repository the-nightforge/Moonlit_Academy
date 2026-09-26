import { resolveEffects } from "./effects";
import type {
  CombatEvent,
  CombatState,
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

export function checkLevelUps(
  data: GameData,
  state: CombatState,
  events: CombatEvent[],
): void {
  for (const hero of state.heroes) {
    if (!hero.alive || hero.leveledUp) continue;
    const def = data.heroes[hero.defId];
    if (!def) continue;
    const threshold = hero.constellation >= 2 ? def.levelUp.constellationThreshold : def.levelUp.threshold;
    if (hero.levelUpCounter >= threshold) {
      hero.leveledUp = true;
      events.push({ type: "heroLeveledUp", heroId: hero.id, name: def.name });
      const onLevelUp = hero.levelUpForm === "alt" ? def.altLevelUp.onLevelUp : undefined;
      if (onLevelUp) resolveEffects(data, state, onLevelUp, { source: hero, noHooks: true }, events);
    }
  }
}
