import { cardDefOf } from "./gear";
import { levelUpPassive } from "./levelup";
import { cardOwners, getEffectiveCost, getValidTargets, isCardPlayable } from "./queries";
import type { Action, CombatState, Effect, GameData, HeroState, UnitState } from "./types/index";

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
  const ordered = [...candidates].sort((a, b) => {
    const comboA = keywordsOf(a).includes("lien_hoan") ? 1 : 0;
    const comboB = keywordsOf(b).includes("lien_hoan") ? 1 : 0;
    if (comboA !== comboB) return comboA - comboB; // non-combo cards first
    return getEffectiveCost(data, state, b) - getEffectiveCost(data, state, a);
  });
  const unitOf = (id: string) =>
    state.heroes.find((hero) => hero.id === id) ?? state.enemies.find((enemy) => enemy.id === id);
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
    // Đổi Vận: only land on a phase that helps the hand — unless the card still
    // feeds an unleveled `moonShifts` counter.
    if (hasShiftMoon(card.effects)) {
      const leveling = owners.some(
        (hero) =>
          hero?.alive === true &&
          !hero.leveledUp &&
          data.heroes[hero.defId]?.levelUp.counter === "moonShifts",
      );
      if (!leveling && !shiftTotals(card.effects).some((shift) => landingScore(shift) > 0)) continue;
    }
    if (card.target === "none") return { type: "playCard", instanceId };
    const targets = getValidTargets(data, state, instanceId);
    let targetId: string | undefined;
    if (card.target === "enemy") {
      const drains = keywordsOf(instanceId).some((k) => k === "toa_nguyet" || k === "doat_nguyet");
      // PvE drains hit the enemy planning the priciest chain; PvP drains hit the
      // seat holding the bigger reserve (`17` §4.5).
      const threat = (id: string) => {
        const unit = unitOf(id)!;
        return unit.side === "enemy"
          ? state.enemies.find((e) => e.id === id)!.plannedIntents.reduce((s, p) => s + p.cost, 0)
          : (state.players.find((p) => p.index === (unit as { player: number }).player)?.moonReserve ?? 0);
      };
      const hp = (id: string) => unitOf(id)!.hp;
      targetId = [...targets].sort((a, b) => (drains ? threat(b) - threat(a) : hp(a) - hp(b)))[0];
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

/** Any `shiftMoon` anywhere in the effect tree (nested `conditional` branches count). */
function hasShiftMoon(effects: Effect[]): boolean {
  return effects.some(
    (effect) =>
      effect.type === "shiftMoon" ||
      (effect.type === "conditional" &&
        (hasShiftMoon(effect.then) || hasShiftMoon(effect.else ?? []))),
  );
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
