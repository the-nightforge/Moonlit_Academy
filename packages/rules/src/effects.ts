import { drawCards } from "./draw";
import { bumpCounter, checkLevelUps } from "./levelup";
import {
  moonArmorMultiplier,
  moonCardDamageMultiplier,
  moonHealMultiplier,
  moonStealthDurationBonus,
} from "./moon";
import { applyStatus, cleanseDebuffs, getStatus, hasStatus, removeStatus, statusValue } from "./statuses";
import type {
  CardDef,
  CombatEvent,
  CombatState,
  Condition,
  Effect,
  GameData,
  HeroState,
  IntentKind,
  TargetRef,
  UnitState,
} from "./types/index";

export interface EffectContext {
  source: UnitState;
  card?: CardDef;
  intentKind?: IntentKind;
  chosenId?: string;
}

function findUnit(state: CombatState, unitId: string | undefined): UnitState | undefined {
  if (unitId === undefined) return undefined;
  return [...state.heroes, ...state.enemies].find((unit) => unit.id === unitId);
}

function isAttackSource(ctx: EffectContext): boolean {
  return (
    ctx.card?.type === "attack" ||
    ctx.intentKind === "attack" ||
    ctx.intentKind === "attackDefend"
  );
}

function resolveTargets(state: CombatState, to: TargetRef, ctx: EffectContext): UnitState[] {
  switch (to) {
    case "self":
      return ctx.source.alive ? [ctx.source] : [];
    case "chosen": {
      const target = findUnit(state, ctx.chosenId);
      return target?.alive ? [target] : [];
    }
    case "allEnemies":
      return (ctx.source.side === "hero" ? state.enemies : state.heroes).filter(
        (unit) => unit.alive,
      );
    case "allAllies":
      return (ctx.source.side === "hero" ? state.heroes : state.enemies).filter(
        (unit) => unit.alive,
      );
  }
}

function markFromSource(target: UnitState, sourceId: string): boolean {
  return target.statuses.some(
    (entry) => entry.id === "mark" && entry.sourceId === sourceId,
  );
}

export function computeDamageAmount(
  data: GameData,
  state: CombatState,
  ctx: EffectContext,
  target: UnitState,
  base: number,
): number {
  const attack = isAttackSource(ctx);
  let flat = base;
  if (attack) {
    flat += statusValue(ctx.source, "strength");
    if (ctx.card !== undefined) {
      flat += statusValue(ctx.source, "empower");
      if (markFromSource(target, ctx.source.id)) flat += 3;
      if (ctx.source.side === "hero") {
        const hero = ctx.source as HeroState;
        const passive = data.heroes[hero.defId]?.levelUp.passive;
        if (hero.leveledUp && passive?.type === "attackDamageBonus") {
          flat += passive.amount;
        }
      }
    }
  }
  let multiplier = 1;
  if (ctx.card !== undefined) {
    multiplier *= moonCardDamageMultiplier(data, state, ctx.card.tags);
  }
  if (hasStatus(ctx.source, "weak")) multiplier *= 0.75;
  if (hasStatus(target, "vulnerable")) multiplier *= 1.5;
  return Math.max(0, Math.floor(flat * multiplier));
}

function dealDamage(
  data: GameData,
  state: CombatState,
  ctx: EffectContext,
  target: UnitState,
  base: number,
  events: CombatEvent[],
): void {
  const amount = computeDamageAmount(data, state, ctx, target, base);
  const blocked = Math.min(target.armor, amount);
  target.armor -= blocked;
  const hpLost = Math.min(target.hp, amount - blocked);
  target.hp -= hpLost;
  if (target.side === "hero") bumpCounter(data, target as HeroState, "damageTaken", hpLost);
  events.push({
    type: "damageDealt",
    sourceId: ctx.source.id,
    targetId: target.id,
    amount,
    blocked,
    hpLost,
  });
}

function evalCondition(
  data: GameData,
  state: CombatState,
  condition: Condition,
  ctx: EffectContext,
): boolean {
  switch (condition.type) {
    case "selfHpBelow":
      return ctx.source.hp / ctx.source.maxHp < condition.ratio;
    case "targetHpAtOrBelow": {
      const target = findUnit(state, ctx.chosenId);
      return target !== undefined && target.alive && target.hp / target.maxHp <= condition.ratio;
    }
    case "selfHasStatus":
      return hasStatus(ctx.source, condition.status);
    case "targetHasStatus": {
      const target = findUnit(state, ctx.chosenId);
      return target !== undefined && target.alive && hasStatus(target, condition.status);
    }
    case "moonPhaseIs":
      return data.moonPhases[state.moonIndex]!.id === condition.phase;
    case "bloodMoonActive":
      throw new Error("condition bloodMoonActive: not implemented (step 2.3)");
  }
}

