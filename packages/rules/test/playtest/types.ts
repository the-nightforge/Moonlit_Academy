import type { BotMode } from "../../src/bot/observation";
import type { BotProfile } from "../../src/bot/policy";
import type {
  CombatSetup,
  CoopSide,
  PvpSide,
  RunSetup,
  StorySetup,
} from "../../src/index";

/**
 * One match's classified end. `truncated` means the cap cut a live match;
 * `error` means the engine rejected an action or setup — never silently
 * skipped, always recorded (`balance-gates` counts them in quality totals).
 */
export type MatchOutcome = "won" | "lost" | "draw" | "truncated" | "error";

export type ScenarioMode = BotMode | "run" | "story";
export type ScenarioLeg = "AB" | "BA" | "single";

/** createPvpCombat's setup shape, named here for manifests (`17` §4.1). */
export interface PvpSetup {
  seed: number;
  players: [PvpSide, PvpSide];
}

/** createCoopCombat's setup shape (`01` §16.1). */
export interface CoopSetup {
  seed: number;
  players: [CoopSide, CoopSide];
  encounterId: string;
}

/** The mode field narrows which member of the union a scenario carries. */
export type ScenarioSetup = CombatSetup | RunSetup | StorySetup | PvpSetup | CoopSetup;

/**
 * One match definition inside a paired block. `profiles`/`policySeeds`/
 * `beliefSeeds` are indexed by seat; AB/BA legs swap teams and profiles
 * together so seat-order effects are measured, not averaged away.
 */
export interface Scenario {
  id: string;
  mode: ScenarioMode;
  setup: ScenarioSetup;
  profiles: readonly BotProfile[];
  /** Per-seat decision seeds; decision n of seat s uses seed + n. */
  policySeeds: readonly number[];
  beliefSeeds: readonly number[];
  blockId: string;
  leg: ScenarioLeg;
}

/** What the records describe — synthetic sims today, human replays later. */
export interface Evidence {
  kind: "synthetic" | "human" | "mixed";
  note?: string;
}

/**
 * Immutable description of one experiment. Any hash change invalidates the
 * comparison: engineHash covers the rules sources, dataHash the GameData,
 * policyHash the profile set, poolHash the roster pool.
 */
export interface ExperimentManifest {
  schemaVersion: 1;
  id: string;
  /** "worktree" when not run from a committed checkout. */
  sourceRevision: string;
  engineHash: string;
  dataHash: string;
  policyHash: string;
  poolHash: string;
  stage: "screen" | "confirm";
  evidence: Evidence;
  scenarios: readonly Scenario[];
}

/** JSON experiment config — strict parse rejects unknown/invalid fields. */
export interface ExperimentConfig {
  schemaVersion: 1;
  id: string;
  stage: "screen" | "confirm";
  seedStart: number;
  blockCount: number;
  mode: ScenarioMode;
  poolPath: string;
  profilePath: string;
  /** Optional content restriction; default: every legal target for the mode. */
  encounterIds?: readonly string[];
  stageIds?: readonly string[];
}

/** One completed match. `winnerSeat`/`outcome` are recorded, not inferred. */
export interface MatchRecord {
  experimentId: string;
  scenarioId: string;
  blockId: string;
  leg: ScenarioLeg;
  outcome: MatchOutcome;
  /** Winning seat, or null on draw/loss/truncation/error. */
  winnerSeat: number | null;
  rounds: number;
  /** Player-side actions applied (engine-resolved steps don't count). */
  actions: number;
  /** Free-form counters: cardsPlayed, turnsEnded, firstPlayer, … */
  counters: Record<string, number>;
  /** sha256 over canonical action keys — two runs of the same seeds match. */
  traceHash: string;
  /** Canonical keys of every applied action — the replay sidecar payload. */
  traceKeys?: readonly string[];
  error: string | null;
}
