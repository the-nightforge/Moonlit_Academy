import { drainEnemyMoonPower } from "./intent";
import { bumpCounter, checkLevelUps } from "./levelup";
import {
  moonArmorMultiplier,
  moonCardDamageMultiplier,
  moonHealMultiplier,
  moonStealthDurationBonus,
} from "./moon";
import { fireEventHooks } from "./run-relic-hooks";
import {
  applyStatus,
  cleanseDebuffs,
  DEBUFF_STATUSES,
  getStatus,
  hasStatus,
  removeStatus,
  statusValue,
} from "./statuses";
import type {
  CardDef,
  CombatEvent,
  CombatState,
  Condition,
  Effect,
  EnemyState,
  GameData,
  HeroState,
  IntentKind,
  LevelUpPassive,
  TargetRef,
  UnitState,
} from "./types/index";

export interface EffectContext {
  /** The acting unit of the current effect. */
  source: UnitState;
  /** Card owners; `effect.actor` indexes them (bond cards). */
  actors?: HeroState[];
  card?: CardDef;
  intentKind?: IntentKind;
  chosenId?: string;
  /** Instance of the card being played (Tích Tụ). */
  instanceId?: string;
  /** Set for run relic effects and nested conditional branches: do not fire hooks here. */
  noHooks?: boolean;
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

/** Level-up passive of the acting hero for this card; never applies to bond cards. */
function cardPassive(data: GameData, ctx: EffectContext): LevelUpPassive | undefined {
  if (ctx.card === undefined || ctx.card.bond || ctx.source.side !== "hero") return undefined;
  const hero = ctx.source as HeroState;
  return hero.leveledUp ? data.heroes[hero.defId]?.levelUp.passive : undefined;
}

export function computeDamageAmount(
  data: GameData,
  state: CombatState,
  ctx: EffectContext,
  target: UnitState,
  base: number,
): number {
  const attack = isAttackSource(ctx);
  const passive = cardPassive(data, ctx);
  let flat = base;
  if (attack) {
    flat += statusValue(ctx.source, "strength");
    if (ctx.card !== undefined) {
      flat += statusValue(ctx.source, "empower");
      if (markFromSource(target, ctx.source.id)) flat += 3;
      if (passive?.type === "attackDamageBonus") flat += passive.amount;
    }
  }
  let multiplier = 1;
  if (ctx.card !== undefined) {
    multiplier *= moonCardDamageMultiplier(data, state, ctx.card.tags);
  }
  if (hasStatus(ctx.source, "weak")) multiplier *= 0.75;
  if (hasStatus(target, "vulnerable")) multiplier *= 1.5;
  if (passive?.type === "doubleDamageVsFrozen" && hasStatus(target, "freeze")) multiplier *= 2;
  return Math.max(0, Math.floor(flat * multiplier));
}

/** HP loss that ignores armor and multipliers (loseHp, burn, reflect, blood moon). */
export function loseHp(
  data: GameData,
  unit: UnitState,
  amount: number,
  cause: "loseHp" | "burn" | "reflect" | "bloodMoon",
  events: CombatEvent[],
): void {
  const lost = Math.min(unit.hp, amount);
  unit.hp -= lost;
  if (unit.side === "hero") bumpCounter(data, unit as HeroState, "damageTaken", lost);
  events.push({ type: "hpLost", targetId: unit.id, amount: lost, cause });
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

  const reflect = statusValue(target, "reflect");
  if (amount <= 0 || reflect <= 0) return;
  loseHp(data, ctx.source, reflect, "reflect", events);
  if (ctx.source.hp > 0) return;
  // Both deaths resolve right after this hit, each credited to its own killer.
  if (target.alive && target.hp <= 0) {
    killUnit(data, state, target, events, { id: ctx.source.id, cardDamage: ctx.card !== undefined });
  }
  killUnit(data, state, ctx.source, events, { id: target.id, cardDamage: false });
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
      return state.bloodMoonRounds > 0;
    case "heldTurnsAtLeast": {
      const instance = ctx.instanceId !== undefined ? state.cards[ctx.instanceId] : undefined;
      return instance !== undefined && instance.heldTurns >= condition.turns;
    }
    case "cardsPlayedThisTurnAtLeast":
      return state.cardsPlayedThisTurn >= condition.count;
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
          if (!ctx.source.alive) return;
        }
      }
      return;
    }
    case "heal": {
      const multiplier = moonHealMultiplier(data, state);
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const raw = Math.floor(effect.amount * multiplier);
        const healed = Math.min(target.maxHp - target.hp, raw);
        if (healed > 0) {
          target.hp += healed;
          events.push({ type: "healed", targetId: target.id, amount: healed });
        }
        if (effect.overflow === "armor" && raw > healed) {
          const armor = Math.floor((raw - healed) * moonArmorMultiplier(data, state));
          if (armor > 0) {
            target.armor += armor;
            events.push({ type: "armorGained", targetId: target.id, amount: armor });
          }
        }
      }
      return;
    }
    case "loseHp": {
      for (const target of resolveTargets(state, effect.to, ctx)) {
        loseHp(data, target, effect.amount, "loseHp", events);
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
    case "chooseCard": {
      const options = state.drawPile.splice(0, Math.min(effect.look, state.drawPile.length));
      if (options.length === 0) return;
      if (options.length === 1) {
        state.cards[options[0]!]!.heldTurns = 0;
        state.hand.push(options[0]!);
        events.push({ type: "cardsDrawn", instanceIds: options });
        return;
      }
      state.pendingChoice = { kind: "chooseCard", options };
      state.status = "choosing";
      events.push({ type: "choiceOpened", options });
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
      resolveEffects(data, state, branch, { ...ctx, noHooks: true }, events);
      return;
    }
    case "applyStatus": {
      const bonus = effect.status === "stealth" ? moonStealthDurationBonus(data, state) : 0;
      let targets = resolveTargets(state, effect.to, ctx);
      if (
        effect.status === "regen" &&
        cardPassive(data, ctx)?.type === "regenSpreadsToAllAllies"
      ) {
        targets = [...new Set([...targets, ...state.heroes.filter((h) => h.alive)])];
      }
      for (const target of targets) {
        const newFreeze = effect.status === "freeze" && !hasStatus(target, "freeze");
        applyStatus(target, effect.status, effect.amount + bonus, ctx.source.id, events);
        if (newFreeze && ctx.source.side === "hero") {
          bumpCounter(data, ctx.source as HeroState, "freezesApplied", 1);
        }
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
    case "stealBuff": {
      const [target] = resolveTargets(state, "chosen", ctx);
      if (!target) return;
      const stolen = target.statuses
        .filter((entry) => !DEBUFF_STATUSES.has(entry.id))
        .slice(0, effect.count);
      const bonus = cardPassive(data, ctx)?.type === "stealBonus" ? 1 : 0;
      for (const entry of stolen) {
        removeStatus(target, entry.id, events);
        applyStatus(ctx.source, entry.id, entry.value + bonus, ctx.source.id, events);
        if (ctx.source.side === "hero") {
          bumpCounter(data, ctx.source as HeroState, "buffsStolen", 1);
        }
      }
      return;
    }
    case "bloodMoon": {
      const rounds = Math.max(state.bloodMoonRounds, effect.rounds);
      if (rounds !== state.bloodMoonRounds) {
        state.bloodMoonRounds = rounds;
        events.push({ type: "bloodMoonChanged", rounds, cause: "card" });
      }
      return;
    }
    case "burstRegen": {
      const multiplier = moonHealMultiplier(data, state);
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const regen = getStatus(target, "regen");
        if (!regen) continue;
        const healed = Math.min(
          target.maxHp - target.hp,
          Math.floor(regen.value * effect.multiplier * multiplier),
        );
        if (healed > 0) {
          target.hp += healed;
          events.push({ type: "healed", targetId: target.id, amount: healed });
        }
        removeStatus(target, "regen", events);
      }
      return;
    }
    case "missingHpDamage": {
      const hits = effect.hits ?? 1;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        for (let hit = 0; hit < hits && target.alive && target.hp > 0; hit++) {
          const base = Math.floor((ctx.source.maxHp - ctx.source.hp) * effect.ratio);
          dealDamage(data, state, ctx, target, base, events);
          if (!ctx.source.alive) return;
        }
      }
      return;
    }
    case "drainMoonPower": {
      let drained = 0;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        if (target.side !== "enemy") continue;
        drained += drainEnemyMoonPower(data, target as EnemyState, effect.amount, events);
      }
      if (effect.steal && drained > 0) {
        // Đoạt Nguyệt counts as one theft toward F02's level-up (01 §8).
        if (ctx.source.side === "hero") {
          bumpCounter(data, ctx.source as HeroState, "buffsStolen", 1);
        }
        state.moonPower += drained;
        events.push({ type: "moonPowerChanged", value: state.moonPower });
      }
      return;
    }
    case "gainMoonPowerPerTurn": {
      state.moonPowerBonus += effect.amount;
      return;
    }
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
  killer: Killer | undefined,
): void {
  for (const unit of [...state.heroes, ...state.enemies]) {
    if (unit.alive && unit.hp <= 0) killUnit(data, state, unit, events, killer);
  }
}

