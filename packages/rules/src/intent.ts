import { bossPhaseOf } from "./coop/boss";
import { decreeModifier } from "./moon";
import { baseMoonPower } from "./moon-power";
import { nextRandom } from "./rng";
import { hasStatus } from "./statuses";
import type {
  CombatEvent,
  CombatState,
  EnemyIntentDef,
  EnemyState,
  GameData,
  PlannedIntent,
  Targeting,
  UnitState,
} from "./types/index";

export function pickTarget(state: CombatState, candidates: UnitState[], targeting: Targeting): string {
  switch (targeting) {
    case "random": {
      const roll = nextRandom(state.rngState);
      state.rngState = roll.rngState;
      return candidates[Math.floor(roll.value * candidates.length)]!.id;
    }
    case "lowestHp": {
      let best = candidates[0]!;
      for (const hero of candidates) {
        if (hero.hp < best.hp) best = hero;
      }
      return best.id;
    }
    case "highestHp": {
      let best = candidates[0]!;
      for (const hero of candidates) {
        if (hero.hp > best.hp) best = hero;
      }
      return best.id;
    }
    case "front":
      return candidates[0]!.id;
  }
}

export function chooseHeroTarget(state: CombatState, targeting: Targeting): string | null {
  const candidates = state.heroes.filter((hero) => hero.alive && !hasStatus(hero, "stealth"));
  if (candidates.length === 0) return null;
  return pickTarget(state, candidates, targeting);
}

function weightedPick(state: CombatState, intents: EnemyIntentDef[]): EnemyIntentDef {
  if (intents.length === 1) return intents[0]!;
  const total = intents.reduce((sum, intent) => sum + intent.cost + 1, 0);
  const roll = nextRandom(state.rngState);
  state.rngState = roll.rngState;
  let cursor = roll.value * total;
  for (const intent of intents) {
    cursor -= intent.cost + 1;
    if (cursor < 0) return intent;
  }
  return intents[intents.length - 1]!;
}

/** Tỏa Nguyệt: shrink an enemy's planned fund, cancelling intents from the chain's end (`01` §9.5). */
export function drainEnemyMoonPower(
  data: GameData,
  enemy: EnemyState,
  amount: number,
  events: CombatEvent[],
): number {
  const drained = Math.min(amount, enemy.moonPower);
  enemy.moonPower -= drained;
  const planned = () => enemy.plannedIntents.reduce((sum, entry) => sum + entry.cost, 0);
  const cancelled: string[] = [];
  while (enemy.plannedIntents.length > 0 && planned() > enemy.moonPower) {
    cancelled.push(enemy.plannedIntents.pop()!.intent.id);
  }
  if (cancelled.length > 0) {
    events.push({ type: "intentsCancelled", enemyId: enemy.id, intentIds: cancelled });
  }
  const reserve = Math.min(data.combatConfig.moonReserveMax, enemy.moonPower - planned());
  if (reserve !== enemy.moonReserve) {
    enemy.moonReserve = reserve;
    events.push({ type: "moonReserveChanged", side: "enemy", enemyId: enemy.id, value: reserve });
  }
  return drained;
}

/** Plans every living enemy's intent chain for `state.round` (`12` §4.2). */
export function planEnemyIntents(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const phaseId = data.moonPhases[state.moonIndex]!.id;
  const { maxIntentsPerRound, moonReserveMax, moonPower } = data.combatConfig;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const def = data.enemies[enemy.defId]!;
    // Co-op boss: the current phase supplies the intent pool and chain cap (`01` §16.5).
    const phase = bossPhaseOf(data, state, enemy, def);
    const intents = phase?.intents ?? def.intents;
    const maxIntents = phase?.maxIntentsPerRound ?? maxIntentsPerRound;
    // Nguyệt Sinh (`01` §9.2): the decree adds to the fund at plan time.
    const fund =
      baseMoonPower(def.moonPower, moonPower.perRound, state.round) + enemy.moonReserve +
      (decreeModifier(data, state, "turnMoonPowerBonus")?.amount ?? 0);
    let left = fund;
    const chain: PlannedIntent[] = [];
    // Huyết Nguyệt replaces the phase wholesale (`01` §7.4): only the blood
    // override leads — a moon override is a phase trait, and the phase is off.
    const override =
      state.bloodMoonRounds > 0
        ? def.bloodMoonOverride
        : def.moonOverrides?.find((entry) => entry.phase === phaseId)?.intent;
    if (override) chain.push({ intent: override, cost: 0, targetId: null });
    const used = new Set<string>();
    // `alwaysPlan` intents lead the chain while the fund covers them (`01` §16.5).
    for (const intent of intents) {
      if (chain.length >= maxIntents) break;
      if (!intent.alwaysPlan || used.has(intent.id) || intent.cost > left) continue;
      chain.push({ intent, cost: intent.cost, targetId: null });
      used.add(intent.id);
      left -= intent.cost;
    }
    const top = intents.reduce((best, intent) => (intent.cost > best.cost ? intent : best));
    while (chain.length < maxIntents) {
      const affordable = intents.filter((intent) => intent.cost <= left && !used.has(intent.id));
      if (affordable.length === 0) break;
      const pick =
        affordable.includes(top) && !enemy.lastIntentIds.includes(top.id)
          ? top
          : weightedPick(state, affordable);
      chain.push({ intent: pick, cost: pick.cost, targetId: null });
      used.add(pick.id);
      left -= pick.cost;
    }
    for (const planned of chain) {
      planned.targetId =
        planned.intent.targeting !== undefined ? chooseHeroTarget(state, planned.intent.targeting) : null;
    }
    enemy.plannedIntents = chain;
    enemy.moonPower = fund;
    enemy.moonReserve = Math.min(moonReserveMax, left);
    events.push({
      type: "intentsRevealed",
      enemyId: enemy.id,
      moonPower: fund,
      intents: chain.map((planned) => ({
        intentId: planned.intent.id,
        cost: planned.cost,
        targetId: planned.targetId,
      })),
    });
  }
}
