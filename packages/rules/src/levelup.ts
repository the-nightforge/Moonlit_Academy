import type {
  CombatEvent,
  CombatState,
  GameData,
  HeroState,
  LevelUpCounter,
} from "./types/index";

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
    if (hero.levelUpCounter >= def.levelUp.threshold) {
      hero.leveledUp = true;
      events.push({ type: "heroLeveledUp", heroId: hero.id, name: def.name });
    }
  }
}