interface Killer {
  id: string;
  cardDamage: boolean;
}

function killUnit(
  data: GameData,
  state: CombatState,
  unit: UnitState,
  events: CombatEvent[],
  killer: Killer | undefined,
): void {
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
  if (unit.side === "hero") {
    const defId = (unit as HeroState).defId;
    const purged = state.drawPile.filter((id) => state.cards[id]!.ownerIds.includes(defId));
    if (purged.length > 0) {
      state.drawPile = state.drawPile.filter((id) => !purged.includes(id));
      state.discardPile.push(...purged);
      events.push({ type: "cardsPurged", heroId: unit.id, instanceIds: purged });
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
    const start = events.length;
    const bloodMoonBefore = state.bloodMoonRounds;
    // Nested effects without their own actor inherit the enclosing one via ctx.
    const effectCtx =
      effect.actor !== undefined && ctx.actors
        ? { ...ctx, source: ctx.actors[effect.actor]! }
        : ctx;
    resolveEffect(data, state, effect, effectCtx, events);
    processDeaths(data, state, events, {
      id: effectCtx.source.id,
      cardDamage:
        ctx.card !== undefined && (effect.type === "damage" || effect.type === "missingHpDamage"),
    });
    checkLevelUps(data, state, events);
    if (checkCombatEnd(state, events)) return;
    if (!ctx.noHooks) {
      fireEventHooks(data, state, events, start, bloodMoonBefore);
      if (checkCombatEnd(state, events)) return;
    }
    // An actor that died mid-resolution (e.g. to reflect) stops its card or intent.
    if ((ctx.actors ?? [ctx.source]).some((actor) => !actor.alive)) return;
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
    loseHp(data, unit, burn.value, "burn", events);
    burn.value -= 1;
    if (burn.value <= 0) removeStatus(unit, "burn", events);
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
