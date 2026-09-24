import type { CardDef, EnemyDef, EncounterDef, HeroDef, MoonPhaseDef } from "./static";
import type { CombatState } from "./state";
import type { CombatEvent } from "./events";

export interface GameData {
  heroes: Record<string, HeroDef>;
  cards: Record<string, CardDef>;
  enemies: Record<string, EnemyDef>;
  encounters: Record<string, EncounterDef>;
  moonPhases: MoonPhaseDef[];
}

export interface CombatSetup {
  heroIds: [string, string, string];
  encounterId: string;
  seed: number;
}

export type ActionResult =
  | { ok: true; state: CombatState; events: CombatEvent[] }
  | { ok: false; error: string };
