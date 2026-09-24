import { loadGameData } from "data";
import { createCombat } from "rules";
import type { CombatEvent, CombatState, GameData } from "rules";

export interface CombatSession {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
  seed: number;
  encounterId: string;
}

export function newCombatSession(seed = 42, encounterId = "enc_01"): CombatSession {
  const data = loadGameData();
  const { state, events } = createCombat(data, {
    heroIds: ["m05", "f04", "m06"],
    encounterId,
    seed,
  });
  return { data, state, events, seed, encounterId };
}

export const session: CombatSession = newCombatSession();

export function restartSession(seed = session.seed, encounterId = session.encounterId): void {
  const fresh = newCombatSession(seed, encounterId);
  session.seed = fresh.seed;
  session.encounterId = fresh.encounterId;
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
