import { cardDefOf } from "../gear";
import { bossPhaseOf } from "../coop/boss";
import { levelUpPassive } from "../levelup";
import { decreeModifier, phaseModifiers } from "../moon";
import { heroesOf, opponentsOf, summonsOf } from "../players";
import { getEffectiveCost } from "../queries";
import { hasStatus } from "../statuses";
import { isSummon, summonOf } from "../summons";
import type {
  Action,
  CardDef,
  CardInstance,
  CombatState,
  Effect,
  EnemyState,
  GameData,
  HeroState,
  IntentDef,
  MoonPhaseId,
  UnitState,
} from "../types/index";
import type { BotObservation } from "./observation";

/**
 * Rough benefit estimates for one legal action — the feature vector a
 * `BotProfile` scores against (`weights` keys). Everything is computed from the
 * seat's sanitized observation only; no engine simulation, no hidden info.
 * Units are intentionally in "points of benefit" so styles can weigh them.
 *
 * `damage` is *effective* damage (capped at what the target can absorb), so a
 * cheap kill is not outscored by an expensive overkill — the excess lands in
 * `overkill`, which profiles weigh negatively.
 */
export const FEATURE_NAMES = [
  "damage",
  "lethal",
  "overkill",
  "heal",
  "overheal",
  "preventLethal",
  "control",
  "draw",
  "handCap",
  "reserve",
  "waste",
  "levelUp",
  "moon",
  "summon",
  "synergy",
  "cost",
  "selfDamage",
  "hold",
  "convert",
  "mulliganFix",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export type FeatureVector = Partial<Record<FeatureName, number>>;

/** Adds `amount` under `name`. */
function put(vec: FeatureVector, name: FeatureName, amount: number): void {
  if (amount !== 0) vec[name] = (vec[name] ?? 0) + amount;
}

/** Damage/heal/etc. an effect list can put on `chosen` (`to: "chosen"`), in rough points. */
function chosenEffects(effects: readonly Effect[]): Effect[] {
  const out: Effect[] = [];
  const walk = (list: readonly Effect[]) => {
    for (const effect of list) {
      if (effect.type === "conditional") {
        walk(effect.then);
        walk(effect.else ?? []);
      } else if ("to" in effect && effect.to === "chosen") {
        out.push(effect);
      }
    }
  };
  walk(effects);
  return out;
}

/** Effects hitting every opposing unit regardless of target. */
function wideEffects(effects: readonly Effect[]): Effect[] {
  const out: Effect[] = [];
  const walk = (list: readonly Effect[]) => {
    for (const effect of list) {
      if (effect.type === "conditional") {
        walk(effect.then);
        walk(effect.else ?? []);
      } else if ("to" in effect && effect.to === "allEnemies") {
        out.push(effect);
      }
    }
  };
  walk(effects);
  return out;
}

/** Effects landing on the acting seat's own units (self/allies). */
function selfEffects(effects: readonly Effect[]): Effect[] {
  const out: Effect[] = [];
  const walk = (list: readonly Effect[]) => {
    for (const effect of list) {
      if (effect.type === "conditional") {
        walk(effect.then);
        walk(effect.else ?? []);
      } else if (
        "to" in effect &&
        (effect.to === "self" || effect.to === "allAllies" || effect.to === "owner")
      ) {
        out.push(effect);
      }
    }
  };
  walk(effects);
  return out;
}

/** True when any nested effect (incl. conditional branches) has `type`. */
function hasEffect(effects: readonly Effect[], type: Effect["type"]): boolean {
  for (const effect of effects) {
    if (effect.type === type) return true;
    if (effect.type === "conditional" && (hasEffect(effect.then, type) || hasEffect(effect.else ?? [], type))) {
      return true;
    }
    if (effect.type === "execute" && hasEffect(effect.elseEffects ?? [], type)) return true;
  }
  return false;
}

/** True when the card applies one of `statuses` anywhere in its effect tree. */
function appliesStatus(effects: readonly Effect[], ...statuses: string[]): boolean {
  for (const effect of effects) {
    if (effect.type === "applyStatus" && statuses.includes(effect.status)) return true;
    if (effect.type === "conditional" && (appliesStatus(effect.then, ...statuses) || appliesStatus(effect.else ?? [], ...statuses))) {
      return true;
    }
    if (effect.type === "execute" && appliesStatus(effect.elseEffects ?? [], ...statuses)) return true;
  }
  return false;
}

/**
 * Whether this seat can raise Huyết Nguyệt (own info only): a caller already in
 * hand, or one still reachable via draw/discard. Draw-pile contents are hidden
 * from the seat, so the registered decklist is the legal channel — a caller
 * copy stays reachable while fewer copies are visible than registered.
 */
function moonAccess(
  data: GameData,
  state: CombatState,
  seat: number,
  excludeId: string | undefined,
  deckCardIds: readonly string[] | null,
): "hand" | "deck" | "none" {
  const player = state.players[seat]!;
  const isCallerDef = (def: CardDef | undefined) =>
    def !== undefined && hasEffect(def.effects, "bloodMoon");
  const isCaller = (id: string) => {
    if (id === excludeId) return false;
    const inst = state.cards[id];
    return isCallerDef(inst !== undefined ? cardDefOf(data, state, inst) : undefined);
  };
  if (player.hand.some(isCaller)) return "hand";
  if (player.discardPile.some(isCaller)) return "deck";
  if (deckCardIds !== null) {
    const unseen = new Map<string, number>();
    for (const id of deckCardIds) {
      if (isCallerDef(data.cards[id])) unseen.set(id, (unseen.get(id) ?? 0) + 1);
    }
    for (const id of [...player.hand, ...player.discardPile]) {
      const cardId = state.cards[id]?.cardId;
      if (cardId !== undefined && unseen.has(cardId)) {
        const left = unseen.get(cardId)! - 1;
        if (left <= 0) unseen.delete(cardId);
        else unseen.set(cardId, left);
      }
    }
    if (unseen.size > 0) return "deck";
  }
  return "none";
}

/** True when the card has a `bloodMoonActive` conditional anywhere — a rider that empowers under Huyết Nguyệt. */
function hasBloodMoonBonus(effects: readonly Effect[]): boolean {
  for (const e of effects) {
    if (e.type === "conditional") {
      if (e.condition.type === "bloodMoonActive") return true;
      if (hasBloodMoonBonus(e.then) || hasBloodMoonBonus(e.else ?? [])) return true;
    }
    if (e.type === "execute" && hasBloodMoonBonus(e.elseEffects ?? [])) return true;
  }
  return false;
}

/** Damage estimate of one effect on `target` (≈ the old `effectDamage`). `source` is the unit paying missing HP. */
function effectDamage(effect: Effect, target: UnitState | undefined, stat: number, source?: UnitState): number {
  if (effect.type === "damage") return effect.amount * (effect.hits ?? 1);
  if (effect.type === "missingHpDamage") {
    // `missingHpDamage` resolves off the caster's missing HP (effects.ts).
    const unit = source ?? target;
    if (unit === undefined) return 0;
    return Math.floor((unit.maxHp - unit.hp) * effect.ratio) * (effect.hits ?? 1);
  }
  if (effect.type === "scaledDamage") {
    const base = effect.base ?? 0;
    const scaled = Math.floor((stat * effect.amount) / (effect.divisor ?? 1));
    return Math.min(effect.max ?? Number.MAX_SAFE_INTEGER, Math.max(0, base + scaled));
  }
  if (effect.type === "execute" && target !== undefined) {
    const threshold = target.maxHp * effect.threshold;
    const execute = target.hp <= threshold ? target.hp + target.armor : 0;
    return execute + (effect.elseEffects ?? []).reduce(
      (sum, sub) => sum + effectDamage(sub, target, stat, source),
      0,
    );
  }
  return 0;
}

/** The stat a `scaledDamage` reads right now, in public terms (`01` §5.7). */
function scaleStat(effect: Extract<Effect, { type: "scaledDamage" }>, state: CombatState, seat: number, target: UnitState | undefined): number {
  const player = state.players[seat]!;
  const allies = heroesOf(state, seat).filter((hero) => hero.alive);
  switch (effect.per) {
    case "cardsPlayedThisTurn":
      return player.cardsPlayedThisTurn;
    case "selfArmor":
      return target?.armor ?? 0;
    case "moonPower":
      return player.moonPower;
    case "alliesAtFullHp":
      return allies.filter((hero) => hero.hp >= hero.maxHp).length;
    case "targetDebuffs":
      return (
        target?.statuses.filter((status) =>
          ["burn", "freeze", "charm", "weak", "vulnerable", "mark"].includes(status.id),
        ).length ?? 0
      );
    case "alliesArmor":
      return allies.reduce((sum, hero) => sum + hero.armor, 0);
    case "alliesRegen":
      return allies.reduce(
        (sum, hero) => sum + (hero.statuses.find((s) => s.id === "regen")?.value ?? 0),
        0,
      );
    default:
      return 0;
  }
}

/** Card effects that grow with counters this action can feed — level-up progress. */
function levelUpGain(data: GameData, state: CombatState, card: CardDef, owners: (HeroState | undefined)[]): number {
  let gain = 0;
  for (const owner of owners) {
    if (owner === undefined || !owner.alive || owner.leveledUp) continue;
    const counter = data.heroes[owner.defId]?.levelUp.counter;
    if (counter === "schemeCardsPlayed" && card.tags.includes("scheme")) gain += 1;
    if (counter === "cardsChosen" && hasEffect(card.effects, "chooseCard")) gain += 1;
    if (counter === "charmsApplied" && appliesStatus(card.effects, "charm")) gain += 1;
    if (counter === "freezesApplied" && appliesStatus(card.effects, "freeze")) gain += 1;
    if (counter === "debuffsApplied" && appliesStatus(card.effects, "weak", "vulnerable", "mark")) gain += 1;
    if (counter === "intentsSealed" && hasEffect(card.effects, "sealIntent")) gain += 1;
    if (counter === "buffsStolen" && hasEffect(card.effects, "stealBuff")) gain += 1;
    if (counter === "forbiddenHpLost" && card.tags.includes("forbidden")) gain += 1;
    if (counter === "moonShifts" && hasEffect(card.effects, "shiftMoon")) gain += 1;
    if (counter === "summonsMade" && hasEffect(card.effects, "summon")) gain += 1;
  }
  return gain;
}

/** Pha helpers — the landing score idea from `bot.ts`: modifiers matching tags in hand. */
function landingHelp(
  data: GameData,
  state: CombatState,
  seat: number,
  shift: number,
  enemyTraitPhases: ReadonlySet<MoonPhaseId>,
): number {
  const phases = data.moonPhases;
  const landing = phases[(((state.moonIndex + shift) % phases.length) + phases.length) % phases.length]!;
  const tags = new Set(
    state.players[seat]!.hand.flatMap((id) => cardDefOf(data, state, state.cards[id]!)?.tags ?? []),
  );
  const score = phaseModifiers(data, state, landing.index).filter(
    (modifier) => ("tag" in modifier ? tags.has(modifier.tag) : true),
  ).length;
  return enemyTraitAblesLanding(landing.id, enemyTraitPhases) ? score - 2 : score;
}
function enemyTraitAblesLanding(phase: MoonPhaseId, traits: ReadonlySet<MoonPhaseId>): boolean {
  return traits.has(phase);
}

/** Damage `unit` could deal on its next action, from public info only. */
export function incomingDamage(data: GameData, state: CombatState, unit: UnitState): number {
  if (!isSummon(unit) && hasStatus(unit, "freeze")) return 0;
  if (unit.side === "enemy") {
    const def = data.enemies[unit.defId];
    if (def === undefined) return 0;
    const enemy = unit as EnemyState;
    const pool = bossPhaseOf(data, state, enemy, def)?.intents ?? def.intents;
    const affordable = pool.filter((intent) => intent.cost <= enemy.moonPower);
    const nextPhase = data.moonPhases[(state.moonIndex + 1) % data.moonPhases.length]?.id;
    const trait = def.moonOverrides?.find((entry) => entry.phase === nextPhase)?.intent;
    const kit = trait !== undefined ? [trait, ...affordable] : affordable;
    return kit.reduce(
      (sum, intent) => sum + intent.effects.reduce((s, e) => s + effectDamage(e, unit, 0, unit), 0),
      0,
    );
  }
  if (isSummon(unit)) {
    return (data.summons[unit.summonId]?.action ?? []).reduce(
      (sum, e) => sum + effectDamage(e, unit, 0, unit),
      0,
    );
  }
  const def = data.heroes[unit.defId];
  if (def === undefined) return 0;
  return [...def.cardIds, ...def.lockedCardIds].reduce(
    (sum, cardId) =>
      sum + (data.cards[cardId]?.effects ?? []).reduce((s, e) => s + effectDamage(e, unit, 0, unit), 0),
    0,
  );
}

/** Control weight of statuses an effect applies to the target side. */
function controlWeight(effect: Effect): number {
  if (effect.type !== "applyStatus") return 0;
  switch (effect.status) {
    case "charm":
      return 3;
    case "freeze":
      return 2.5;
    case "taunt":
      return 1;
    case "stealth":
      return 0.8;
    case "guard":
      return 1.2;
    case "vulnerable":
    case "weak":
      return 1.5;
    case "strength":
    case "regen":
    case "reflect":
      return 1;
    default:
      return 0.5;
  }
}

/** Phong Ấn value: non-damage effects the marked unit's next turn would lose. */
function sealValue(data: GameData, state: CombatState, unit: UnitState | undefined): number {
  if (unit === undefined || (!isSummon(unit) && hasStatus(unit, "freeze"))) return 0;
  const strippable = (effects: readonly Effect[]) =>
    effects.filter(
      (e) => e.type !== "damage" && e.type !== "missingHpDamage" && e.type !== "scaledDamage",
    ).length;
  if (unit.side === "enemy") {
    const def = data.enemies[unit.defId];
    if (def === undefined) return 0;
    const enemy = unit as EnemyState;
    const pool = bossPhaseOf(data, state, enemy, def)?.intents ?? def.intents;
    return pool
      .filter((intent) => intent.cost <= enemy.moonPower)
      .reduce((sum, intent) => sum + strippable(intent.effects), 0);
  }
  if (isSummon(unit)) return strippable(data.summons[unit.summonId]?.action ?? []);
  const def = data.heroes[unit.defId];
  if (def === undefined) return 0;
  return [...def.cardIds, ...def.lockedCardIds].reduce(
    (sum, cardId) => sum + strippable(data.cards[cardId]?.effects ?? []),
    0,
  );
}

/** Rough keep-value of a card in hand: usable benefit ignoring costs (for discard/mulligan trade-offs). */
function cardKeepValue(
  data: GameData,
  state: CombatState,
  seat: number,
  instanceId: string,
  deckCardIds: readonly string[] | null,
): number {
  const instance = state.cards[instanceId];
  const card = instance ? cardDefOf(data, state, instance) : undefined;
  if (card === undefined) return 0;
  const owner =
    instance !== undefined
      ? instance.ownerIds
          .map((id) => state.heroes.find((h) => h.defId === id && h.player === instance.player))
          .find((h) => h !== undefined)
      : undefined;
  let value = 0;
  const walk = (effects: readonly Effect[]) => {
    for (const effect of effects) {
      if (effect.type === "conditional") {
        walk(effect.then);
        walk(effect.else ?? []);
        continue;
      }
      if (effect.type === "damage" || effect.type === "missingHpDamage" || effect.type === "scaledDamage") {
        value += effectDamage(effect, undefined, 1, owner);
      } else if (effect.type === "heal" || effect.type === "gainArmor") {
        value += effect.amount * 0.8;
      } else if (effect.type === "drawCards" || effect.type === "chooseCard") {
        value += 1.5;
      } else if (effect.type === "gainMoonPower" || effect.type === "gainMoonPowerPerTurn") {
        value += effect.amount;
      } else if (effect.type === "applyStatus") {
        value += controlWeight(effect);
      } else if (effect.type === "summon") {
        value += 2;
      } else if (effect.type === "revive") {
        value += 4;
      }
    }
  };
  walk(card.effects);
  // A gated payoff with no moon and no caller in reach is dead weight.
  if (card.requiresBloodMoon === true && state.bloodMoonRounds === 0) {
    const access = moonAccess(data, state, seat, instanceId, deckCardIds);
    if (access === "deck") value *= 0.5;
    else if (access === "none") value *= 0.25;
  }
  return value + (card.bond !== undefined ? 1 : 0) + card.cost * 0.1;
}

/** The feature vector of one legal action in `obs`. */
export function actionFeatures(
  data: GameData,
  obs: BotObservation,
  action: Action,
): FeatureVector {
  const state = obs.visibleState;
  const seat = obs.seat;
  const player = state.players[seat]!;
  const vec: FeatureVector = {};
  const unitOf = (id: string) =>
    state.heroes.find((h) => h.id === id) ??
    summonsOf(state).find((s) => s.id === id) ??
    state.enemies.find((e) => e.id === id);
  const enemyTraitPhases = new Set<MoonPhaseId>(
    state.enemies
      .filter((e) => e.alive)
      .flatMap((e) => (data.enemies[e.defId]?.moonOverrides ?? []).map((entry) => entry.phase)),
  );

  switch (action.type) {
    case "mulligan": {
      for (const id of action.instanceIds) {
        const card = cardDefOf(data, state, state.cards[id]!);
        const deadGate =
          card !== undefined &&
          card.requiresBloodMoon === true &&
          state.bloodMoonRounds === 0 &&
          moonAccess(data, state, seat, id, obs.ownDeckCardIds) === "none";
        // Returning cards above the early curve fixes the opening hand;
        // cheap cards are fine to keep — as are gated cards a caller can unlock.
        put(vec, "mulliganFix", card !== undefined && (card.cost > 5 || deadGate) ? 1 : -0.5);
      }
      return vec;
    }
    case "chooseCard": {
      put(vec, "draw", 1);
      put(vec, "hold", cardKeepValue(data, state, seat, action.instanceId, obs.ownDeckCardIds));
      return vec;
    }
    case "chooseMoon": {
      put(vec, "moon", landingHelp(data, state, seat, action.offset, enemyTraitPhases));
      return vec;
    }
    case "discardCard": {
      const rule = decreeModifier(data, state, "discardForMoonPower");
      put(vec, "convert", rule?.moonPower ?? 0);
      put(vec, "hold", -cardKeepValue(data, state, seat, action.instanceId, obs.ownDeckCardIds));
      return vec;
    }
    case "bloodPact": {
      const rule = decreeModifier(data, state, "bloodPact");
      put(vec, "draw", rule?.draw ?? 0);
      put(vec, "selfDamage", rule?.hp ?? 0);
      return vec;
    }
    case "endTurn": {
      const carried = Math.min(player.moonPower, data.combatConfig.moonReserveMax);
      put(vec, "reserve", carried);
      put(vec, "waste", Math.max(0, player.moonPower - carried));
      return vec;
    }
    case "forfeit":
      return vec;
  }

  // playCard
  const instance: CardInstance | undefined = state.cards[action.instanceId];
  const card = instance ? cardDefOf(data, state, instance) : undefined;
  if (card === undefined || instance === undefined) return vec;
  const owners = instance.ownerIds.map(
    (id) => state.heroes.find((h) => h.defId === id && h.player === instance.player),
  );
  const cost = getEffectiveCost(data, state, action.instanceId, seat);
  put(vec, "cost", cost);

  const target = action.targetId !== undefined ? unitOf(action.targetId) : undefined;
  const liveOpponents =
    owners[0] !== undefined ? opponentsOf(state, owners[0]).filter((u) => u.alive) : [];
  const incoming = (unit: UnitState) => incomingDamage(data, state, unit);
  const threatOn = (unit: UnitState) =>
    liveOpponents.reduce((sum, foe) => sum + incoming(foe), 0);

  // Damage on the chosen target and wide hits.
  const chosen = chosenEffects(card.effects);
  const wide = wideEffects(card.effects);
  if (target !== undefined) {
    const stat = (e: Effect) =>
      e.type === "scaledDamage" ? scaleStat(e, state, seat, target) : 1;
    const raw = chosen.reduce((sum, e) => sum + effectDamage(e, target, stat(e), owners[0]), 0);
    const absorb = target.hp + target.armor;
    const effective = Math.min(raw, absorb);
    put(vec, "damage", effective);
    put(vec, "overkill", Math.max(0, raw - absorb));
    if (raw >= absorb) {
      put(vec, "lethal", 1);
      // Killing the last opposing unit or the boss ends the fight — extra value.
      const survivors = liveOpponents.filter((u) => u.id !== target.id);
      if (survivors.length === 0 || target.defId.includes("boss")) put(vec, "lethal", 1);
    }
    for (const e of chosen) {
      if (e.type === "heal") {
        const missing = Math.max(0, target.maxHp - target.hp);
        put(vec, "heal", Math.min(e.amount, missing));
        put(vec, "overheal", Math.max(0, e.amount - missing));
        if (target.hp <= threatOn(target) && missing > 0) put(vec, "preventLethal", 1);
      } else if (e.type === "gainArmor") {
        put(vec, "heal", e.amount * 0.8);
        if (target.hp + target.armor <= threatOn(target)) put(vec, "preventLethal", 1);
      } else if (e.type === "applyStatus") {
        // Hộ Vệ on its own source fizzles — no control value.
        const isSelfGuard =
          e.status === "guard" && target.id === owners.find((o) => o?.id === target.id)?.id;
        put(vec, "control", isSelfGuard ? 0 : controlWeight(e) * e.amount);
        if (e.status === "guard" && !isSelfGuard && target.side === "hero") {
          put(vec, "preventLethal", target.hp <= threatOn(target) ? 0.5 : 0);
        }
      } else if (e.type === "sealIntent") {
        put(vec, "control", Math.min(3, sealValue(data, state, target)));
      } else if (e.type === "drainMoonPower") {
        const fund =
          target.side === "enemy"
            ? (target as EnemyState).moonPower
            : (state.players.find((p) => p.index === (target as { player: number }).player)
                ?.moonReserve ?? 0);
        put(vec, "control", Math.min(e.amount, fund) + (e.steal === true ? e.amount : 0));
      } else if (e.type === "revive") {
        put(vec, "preventLethal", 2);
        put(vec, "heal", Math.floor(target.maxHp * e.ratio));
      }
    }
  }
  for (const e of wide) {
    const hits = liveOpponents.length;
    const per = effectDamage(e, undefined, 1, owners[0]);
    put(vec, "damage", per * hits);
    put(vec, "lethal", liveOpponents.filter((u) => per >= u.hp + u.armor).length);
    if (e.type === "applyStatus") put(vec, "control", controlWeight(e) * hits);
    if (e.type === "sealIntent") {
      put(vec, "control", liveOpponents.reduce((s, u) => s + Math.min(3, sealValue(data, state, u)), 0));
    }
  }
  // Self/ally effects regardless of `targetId`.
  for (const e of selfEffects(card.effects)) {
    if (e.type === "loseHp") put(vec, "selfDamage", e.amount);
    else if (e.type === "heal") {
      const missing = heroesOf(state, seat)
        .filter((h) => h.alive)
        .reduce((s, h) => s + (h.maxHp - h.hp), 0);
      put(vec, "heal", Math.min(e.amount * Math.max(1, owners.length), Math.max(0, missing)));
    } else if (e.type === "gainArmor") {
      put(vec, "heal", e.amount * 0.8);
    } else if (e.type === "applyStatus") {
      put(vec, "control", controlWeight(e) * e.amount);
    }
  }

  // Resource and card-economy effects.
  const walk = (effects: readonly Effect[]) => {
    for (const e of effects) {
      if (e.type === "conditional") {
        walk(e.then);
        walk(e.else ?? []);
      } else if (e.type === "drawCards") {
        const room = Math.max(0, data.combatConfig.handSize - player.hand.length);
        put(vec, "draw", Math.min(e.amount, room + 1));
        put(vec, "handCap", Math.max(0, e.amount - room - 1));
      } else if (e.type === "chooseCard") {
        put(vec, "draw", 1);
      } else if (e.type === "bloodMoon") {
        put(vec, "control", e.rounds);
        // Unlock value: gated cards in hand become legal, riders empower (`01` Huyết Nguyệt).
        let unlock = 0;
        for (const id of player.hand) {
          if (id === action.instanceId) continue;
          const held = state.cards[id] !== undefined ? cardDefOf(data, state, state.cards[id]!) : undefined;
          if (held === undefined) continue;
          if (held.requiresBloodMoon === true) unlock += 1;
          else if (hasBloodMoonBonus(held.effects)) unlock += 0.5;
        }
        if (unlock > 0) put(vec, "synergy", unlock);
      } else if (e.type === "gainMoonPower") {
        put(vec, "reserve", e.amount);
      } else if (e.type === "gainMoonPowerPerTurn") {
        put(vec, "reserve", e.amount * 2);
      } else if (e.type === "shiftMoon") {
        put(vec, "moon", landingHelp(data, state, seat, e.amount, enemyTraitPhases));
      } else if (e.type === "summon") {
        const hero = owners.find((o) => o !== undefined && o.alive);
        if (hero !== undefined && wantsSummon(data, state, hero)) put(vec, "summon", 1);
        else put(vec, "heal", 1.5);
      } else if (e.type === "createCard") {
        put(vec, "draw", 1);
      } else if (e.type === "stealBuff") {
        put(vec, "control", e.count * 1.5);
      }
    }
  };
  walk(card.effects);

  // Combo setup: this card feeds a `cardsPlayedThisTurn` payoff still in hand,
  // or is itself the payoff — sequencing matters more than cost.
  const hasPayoff = player.hand.some((id) => {
    const c = cardDefOf(data, state, state.cards[id]!);
    return c?.effects.some((e) => e.type === "scaledDamage" && e.per === "cardsPlayedThisTurn") === true;
  });
  const isPayoff = card.effects.some(
    (e) => e.type === "scaledDamage" && e.per === "cardsPlayedThisTurn",
  );
  if (hasPayoff && !isPayoff) put(vec, "synergy", 1);
  if (isPayoff) put(vec, "synergy", player.cardsPlayedThisTurn);
  if (card.bond !== undefined) put(vec, "synergy", 1);
  if (card.keywords?.includes("lien_hoan")) put(vec, "synergy", player.cardsPlayedThisTurn * 0.5);

  // Tích Tụ: a card with a held-turns conditional is worth more later — holding
  // it is a feature of *other* actions, a cost of playing it early.
  const walkHeld = (effects: readonly Effect[]): number => {
    let best = 0;
    for (const e of effects) {
      if (e.type === "conditional") {
        if (e.condition.type === "heldTurnsAtLeast") best = Math.max(best, e.condition.turns);
        best = Math.max(best, walkHeld(e.then), walkHeld(e.else ?? []));
      }
    }
    return best;
  };
  const heldNeed = walkHeld(card.effects);
  if (heldNeed > 0 && instance.heldTurns < heldNeed) put(vec, "hold", -1);

  // Blood-moon requirement already gated by legality; still worth noting uptime.
  if (card.requiresBloodMoon === true) put(vec, "control", 0.5);

  // Lethal reach endgame bonus: killing intent when opponents are nearly dead.
  put(vec, "levelUp", levelUpGain(data, state, card, owners));

  // Đổi Vận-only cards on a bad landing are worse than passing — negative moon.
  return vec;
}

/** Linh Thú want check shared with the heuristic (`01` §17). */
function wantsSummon(data: GameData, state: CombatState, hero: HeroState): boolean {
  if (!hero.leveledUp && data.heroes[hero.defId]?.levelUp.counter === "summonsMade") return true;
  const summon = summonOf(state, hero.id);
  return summon === undefined || summon.hp * 2 < summon.maxHp;
}
