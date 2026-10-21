import { createHash } from "node:crypto";
import type {
  Action,
  CombatEvent,
  CombatState,
  GameData,
  RunAction,
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
import type { BotMode, BotObservation } from "../../src/bot/observation";
import type { Skill } from "../../src/bot/policy";
import type { CoopSetup, PvpSetup } from "./types";
import type { CombatSetup, StorySetup, RunSetup } from "../../src/index";

/**
 * Human replay corpus tooling (`20` §8). `HumanReplay` mirrors the server-side
 * export contract in `apps/server/src/playtest/replay-capture.ts` — the CLI
 * consumes the exported JSON, so both sides stay structurally identical by
 * construction (the schemaVersion/validator test pins the shape).
 */

export type ReplayMode = "pve" | "pvp" | "coop" | "run" | "story";
export type ActionSource = "human" | "bot" | "system";
export type Termination = "combat" | "deckOut" | "resign" | "timeout" | "disconnect" | "incomplete";

export interface HumanReplay {
  schemaVersion: 1;
  id: string;
  groupId: string;
  participantIds: readonly string[];
  humanSeats: readonly number[];
  skillLabels: readonly Skill[];
  mode: ReplayMode;
  dataHash: string;
  engineHash: string;
  setup: unknown;
  actions: readonly (Action | RunAction)[];
  actionSources: readonly ActionSource[];
  result: string;
  termination: Termination;
}

/** The seat placeholder a server export writes for bot/system seats. */
const BOT_SEAT = "bot";

// --- Corpus quality ----------------------------------------------------------

export interface CorpusQuality {
  total: number;
  accepted: number;
  /** Rejected rows stay counted — collection quality never hides them. */
  droppedIncomplete: number;
  droppedVersion: number;
  droppedEmpty: number;
  distinctParticipants: number;
  clusters: number;
  terminations: Record<string, number>;
}

/**
 * The participant components a corpus splits over: every non-bot participant
 * co-seated in one replay shares match outcomes, so a replay unions its
 * participants into one resampling cluster. `componentOf` returns the
 * canonical key (sorted ids joined); bot-only matches get their own key per
 * replay so they never merge distinct human players.
 */
export function componentOf(replay: HumanReplay): string {
  const humans = replay.participantIds.filter((id) => id !== BOT_SEAT && id !== "");
  if (humans.length === 0) return `__nobody:${replay.id}`;
  return [...new Set(humans)].sort().join("+");
}

const humanIds = (replay: HumanReplay): string[] =>
  [...new Set(replay.participantIds.filter((id) => id !== BOT_SEAT && id !== ""))];

/**
 * Union-find over the whole corpus: replays sharing any non-bot participant —
 * directly or transitively through opponents — form one connected component.
 * This is the real resampling/split unit: a player who faced A in one match
 * and B in another links both matches, so neither a participant nor their
 * opponent graph may cross train/test.
 *
 * Returns replayId → canonical component key (sorted member ids joined).
 * Bot-only replays get a unique key so they never merge distinct humans.
 */
export function componentMap(replays: readonly HumanReplay[]): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  for (const replay of replays) {
    const ids = humanIds(replay);
    for (const id of ids) if (!parent.has(id)) parent.set(id, id);
    for (let i = 1; i < ids.length; i++) union(ids[0]!, ids[i]!);
  }
  const members = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const list = members.get(root) ?? [];
    list.push(id);
    members.set(root, list);
  }
  const map = new Map<string, string>();
  for (const replay of replays) {
    const ids = humanIds(replay);
    if (ids.length === 0) {
      map.set(replay.id, `__nobody:${replay.id}`);
    } else {
      map.set(replay.id, (members.get(find(ids[0]!)) ?? []).sort().join("+"));
    }
  }
  return map;
}

