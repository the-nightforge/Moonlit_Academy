import { computeDamageAmount, type EffectContext } from "./effects";
import { reresolveTarget } from "./enemy-turn";
import { hasStatus } from "./statuses";
import type {
  CombatState,
  EnemyState,
  GameData,
  UnitState,
} from "./types/index";

export interface IntentDamagePreview {
  targetId: string;
  amount: number;
  hits: number;
}

export interface IntentPreview {
  targetId: string | null;
  skipped: boolean;
  fizzles: boolean;
  damages: IntentDamagePreview[];
}

export function previewEnemyIntent(
  data: GameData,
  state: CombatState,
  enemy: EnemyState,
): IntentPreview | null {
  const current = enemy.currentIntent;
  if (!current || !enemy.alive) return null;
  const intent = current.intent;
  const skipped = hasStatus(enemy, "freeze");

  let targetId: string | null = null;
  let fizzles = false;
  if (intent.targeting !== undefined) {
    const previewState = { ...state };
    targetId = reresolveTarget(previewState, current.targetId, intent.targeting);
    fizzles = targetId === null;
  }

  const ctx: EffectContext = {
    source: enemy,
    intentKind: intent.kind,
    ...(targetId !== null ? { chosenId: targetId } : {}),
  };
  const damages: IntentDamagePreview[] = [];
  for (const effect of intent.effects) {
    if (effect.type !== "damage") continue;
    let targets: UnitState[] = [];
    if (effect.to === "chosen") {
      const target = [...state.heroes, ...state.enemies].find(
        (unit) => unit.id === targetId,
      );
      targets = target?.alive ? [target] : [];
    } else if (effect.to === "allEnemies") {
      targets = state.heroes.filter((hero) => hero.alive);
    } else if (effect.to === "self") {
      targets = [enemy];
    } else {
      targets = state.enemies.filter((foe) => foe.alive);
    }
    for (const target of targets) {
      damages.push({
        targetId: target.id,
        amount: computeDamageAmount(data, state, ctx, target, effect.amount),
        hits: effect.hits ?? 1,
      });
    }
  }
  return { targetId, skipped, fizzles, damages };
}
