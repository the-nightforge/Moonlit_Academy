import { drawCards } from "./draw";
import { moonArmorMultiplier, moonCardDamageMultiplier, moonHealMultiplier } from "./moon";
import { hasStatus, statusValue } from "./statuses";
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

function dealDamage(
  data: GameData,
  state: CombatState,
  ctx: EffectContext,
  target: UnitState,
  base: number,
  events: CombatEvent[],
): void {
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
  const amount = Math.max(0, Math.floor(flat * multiplier));
  const blocked = Math.min(target.armor, amount);
  target.armor -= blocked;
  const hpLost = Math.min(target.hp, amount - blocked);
  target.hp -= hpLost;
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
        for (let hit = 0; hit < hits && target.alive; hit++) {
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
    case "applyStatus":
    case "cleanse":
    case "shiftMoon":
      throw new Error(`effect "${effect.type}" is not implemented yet`);
    default: {
      const exhaustive: never = effect;
      throw new Error(`unknown effect: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function processDeaths(
  state: CombatState,
  events: CombatEvent[],
  killerId: string | undefined,
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
        ...(killerId !== undefined ? { killerId } : {}),
      });
    }
  }
}

function checkCombatEnd(state: CombatState, events: CombatEvent[]): boolean {
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
    processDeaths(state, events, ctx.source.id);
    if (checkCombatEnd(state, events)) return;
  }
}