export function resolveEffect(
  data: GameData,
  state: CombatState,
  effect: Effect,
  ctx: EffectContext,
  events: CombatEvent[],
): void {
  switch (effect.type) {
    case "damage": {
      const hits = effect.hits ?? 1;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        for (let hit = 0; hit < hits && target.alive && target.hp > 0; hit++) {
          dealDamage(data, state, ctx, target, effect.amount, events);
        }
      }
      return;
    }
    case "heal": {
      const multiplier = moonHealMultiplier(data, state);
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const healed = Math.min(
          target.maxHp - target.hp,
          Math.floor(effect.amount * multiplier),
        );
        if (healed > 0) {
          target.hp += healed;
          events.push({ type: "healed", targetId: target.id, amount: healed });
        }
      }
      return;
    }
    case "loseHp": {
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const lost = Math.min(target.hp, effect.amount);
        target.hp -= lost;
        if (target.side === "hero") {
          bumpCounter(data, target as HeroState, "damageTaken", lost);
        }
        events.push({ type: "hpLost", targetId: target.id, amount: lost, cause: "loseHp" });
      }
      return;
    }
    case "gainArmor": {
      const multiplier = moonArmorMultiplier(data, state);
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const gained = Math.floor(effect.amount * multiplier);
        target.armor += gained;
        events.push({ type: "armorGained", targetId: target.id, amount: gained });
      }
      return;
    }
    case "removeArmor": {
      for (const target of resolveTargets(state, effect.to, ctx)) {
        target.armor = 0;
        events.push({ type: "armorRemoved", targetId: target.id });
      }
      return;
    }
    case "draw": {
      drawCards(state, effect.amount, events);
      return;
    }
    case "gainMoonPower": {
      state.moonPower += effect.amount;
      events.push({ type: "moonPowerChanged", value: state.moonPower });
      return;
    }
    case "conditional": {
      const branch = evalCondition(data, state, effect.condition, ctx)
        ? effect.then
        : (effect.else ?? []);
      resolveEffects(data, state, branch, ctx, events);
      return;
    }
    case "applyStatus": {
      const bonus = effect.status === "stealth" ? moonStealthDurationBonus(data, state) : 0;
      let targets = resolveTargets(state, effect.to, ctx);
      if (effect.status === "regen" && ctx.card !== undefined && ctx.source.side === "hero") {
        const hero = ctx.source as HeroState;
        if (
          hero.leveledUp &&
          data.heroes[hero.defId]?.levelUp.passive.type === "regenSpreadsToAllAllies"
        ) {
          targets = [...new Set([...targets, ...state.heroes.filter((h) => h.alive)])];
        }
      }
      for (const target of targets) {
        applyStatus(target, effect.status, effect.amount + bonus, ctx.source.id, events);
      }
      return;
    }
    case "cleanse": {
      for (const target of resolveTargets(state, effect.to, ctx)) {
        cleanseDebuffs(target, events);
      }
      return;
    }
    case "shiftMoon": {
      const from = state.moonIndex;
      state.moonIndex =
        (((state.moonIndex + effect.amount) % data.moonPhases.length) + data.moonPhases.length) %
        data.moonPhases.length;
      events.push({ type: "moonShifted", from, to: state.moonIndex, cause: "card" });
      return;
    }
    case "stealBuff":
    case "bloodMoon":
      throw new Error(`effect ${effect.type}: not implemented (step 2.3)`);
    default: {
      const exhaustive: never = effect;
      throw new Error(`unknown effect: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function processDeaths(
  data: GameData,
  state: CombatState,
  events: CombatEvent[],
  killer: { id: string; cardDamage: boolean } | undefined,
): void {
  for (const unit of [...state.heroes, ...state.enemies]) {
    if (unit.alive && unit.hp <= 0) {
      unit.hp = 0;
      unit.alive = false;
      unit.statuses = [];
      unit.armor = 0;
      events.push({
        type: "unitDied",
        unitId: unit.id,
        ...(killer !== undefined ? { killerId: killer.id } : {}),
      });
      if (killer?.cardDamage && unit.side === "enemy") {
        const killerHero = state.heroes.find((hero) => hero.id === killer.id);
        if (killerHero) bumpCounter(data, killerHero, "enemiesKilled", 1);
      }
    }
  }
}

export function checkCombatEnd(state: CombatState, events: CombatEvent[]): boolean {
  if (state.status === "won" || state.status === "lost") return true;
  if (state.enemies.every((enemy) => !enemy.alive)) {
    state.status = "won";
    events.push({ type: "combatEnded", result: "won" });
    return true;
  }
  if (state.heroes.every((hero) => !hero.alive)) {
    state.status = "lost";
    events.push({ type: "combatEnded", result: "lost" });
    return true;
  }
  return false;
}

export function resolveEffects(
  data: GameData,
  state: CombatState,
  effects: Effect[],
  ctx: EffectContext,
  events: CombatEvent[],
): void {
  for (const effect of effects) {
    resolveEffect(data, state, effect, ctx, events);
    processDeaths(data, state, events, {
      id: ctx.source.id,
      cardDamage: ctx.card !== undefined && effect.type === "damage",
    });
    checkLevelUps(data, state, events);
    if (checkCombatEnd(state, events)) return;
  }
}

export function tickUnitStatuses(
  data: GameData,
  state: CombatState,
  unit: UnitState,
  events: CombatEvent[],
): void {
  const burn = getStatus(unit, "burn");
  if (burn) {
    const lost = Math.min(unit.hp, burn.value);
    unit.hp -= lost;
    events.push({ type: "hpLost", targetId: unit.id, amount: lost, cause: "burn" });
    burn.value -= 1;
    if (burn.value <= 0) removeStatus(unit, "burn", events);
    if (unit.side === "hero") bumpCounter(data, unit as HeroState, "damageTaken", lost);
    processDeaths(data, state, events, undefined);
    checkLevelUps(data, state, events);
    if (!unit.alive) return;
  }
  const regen = getStatus(unit, "regen");
  if (regen) {
    const healed = Math.min(
      unit.maxHp - unit.hp,
      Math.floor(regen.value * moonHealMultiplier(data, state)),
    );
    if (healed > 0) {
      unit.hp += healed;
      events.push({ type: "healed", targetId: unit.id, amount: healed });
    }
    regen.value -= 1;
    if (regen.value <= 0) removeStatus(unit, "regen", events);
  }
}
