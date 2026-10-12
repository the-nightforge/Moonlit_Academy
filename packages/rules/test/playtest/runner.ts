import type {
  Action,
  CombatEvent,
  CombatState,
  GameData,
  RunAction,
  RunState,
} from "../../src/index";
import {
  applyAction,
  applyRunAction,
  coopRedactEvents,
  createCombat,
  createCoopCombat,
  createPvpCombat,
  createRun,
  createStoryCombat,
  makeBotObservation,
  redactEvents,
} from "../../src/index";
import type { BotContext, BotProfile } from "../../src/bot/policy";
import { chooseBotAction } from "../../src/bot/policy";
import { chooseRunAction } from "../../src/bot/run-policy";
import { canonicalActionKey } from "../../src/bot/actions";
import { sha256Hex } from "./manifest";
import type {
  CoopSetup,
  ExperimentManifest,
  MatchOutcome,
  MatchRecord,
  PvpSetup,
  Scenario,
  ScenarioLeg,
} from "./types";
import type { CombatSetup, StorySetup, RunSetup } from "../../src/index";

/** Spec caps — combat 60 rounds / 4000 applied actions, runs 20000 actions. */
export const DEFAULT_CAPS = {
  maxRounds: 60,
  maxActions: 4000,
  maxRunActions: 20000,
} as const;
export interface RunnerCaps {
  maxRounds: number;
  maxActions: number;
  maxRunActions: number;
}

/** Identity of one record for resume/checkpoint bookkeeping. */
export function recordKey(
  record: Pick<MatchRecord, "experimentId" | "scenarioId" | "blockId" | "leg">,
): string {
  return `${record.experimentId}|${record.scenarioId}|${record.blockId}|${record.leg}`;
}

interface Drive {
  outcome: MatchOutcome | null;
  winnerSeat: number | null;
  actions: number;
  lastRound: number;
  trace: string[];
  counters: Record<string, number>;
  error: string | null;
}

const newDrive = (): Drive => ({
  outcome: null,
  winnerSeat: null,
  actions: 0,
  lastRound: 0,
  trace: [],
  counters: {},
  error: null,
});

/** Applies one action; counts it + trace key; tallies events. null on rejection. */
function applyCounted(
  data: GameData,
  drive: Drive,
  state: CombatState,
  action: Action,
): { state: CombatState; events: CombatEvent[] } | null {
  const result = applyAction(data, state, action);
  if (!result.ok) {
    drive.outcome = "error";
    drive.error = `action ${action.type} rejected: ${result.error}`;
    return null;
  }
  drive.actions += 1;
  drive.trace.push(canonicalActionKey(action));
  for (const event of result.events) {
    if (event.type === "cardPlayed") {
      drive.counters.cardsPlayed = (drive.counters.cardsPlayed ?? 0) + 1;
      const card = state.cards[event.instanceId];
      if (card) {
        drive.counters[`card:${card.cardId}`] = (drive.counters[`card:${card.cardId}`] ?? 0) + 1;
      }
    } else if (event.type === "damageDealt") {
      drive.counters.damageDealt = (drive.counters.damageDealt ?? 0) + event.amount;
    }
  }
  return result;
}

function context(scenario: Scenario, seat: number, step: number): BotContext {
  return {
    policySeed: (scenario.policySeeds[seat] ?? 0) + step,
    beliefSeed: (scenario.beliefSeeds[seat] ?? 0) + step,
  };
}

const seatProfile = (scenario: Scenario, seat: number): BotProfile =>
  scenario.profiles[seat] ?? scenario.profiles[0]!;

const terminal = (state: CombatState) => state.status === "won" || state.status === "lost";

function decide(
  data: GameData,
  drive: Drive,
  state: CombatState,
  scenario: Scenario,
  seat: number,
  mode: "pve" | "pvp" | "coop",
  history: readonly CombatEvent[],
  ownDeckCardIds: readonly string[],
  step: number,
): { state: CombatState; events: CombatEvent[] } | null {
  const obs = makeBotObservation(data, state, seat, mode, history, ownDeckCardIds);
  const decision = chooseBotAction(data, obs, seatProfile(scenario, seat), context(scenario, seat, step));
  if (decision === null) {
    drive.outcome = "error";
    drive.error = `seat ${seat}: no legal action`;
    return null;
  }
  return applyCounted(data, drive, state, decision.action);
}

