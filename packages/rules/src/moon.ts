import type { CardTag, GameData, MoonModifier, CombatState } from "./types/index";

export function activeMoonModifiers(data: GameData, state: CombatState): MoonModifier[] {
  return data.moonPhases[state.moonIndex]?.modifiers ?? [];
}

export function moonCardDamageMultiplier(data: GameData, state: CombatState, tags: CardTag[]): number {
  let multiplier = 1;
  for (const modifier of activeMoonModifiers(data, state)) {
    if (modifier.type === "damageMultiplierForTag" && tags.includes(modifier.tag)) {
      multiplier *= modifier.multiplier;
    }
  }
  return multiplier;
}

export function moonHealMultiplier(data: GameData, state: CombatState): number {
  let multiplier = 1;
  for (const modifier of activeMoonModifiers(data, state)) {
    if (modifier.type === "healMultiplier") multiplier *= modifier.multiplier;
  }
  return multiplier;
}

export function moonStealthDurationBonus(data: GameData, state: CombatState): number {
  let bonus = 0;
  for (const modifier of activeMoonModifiers(data, state)) {
    if (modifier.type === "stealthDurationBonus") bonus += modifier.amount;
  }
  return bonus;
}

export function moonArmorMultiplier(data: GameData, state: CombatState): number {
  let multiplier = 1;
  for (const modifier of activeMoonModifiers(data, state)) {
    if (modifier.type === "armorMultiplier") multiplier *= modifier.multiplier;
  }
  return multiplier;
}
