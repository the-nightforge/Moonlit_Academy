import { checkBossPhase } from "./coop/boss";
import { addToHand, drawCards } from "./draw";
import { drainEnemyMoonPower } from "./intent";
import { bumpCounter, bumpSeat, checkLevelUps, levelUpPassive } from "./levelup";
import {
  decreeModifier,
  enterPhase,
  moonArmorMultiplier,
  moonCardDamageMultiplier,
  moonHealMultiplier,
  moonStealthDurationBonus,
} from "./moon";
import { alliesOf, heroesOf, opponentsOf, playerOf, prefixedId, seatTag, summonsOf } from "./players";
import { shuffle } from "./rng";
import { fireEventHooks } from "./run-relic-hooks";
import {
  applyStatus,
  cleanseDebuffs,
  DEBUFF_STATUSES,
  DURATION_STATUSES,
  getStatus,
  hasStatus,
  removeStatus,
  statusValue,
} from "./statuses";
import { dismissSummonOf, isSummon, ownerOf, summonEffect, summonOf } from "./summons";
import type {
  CardDef,
  CombatEvent,
  CombatState,
  Condition,
  DamageScale,
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
  /** Tàn Ảnh: cards counted as already played this turn on top of the real count. */
  comboBonus?: number;
  /** Hợp Kích effects: `allAllies` means all six heroes, not the actor's three (`01` §16.4). */
  comboScope?: true;
  /** A Linh Thú's action: its hits are attacks (`01` §17). */
  summonAction?: true;
  /** Kinh Hồng Vũ: a charmed intent's damage multiplier (`01` §9.3.1). */
  damageMultiplier?: number;
  /** Liên Kích (`01` §7.5): this attack follows an earlier attack card / attack intent of the same side this turn. */
  attackChain?: true;
}

function findUnit(state: CombatState, unitId: string | undefined): UnitState | undefined {
  if (unitId === undefined) return undefined;
  return [...state.heroes, ...summonsOf(state), ...state.enemies].find((unit) => unit.id === unitId);
}

function isAttackSource(ctx: EffectContext): boolean {
  return (
    ctx.card?.type === "attack" ||
    ctx.intentKind === "attack" ||
    ctx.intentKind === "attackDefend" ||
    ctx.summonAction === true
  );
}

/** Seat whose run relics/augments/moon relics modify `unit`'s effects (`17` §2.1). */
function modifiersSeat(state: CombatState, unit: UnitState): number {
  return unit.side === "hero" ? (unit as HeroState).player : state.activePlayer;
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
      return opponentsOf(state, ctx.source).filter((unit) => unit.alive);
    case "allAllies":
      if (ctx.comboScope === true && state.mode === "coop") {
        return state.heroes.filter((unit) => unit.alive);
      }
      return alliesOf(state, ctx.source).filter((unit) => unit.alive);
    case "owner": {
      const owner = isSummon(ctx.source) ? ownerOf(state, ctx.source) : undefined;
      return owner?.alive ? [owner] : [];
    }
    case "summon": {
      const summon = ctx.source.side === "hero" && !isSummon(ctx.source) ? summonOf(state, ctx.source.id) : undefined;
      return summon ? [summon] : [];
    }
  }
}

function markFromSource(target: UnitState, sourceId: string): boolean {
  return target.statuses.some(
    (entry) => entry.id === "mark" && entry.sourceId === sourceId,
  );
}

/** Tập Kích key of `unit`'s side (`01` §7.5): `"enemy"`, or `p<seat>` — a Linh Thú hits for its owner's seat. */
export function hitKey(state: CombatState, unit: UnitState): string {
  if (unit.side === "enemy") return "enemy";
  const seat = isSummon(unit) ? (ownerOf(state, unit) ?? unit).player : (unit as HeroState).player;
  return `p${seat}`;
}

/** Level-up passive of the acting hero for this card; never applies to bond cards. */
function cardPassive(data: GameData, ctx: EffectContext): LevelUpPassive | undefined {
  if (ctx.card === undefined || ctx.card.bond || ctx.source.side !== "hero") return undefined;
  const hero = ctx.source as HeroState;
  return hero.leveledUp ? levelUpPassive(data, hero) : undefined;
}