// --- Mode drivers -------------------------------------------------------------

function driveSingleSeat(
  data: GameData,
  drive: Drive,
  state: CombatState,
  scenario: Scenario,
  deckCardIds: readonly string[],
  caps: RunnerCaps,
): void {
  const history: CombatEvent[] = [];
  let step = 0;
  while (drive.outcome === null) {
    drive.lastRound = state.round;
    if (terminal(state)) {
      drive.outcome = state.status === "won" ? "won" : "lost";
      drive.winnerSeat = state.status === "won" ? 0 : null;
      break;
    }
    if (state.round > caps.maxRounds || drive.actions >= caps.maxActions) {
      drive.outcome = "truncated";
      break;
    }
    const applied = decide(data, drive, state, scenario, 0, "pve", history, deckCardIds, step);
    if (applied === null) break;
    history.push(...applied.events);
    state = applied.state;
    step += 1;
  }
}

function drivePvp(
  data: GameData,
  drive: Drive,
  state: CombatState,
  scenario: Scenario,
  setup: PvpSetup,
  caps: RunnerCaps,
): void {
  const history: [CombatEvent[], CombatEvent[]] = [[], []];
  let step = 0;
  while (drive.outcome === null) {
    drive.lastRound = state.round;
    if (terminal(state)) {
      drive.outcome = state.winner === "draw" ? "draw" : state.winner === 0 ? "won" : "lost";
      drive.winnerSeat = typeof state.winner === "number" ? state.winner : null;
      break;
    }
    if (state.round > caps.maxRounds || drive.actions >= caps.maxActions) {
      drive.outcome = "truncated";
      break;
    }
    const seat =
      state.status === "mulligan"
        ? state.players.find((player) => !player.mulliganDone)!.index
        : state.activePlayer;
    const side = setup.players[seat]!;
    const own = side.deckCardIds ?? side.heroIds.flatMap((id) => data.heroes[id]!.cardIds);
    const applied = decide(data, drive, state, scenario, seat, "pvp", history[seat]!, own, step);
    if (applied === null) break;
    // Per-seat feeds get the same redaction the client receives.
    for (const s of [0, 1] as const) history[s].push(...redactEvents(applied.events, s));
    state = applied.state;
    step += 1;
  }
  drive.counters.firstPlayer = state.firstPlayer ?? -1;
}

function driveCoop(
  data: GameData,
  drive: Drive,
  state: CombatState,
  scenario: Scenario,
  setup: CoopSetup,
  caps: RunnerCaps,
): void {
  const history: [CombatEvent[], CombatEvent[]] = [[], []];
  let step = 0;
  while (drive.outcome === null) {
    drive.lastRound = state.round;
    if (terminal(state)) {
      drive.outcome = state.status === "won" ? "won" : "lost";
      drive.winnerSeat = state.status === "won" ? 0 : null;
      break;
    }
    if (state.round > caps.maxRounds || drive.actions >= caps.maxActions) {
      drive.outcome = "truncated";
      break;
    }
    const seat =
      state.status === "mulligan"
        ? state.players.find((player) => !player.mulliganDone)!.index
        : (state.players.find((player) => !player.done) ?? state.players[0]!).index;
    const side = setup.players[seat]!;
    const own = side.deckCardIds ?? side.heroIds.flatMap((id) => data.heroes[id]!.cardIds);
    const applied = decide(data, drive, state, scenario, seat, "coop", history[seat]!, own, step);
    if (applied === null) break;
    for (const s of [0, 1] as const) history[s].push(...coopRedactEvents(applied.events, s));
    state = applied.state;
    step += 1;
  }
}

function driveRun(
  data: GameData,
  drive: Drive,
  scenario: Scenario,
  setup: RunSetup,
  caps: RunnerCaps,
): void {
  let run: RunState = createRun(data, setup).run;
  let step = 0;
  while (drive.outcome === null) {
    if (run.status === "won" || run.status === "lost") {
      drive.outcome = run.status;
      drive.winnerSeat = run.status === "won" ? 0 : null;
      break;
    }
    if (drive.actions >= caps.maxRunActions) {
      drive.outcome = "truncated";
      break;
    }
    const action: RunAction = chooseRunAction(
      data,
      run,
      seatProfile(scenario, 0),
      context(scenario, 0, step),
    );
    const result = applyRunAction(data, run, action);
    if (!result.ok) {
      drive.outcome = "error";
      drive.error = `runAction ${action.type} rejected: ${result.error}`;
      break;
    }
    drive.actions += 1;
    drive.trace.push(`run:${action.type}`);
    for (const event of result.events) {
      if (event.type === "combatEnded") {
        drive.counters.combats = (drive.counters.combats ?? 0) + 1;
        if (event.result === "won") drive.counters.combatsWon = (drive.counters.combatsWon ?? 0) + 1;
      }
    }
    run = result.run;
    step += 1;
  }
}

