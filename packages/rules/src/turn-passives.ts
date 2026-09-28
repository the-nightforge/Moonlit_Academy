import { bumpCounter, levelUpPassive } from "./levelup";
import type { CombatEvent, CombatState, GameData, HeroState, LevelUpPassive } from "./types/index";

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
}
