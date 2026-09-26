import { relicAt } from "./gear";
import type { CardTag, GameData, MoonModifier, CombatState } from "./types/index";

/**
 * Moon phase modifiers plus the always-on modifiers of held run relics, augments
 * and moon relics; `while: "bloodMoon"` ones only during blood moon (`01` §14.4).
 */
export function activeModifiers(data: GameData, state: CombatState): MoonModifier[] {
  const relicModifiers = state.runRelicIds.flatMap(
    (id) => (data.runRelics[id] ?? data.augments[id])?.modifiers ?? [],
  );
  const moonRelicModifiers = state.relics.flatMap((relic) => {
    const def = data.relics[relic.id];
    return def ? (relicAt(def, relic.resonance).modifiers ?? []) : [];
  });
  return [...(data.moonPhases[state.moonIndex]?.modifiers ?? []), ...relicModifiers, ...moonRelicModifiers].filter(
    (modifier) => modifier.type !== "costModifierForTag" || modifier.while !== "bloodMoon" || state.bloodMoonRounds > 0,
  );
}

export function moonCardDamageMultiplier(data: GameData, state: CombatState, tags: CardTag[]): number {
  let multiplier = 1;
  for (const modifier of activeModifiers(data, state)) {
    if (modifier.type === "damageMultiplierForTag" && tags.includes(modifier.tag)) {
      multiplier *= modifier.multiplier;
    }
  }
  return multiplier;
}

export function moonHealMultiplier(data: GameData, state: CombatState): number {
  let multiplier = 1;
  for (const modifier of activeModifiers(data, state)) {
    if (modifier.type === "healMultiplier") multiplier *= modifier.multiplier;
  }
  return multiplier;
}

export function moonStealthDurationBonus(data: GameData, state: CombatState): number {
  let bonus = 0;
  for (const modifier of activeModifiers(data, state)) {
    if (modifier.type === "stealthDurationBonus") bonus += modifier.amount;
  }
  return bonus;
}

export function moonArmorMultiplier(data: GameData, state: CombatState): number {
  let multiplier = 1;
  for (const modifier of activeModifiers(data, state)) {
    if (modifier.type === "armorMultiplier") multiplier *= modifier.multiplier;
  }
  return multiplier;
}