/** Validates a raw export against the pinned data hash; drops are counted. */
export function validateCorpus(
  replays: readonly HumanReplay[],
  dataHash: string,
): { accepted: HumanReplay[]; quality: CorpusQuality } {
  const quality: CorpusQuality = {
    total: replays.length,
    accepted: 0,
    droppedIncomplete: 0,
    droppedVersion: 0,
    droppedEmpty: 0,
    distinctParticipants: 0,
    clusters: 0,
    terminations: {},
  };
  const accepted: HumanReplay[] = [];
  for (const replay of replays) {
    quality.terminations[replay.termination] = (quality.terminations[replay.termination] ?? 0) + 1;
    if (replay.termination === "incomplete") {
      quality.droppedIncomplete += 1;
      continue;
    }
    if (replay.dataHash !== dataHash) {
      quality.droppedVersion += 1;
      continue;
    }
    if (replay.actions.length === 0 || replay.actionSources.length !== replay.actions.length) {
      quality.droppedEmpty += 1;
      continue;
    }
    accepted.push(replay);
  }
  quality.accepted = accepted.length;
  const participants = new Set<string>();
  const components = componentMap(accepted);
  for (const replay of accepted) {
    for (const id of replay.participantIds) {
      if (id !== BOT_SEAT && id !== "") participants.add(id);
    }
  }
  const clusters = new Set(components.values());
  quality.distinctParticipants = participants.size;
  quality.clusters = clusters.size;
  return { accepted, quality };
}

// --- Deterministic corpus split ----------------------------------------------

const hash = (text: string): number =>
  createHash("sha256").update(text).digest().readUInt32BE(0);

/**
 * Train/test split by connected participant component — a human who appears
 * in two replays (or against transitively linked opponents) lands in exactly
 * one side. The literal "bot" seat never links replays: it is a shared
 * placeholder, not a participant. ~75/25 by salted component hash; fully
 * deterministic.
 */
export function splitHumanCorpus(
  replays: readonly HumanReplay[],
  salt: string,
): { train: readonly HumanReplay[]; test: readonly HumanReplay[] } {
  const components = componentMap(replays);
  const train: HumanReplay[] = [];
  const test: HumanReplay[] = [];
  for (const replay of replays) {
    const bucket = hash(`${salt}|${components.get(replay.id)!}`) % 4;
    (bucket === 3 ? test : train).push(replay);
  }
  return { train, test };
}

// --- Decision reconstruction ---------------------------------------------------

export interface HumanDecision {
  replayId: string;
  /** Index into replay.actions — provenance for debugging. */
  actionIndex: number;
  seat: number;
  participant: string;
  skill: Skill | null;
  /** Observation rebuilt from state before this action only — never future events. */
  observation: BotObservation;
  action: Action;
  /** Resampling cluster — same match outcomes stay grouped. */
  component: string;
}

const seatSkill = (replay: HumanReplay, seat: number): Skill | null =>
  replay.skillLabels[seat] ?? null;

const seatParticipant = (replay: HumanReplay, seat: number): string =>
  replay.participantIds[seat] ?? BOT_SEAT;

const ownDeck = (data: GameData, side: { heroIds: readonly string[]; deckCardIds?: readonly string[] }) =>
  side.deckCardIds ?? side.heroIds.flatMap((id) => data.heroes[id]?.cardIds ?? []);

/**
 * Walks one replay, capturing the decision-facing observation right before
 * every human-sourced combat action. Anything after index i cannot leak into
 * the observation at i — history accumulates forward only.
 *
 * Returns the decisions and a terminal error string when the log stops
 * replaying (corrupt/truncated) — partial decisions stay usable.
 */
export function extractDecisions(
  data: GameData,
  replay: HumanReplay,
): { decisions: HumanDecision[]; error: string | null } {
  switch (replay.mode) {
    case "pvp":
      return extractCombat(data, replay, () => createPvpCombat(data, replay.setup as PvpSetup).state, "pvp");
    case "coop":
      return extractCombat(data, replay, () => createCoopCombat(data, replay.setup as CoopSetup).state, "coop");
    case "story":
      return extractCombat(data, replay, () => createStoryCombat(data, replay.setup as StorySetup).state, "pve");
    case "pve":
      return extractCombat(data, replay, () => createCombat(data, replay.setup as CombatSetup).state, "pve");
    case "run":
      return extractRun(data, replay);
  }
}

