import { checkCombatEnd, resolveEffects } from "../effects";
import { runRelicHooks } from "../run-relic-hooks";
import { cleanseDebuffs } from "../statuses";
import type {
  BossPhaseDef,
  CombatEvent,
  CombatState,
  EnemyDef,
  EnemyState,
  GameData,
} from "../types/index";

/** The phased boss of a co-op combat, or null (`01` §16.5). */
export function bossOf(state: CombatState): EnemyState | null {
  if (state.boss === undefined) return null;
  const enemy = state.enemies.find((entry) => entry.id === state.boss!.enemyId);
  return enemy ?? null;
}

/** The boss's current phase definition (undefined for non-phased enemies / PvE). */
export function bossPhaseOf(
  data: GameData,
  state: CombatState,
  enemy: EnemyState,
  def: EnemyDef,
): BossPhaseDef | undefined {
  if (state.boss?.enemyId !== enemy.id || def.phases === undefined) return undefined;
  return def.phases[state.boss.phase - 1];
}

/**
 * `01` §16.5 — checked after every effect (like level-ups): while the boss sits
 * at or below the next phase's `hpBelow`, enter it. A hit crossing several
 * thresholds walks the phases in order, running each `onEnter` in turn.
 */
export function checkBossPhase(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const boss = state.boss;
  if (boss === undefined) return;
  const enemy = bossOf(state);
  if (!enemy?.alive) return;
  const def = data.enemies[enemy.defId]!;
  const phases = def.phases;
  if (phases === undefined) return;
  while (boss.phase < phases.length) {
    const next = phases[boss.phase]!;
    if (enemy.hp > enemy.maxHp * next.hpBelow) break;
    boss.phase += 1;
    events.push({ type: "bossPhaseChanged", enemyId: enemy.id, phase: boss.phase });
    // Phase 2's Blood Moon is continuous while the phase is active (`01` §16.5).
    if (next.bloodMoonWhileActive === true && state.bloodMoonRounds === 0) {
      state.bloodMoonRounds = 1;
      events.push({ type: "bloodMoonChanged", rounds: 1, cause: "boss" });
      for (const seat of state.players) {
        runRelicHooks(data, state, events, { type: "bloodMoonStarted" }, seat.index);
      }
    }
    if (next.reviveAfterRounds !== undefined && !boss.revived) {
      boss.reviveCountdown = next.reviveAfterRounds;
    }
    if (next.onEnter !== undefined && next.onEnter.length > 0) {
      resolveEffects(data, state, next.onEnter, { source: enemy }, events);
    }
    if (checkCombatEnd(state, events)) return;
    // The phase change itself may have killed the boss via nested effects.
    if (!enemy.alive) return;
  }
}

/**
 * `01` §16.5 — the revive countdown ticks at each round's end. At zero (boss
 * still alive) it heals to 50%, sheds debuffs, and returns to the previous
 * phase — once. A boss killed while counting down is just dead.
 */
export function tickBossRevive(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const boss = state.boss;
  if (boss === undefined || boss.reviveCountdown === null) return;
  const enemy = bossOf(state);
  if (!enemy?.alive) return;
  boss.reviveCountdown -= 1;
  if (boss.reviveCountdown > 0) return;
  boss.reviveCountdown = null;
  boss.revived = true;
  const healed = Math.ceil(enemy.maxHp * 0.5) - enemy.hp;
  if (healed > 0) {
    enemy.hp += healed;
    events.push({ type: "healed", targetId: enemy.id, amount: healed });
  }
  cleanseDebuffs(enemy, events);
  const phases = data.enemies[enemy.defId]!.phases!;
  boss.phase = Math.max(1, phases.length - 1);
  events.push({ type: "bossPhaseChanged", enemyId: enemy.id, phase: boss.phase });
}
