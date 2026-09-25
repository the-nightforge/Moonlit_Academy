import { baseMoonPower } from "./moon-power";
import { nextRandom } from "./rng";
import { hasStatus } from "./statuses";
import type {
  CombatEvent,
  CombatState,
  EnemyIntentDef,
  GameData,
  HeroState,
  PlannedIntent,
  Targeting,
} from "./types/index";

function pickTarget(state: CombatState, candidates: HeroState[], targeting: Targeting): string {
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

/** Plans every living enemy's intent chain for `state.round` (`12` §4.2). */
export function planEnemyIntents(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const phaseId = data.moonPhases[state.moonIndex]!.id;
  const { maxIntentsPerRound, moonReserveMax, moonPower } = data.combatConfig;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const def = data.enemies[enemy.defId]!;
    const fund = baseMoonPower(def.moonPower, moonPower.perRound, state.round) + enemy.moonReserve;
    let left = fund;
    const chain: PlannedIntent[] = [];
    const override =
      (state.bloodMoonRounds > 0 ? def.bloodMoonOverride : undefined) ??
      def.moonOverrides?.find((entry) => entry.phase === phaseId)?.intent;
    if (override) chain.push({ intent: override, cost: 0, targetId: null });
    const top = def.intents.reduce((best, intent) => (intent.cost > best.cost ? intent : best));
    const used = new Set<string>();
    while (chain.length < maxIntentsPerRound) {
      const affordable = def.intents.filter((intent) => intent.cost <= left && !used.has(intent.id));
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
