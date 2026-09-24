import { activeMoonModifiers } from "./moon";
import { hasStatus } from "./statuses";
import type { CombatState, GameData } from "./types/index";

export function isFreeByPassive(data: GameData, state: CombatState, instanceId: string): boolean {
  const instance = state.cards[instanceId];
  if (!instance) return false;
  const owner = state.heroes.find((hero) => hero.defId === instance.ownerIds[0]);
  if (!owner?.leveledUp || !owner.freeCardActive || owner.freeCardUsedThisTurn) return false;
  return data.heroes[owner.defId]?.levelUp.passive.type === "firstOwnCardFreeEachTurn";
}

export function getEffectiveCost(data: GameData, state: CombatState, instanceId: string): number {
  const instance = state.cards[instanceId];
  const card = instance ? data.cards[instance.cardId] : undefined;
  if (!card) throw new Error(`getEffectiveCost: unknown card instance "${instanceId}"`);
  if (isFreeByPassive(data, state, instanceId)) return 0;
  let cost = card.cost;
  let floor = 0;
  for (const modifier of activeMoonModifiers(data, state)) {
    if (modifier.type === "costModifierForTag" && card.tags.includes(modifier.tag)) {
      cost += modifier.amount;
      floor = Math.max(floor, modifier.min);
    }
  }
  return Math.max(0, floor, cost);
}

export function getValidTargets(data: GameData, state: CombatState, instanceId: string): string[] {
  const instance = state.cards[instanceId];
  const card = instance ? data.cards[instance.cardId] : undefined;
  if (!card) return [];
  switch (card.target) {
    case "none":
      return [];
    case "enemy":
      return state.enemies
        .filter((enemy) => enemy.alive && !hasStatus(enemy, "stealth"))
        .map((enemy) => enemy.id);
    case "ally":
      return state.heroes.filter((hero) => hero.alive).map((hero) => hero.id);
  }
}

export function isCardPlayable(data: GameData, state: CombatState, instanceId: string): boolean {
  if (state.status !== "playerTurn") return false;
  const instance = state.cards[instanceId];
  const card = instance ? data.cards[instance.cardId] : undefined;
  if (!instance || !card || !state.hand.includes(instanceId)) return false;
  const owner = state.heroes.find((hero) => hero.defId === instance.ownerIds[0]);
  if (!owner?.alive || hasStatus(owner, "freeze")) return false;
  if (state.moonPower < getEffectiveCost(data, state, instanceId)) return false;
  if (card.target !== "none" && getValidTargets(data, state, instanceId).length === 0) return false;
  return true;
}
