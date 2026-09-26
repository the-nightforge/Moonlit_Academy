import { checkCombatEnd, resolveEffects } from "./effects";
import { relicAt, weaponHooks } from "./gear";
import type {
  CardDef,
  CombatEvent,
  CombatState,
  GameData,
  HeroState,
  HookTrigger,
  MoonPhaseId,
  RunRelicActor,
  RunRelicHook,
  WeaponHook,
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

/** Whether `on` reacts to `trigger`; `wearer` filters need the weapon's wearer (`01` §14.3). */
function matches(on: HookTrigger, trigger: TriggerInstance, wearer?: HeroState): boolean {
  if (on.type !== trigger.type) return false;
  if (on.type === "cardPlayed" && trigger.type === "cardPlayed") {
    if (on.tag !== undefined && !trigger.card.tags.includes(on.tag)) return false;
    if (on.cardType !== undefined && trigger.card.type !== on.cardType) return false;
    if (on.owner === "wearer" && trigger.heroId !== wearer?.id) return false;
  }
  if (on.type === "enemyKilled" && trigger.type === "enemyKilled") {
    if (on.killer === "wearer" && trigger.killerId !== wearer?.id) return false;
  }
  if (on.type === "moonPhaseEntered" && trigger.type === "moonPhaseEntered") {
    if (on.phase !== undefined && on.phase !== trigger.phase) return false;
  }
  return true;
}

function pickActors(
  state: CombatState,
  actor: RunRelicActor | "wearer",
  trigger: TriggerInstance,
  wearer?: HeroState,
): HeroState[] {
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
    case "wearer":
      return wearer?.alive ? [wearer] : [];
    default: {
      const exhaustive: never = actor;
      throw new Error(`unknown relic actor ${String(exhaustive)}`);
    }
  }
}

function isOver(state: CombatState): boolean {
  return state.status === "won" || state.status === "lost";
}

/** One source of hooks: a run relic or augment, a moon relic, or a carried weapon. */
interface HookSource {
  keyPrefix: string;
  hooks: (RunRelicHook | WeaponHook)[];
  event: CombatEvent;
  wearer?: HeroState;
}

/** Hook sources in firing order (`01` §14.5); weapons of fallen wearers are left out. */
function hookSources(data: GameData, state: CombatState): HookSource[] {
  const sources: HookSource[] = state.runRelicIds.map((relicId) => ({
    keyPrefix: relicId,
    hooks: (data.runRelics[relicId] ?? data.augments[relicId])?.hooks ?? [],
    event: { type: "runRelicTriggered", runRelicId: relicId },
  }));
  for (const relic of state.relics) {
    const def = data.relics[relic.id];
    if (!def) continue;
    sources.push({
      keyPrefix: relic.id,
      hooks: relicAt(def, relic.resonance).hooks ?? [],
      event: { type: "relicTriggered", relicId: relic.id },
    });
  }
  for (const weapon of state.weapons) {
    const wearer = state.heroes.find((hero) => hero.defId === weapon.heroId);
    if (!wearer) continue;
    sources.push({
      keyPrefix: `${weapon.weaponId}@${weapon.heroId}`,
      hooks: weaponHooks(data, weapon),
      event: { type: "weaponTriggered", weaponId: weapon.weaponId, heroId: weapon.heroId },
      wearer,
    });
  }
  return sources;
}

/**
 * Runs every hook matching `trigger`: run relics and augments, then moon relics,
 * then weapons by wearer position; each in hook order (`01` §13, §14.5).
 */
export function runRelicHooks(
  data: GameData,
  state: CombatState,
  events: CombatEvent[],
  trigger: TriggerInstance,
): void {
  for (const source of hookSources(data, state)) {
    for (const [index, hook] of source.hooks.entries()) {
      if (isOver(state)) return;
      // A fallen wearer's weapon does nothing, and its counters stay put.
      if (source.wearer !== undefined && !source.wearer.alive) break;
      if (!matches(hook.on, trigger, source.wearer)) continue;
      const key = `${source.keyPrefix}#${index}`;
      const count = (state.runRelicCounters[key] ?? 0) + 1;
      state.runRelicCounters[key] = count;
      if (hook.every !== undefined && count % hook.every !== 0) continue;
      const actors = pickActors(state, hook.actor, trigger, source.wearer);
      if (actors.length === 0) continue;
      events.push(source.event);
      for (const actor of actors) {
        if (!actor.alive) continue;
        // noHooks: triggers raised inside hook effects never fire hooks (no recursion).
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
  if (state.runRelicIds.length === 0 && state.relics.length === 0 && state.weapons.length === 0) return;
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