/** Tĩnh Tâm: a hero healed by the card is cleansed (`01` §8). */
function cleanseIfHealer(data: GameData, ctx: EffectContext, target: UnitState, events: CombatEvent[]): void {
  if (target.side === "hero" && target.alive && cardPassive(data, ctx)?.type === "healCleanses") {
    cleanseDebuffs(target, events);
  }
}

export function computeDamageAmount(
  data: GameData,
  state: CombatState,
  ctx: EffectContext,
  target: UnitState,
  base: number,
  consume = true,
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
      if (passive?.type === "comboAttackBonus") {
        const played = playerOf(state, ctx.source.id)?.cardsPlayedThisTurn ?? 0;
        flat += passive.amount * (played + (ctx.comboBonus ?? 0));
      }
      if (passive?.type === "bloodMoonAttackBonus" && state.bloodMoonRounds > 0) flat += passive.amount;
      // Nam Chiếu Hồn: the hero's card hits harder on a stacked target (`18` §3.3).
      if (passive?.type === "bonusVsDebuffed" && target.statuses.filter((st) => DEBUFF_STATUSES.has(st.id)).length >= passive.minDebuffs) flat += passive.amount;
    }
  }
  // Liên Kích (`01` §7.5): chained attack cards / attack intents hit harder.
  const chain = decreeModifier(data, state, "attackChainBonus");
  if (chain && ctx.attackChain) flat += chain.amount;
  // Tập Kích (`01` §7.5): the side's first damage hit of its turn. `consume`
  // marks the key — previews compute the bonus without spending it.
  const first = decreeModifier(data, state, "firstHitBonus");
  if (first) {
    const key = hitKey(state, ctx.source);
    state.firstHitKeys ??= [];
    if (!state.firstHitKeys.includes(key)) {
      if (consume) state.firstHitKeys.push(key);
      flat += first.amount;
    }
  }
  let multiplier = 1;
  multiplier *= ctx.damageMultiplier ?? 1;
  if (ctx.card !== undefined) {
    multiplier *= moonCardDamageMultiplier(data, state, modifiersSeat(state, ctx.source), ctx.card.tags);
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
): number {
  const lost = Math.min(unit.hp, amount);
  unit.hp -= lost;
  if (unit.side === "hero") bumpCounter(data, unit as HeroState, "damageTaken", lost);
  events.push({ type: "hpLost", targetId: unit.id, amount: lost, cause });
  return lost;
}

/** Hàng sau: a living unit that is not the front (lowest position) of its side (`01` §5.6). */
export function isBackRow(state: CombatState, target: UnitState): boolean {
  const side =
    target.side === "enemy"
      ? state.enemies
      : state.heroes.filter((hero) => hero.player === (target as HeroState).player);
  const front = side.filter((unit) => unit.alive && unit.hp > 0).reduce((min, unit) => Math.min(min, unit.position), Infinity);
  return target.position > front;
}

function nextBehind(state: CombatState, target: UnitState): UnitState | undefined {
  const side =
    target.side === "enemy"
      ? state.enemies
      : state.heroes.filter((hero) => hero.player === (target as HeroState).player);
  return side
    .filter((unit) => unit.alive && unit.hp > 0 && unit.position > target.position)
    .sort((a, b) => a.position - b.position)[0];
}

