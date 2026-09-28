import { cardDefOf } from "./gear";
import { levelUpPassive } from "./levelup";
import { activeModifiers } from "./moon";
import { alliesOf, opponentsOf, summonsOf } from "./players";
import { hasStatus } from "./statuses";
import type { CardInstance, CardTag, CombatState, GameData, HeroState } from "./types/index";

/** Heroes owning a card instance: one, or two for a bond card — looked up in the card's seat. */
export function cardOwners(state: CombatState, instance: CardInstance): (HeroState | undefined)[] {
  return instance.ownerIds.map((ownerId) =>
    state.heroes.find((hero) => hero.defId === ownerId && hero.player === instance.player),
  );
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

/** Tự Do: the owner's cards with `tag` cost less (`01` §8). */
function ownTagDiscount(data: GameData, state: CombatState, instance: CardInstance, tags: readonly CardTag[]): number {
  if (instance.ownerIds.length !== 1) return 0;
  const [owner] = cardOwners(state, instance);
  if (!owner?.leveledUp) return 0;
  const passive = levelUpPassive(data, owner);
  return passive?.type === "tagDiscountOwnCards" && tags.includes(passive.tag) ? passive.amount : 0;
}

export function getEffectiveCost(
  data: GameData,
  state: CombatState,
  instanceId: string,
  player?: number,
): number {
  const instance = state.cards[instanceId];
  const card = instance ? cardDefOf(data, state, instance) : undefined;
  if (!card) throw new Error(`getEffectiveCost: unknown card instance "${instanceId}"`);
  const seat = player ?? instance!.player;
  let cost = card.cost;
  let floor = 0;
  for (const modifier of activeModifiers(data, state, seat)) {
    if (modifier.type === "costModifierForTag" && card.tags.includes(modifier.tag)) {
      cost += modifier.amount;
      floor = Math.max(floor, modifier.min);
    }
  }
  const chosen = instance!.chosenThisTurn ? data.combatConfig.chooseCardDiscount : 0;
  // PvP Phong Ấn (`01` §5.6): the sealed card costs more through the owner's next turn.
  const surcharge = instance!.sealSurcharge ?? 0;
  const passives = firstCardDiscount(data, state, instanceId) + bloodMoonDiscount(data, state, instance!) + ownTagDiscount(data, state, instance!, card.tags) + (instance!.turnDiscount ?? 0);
  return Math.max(0, Math.max(0, floor, cost) + surcharge - passives - chosen);
}

export function getValidTargets(data: GameData, state: CombatState, instanceId: string): string[] {
  const instance = state.cards[instanceId];
  const card = instance ? cardDefOf(data, state, instance) : undefined;
  if (!instance || !card) return [];
  const source = state.heroes.find(
    (hero) => hero.defId === instance.ownerIds[0] && hero.player === instance.player,
  );
  if (!source) return [];
  switch (card.target) {
    case "none":
      return [];
    case "enemy": {
      const targets = opponentsOf(state, source).filter(
        (unit) => unit.alive && !hasStatus(unit, "stealth"),
      );
      // PvP: a taunting opposing hero soaks single-target picks (`17` §4.4).
      if (state.mode === "pvp") {
        const taunters = targets.filter((unit) => hasStatus(unit, "taunt"));
        if (taunters.length > 0) return taunters.map((unit) => unit.id);
      }
      return targets.map((unit) => unit.id);
    }
    case "ally": {
      // Co-op: a targeted heal/buff may pick any of the six heroes plus both
      // seats' Linh Thú (`01` §16.3, §17.3).
      const allies = state.mode === "coop" ? [...state.heroes, ...summonsOf(state)] : alliesOf(state, source);
      return allies.filter((unit) => unit.alive).map((unit) => unit.id);
    }
  }
}

export function isCardPlayable(
  data: GameData,
  state: CombatState,
  instanceId: string,
  player?: number,
): boolean {
  if (state.status !== "playerTurn") return false;
  const instance = state.cards[instanceId];
  const card = instance ? cardDefOf(data, state, instance) : undefined;
  if (!instance || !card) return false;
  const seat = state.players[player ?? instance.player];
  if (!seat || !seat.hand.includes(instanceId)) return false;
  if (state.mode === "coop" && (seat.done || seat.pendingChoice !== null)) return false;
  if (ownerError(state, instance) !== null) return false;
  if (card.requiresBloodMoon && state.bloodMoonRounds === 0) return false;
  if (seat.moonPower < getEffectiveCost(data, state, instanceId, seat.index)) return false;
  if (card.target !== "none" && getValidTargets(data, state, instanceId).length === 0) return false;
  return true;
}
