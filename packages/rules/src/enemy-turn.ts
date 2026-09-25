import { checkCombatEnd, resolveEffects, tickUnitStatuses } from "./effects";
import { chooseHeroTarget } from "./intent";
import { fireEventHooks } from "./run-relic-hooks";
import { hasStatus, removeStatus } from "./statuses";
import type { CombatEvent, CombatState, GameData, Targeting } from "./types/index";

export function reresolveTarget(
  state: CombatState,
  announcedTargetId: string | null,
  targeting: Targeting,
): string | null {
  const taunter = state.heroes.find((hero) => hero.alive && hasStatus(hero, "taunt"));
  if (taunter) return taunter.id;
  const announced = state.heroes.find((hero) => hero.id === announcedTargetId);
  if (announced?.alive && !hasStatus(announced, "stealth")) return announced.id;
  return chooseHeroTarget(state, targeting);
}

export function runEnemyTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  state.status = "enemyTurn";
  events.push({ type: "turnStarted", side: "enemy", round: state.round });
  for (const enemy of state.enemies) {
    if (enemy.armor > 0) {
      enemy.armor = 0;
      events.push({ type: "armorRemoved", targetId: enemy.id });
    }
    removeStatus(enemy, "reflect", events);
  }
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const start = events.length;
    tickUnitStatuses(data, state, enemy, events);
    if (checkCombatEnd(state, events)) return;
    fireEventHooks(data, state, events, start, state.bloodMoonRounds);
    if (checkCombatEnd(state, events)) return;
  }
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.lastIntentIds = enemy.plannedIntents.map((planned) => planned.intent.id);
    if (hasStatus(enemy, "freeze")) {
      events.push({ type: "intentSkipped", enemyId: enemy.id, reason: "freeze" });
      removeStatus(enemy, "freeze", events);
      if (enemy.moonReserve !== 0) {
        enemy.moonReserve = 0;
        events.push({ type: "moonReserveChanged", side: "enemy", enemyId: enemy.id, value: 0 });
      }
      continue;
    }
    for (const planned of enemy.plannedIntents) {
      if (!enemy.alive) break;
      const intent = planned.intent;
      let targetId: string | null = null;
      if (intent.targeting !== undefined) {
        targetId = reresolveTarget(state, planned.targetId, intent.targeting);
        if (targetId === null) {
          events.push({ type: "intentFizzled", enemyId: enemy.id, intentId: intent.id });
          continue;
        }
      }
      events.push({ type: "intentExecuted", enemyId: enemy.id, intentId: intent.id, targetId });
      resolveEffects(
        data,
        state,
        intent.effects,
        {
          source: enemy,
          intentKind: intent.kind,
          ...(targetId !== null ? { chosenId: targetId } : {}),
        },
        events,
      );
      if (state.status !== "enemyTurn") return;
    }
  }
}