function dealDamage(
  data: GameData,
  state: CombatState,
  ctx: EffectContext,
  target: UnitState,
  base: number,
  events: CombatEvent[],
  single = false,
): void {
  const backRow =
    ctx.card !== undefined && ctx.card.type === "attack" && ctx.card.bond === undefined &&
    ctx.source.side === "hero" && isBackRow(state, target);
  const amount = computeDamageAmount(data, state, ctx, target, base);
  // Thế Thủ (`01` §10.1 step 4b): the first single-target hit a unit takes each
  // round is reduced before armor.
  let final = amount;
  const shield = decreeModifier(data, state, "firstSingleHitReduction");
  if (shield && single && !target.shieldUsed) {
    target.shieldUsed = true;
    final = Math.max(0, final - shield.amount);
  }
  const blocked = Math.min(target.armor, final);
  target.armor -= blocked;
  const hpLost = Math.min(target.hp, final - blocked);
  target.hp -= hpLost;
  if (target.side === "hero") bumpCounter(data, target as HeroState, "damageTaken", hpLost);
  events.push({
    type: "damageDealt",
    sourceId: ctx.source.id,
    targetId: target.id,
    amount: final,
    blocked,
    hpLost,
  });
  if (backRow) bumpCounter(data, ctx.source as HeroState, "backRowHits", 1);

  // Hàn Kiếm: the first hit each turn from the hero's cards leaves the enemy vulnerable.
  const passive = cardPassive(data, ctx);
  if (passive?.type === "firstHitVulnerable" && target.side === "enemy") {
    const hero = ctx.source as HeroState;
    if (!hero.firstHitUsedThisTurn) {
      hero.firstHitUsedThisTurn = true;
      if (target.alive && target.hp > 0) applyStatus(target, "vulnerable", passive.rounds, hero.id, events);
    }
  }
  // Biên Tái: the first hit each turn from the hero's attack cards marks the opposing target.
  if (passive?.type === "firstHitMarks" && ctx.card?.type === "attack" && opponentsOf(state, ctx.source).includes(target)) {
    const hero = ctx.source as HeroState;
    if (!hero.firstHitUsedThisTurn) {
      hero.firstHitUsedThisTurn = true;
      const factor = state.mode === "pvp" ? 2 : 1;
      if (target.alive && target.hp > 0) applyStatus(target, "mark", passive.rounds * factor, hero.id, events);
    }
  }

  const reflect = statusValue(target, "reflect");
  if (final <= 0 || reflect <= 0) return;
  // Phản Chấn (`01` §10.5): the decree multiplies Phản Đòn.
  loseHp(data, ctx.source, reflect * (decreeModifier(data, state, "reflectMultiplier")?.multiplier ?? 1), "reflect", events);
  if (ctx.source.hp > 0) return;
  // Both deaths resolve right after this hit, each credited to its own killer.
  if (target.alive && target.hp <= 0) {
    killUnit(data, state, target, events, { id: ctx.source.id, cardDamage: ctx.card !== undefined });
  }
  killUnit(data, state, ctx.source, events, { id: target.id, cardDamage: false, reflect: true });
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
    case "cardsPlayedThisTurnAtLeast": {
      const seat = playerOf(state, ctx.source.id);
      return (seat?.cardsPlayedThisTurn ?? 0) + (ctx.comboBonus ?? 0) >= condition.count;
    }
    case "targetSealed": {
      const target = findUnit(state, ctx.chosenId);
      return target !== undefined && target.alive && target.sealedBy !== undefined;
    }
  }
}

