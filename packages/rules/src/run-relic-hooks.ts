import { checkCombatEnd, resolveEffects } from "./effects";
import type {
  CardDef,
  CombatEvent,
  CombatState,
  GameData,
  HeroState,
  HookTrigger,
  MoonPhaseId,
  RunRelicActor,
} from "./types/index";

/** A concrete occurrence that run relic hooks may react to. */
export type TriggerInstance =
  | { type: "combatStart" }
  | { type: "playerTurnStart" }
  | { type: "playerTurnEnd" }
  | { type: "cardPlayed"; card: CardDef; heroId: string }
  | { type: "enemyKilled"; killerId?: string }
  | { type: "heroDied" }
  | { type: "moonPhaseEntered"; phase: MoonPhaseId }
  | { type: "bloodMoonStarted" };

function matches(on: HookTrigger, trigger: TriggerInstance): boolean {
  if (on.type !== trigger.type) return false;
  if (on.type === "cardPlayed" && trigger.type === "cardPlayed") {
    if (on.tag !== undefined && !trigger.card.tags.includes(on.tag)) return false;
    if (on.cardType !== undefined && trigger.card.type !== on.cardType) return false;
  }
  if (on.type === "moonPhaseEntered" && trigger.type === "moonPhaseEntered") {
    if (on.phase !== undefined && on.phase !== trigger.phase) return false;
  }
  return true;
}

function pickActors(state: CombatState, actor: RunRelicActor, trigger: TriggerInstance): HeroState[] {
  const living = state.heroes.filter((hero) => hero.alive);
  switch (actor) {
    case "trigger": {
      const heroId =
        trigger.type === "cardPlayed"
          ? trigger.heroId
          : trigger.type === "enemyKilled"
            ? trigger.killerId
            : undefined;
      const hero = living.find((h) => h.id === heroId);
      return hero ? [hero] : [];
    }
    case "each":
      return living;
    case "front":
      return living.slice(0, 1);
    case "lowestHp":
      return living.length === 0
        ? []
        : [living.reduce((best, h) => (h.hp < best.hp ? h : best))];
    default: {
      const exhaustive: never = actor;
      throw new Error(`unknown relic actor ${String(exhaustive)}`);
    }
  }
}

function isOver(state: CombatState): boolean {
  return state.status === "won" || state.status === "lost";
}

/** Runs every held relic hook matching `trigger`, in acquisition then hook order (`01` §13). */
export function runRelicHooks(
  data: GameData,
  state: CombatState,
  events: CombatEvent[],
  trigger: TriggerInstance,
): void {
  for (const relicId of state.runRelicIds) {
    const hooks = (data.runRelics[relicId] ?? data.augments[relicId])?.hooks ?? [];
    for (const [index, hook] of hooks.entries()) {
      if (isOver(state)) return;
      if (!matches(hook.on, trigger)) continue;
      const key = `${relicId}#${index}`;
      const count = (state.runRelicCounters[key] ?? 0) + 1;
      state.runRelicCounters[key] = count;
      if (hook.every !== undefined && count % hook.every !== 0) continue;
      const actors = pickActors(state, hook.actor, trigger);
      if (actors.length === 0) continue;
      events.push({ type: "runRelicTriggered", runRelicId: relicId });
      for (const actor of actors) {
        if (!actor.alive) continue;
        // noHooks: triggers raised inside relic effects never fire hooks (no recursion).
        resolveEffects(data, state, hook.effects, { source: actor, noHooks: true }, events);
        if (checkCombatEnd(state, events)) return;
      }
    }
  }
}

/**
 * Fires enemyKilled / heroDied / moonPhaseEntered for events[from..], then
 * bloodMoonStarted if blood moon went from 0 to active.
 */
export function fireEventHooks(
  data: GameData,
  state: CombatState,
  events: CombatEvent[],
  from: number,
  bloodMoonBefore: number,
): void {
  if (state.runRelicIds.length === 0) return;
  // Sampled before any hook effects below run: bloodMoonStarted only reacts to
  // the scanned effect's own 0→active transition, never a relic-internal one.
  const bloodMoonAfter = state.bloodMoonRounds;
  for (const event of events.slice(from)) {
    if (isOver(state)) return;
    if (event.type === "unitDied") {
      const isEnemy = state.enemies.some((enemy) => enemy.id === event.unitId);
      runRelicHooks(
        data,
        state,
        events,
        isEnemy ? { type: "enemyKilled", killerId: event.killerId } : { type: "heroDied" },
      );
    } else if (event.type === "moonShifted") {
      runRelicHooks(data, state, events, {
        type: "moonPhaseEntered",
        phase: data.moonPhases[event.to]!.id,
      });
    }
  }
  if (!isOver(state) && bloodMoonBefore === 0 && bloodMoonAfter > 0) {
    runRelicHooks(data, state, events, { type: "bloodMoonStarted" });
  }
}
