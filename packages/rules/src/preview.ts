import { computeDamageAmount, type EffectContext } from "./effects";
import { charmTargetOf, guardianOf, reresolveTarget } from "./enemy-turn";
import { baseMoonPower } from "./moon-power";
import { summonsOf } from "./players";
import { hasStatus } from "./statuses";
import type {
  CombatState,
  EnemyState,
  GameData,
  PlannedIntent,
  UnitState,
} from "./types/index";

export interface IntentDamagePreview {
  targetId: string;
  amount: number;
  hits: number;
}

export interface IntentPreview {
  intentId: string;
  cost: number;
  targetId: string | null;
  fizzles: boolean;
  damages: IntentDamagePreview[];
}

export interface EnemyPlanPreview {
  skipped: boolean;
  intents: IntentPreview[];
  /** Fund the enemy plans with next round: base of round + 1 plus its current reserve. */
  nextRoundMoonPower: number;
}

function previewIntent(
  data: GameData,
  state: CombatState,
  enemy: EnemyState,
  planned: PlannedIntent,
): IntentPreview {
  const intent = planned.intent;
  let targetId: string | null = null;
  let fizzles = false;
  if (intent.targeting !== undefined) {
    if (hasStatus(enemy, "charm")) {
      // Mê Hoặc: the intent turns on a fellow enemy (`01` §9.3.1).
      targetId = charmTargetOf(state, enemy)?.id ?? null;
    } else {
      targetId = reresolveTarget({ ...state }, planned.targetId, intent.targeting);
      if (targetId !== null) targetId = guardianOf(state, targetId)?.id ?? targetId;
    }
    fizzles = targetId === null;
  }
  const ctx: EffectContext = {
    source: enemy,
    intentKind: intent.kind,
    ...(targetId !== null ? { chosenId: targetId } : {}),
  };
  const damages: IntentDamagePreview[] = [];
  for (const effect of intent.effects) {
    if (effect.type !== "damage" && effect.type !== "missingHpDamage") continue;
    const base =
      effect.type === "damage"
        ? effect.amount
        : Math.floor((enemy.maxHp - enemy.hp) * effect.ratio);
    let targets: UnitState[] = [];
    if (effect.to === "chosen") {
      const target = [...state.heroes, ...summonsOf(state), ...state.enemies].find((unit) => unit.id === targetId);
      targets = target?.alive ? [target] : [];
    } else if (effect.to === "allEnemies") {
      targets = [...state.heroes, ...summonsOf(state)].filter((unit) => unit.alive);
    } else if (effect.to === "self") {
      targets = [enemy];
    } else {
      targets = state.enemies.filter((foe) => foe.alive);
    }
    for (const target of targets) {
      damages.push({
        targetId: target.id,
        // `consume: false` — a preview computes the Tập Kích bonus without
        // spending the side's first-hit key (`01` §7.5).
        amount: computeDamageAmount(data, state, ctx, target, base, false),
        hits: effect.hits ?? 1,
      });
    }
  }
  return { intentId: intent.id, cost: planned.cost, targetId, fizzles, damages };
}

/** The announced chain as the player will see it; never consumes RNG. */
export function previewEnemyIntent(
  data: GameData,
  state: CombatState,
  enemy: EnemyState,
): EnemyPlanPreview | null {
  if (!enemy.alive) return null;
  return {
    skipped: hasStatus(enemy, "freeze"),
    intents: enemy.plannedIntents.map((planned) => previewIntent(data, state, enemy, planned)),
    nextRoundMoonPower:
      baseMoonPower(data.enemies[enemy.defId]!.moonPower, data.combatConfig.moonPower.perRound, state.round + 1) +
      enemy.moonReserve,
  };
}