/** The stat a `scaledDamage` effect reads for one target (`01` §5.7). */
function damageScale(state: CombatState, per: DamageScale, ctx: EffectContext, target: UnitState): number {
  const seat = playerOf(state, ctx.source.id);
  const heroes = seat ? heroesOf(state, seat.index).filter((hero) => hero.alive) : [];
  switch (per) {
    case "cardsPlayedThisTurn":
      return (seat?.cardsPlayedThisTurn ?? 0) + (ctx.comboBonus ?? 0);
    case "selfArmor":
      return ctx.source.armor;
    case "moonPower":
      return seat?.moonPower ?? 0;
    case "alliesAtFullHp":
      return heroes.filter((hero) => hero.hp >= hero.maxHp).length;
    case "targetDebuffs":
      return target.statuses.filter((status) => DEBUFF_STATUSES.has(status.id)).length;
    case "alliesArmor":
      return heroes.reduce((sum, hero) => sum + hero.armor, 0);
    case "alliesRegen":
      return heroes.reduce((sum, hero) => sum + statusValue(hero, "regen"), 0);
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
      const pierce = effect.to === "chosen" && cardPassive(data, ctx)?.type === "pierceOwnAttacks";
      for (const target of resolveTargets(state, effect.to, ctx)) {
        for (let hit = 0; hit < hits && target.alive && target.hp > 0; hit++) {
          // Compute `behind` before the main hit: the main target dying must
          // not make the unit behind it step forward (`18` §3.2).
          const behind = pierce ? nextBehind(state, target) : undefined;
          dealDamage(data, state, ctx, target, effect.amount, events, effect.to === "chosen");
          if (!ctx.source.alive) return;
          if (behind?.alive && behind.hp > 0) {
            dealDamage(data, state, ctx, behind, effect.amount, events, effect.to === "chosen");
            if (!ctx.source.alive) return;
          }
        }
      }
      return;
    }
    case "heal": {
      const multiplier = moonHealMultiplier(data, state, modifiersSeat(state, ctx.source));
      const healPassive = cardPassive(data, ctx);
      const bonus = healPassive?.type === "healBonusOwnCards" ? healPassive.amount : 0;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const raw = Math.floor((effect.amount + bonus) * multiplier);
        const healed = Math.min(target.maxHp - target.hp, raw);
        if (healed > 0) {
          target.hp += healed;
          events.push({ type: "healed", targetId: target.id, amount: healed });
          if (ctx.card !== undefined && ctx.source.side === "hero") bumpCounter(data, ctx.source as HeroState, "hpHealed", healed);
        }
        if (effect.overflow === "armor" && raw > healed) {
          const armor = Math.floor((raw - healed) * moonArmorMultiplier(data, state, modifiersSeat(state, ctx.source)));
          if (armor > 0) {
            target.armor += armor;
            events.push({ type: "armorGained", targetId: target.id, amount: armor });
          }
        }
        cleanseIfHealer(data, ctx, target, events);
      }
      return;
    }
    case "loseHp": {
      for (const target of resolveTargets(state, effect.to, ctx)) {
        if (target === ctx.source && ctx.card?.tags.includes("forbidden") && cardPassive(data, ctx)?.type === "forbiddenNoSelfHpLoss") continue;
        const lost = loseHp(data, target, effect.amount, "loseHp", events);
        if (target === ctx.source && ctx.source.side === "hero" && ctx.card?.tags.includes("forbidden")) {
          bumpCounter(data, ctx.source as HeroState, "forbiddenHpLost", lost);
        }
      }
      return;
    }
    case "gainArmor": {
      const multiplier = moonArmorMultiplier(data, state, modifiersSeat(state, ctx.source));
      // Bất Diệt: armor from the hero's cards is raised before the armor multiplier.
      const passive = cardPassive(data, ctx);
      const bonus = passive?.type === "armorBonusOwnCards" ? passive.amount : 0;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const gained = Math.floor((effect.amount + bonus) * multiplier);
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
      const seat = playerOf(state, ctx.source.id);
      if (!seat) return;
      const extra = heroesOf(state, seat.index).reduce((sum, hero) => { const p = hero.alive && hero.leveledUp ? levelUpPassive(data, hero) : undefined; return sum + (p?.type === "chooseCardExtraLook" ? p.amount : 0); }, 0);
      const options = seat.drawPile.splice(0, Math.min(effect.look + extra, seat.drawPile.length));
      if (options.length === 0) return;
      if (options.length === 1) {
        state.cards[options[0]!]!.heldTurns = 0;
        state.cards[options[0]!]!.chosenThisTurn = true;
        addToHand(data, state, seat, options[0]!, events);
        bumpSeat(data, state, seat.index, "cardsChosen", 1);
        events.push({ type: "cardsDrawn", instanceIds: options, ...seatTag(state, seat.index) });
        return;
      }
      seat.pendingChoice = { kind: "chooseCard", options };
      // Co-op keeps the shared turn open while one seat answers (`01` §16.2).
      if (state.mode !== "coop") state.status = "choosing";
      events.push({ type: "choiceOpened", options, ...seatTag(state, seat.index) });
      return;
    }
    case "gainMoonPower": {
      if (ctx.source.side === "enemy") {
        (ctx.source as EnemyState).moonPower += effect.amount;
        return;
      }
      const seat = playerOf(state, ctx.source.id)!;
      seat.moonPower += effect.amount;
      events.push({ type: "moonPowerChanged", value: seat.moonPower, ...seatTag(state, seat.index) });
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
      const bonus = effect.status === "stealth" ? moonStealthDurationBonus(data, state, modifiersSeat(state, ctx.source)) : 0;
      // PvP stores durations in turns (2 × rounds); they tick at each player's turn end (`17` §4.3).
      const durationFactor = state.mode === "pvp" && DURATION_STATUSES.has(effect.status) ? 2 : 1;
      const passive = cardPassive(data, ctx);
      const debuff = DEBUFF_STATUSES.has(effect.status);
      let amount = (effect.amount + bonus) * durationFactor;
      // Vong Quốc Khúc: the hero's own duration debuffs run longer (`18` §3.3).
      if (passive?.type === "debuffDurationBonus" && debuff && DURATION_STATUSES.has(effect.status)) amount += passive.amount * durationFactor;
      // Kinh Hồng Vũ: each charm the hero applies carries extra charges (`18` §3.3).
      if (passive?.type === "charmMastery" && effect.status === "charm") amount += passive.extraCharges;
      // Nguyệt Chiếu (`01` §7.5): Ẩn Thân cannot be applied while the decree holds.
      if (effect.status === "stealth" && decreeModifier(data, state, "stealthSuppressed")) return;
      // Cuồng Nguyệt: listed buffs apply at a multiple of their value.
      const buff = decreeModifier(data, state, "buffMultiplier");
      if (buff?.statuses.includes(effect.status)) amount *= buff.multiplier;
      // Thiên Bình: duration debuffs apply longer (every source).
      const extend = decreeModifier(data, state, "debuffDurationBonus");
      if (extend && debuff && DURATION_STATUSES.has(effect.status)) amount += extend.amount * durationFactor;
      let targets = resolveTargets(state, effect.to, ctx);
      if (
        effect.status === "regen" &&
        passive?.type === "regenSpreadsToAllAllies"
      ) {
        targets = [...new Set([...targets, ...alliesOf(state, ctx.source).filter((h) => h.alive)])];
      }
      for (const target of targets) {
        // Hộ Vệ on the caster itself is meaningless — the guardian must be an ally.
        if (effect.status === "guard" && target.id === ctx.source.id) continue;
        const newFreeze = effect.status === "freeze" && !hasStatus(target, "freeze");
        applyStatus(target, effect.status, amount, ctx.source.id, events);
        if (newFreeze && ctx.source.side === "hero") {
          bumpCounter(data, ctx.source as HeroState, "freezesApplied", 1);
        }
        // PvP: an opposing hero is still `side === "hero"` — check the side lists (`17` §3.4).
        if (debuff && ctx.source.side === "hero" && opponentsOf(state, ctx.source).includes(target)) {
          bumpCounter(data, ctx.source as HeroState, "debuffsApplied", 1);
        }
        if (effect.status === "charm" && ctx.source.side === "hero" && opponentsOf(state, ctx.source).includes(target)) {
          bumpCounter(data, ctx.source as HeroState, "charmsApplied", 1);
          // Vũ Y: charming an enemy hides the charmer (`18` §3.3).
          if (passive?.type === "stealthOnCharm") applyStatus(ctx.source, "stealth", passive.rounds * durationFactor, ctx.source.id, events);
        }
        if (effect.status === "regen") cleanseIfHealer(data, ctx, target, events);
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
      enterPhase(data, state, events);
      if (ctx.card !== undefined && ctx.source.side === "hero") bumpCounter(data, ctx.source as HeroState, "moonShifts", 1);
      const weakens = cardPassive(data, ctx);
      if (weakens?.type === "moonShiftWeakensEnemies") {
        resolveEffect(data, state, { type: "applyStatus", status: "weak", amount: weakens.amount, to: "allEnemies" }, ctx, events);
      }
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
      const multiplier = moonHealMultiplier(data, state, modifiersSeat(state, ctx.source));
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
          if (ctx.card !== undefined && ctx.source.side === "hero") bumpCounter(data, ctx.source as HeroState, "hpHealed", healed);
        }
        removeStatus(target, "regen", events);
        cleanseIfHealer(data, ctx, target, events);
      }
      return;
    }
    case "missingHpDamage": {
      const hits = effect.hits ?? 1;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        for (let hit = 0; hit < hits && target.alive && target.hp > 0; hit++) {
          const base = Math.floor((ctx.source.maxHp - ctx.source.hp) * effect.ratio);
          dealDamage(data, state, ctx, target, base, events, effect.to === "chosen");
          if (!ctx.source.alive) return;
        }
      }
      return;
    }
    case "scaledDamage": {
      for (const target of resolveTargets(state, effect.to, ctx)) {
        if (!target.alive || target.hp <= 0) continue;
        const scaled = (effect.base ?? 0) + Math.floor((damageScale(state, effect.per, ctx, target) * effect.amount) / (effect.divisor ?? 1));
        dealDamage(data, state, ctx, target, Math.min(effect.max ?? scaled, scaled), events, effect.to === "chosen");
        if (!ctx.source.alive) return;
      }
      return;
    }
    case "drainMoonPower": {
      // PvP: drains the opponent's reserve once, however many heroes `to` covers (`17` §4.5).
      if (state.mode === "pvp") {
        const seat = playerOf(state, ctx.source.id);
        const opponent = state.players.find((p) => p.index !== seat?.index);
        if (!seat || !opponent) return;
        const drained = Math.min(effect.amount, opponent.moonReserve);
        if (drained > 0) {
          opponent.moonReserve -= drained;
          events.push({ type: "moonReserveChanged", side: "hero", value: opponent.moonReserve, player: opponent.index });
        }
        if (effect.steal && drained > 0 && ctx.source.side === "hero") {
          bumpCounter(data, ctx.source as HeroState, "buffsStolen", 1);
          seat.moonPower += drained;
          events.push({ type: "moonPowerChanged", value: seat.moonPower, player: seat.index });
        }
        return;
      }
      // Story intents (`01` §9.3.2): an enemy drain pulls the player seat's
      // reserve once — `to` only picks the aimed hero; players have no intent
      // chain to cancel. `steal` feeds the executing enemy's fund.
      if (ctx.source.side === "enemy") {
        const seat = (ctx.chosenId !== undefined ? playerOf(state, ctx.chosenId) : undefined) ?? state.players[0]!;
        const drained = Math.min(effect.amount, seat.moonReserve);
        seat.moonReserve -= drained;
        if (drained > 0) {
          events.push({ type: "moonReserveChanged", side: "hero", value: seat.moonReserve, player: seat.index });
        }
        if (effect.steal === true) (ctx.source as EnemyState).moonPower += drained;
        return;
      }
      let drained = 0;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        if (target.side !== "enemy") continue;
        drained += drainEnemyMoonPower(data, target as EnemyState, effect.amount, events);
      }
      if (effect.steal && drained > 0) {
        // Đoạt Nguyệt counts as one theft toward F02's level-up (01 §8).
        if (ctx.source.side === "hero") {
          bumpCounter(data, ctx.source as HeroState, "buffsStolen", 1);
          const seat = playerOf(state, ctx.source.id)!;
          seat.moonPower += drained;
          events.push({ type: "moonPowerChanged", value: seat.moonPower, ...seatTag(state, seat.index) });
        }
      }
      return;
    }
    case "gainMoonPowerPerTurn": {
      const seat = playerOf(state, ctx.source.id);
      if (seat) seat.moonPowerBonus += effect.amount;
      return;
    }
    case "execute": {
      // Hợp Kích only (`01` §16.4): targets under the HP threshold die outright;
      // when nothing qualifies, `elseEffects` run once.
      const executed = resolveTargets(state, effect.to, ctx).filter(
        (target) => target.hp / target.maxHp <= effect.threshold,
      );
      if (executed.length === 0) {
        resolveEffects(data, state, effect.elseEffects ?? [], { ...ctx, noHooks: true }, events);
        return;
      }
      for (const target of executed) {
        killUnit(data, state, target, events, { id: ctx.source.id, cardDamage: ctx.card !== undefined });
      }
      return;
    }
    case "createCard": {
      const seat = playerOf(state, ctx.source.id);
      const card = data.cards[effect.cardId];
      if (!seat || card?.ownerId === undefined) return;
      if (seat.hand.length >= data.combatConfig.handLimit) {
        events.push({ type: "cardCreated", cardId: card.id, instanceId: null, ...seatTag(state, seat.index) });
        return;
      }
      seat.createdCards = (seat.createdCards ?? 0) + 1;
      const instanceId = prefixedId(state, seat.index, `t${seat.createdCards}`);
      state.cards[instanceId] = { instanceId, cardId: card.id, ownerIds: [card.ownerId], player: seat.index, heldTurns: 0 };
      seat.hand.push(instanceId);
      events.push({ type: "cardCreated", cardId: card.id, instanceId, ...seatTag(state, seat.index) });
      return;
    }
    case "drawCards": {
      const seat = playerOf(state, ctx.source.id);
      if (!seat) return;
      drawCards(data, state, seat, effect.amount, events);
      return;
    }
    case "summon": {
      if (ctx.source.side !== "hero" || isSummon(ctx.source)) return;
      summonEffect(data, state, ctx.source as HeroState, effect.summonId, events);
      return;
    }
    case "sealIntent": {
      const hero = ctx.source.side === "hero" && !isSummon(ctx.source) ? (ctx.source as HeroState) : undefined;
      const passive = cardPassive(data, ctx);
      for (const target of resolveTargets(state, effect.to, ctx)) {
        // Phong Ấn (`01` §5.6): mark the opposing unit — during its side's next
        // turn every intent or card it plays keeps damage but loses every other
        // effect. The counter credits the sealer at strip time, not at cast.
        if (!opponentsOf(state, ctx.source).includes(target)) continue;
        target.sealedBy = ctx.source.id;
        if (passive?.type === "sealExtraFirstPerTurn" && hero && !hero.firstSealUsedThisTurn) {
          hero.firstSealUsedThisTurn = true;
          const extra = opponentsOf(state, ctx.source)
            .filter((unit) => unit.alive && unit.id !== target.id)
            .sort((a, b) => a.position - b.position)[0];
          if (extra) extra.sealedBy = ctx.source.id;
        }
        if (passive?.type === "sealWeakens") {
          const factor = state.mode === "pvp" ? 2 : 1;
          applyStatus(target, "weak", passive.amount * factor, ctx.source.id, events);
        }
      }
      return;
    }
    case "extendDebuffs": {
      // PvP durations are stored in turns (2 × rounds), like applyStatus (`17` §4.3).
      const factor = state.mode === "pvp" ? 2 : 1;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        for (const entry of target.statuses) {
          if (DEBUFF_STATUSES.has(entry.id) && DURATION_STATUSES.has(entry.id)) {
            entry.value += effect.amount * factor;
            events.push({ type: "statusApplied", targetId: target.id, status: entry.id, value: entry.value });
          }
        }
      }
      return;
    }
    case "revive": {
      // Hồi Hồn (`18` §3.5): a fallen, unrevived ally stands back up at
      // ratio × maxHp and its purged draw-pile cards shuffle back in.
      const seat = playerOf(state, ctx.source.id);
      if (!seat) return;
      const targetId =
        effect.to === "chosen"
          ? ctx.chosenId
          : [...(seat.fallenOrder ?? [])].reverse().find((id) => {
              const hero = state.heroes.find((h) => h.id === id);
              return hero !== undefined && !hero.alive && !hero.revived;
            });
      const hero = state.heroes.find((h) => h.id === targetId && h.player === seat.index);
      if (!hero || hero.alive || hero.revived) return;
      hero.alive = true;
      hero.revived = true;
      hero.hp = Math.max(1, Math.floor(effect.ratio * hero.maxHp));
      hero.armor = 0;
      hero.statuses = [];
      events.push({ type: "heroRevived", heroId: hero.id, hp: hero.hp, ...seatTag(state, seat.index) });
      const back = seat.purged?.[hero.id] ?? [];
      if (back.length > 0) {
        seat.discardPile = seat.discardPile.filter((id) => !back.includes(id));
        const shuffled = shuffle([...seat.drawPile, ...back], state.rngState);
        seat.drawPile = shuffled.items;
        state.rngState = shuffled.rngState;
        delete seat.purged![hero.id];
        events.push({ type: "deckShuffled", ...seatTag(state, seat.index) });
      }
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
  for (const unit of [...state.heroes, ...summonsOf(state), ...state.enemies]) {
    if (unit.alive && unit.hp <= 0) killUnit(data, state, unit, events, killer);
  }
}