function extractCombat(
  data: GameData,
  replay: HumanReplay,
  create: () => CombatState,
  mode: "pvp" | "coop" | "pve",
): { decisions: HumanDecision[]; error: string | null } {
  const setup = replay.setup as PvpSetup | CoopSetup | CombatSetup | StorySetup;
  const own = (seat: number): readonly string[] => {
    if (mode === "pve") return ownDeck(data, setup as CombatSetup | StorySetup);
    return ownDeck(data, (setup as PvpSetup | CoopSetup).players[seat]!);
  };
  let state = create();
  const histories = new Map<number, CombatEvent[]>();
  const decisions: HumanDecision[] = [];
  for (let i = 0; i < replay.actions.length; i++) {
    const action = replay.actions[i] as Action & { player?: number };
    const seat = action.player ?? (mode === "pvp" ? state.activePlayer : 0);
    if (replay.actionSources[i] === "human") {
      decisions.push({
        replayId: replay.id,
        actionIndex: i,
        seat,
        participant: seatParticipant(replay, seat),
        skill: seatSkill(replay, seat),
        observation: makeBotObservation(data, state, seat, mode, histories.get(seat) ?? [], own(seat)),
        action,
        component: componentOf(replay),
      });
    }
    const result = applyAction(data, state, action);
    if (!result.ok) return { decisions, error: `action ${i} (${action.type}): ${result.error}` };
    state = result.state;
    for (let s = 0; s < state.players.length; s++) {
      const feed = histories.get(s) ?? [];
      feed.push(...(mode === "pvp" ? redactEvents(result.events, s) : mode === "coop" ? coopRedactEvents(result.events, s) : result.events));
      histories.set(s, feed);
    }
  }
  return { decisions, error: null };
}

function extractRun(
  data: GameData,
  replay: HumanReplay,
): { decisions: HumanDecision[]; error: string | null } {
  let run = createRun(data, replay.setup as RunSetup).run;
  const decisions: HumanDecision[] = [];
  const history: CombatEvent[] = [];
  const own = ownDeck(data, replay.setup as RunSetup);
  for (let i = 0; i < replay.actions.length; i++) {
    const action = replay.actions[i] as RunAction;
    // Only inner combat actions carry a decision-facing combat observation;
    // run-level picks (nodes/rewards) are excluded from combat action-fit.
    if (
      replay.actionSources[i] === "human" &&
      action.type === "combat" &&
      run.combat &&
      (run.combat.status === "mulligan" || run.combat.status === "choosing" || run.combat.status === "playerTurn")
    ) {
      decisions.push({
        replayId: replay.id,
        actionIndex: i,
        seat: 0,
        participant: seatParticipant(replay, 0),
        skill: seatSkill(replay, 0),
        observation: makeBotObservation(data, run.combat, 0, "pve", history, own),
        action: action.action,
        component: componentOf(replay),
      });
    }
    const result = applyRunAction(data, run, action);
    if (!result.ok) return { decisions, error: `action ${i} (${action.type}): ${result.error}` };
    // `applyRunAction` exposes no per-step event feed, so run observations
    // carry an empty history — run-level decisions stay out of combat fit.
    run = result.run;
  }
  return { decisions, error: null };
}

// --- Outcome helpers -----------------------------------------------------------

/** Human-facing score of one seat's result: win 1 / draw 0.5 / loss 0. */
export function seatScore(replay: HumanReplay, seat: number): number | null {
  const result = replay.result;
  if (result === "draw") return 0.5;
  const winner = parseResultWinner(result);
  if (winner === null) {
    // PvE-family results are global ("won"/"lost"), not per-seat.
    if (result === "won") return 1;
    if (result === "lost") return 0;
    return null;
  }
  return winner === seat ? 1 : 0;
}

/** Parses a serialized result_json string: `{winner:0,...}` or `"won"`. */
function parseResultWinner(result: string): number | null {
  try {
    const parsed = JSON.parse(result) as { winner?: number | string };
    return typeof parsed.winner === "number" ? parsed.winner : null;
  } catch {
    return null;
  }
}
