import type {
  CardDef, CombatConfig, EnemyDef, EncounterDef, HeroDef, KeywordDef, MoonPhaseDef, RunConfig, RunRelicDef,
} from "./static";
import type { CombatState } from "./state";
import type { CombatEvent } from "./events";

export interface GameData {
  heroes: Record<string, HeroDef>;
  cards: Record<string, CardDef>;
  enemies: Record<string, EnemyDef>;
  encounters: Record<string, EncounterDef>;
  moonPhases: MoonPhaseDef[];
  runRelics: Record<string, RunRelicDef>;
  runConfig: RunConfig;
  combatConfig: CombatConfig;
  keywords: Record<string, KeywordDef>;
}

export interface CombatSetup {
  heroIds: [string, string, string];
  encounterId: string;
  seed: number;
  /** Default: the three heroes' `cardIds`. Each card's owner must be in the team. */
  deckCardIds?: string[];
  /** Default: every hero at full HP. */
  heroes?: { hp: number; maxHp: number }[];
  runRelicIds?: string[];
}

export type ActionResult =
  | { ok: true; state: CombatState; events: CombatEvent[] }
  | { ok: false; error: string };
