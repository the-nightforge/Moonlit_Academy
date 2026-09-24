import { loadGameData } from "data";
import { createCombat } from "rules";
import type { CombatEvent, CombatState, GameData } from "rules";

export type Team = [string, string, string];

export const DEFAULT_TEAM: Team = ["m05", "f04", "m06"];

export interface CombatSession {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
  seed: number;
  encounterId: string;
  heroIds: Team;
}

export function newCombatSession(
  seed = 42,
  encounterId = "enc_01",
  heroIds: Team = DEFAULT_TEAM,
): CombatSession {
  const data = loadGameData();
  const { state, events } = createCombat(data, { heroIds, encounterId, seed });
  return { data, state, events, seed, encounterId, heroIds };
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
  session.events.push(...fresh.events);
}

export function cycleEncounter(direction = 1): string {
  const ids = Object.keys(session.data.encounters);
  const index = ids.indexOf(session.encounterId);
  const next = ids[(index + direction + ids.length) % ids.length]!;
  restartSession(session.seed, next);
  return next;
}
