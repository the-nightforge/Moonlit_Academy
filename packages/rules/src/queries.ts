import { cardDefOf } from "./gear";
import { levelUpPassive } from "./levelup";
import { activeModifiers } from "./moon";
import { hasStatus } from "./statuses";
import type { CardInstance, CombatState, GameData, HeroState } from "./types/index";

/** Heroes owning a card instance: one, or two for a bond card. */
export function cardOwners(state: CombatState, instance: CardInstance): (HeroState | undefined)[] {
  return instance.ownerIds.map((ownerId) => state.heroes.find((hero) => hero.defId === ownerId));
}

/** Rejection reason tied to the card's owners, or null. */
export function ownerError(state: CombatState, instance: CardInstance): string | null {
  const owners = cardOwners(state, instance);
  if (owners.some((owner) => !owner?.alive)) return "card is broken (owner is dead)";
  if (owners.some((owner) => owner !== undefined && hasStatus(owner, "freeze"))) {
    return "owner is frozen";
  }
  return null;
}

/** First-card discount granted by a `firstOwnCardDiscount` passive, or 0. */
export function firstCardDiscount(data: GameData, state: CombatState, instanceId: string): number {
  const instance = state.cards[instanceId];
  // Level-up passives never apply to bond cards.
  if (!instance || instance.ownerIds.length !== 1) return 0;
  const [owner] = cardOwners(state, instance);
  if (!owner?.leveledUp || !owner.firstCardDiscountActive || owner.firstCardDiscountUsedThisTurn) return 0;
  const passive = levelUpPassive(data, owner);
  return passive?.type === "firstOwnCardDiscount" ? passive.amount : 0;
}

/** Huyết Diện: the owner's cards cost less during blood moon (`01` §8). */
function bloodMoonDiscount(data: GameData, state: CombatState, instance: CardInstance): number {
  if (state.bloodMoonRounds === 0 || instance.ownerIds.length !== 1) return 0;
  const [owner] = cardOwners(state, instance);
  if (!owner?.leveledUp) return 0;
  const passive = levelUpPassive(data, owner);
  return passive?.type === "bloodMoonOwnCardDiscount" ? passive.amount : 0;
}

export function getEffectiveCost(data: GameData, state: CombatState, instanceId: string): number {
  const instance = state.cards[instanceId];
  const card = instance ? cardDefOf(data, state, instance) : undefined;
  if (!card) throw new Error(`getEffectiveCost: unknown card instance "${instanceId}"`);
  let cost = card.cost;
  let floor = 0;
  for (const modifier of activeModifiers(data, state)) {
    if (modifier.type === "costModifierForTag" && card.tags.includes(modifier.tag)) {
      cost += modifier.amount;
      floor = Math.max(floor, modifier.min);
    }
  }
  const chosen = instance!.chosenThisTurn ? data.combatConfig.chooseCardDiscount : 0;
  const passives = firstCardDiscount(data, state, instanceId) + bloodMoonDiscount(data, state, instance!);
  return Math.max(0, Math.max(0, floor, cost) - passives - chosen);
}

export function getValidTargets(data: GameData, state: CombatState, instanceId: string): string[] {
  const instance = state.cards[instanceId];
  const card = instance ? cardDefOf(data, state, instance) : undefined;
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
  const card = instance ? cardDefOf(data, state, instance) : undefined;
  if (!instance || !card || !state.hand.includes(instanceId)) return false;
  if (ownerError(state, instance) !== null) return false;
  if (card.requiresBloodMoon && state.bloodMoonRounds === 0) return false;
  if (state.moonPower < getEffectiveCost(data, state, instanceId)) return false;
  if (card.target !== "none" && getValidTargets(data, state, instanceId).length === 0) return false;
  return true;
}