interface Killer {
  id: string;
  cardDamage: boolean;
  /** Died to the killer's Phản Đòn (counts for enemiesKilled at constellation 2, `01` §8). */
  reflect?: boolean;
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
  // Linh Thú never count toward enemiesKilled and carry no cards/drawPile (`01` §17.2, §17.4).
  if (isSummon(unit)) {
    state.summons = summonsOf(state).filter((summon) => summon !== unit);
    return;
  }
  if (killer) {
    const killerHero = state.heroes.find((hero) => hero.id === killer.id);
    // PvE/co-op: kills of enemies count. PvP: kills of the opposing seat's heroes count (`17` §4.5).
    const victimOpposesKiller =
      unit.side === "enemy"
        ? killerHero !== undefined
        : state.mode === "pvp" && (unit as HeroState).player !== killerHero?.player;
    if (killerHero && victimOpposesKiller && (killer.cardDamage || (killer.reflect && killerHero.constellation >= 2 && !killerHero.pvp))) {
      bumpCounter(data, killerHero, "enemiesKilled", 1);
    }
  }
  if (unit.side === "hero") {
    dismissSummonOf(state, unit.id, events);
    const defId = (unit as HeroState).defId;
    const seat = playerOf(state, unit.id)!;
    // Hồi Hồn (`18` §3.5): remember the fall order and keep the purged
    // draw-pile cards so a revive can shuffle them back in.
    seat.fallenOrder = [...(seat.fallenOrder ?? []), unit.id];
    const purged = seat.drawPile.filter(
      (id) => state.cards[id]!.player === seat.index && state.cards[id]!.ownerIds.includes(defId),
    );
    if (purged.length > 0) {
      seat.drawPile = seat.drawPile.filter((id) => !purged.includes(id));
      seat.discardPile.push(...purged);
      seat.purged = { ...(seat.purged ?? {}), [unit.id]: purged };
      events.push({ type: "cardsPurged", heroId: unit.id, instanceIds: purged, ...seatTag(state, seat.index) });
    }
    // F10 Vong Xuyên: the fall counts seat-wide; survivors may shield themselves.
    bumpSeat(data, state, seat.index, "alliesFallen", 1);
    for (const ally of heroesOf(state, seat.index)) {
      const passive = ally.alive && ally.leveledUp ? levelUpPassive(data, ally) : undefined;
      if (passive?.type !== "armorOnAllyFall") continue;
      for (const survivor of heroesOf(state, seat.index).filter((hero) => hero.alive)) {
        survivor.armor += passive.amount;
        events.push({ type: "armorGained", targetId: survivor.id, amount: passive.amount });
      }
    }
  }
}