// --- Entry points -------------------------------------------------------------

/** Runs one scenario to a record. Errors become outcome "error" — never thrown away. */
export function runScenario(
  data: GameData,
  scenario: Scenario,
  caps: RunnerCaps = DEFAULT_CAPS,
  experimentId = "adhoc",
): MatchRecord {
  const drive = newDrive();
  try {
    switch (scenario.mode) {
      case "pve": {
        const setup = scenario.setup as CombatSetup;
        const own = setup.deckCardIds ?? setup.heroIds.flatMap((id) => data.heroes[id]!.cardIds);
        driveSingleSeat(data, drive, createCombat(data, setup).state, scenario, own, caps);
        break;
      }
      case "story": {
        const setup = scenario.setup as StorySetup;
        driveSingleSeat(data, drive, createStoryCombat(data, setup).state, scenario, setup.deckCardIds, caps);
        break;
      }
      case "pvp": {
        const setup = scenario.setup as PvpSetup;
        drivePvp(data, drive, createPvpCombat(data, setup).state, scenario, setup, caps);
        break;
      }
      case "coop": {
        const setup = scenario.setup as CoopSetup;
        driveCoop(data, drive, createCoopCombat(data, setup).state, scenario, setup, caps);
        break;
      }
      case "run":
        driveRun(data, drive, scenario, scenario.setup as RunSetup, caps);
        break;
    }
  } catch (error) {
    drive.outcome = "error";
    drive.error = error instanceof Error ? error.message : String(error);
  }
  drive.outcome ??= "truncated";
  return {
    experimentId,
    scenarioId: scenario.id,
    blockId: scenario.blockId,
    leg: scenario.leg,
    outcome: drive.outcome,
    winnerSeat: drive.winnerSeat,
    rounds: drive.lastRound,
    actions: drive.actions,
    counters: drive.counters,
    traceHash: sha256Hex(drive.trace),
    traceKeys: drive.trace,
    error: drive.error,
  };
}

export interface RunExperimentOptions {
  workerIndex?: number;
  workerCount?: number;
  /** Record keys already completed — resume skips them exactly once. */
  skip?: ReadonlySet<string>;
}

/**
 * Deterministic partition: worker w runs scenarios where index % count == w.
 * Merging all workers' output is identical to a single worker's — order never
 * depends on parallelism.
 */
export function runExperiment(
  data: GameData,
  manifest: ExperimentManifest,
  options: RunExperimentOptions = {},
  caps: RunnerCaps = DEFAULT_CAPS,
): MatchRecord[] {
  const workerIndex = options.workerIndex ?? 0;
  const workerCount = options.workerCount ?? 1;
  const records: MatchRecord[] = [];
  manifest.scenarios.forEach((scenario, index) => {
    if (index % workerCount !== workerIndex) return;
    const key = `${manifest.id}|${scenario.id}|${scenario.blockId}|${scenario.leg}`;
    if (options.skip?.has(key)) return;
    records.push(runScenario(data, scenario, caps, manifest.id));
  });
  return sortRecords(records);
}

export function sortRecords(records: readonly MatchRecord[]): MatchRecord[] {
  const legOrder: Record<ScenarioLeg, number> = { AB: 0, BA: 1, single: 0 };
  return [...records].sort(
    (a, b) =>
      a.blockId.localeCompare(b.blockId) ||
      legOrder[a.leg] - legOrder[b.leg] ||
      a.scenarioId.localeCompare(b.scenarioId),
  );
}

/** Groups a record set into blocks — AB and BA legs of one seed stay paired. */
export function blocksOf(records: readonly MatchRecord[]): Map<string, MatchRecord[]> {
  const blocks = new Map<string, MatchRecord[]>();
  for (const record of records) {
    const list = blocks.get(record.blockId) ?? [];
    list.push(record);
    blocks.set(record.blockId, list);
  }
  return blocks;
}
