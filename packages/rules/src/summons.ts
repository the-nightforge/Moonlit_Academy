import { resolveEffects } from "./effects";
import { pickTarget } from "./intent";
import { bumpCounter, levelUpPassive } from "./levelup";
import { opponentsOf, prefixedId, seatTag, summonsOf } from "./players";
import { applyStatus, hasStatus } from "./statuses";
import type { CombatEvent, CombatState, GameData, HeroState, SummonState, UnitState } from "./types/index";

export function isSummon(unit: UnitState): unit is SummonState {
  return "summonId" in unit;
}

export function ownerOf(state: CombatState, summon: SummonState): HeroState | undefined {
  return state.heroes.find((hero) => hero.id === summon.ownerHeroId);
}

/** The living Linh Thú of hero `heroId`, if any. */
export function summonOf(state: CombatState, heroId: string): SummonState | undefined {
  return summonsOf(state).find((summon) => summon.ownerHeroId === heroId && summon.alive);
}

/** The def a hero's Linh Thú uses: awakened while the owner's passive is `awakenSummons` (`01` §17). */
function summonDefIdFor(data: GameData, owner: HeroState, summonId: string): string {
  const awakened = data.summons[summonId]?.awakenedId;
  const passive = owner.alive && owner.leveledUp ? levelUpPassive(data, owner) : undefined;
  return awakened !== undefined && passive?.type === "awakenSummons" ? awakened : summonId;
}

/** Effect `summon` (`01` §17): create, or heal to full and add Sức Mạnh 1. */
export function summonEffect(data: GameData, state: CombatState, hero: HeroState, summonId: string, events: CombatEvent[]): void {
  bumpCounter(data, hero, "summonsMade", 1);
  let summon = summonOf(state, hero.id);
  if (summon) {
    const healed = summon.maxHp - summon.hp;
    if (healed > 0) {
      summon.hp = summon.maxHp;
      events.push({ type: "healed", targetId: summon.id, amount: healed });
    }
    applyStatus(summon, "strength", 1, hero.id, events);
  } else {
    const defId = summonDefIdFor(data, hero, summonId);
    const def = data.summons[defId]!;
    summon = {
      id: prefixedId(state, hero.player, `summon:${hero.defId}`),
      defId,
      summonId: defId,
      side: "hero",
      player: hero.player,
      ownerHeroId: hero.id,
      position: hero.position,
      hp: def.maxHp,
      maxHp: def.maxHp,
      armor: 0,
      statuses: [],
      alive: true,
    };
    // A dead summon of the same hero leaves the board for good.
    state.summons = [...summonsOf(state).filter((s) => s.ownerHeroId !== hero.id), summon];
    events.push({ type: "summoned", unitId: summon.id, summonId: defId, ownerHeroId: hero.id, ...seatTag(state, hero.player) });
  }
  const passive = hero.leveledUp ? levelUpPassive(data, hero) : undefined;
  if (passive?.type === "summonTaunts") {
    const factor = state.mode === "pvp" ? 2 : 1;
    applyStatus(summon, "taunt", passive.rounds * factor, hero.id, events);
  }
}

/** §3.3: each living Linh Thú of `seats` acts, in owner position order (`01` §17). */
export function runSummonActions(data: GameData, state: CombatState, seats: number[], events: CombatEvent[]): void {
  for (const seat of seats) {
    const acting = summonsOf(state)
      .filter((summon) => summon.player === seat)
      .sort((a, b) => a.position - b.position);
    for (const summon of acting) {
      if (!summon.alive) continue;
      const def = data.summons[summon.summonId]!;
      const candidates = opponentsOf(state, summon).filter((unit) => unit.alive && !hasStatus(unit, "stealth"));
      const chosenId = candidates.length > 0 ? pickTarget(state, candidates, def.targeting) : undefined;
      events.push({ type: "summonActed", unitId: summon.id });
      resolveEffects(data, state, def.action, { source: summon, summonAction: true, ...(chosenId ? { chosenId } : {}) }, events);
      if (state.status === "won" || state.status === "lost") return;
    }
  }
}
