import { loadGameData } from "data";
import { createCombat, createRun } from "rules";
import type { CombatEvent, CombatState, GameData, RunState } from "rules";

export type Team = [string, string, string];

export const DEFAULT_TEAM: Team = ["m05", "f04", "m06"];

export interface CombatSession {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
  seed: number;
  encounterId: string;
  heroIds: Team;
  run: RunState | null;
}

export function newCombatSession(
  seed = 42,
  encounterId = "enc_01",
  heroIds: Team = DEFAULT_TEAM,
): CombatSession {
  const data = loadGameData();
  const { state, events } = createCombat(data, { heroIds, encounterId, seed });
  return { data, state, events, seed, encounterId, heroIds, run: null };
}

export const session: CombatSession = newCombatSession();

export function restartSession(
  seed = session.seed,
  encounterId = session.encounterId,
  heroIds: Team = session.heroIds,
): void {
  const fresh = newCombatSession(seed, encounterId, heroIds);
  session.seed = fresh.seed;
  session.encounterId = fresh.encounterId;
  session.heroIds = fresh.heroIds;
  session.state = fresh.state;
  session.run = null;
  session.events.push(...fresh.events);
}

/** Starts a roguelike run; combat state is taken from the run when a fight begins. */
export function startRun(heroIds: Team, seed = session.seed): void {
  session.heroIds = heroIds;
  session.seed = seed;
  session.run = createRun(session.data, { heroIds, seed }).run;
}

export function cycleEncounter(direction = 1): string {
  const ids = Object.keys(session.data.encounters);
  const index = ids.indexOf(session.encounterId);
  const next = ids[(index + direction + ids.length) % ids.length]!;
  restartSession(session.seed, next);
  return next;
}