export function checkCombatEnd(state: CombatState, events: CombatEvent[]): boolean {
  if (state.status === "won" || state.status === "lost") return true;
  // PvP: a seat loses when all its heroes fall; a simultaneous wipe favors the
  // active player (`17` §4.6).
  if (state.mode === "pvp") {
    const dead = state.players.map((seat) => heroesOf(state, seat.index).every((hero) => !hero.alive));
    if (!dead.some(Boolean)) return false;
    const winner = dead.every(Boolean) ? state.activePlayer : (dead.indexOf(true) === 0 ? 1 : 0);
    state.winner = winner;
    state.status = "won";
    events.push({ type: "combatEnded", result: "won", winner });
    return true;
  }
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
        ctx.card !== undefined && (effect.type === "damage" || effect.type === "missingHpDamage" || effect.type === "scaledDamage"),
    });
    checkLevelUps(data, state, events);
    checkBossPhase(data, state, events);
    if (checkCombatEnd(state, events)) return;
    if (!ctx.noHooks) {
      // Co-op: the acting seat may not be `activePlayer` (the shared-turn marker).
      const actingSeat =
        ctx.source.side === "hero"
          ? (playerOf(state, ctx.source.id)?.index ?? state.activePlayer)
          : state.activePlayer;
      fireEventHooks(data, state, events, start, bloodMoonBefore, actingSeat);
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
    // Burn ticks live outside resolveEffects — a boss crossing a phase
    // threshold here still transitions (`01` §16.5).
    checkBossPhase(data, state, events);
    if (!unit.alive) return;
  }
  const regen = getStatus(unit, "regen");
  if (regen) {
    const healed = Math.min(
      unit.maxHp - unit.hp,
      Math.floor(regen.value * moonHealMultiplier(data, state, modifiersSeat(state, unit))),
    );
    if (healed > 0) {
      unit.hp += healed;
      events.push({ type: "healed", targetId: unit.id, amount: healed });
    }
    regen.value -= 1;
    if (regen.value <= 0) removeStatus(unit, "regen", events);
  }
}
