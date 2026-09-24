import { loadGameData } from "data";
import { createCombat } from "rules";
import type { CombatEvent, CombatState, GameData } from "rules";

export interface CombatSession {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
}

export function newCombatSession(seed = 42): CombatSession {
  const data = loadGameData();
  const { state, events } = createCombat(data, {
    heroIds: ["m05", "f04", "m06"],
    encounterId: "enc_01",
    seed,
  });
  return { data, state, events };
}

export const session: CombatSession = newCombatSession();
