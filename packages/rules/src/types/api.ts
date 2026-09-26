import type {
  CardDef, CombatConfig, EconomyConfig, EnemyDef, EncounterDef, HeroDef, KeywordDef, MetaConfig, MoonPhaseDef, RunAugmentDef, RunConfig, RunRelicDef,
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
  /** TFT-style augments ("Lõi") offered after every won combat. */
  augments: Record<string, RunAugmentDef>;
  runConfig: RunConfig;
  combatConfig: CombatConfig;
  keywords: Record<string, KeywordDef>;
  metaConfig: MetaConfig;
  economyConfig: EconomyConfig;
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
