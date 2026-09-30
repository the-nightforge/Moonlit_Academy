import { bossPhaseOf } from "./coop/boss";
import { cardDefOf } from "./gear";
import { levelUpPassive } from "./levelup";
import { opponentsOf, summonsOf } from "./players";
import { cardOwners, getEffectiveCost, getValidTargets, isCardPlayable } from "./queries";
import { hasStatus } from "./statuses";
import { isSummon, summonOf } from "./summons";
import type {
  Action,
  CardDef,
  CombatState,
  Effect,
  EnemyState,
  GameData,
  HeroState,
  IntentDef,
  UnitState,
} from "./types/index";

/**
 * The heuristic bot shared by the playtest sims and `pvpBot`: mulligan cards
 * above the doubling curve, Chiêm Bài picks the most expensive card affordable
 * next round, plays costliest first, focuses the lowest-HP enemy unit (or the
 * highest-reserve seat for drains) / lowest-ratio ally. Pure: reads only the
 * state it is given — pass a `viewFor` result to keep it honest (`17` §4.9).
 */
export function chooseCombatAction(data: GameData, state: CombatState, seat: number): Action {
  const player = state.players[seat]!;
  const defOf = (id: string) => cardDefOf(data, state, state.cards[id]!);
  if (state.status === "mulligan") {
    const expensive = player.hand.filter((id) => defOf(id)!.cost > 5);
    return {
      type: "mulligan",
      instanceIds: expensive.slice(0, data.combatConfig.maxMulligan),
    };
  }
  // Co-op keeps status playerTurn while a seat answers a choice (`01` §16.2).
  if (state.status === "choosing" || player.pendingChoice !== null) {
    if (player.pendingChoice?.kind === "chooseMoon") {
      return { type: "chooseMoon", offset: bestMoonOffset(data, state, seat), player: seat };
    }
    const options = player.pendingChoice?.kind === "chooseCard" ? player.pendingChoice.options : [];
    const curve = data.combatConfig.moonPower;
    const nextFund =
      Math.min(curve.cap, curve.start + state.round * curve.perRound) +
      data.combatConfig.moonReserveMax;
    const ordered = [...options].sort((a, b) => defOf(b)!.cost - defOf(a)!.cost);
    const pick = ordered.find((id) => defOf(id)!.cost <= nextFund) ?? ordered[0];
    return pick === undefined ? { type: "endTurn" } : { type: "chooseCard", instanceId: pick };
  }
  const keywordsOf = (id: string) => defOf(id)!.keywords ?? [];
  const heldThreshold = (id: string): number => {
    let best = 0;
    const walk = (effects: Effect[]) => {
      for (const effect of effects) {
        if (effect.type !== "conditional") continue;
        if (effect.condition.type === "heldTurnsAtLeast") best = Math.max(best, effect.condition.turns);
        walk(effect.then);
        walk(effect.else ?? []);
      }
    };
    walk(defOf(id)!.effects);
    return best;
  };
  const playable = player.hand.filter((id) => isCardPlayable(data, state, id, seat));
  const ready = playable.filter((id) => state.cards[id]!.heldTurns >= heldThreshold(id));
  const candidates = ready.length > 0 || player.hand.length < data.combatConfig.handSize ? ready : playable;
  // Liên Hoàn and damage scaling on cards played this turn both want to go last.
  const isCombo = (id: string) =>
    keywordsOf(id).includes("lien_hoan") ||
    defOf(id)!.effects.some((effect) => effect.type === "scaledDamage" && effect.per === "cardsPlayedThisTurn");
  const ordered = [...candidates].sort((a, b) => {
    const comboA = isCombo(a) ? 1 : 0;
    const comboB = isCombo(b) ? 1 : 0;
    if (comboA !== comboB) return comboA - comboB; // non-combo cards first
    return getEffectiveCost(data, state, b) - getEffectiveCost(data, state, a);
  });
  const unitOf = (id: string) =>
    state.heroes.find((hero) => hero.id === id) ??
    summonsOf(state).find((summon) => summon.id === id) ??
    state.enemies.find((enemy) => enemy.id === id);
  // `bestMoonOffset`'s idea: a landing phase "matches" when an untagged modifier or
  // one whose tag is somewhere in the hand exists there.
  const tagsInHand = new Set(player.hand.flatMap((id) => defOf(id)?.tags ?? []));
  const moonCount = data.moonPhases.length;
  const landingScore = (shift: number) => {
    const phase = data.moonPhases[(((state.moonIndex + shift) % moonCount) + moonCount) % moonCount]!;
    return phase.modifiers.filter((m) => ("tag" in m ? tagsInHand.has(m.tag) : true)).length;
  };
  for (const instanceId of ordered) {
    const card = defOf(instanceId)!;
    const owners = cardOwners(state, state.cards[instanceId]!);
    // Forbidden self-cost: skip when paying blood would nearly kill the owner.
    if (card.tags.includes("forbidden")) {
      const owner = owners[0];
      const negated =
        card.bond === undefined &&
        owner !== undefined &&
        owner.leveledUp &&
        levelUpPassive(data, owner)?.type === "forbiddenNoSelfHpLoss";
      const fatal = selfLosses(card.effects).some(
        (loss, actor) => {
          const payer = owners[actor];
          return !negated && loss > 0 && payer !== undefined && payer.hp <= loss + 5;
        },
      );
      if (fatal) continue;
    }
    // Đổi Vận: a card that only shifts the moon (and digs) lands on a phase that
    // helps the hand — unless it still feeds an unleveled `moonShifts` counter.
    // Cards with other effects (damage, Nguyệt Lực, debuffs) are worth playing anyway.
    if (
      card.effects.some((effect) => effect.type === "shiftMoon") &&
      card.effects.every((effect) => effect.type === "shiftMoon" || effect.type === "chooseCard" || effect.type === "drawCards")
    ) {
      const leveling = owners.some(
        (hero) =>
          hero?.alive === true &&
          !hero.leveledUp &&
          data.heroes[hero.defId]?.levelUp.counter === "moonShifts",
      );
      if (!leveling && !shiftTotals(card.effects).some((shift) => landingScore(shift) > 0)) continue;
    }
    // Living units opposing the card's owner — enemies in PvE/co-op, the other
    // seat's heroes and Linh Thú in PvP (`17` §3.4, §17.3).
    const opponents = owners[0] !== undefined ? opponentsOf(state, owners[0]).filter((unit) => unit.alive) : [];
    // Linh Thú (`01` §17): recasting while a healthy summon stands only heals and
    // buffs it — hold the card, unless its summoner still levels `summonsMade` (F09).
    const summoners = summonActors(card.effects, owners);
    if (summoners.length > 0 && summoners.every((hero) => !wantsSummon(data, state, hero))) continue;
    // Mê Hoặc (`01` §9.3.1): the turned hit needs a second living unit on the
    // opposing side — a lone enemy makes a charm card dead. PvP counts heroes
    // only: a Linh Thú never follows the mark.
    if (appliesCharm(card)) {
      const charmables = opponents.filter((unit) => unit.side === "enemy" || !isSummon(unit));
      if (charmables.length < 2) continue;
    }
    // Phong Ấn (`01` §5.6): the mark strips non-damage effects from the unit's
    // next turn — when everything it could reach plans pure damage, skip the card.
    if (hasSealIntent(card.effects)) {
      const sealable =
        card.target === "enemy"
          ? getValidTargets(data, state, instanceId).map((id) => unitOf(id)!)
          : opponents;
      if (sealable.every((unit) => sealWeight(data, state, unit) === 0)) continue;
    }
    if (card.target === "none") return { type: "playCard", instanceId };
    const targets = getValidTargets(data, state, instanceId);
    let targetId: string | undefined;
    if (card.target === "enemy") {
      const drains = keywordsOf(instanceId).some((k) => k === "toa_nguyet" || k === "doat_nguyet");
      // PvE drains hit the enemy showing the biggest fund (chains stay hidden,
      // `01` §9.2); PvP drains hit the seat holding the bigger reserve (`17` §4.5).
      const threat = (id: string) => {
        const unit = unitOf(id)!;
        return unit.side === "enemy"
          ? (unit as EnemyState).moonPower
          : (state.players.find((p) => p.index === (unit as { player: number }).player)?.moonReserve ?? 0);
      };
      const hp = (id: string) => unitOf(id)!.hp;
      let pool = targets;
      let score: (id: string) => number = (id) => -hp(id);
      if (drains) {
        score = threat;
      } else if (appliesCharm(card)) {
        // Mê Hoặc aims at the heaviest-hitting kit; in PvP a Linh Thú ignores
        // the mark, so only heroes stay in the pool.
        pool = targets.filter((id) => {
          const unit = unitOf(id)!;
          return unit.side === "enemy" || !isSummon(unit);
        });
        score = (id) => incomingDamage(data, state, unitOf(id)!);
      } else if (hasSealIntent(card.effects)) {
        // Phong Ấn marks the unit whose next turn would lose the most
        // non-damage effects; the all-pure-damage case was gated above.
        score = (id) => sealWeight(data, state, unitOf(id)!);
      }
      targetId = [...pool].sort((a, b) => score(b) - score(a))[0];
    } else if (card.target === "fallenAlly") {
      // Hồi Hồn (`18` §3.5): raise the sturdiest fallen ally.
      targetId = [...targets].sort((a, b) => unitOf(b)!.maxHp - unitOf(a)!.maxHp)[0];
    } else {
      const burst = keywordsOf(instanceId).includes("tu_duoc");
      const regen = (id: string) => unitOf(id)!.statuses.find((s) => s.id === "regen")?.value ?? 0;
      const ratio = (id: string) => {
        const unit = unitOf(id) as UnitState;
        return unit.hp / unit.maxHp;
      };
      // Hộ Vệ aimed at its own source fizzles — target the weakest *other* ally;
      // an empty pool (owner alone) makes `targetId` undefined and skips the card.
      const guards = guardSources(card.effects, owners);
      const allies = guards.size > 0 ? targets.filter((id) => !guards.has(id)) : targets;
      const pool = burst ? allies.filter((id) => regen(id) >= 3) : allies;
      targetId = [...pool].sort((a, b) => ratio(a) - ratio(b))[0];
    }
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
}

/** Chọn Pha: the offset whose phase has the most modifiers matching tags in hand (ties → smaller offset). */
function bestMoonOffset(data: GameData, state: CombatState, seat: number): 0 | 1 | 2 {
  const tags = new Set(state.players[seat]!.hand.flatMap((id) => cardDefOf(data, state, state.cards[id]!)?.tags ?? []));
  let best: 0 | 1 | 2 = 0;
  let bestScore = -1;
  for (const offset of [0, 1, 2] as const) {
    const phase = data.moonPhases[(state.moonIndex + offset) % data.moonPhases.length]!;
    const score = phase.modifiers.filter((m) => "tag" in m ? tags.has(m.tag) : true).length;
    if (score > bestScore) { best = offset; bestScore = score; }
  }
  return best;
}

/** Every `shiftMoon` total a card could leave — one entry per conditional branch path. */
function shiftTotals(effects: Effect[]): number[] {
  let totals = [0];
  for (const effect of effects) {
    if (effect.type === "shiftMoon") {
      totals = totals.map((total) => total + effect.amount);
    } else if (effect.type === "conditional") {
      const branches = [...shiftTotals(effect.then), ...shiftTotals(effect.else ?? [])];
      totals = totals.flatMap((total) => branches.map((branch) => total + branch));
    }
  }
  return totals;
}

/** Worst-case `loseHp → self` totals per `actor` index (both conditional branches counted). */
function selfLosses(effects: Effect[]): number[] {
  const totals: number[] = [];
  const walk = (list: Effect[], actor: number) => {
    for (const effect of list) {
      const at = effect.actor ?? actor;
      if (effect.type === "loseHp" && effect.to === "self") {
        totals[at] = (totals[at] ?? 0) + effect.amount;
      } else if (effect.type === "conditional") {
        walk(effect.then, at);
        walk(effect.else ?? [], at);
      }
    }
  };
  walk(effects, 0);
  return totals;
}

/**
 * Linh Thú (`01` §17): recasting while a healthy summon stands only heals and
 * buffs it — want the card when the hero has no living Linh Thú, when that
 * summon is under half HP, or while the hero still levels via `summonsMade` (F09).
 */
function wantsSummon(data: GameData, state: CombatState, hero: HeroState): boolean {
  if (!hero.leveledUp && data.heroes[hero.defId]?.levelUp.counter === "summonsMade") return true;
  const summon = summonOf(state, hero.id);
  return summon === undefined || summon.hp * 2 < summon.maxHp;
}

/** Heroes a card's `summon` effects would raise a Linh Thú for (`effect.actor` on bond cards; nested branches count). */
function summonActors(effects: Effect[], owners: (HeroState | undefined)[]): HeroState[] {
  const found = new Set<HeroState>();
  const walk = (list: Effect[], actor: number): void => {
    for (const effect of list) {
      const at = effect.actor ?? actor;
      if (effect.type === "summon") {
        const hero = owners[at];
        if (hero !== undefined) found.add(hero);
      } else if (effect.type === "conditional") {
        walk(effect.then, at);
        walk(effect.else ?? [], at);
      }
    }
  };
  walk(effects, 0);
  return [...found];
}

/** Any `applyStatus → charm` that can land on an opposing unit (`allEnemies`, or `chosen` on enemy-target cards). */
function appliesCharm(card: CardDef): boolean {
  const walk = (effects: Effect[]): boolean =>
    effects.some((effect) => {
      if (effect.type === "applyStatus" && effect.status === "charm") {
        return effect.to === "allEnemies" || (card.target === "enemy" && effect.to === "chosen");
      }
      return effect.type === "conditional" && (walk(effect.then) || walk(effect.else ?? []));
    });
  return walk(card.effects);
}

/** Any `sealIntent` anywhere in the effect tree (nested `conditional` branches count). */
function hasSealIntent(effects: Effect[]): boolean {
  return effects.some(
    (effect) =>
      effect.type === "sealIntent" ||
      (effect.type === "conditional" && (hasSealIntent(effect.then) || hasSealIntent(effect.else ?? []))),
  );
}

/** Non-damage effects a Phong Ấn mark would strip from `unit`'s next turn — the same top-level filter `sealFilteredEffects` runs (`01` §5.6). */
function sealWeight(data: GameData, state: CombatState, unit: UnitState): number {
  // A frozen enemy skips its chain and a frozen hero cannot play — the mark
  // expires unused either way. A Linh Thú ignores freeze.
  if (!isSummon(unit) && hasStatus(unit, "freeze")) return 0;
  const strippable = (effects: Effect[]) =>
    effects.filter((effect) => effect.type !== "damage" && effect.type !== "missingHpDamage" && effect.type !== "scaledDamage").length;
  if (unit.side === "enemy") {
    return knownIntents(data, state, unit as EnemyState).reduce((sum, intent) => sum + strippable(intent.effects), 0);
  }
  if (isSummon(unit)) return strippable(data.summons[unit.summonId]?.action ?? []);
  // PvP hero: hands stay hidden (`17` §4.8) — weigh the non-damage effects the
  // hero's pool could lose on its cards next turn.
  const def = data.heroes[unit.defId];
  if (!def) return 0;
  return [...def.cardIds, ...def.lockedCardIds].reduce(
    (sum, cardId) => sum + strippable(data.cards[cardId]?.effects ?? []),
    0,
  );
}

/** Damage an effect list can put out — both `conditional` branches count (heuristic weight). */
function effectDamage(effects: Effect[], unit: UnitState): number {
  let total = 0;
  for (const effect of effects) {
    if (effect.type === "damage") total += effect.amount * (effect.hits ?? 1);
    else if (effect.type === "missingHpDamage") total += Math.floor(unit.maxHp * effect.ratio) * (effect.hits ?? 1);
    // Rough weight: the stat taken as `divisor` (one scaling step).
    else if (effect.type === "scaledDamage") total += (effect.base ?? 0) + effect.amount;
    else if (effect.type === "conditional") total += effectDamage(effect.then, unit) + effectDamage(effect.else ?? [], unit);
  }
  return total;
}

/**
 * Intents a player can know `enemy` might use next: its kit (the active co-op
 * boss phase's pool) within the fund shown on its portrait. Chains stay hidden
 * (`01` §9.2), so the bot never reads `plannedIntents`.
 */
function knownIntents(data: GameData, state: CombatState, enemy: EnemyState): IntentDef[] {
  const def = data.enemies[enemy.defId];
  if (!def) return [];
  const pool = bossPhaseOf(data, state, enemy, def)?.intents ?? def.intents;
  return pool.filter((intent) => intent.cost <= enemy.moonPower);
}

/** Damage `unit` could deal next turn, from public info only: an enemy's affordable kit; card-pool attack power for PvP heroes/summons (`17` §4.8). */
function incomingDamage(data: GameData, state: CombatState, unit: UnitState): number {
  if (!isSummon(unit) && hasStatus(unit, "freeze")) return 0;
  if (unit.side === "enemy") {
    return effectDamage(knownIntents(data, state, unit as EnemyState).flatMap((intent) => intent.effects), unit);
  }
  if (isSummon(unit)) return effectDamage(data.summons[unit.summonId]?.action ?? [], unit);
  const def = data.heroes[unit.defId];
  if (!def) return 0;
  return [...def.cardIds, ...def.lockedCardIds].reduce(
    (sum, cardId) => sum + effectDamage(data.cards[cardId]?.effects ?? [], unit),
    0,
  );
}

/** Hero ids a `guard → chosen` effect would source from — self-guard fizzles, so they are out of the pool. */
function guardSources(effects: Effect[], owners: (HeroState | undefined)[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: Effect[], actor: number) => {
    for (const effect of list) {
      const at = effect.actor ?? actor;
      if (effect.type === "applyStatus" && effect.status === "guard" && effect.to === "chosen") {
        const source = owners[at];
        if (source) ids.add(source.id);
      } else if (effect.type === "conditional") {
        walk(effect.then, at);
        walk(effect.else ?? [], at);
      }
    }
  };
  walk(effects, 0);
  return ids;
}
