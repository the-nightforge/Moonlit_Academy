import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Action, CombatEvent, CombatState, GameData } from "../../src/index";
import {
  applyAction,
  coopRedactEvents,
  createCombat,
  createCoopCombat,
  createPvpCombat,
  createStoryCombat,
  ENGINE_FINGERPRINT,
  makeBotObservation,
  redactEvents,
} from "../../src/index";
import type { BotContext, BotProfile, Skill } from "../../src/bot/policy";
import { chooseBotAction } from "../../src/bot/policy";
import { canonicalActionKey } from "../../src/bot/actions";
import type { CoopSetup, PvpSetup } from "./types";
import type { CombatSetup, StorySetup } from "../../src/index";
import type { Evidence } from "./types";
import type { Interval } from "./statistics";
import { sha256Hex } from "./manifest";
import { meanBootstrap95 } from "./statistics";
import {
  componentMap,
  extractDecisions,
  seatScore,
  validateCorpus,
  type HumanDecision,
  type HumanReplay,
} from "./human";

/**
 * Human calibration + held-out validation (`20` §8). `calibrateProfiles` sees
 * only the train split; `validateCalibration` produces the artifact on the
 * held-out split. Everything is seeded and hash-pinned — a hash mismatch
 * invalidates the artifact before its numbers are read.
 */

const sha = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/** Loads a pinned calibration config (`docs/playtest/calibration.v1.json`). */
export function loadCalibrationConfig(path: string): CalibrationConfig {
  const file = JSON.parse(readFileSync(path, "utf8")) as CalibrationConfig;
  if (file.schemaVersion !== 1) throw new Error(`calibration config ${path}: schemaVersion ≠ 1`);
  for (const key of ["seed", "resamples", "grid", "floors", "gates", "caps"] as const) {
    if (file[key] === undefined) throw new Error(`calibration config ${path}: missing "${key}"`);
  }
  return file;
}

export interface CalibrationGates {
  /** |human − simulated| score: estimate ≤ estimateMax AND upper95 ≤ upperMax. */
  mae: { estimateMax: number; upperMax: number };
  /** Decision disagreement rate, same bound shape. */
  behavioral: { estimateMax: number; upperMax: number };
}

export interface CalibrationConfig {
  schemaVersion: 1;
  seed: number;
  /** Bootstrap resamples for every held-out interval. */
  resamples: number;
  /** Bounded grid fitted on train only — never test. */
  grid: {
    mistakeRates: readonly number[];
    temperatures: readonly number[];
    budgetScales: readonly number[];
    /** Uniform multiplier on all feature weights — bounded, not free-form. */
    weightScales: readonly number[];
  };
  floors: {
    minPlayers: number;
    minReplays: number;
    minDecisions: number;
    /** Below this many resampling clusters the CI is declared too wide. */
    minClusters: number;
    /** Denominator floor — zero-variance strata normalize by 1, never NaN. */
    scaleFloor: number;
  };
  gates: CalibrationGates;
  /** Sim cap per held-out match — a live match past it counts truncated. */
  caps: { maxRounds: number; maxActions: number };
}

export interface CalibrationArtifact {
  schemaVersion: 1;
  evidence: Evidence;
  /** sha256Hex(data) — the experiment-manifest convention for hash pinning. */
  dataHash: string;
  /** `dataVersion(data)` — the server-side id the replay corpus was pinned to. */
  dataVersion: string;
  engineHash: string;
  policyHash: string;
  poolHash: string;
  cohortHash: string;
  splitHash: string;
  weights: Record<string, number>;
  metrics: Record<string, Interval>;
  scope: readonly string[];
  /** Per scope ("mode:skill") outcome — never a single global badge. */
  scopeResults: readonly { scope: string; passed: boolean; reasons: readonly string[] }[];
  precisionLoss: boolean;
  passed: boolean;
}

// --- Scoring -----------------------------------------------------------------

const EPS = 1e-6;

interface Fit {
  exact: number;
  /** Same public benefit as the model's pick — scored within EPS of the max. */
  equivalent: number;
  total: number;
}

/**
 * Replays one human decision against a profile with deterministic seeds —
 * every grid candidate scores the same decision under the same noise roll.
 */
/** Exported for tests — fits one replayed decision against a profile. */
export function fitDecision(
  data: GameData,
  decision: HumanDecision,
  profile: BotProfile,
): { match: "exact" | "equivalent" | "miss" } {
  const context: BotContext = {
    policySeed: Number(`0x${sha(`${decision.replayId}|${decision.actionIndex}|p`).slice(0, 8)}`),
    beliefSeed: Number(`0x${sha(`${decision.replayId}|${decision.actionIndex}|b`).slice(0, 8)}`),
  };
  const bot = chooseBotAction(data, decision.observation, profile, context);
  if (bot === null) return { match: "miss" };
  const humanKey = canonicalActionKey(decision.action);
  if (canonicalActionKey(bot.action) === humanKey) return { match: "exact" };
  const best = bot.actionScores.reduce((m, s) => Math.max(m, s.score), -Infinity);
  const humanScore = bot.actionScores.find((s) => s.key === humanKey)?.score;
  if (humanScore !== undefined && best - humanScore <= EPS) return { match: "equivalent" };
  return { match: "miss" };
}

function measureDecisions(
  data: GameData,
  decisions: readonly HumanDecision[],
  profile: BotProfile,
): Fit {
  const fit: Fit = { exact: 0, equivalent: 0, total: 0 };
  for (const decision of decisions) {
    const { match } = fitDecision(data, decision, profile);
    if (match === "exact") fit.exact += 1;
    else if (match === "equivalent") fit.equivalent += 1;
    fit.total += 1;
  }
  return fit;
}

// --- Calibration (train only) --------------------------------------------------

export interface CandidateScore {
  profileId: string;
  mistakeRate: number;
  temperature: number;
  budgetScale: number;
  weightScale: number;
  /** Disagreement rate on train — lower wins; ties prefer the zero-noise end. */
  loss: number;
}

/**
 * Seeded bounded grid over mistakeRate × temperature × search-budget scale,
 * fitted per skill tier on train-split decisions only. Returns the tuned
 * profiles plus every candidate's training loss for audit.
 */
export function calibrateProfiles(
  data: GameData,
  train: readonly HumanReplay[],
  profiles: readonly BotProfile[],
  config: CalibrationConfig,
): { profiles: readonly BotProfile[]; candidates: readonly CandidateScore[] } {
  const decisions = train.flatMap((replay) => extractDecisions(data, replay).decisions);
  const candidates: CandidateScore[] = [];
  const tuned = profiles.map((profile) => {
    const mine = decisions.filter((d) => d.skill === profile.skill);
    if (mine.length === 0) return { profile, best: null as CandidateScore | null };
    let best: CandidateScore | null = null;
    for (const mistakeRate of config.grid.mistakeRates) {
      for (const temperature of config.grid.temperatures) {
        for (const budgetScale of config.grid.budgetScales) {
          for (const weightScale of config.grid.weightScales) {
            const candidate: BotProfile = {
              ...profile,
              mistakeRate,
              temperature,
              weights: Object.fromEntries(
                Object.entries(profile.weights).map(([k, v]) => [k, (v as number) * weightScale]),
              ),
              search: { ...profile.search, maxExpansions: Math.round(profile.search.maxExpansions * budgetScale) },
            };
            const fit = measureDecisions(data, mine, candidate);
            const loss = fit.total === 0 ? 1 : 1 - (fit.exact + fit.equivalent) / fit.total;
            const score: CandidateScore = { profileId: profile.id, mistakeRate, temperature, budgetScale, weightScale, loss };
            candidates.push(score);
            if (best === null || loss < best.loss - 1e-12) best = score;
          }
        }
      }
    }
    return { profile, best };
  });
  return {
    profiles: tuned.map(({ profile, best }) =>
      best === null
        ? profile
        : {
            ...profile,
            mistakeRate: best.mistakeRate,
            temperature: best.temperature,
            weights: Object.fromEntries(
              Object.entries(profile.weights).map(([k, v]) => [k, (v as number) * best.weightScale]),
            ),
            search: { ...profile.search, maxExpansions: Math.round(profile.search.maxExpansions * best.budgetScale) },
          },
    ),
    candidates,
  };
}

// --- Held-out validation -------------------------------------------------------

interface ClusterSample {
  /** Resampling unit — the participant component. */
  key: string;
  values: number[];
}

/**
 * Cluster bootstrap: components resample whole so co-seated humans and their
 * opponents move together — a shared match outcome is never split.
 */
function clusterInterval(samples: readonly ClusterSample[], seed: number, resamples: number): Interval | null {
  const means = samples.map((s) => s.values.reduce((a, b) => a + b, 0) / s.values.length);
  return meanBootstrap95(means, seed, resamples);
}

/** Scale-safe mean absolute error — zero-variance strata floor at scaleFloor. */
export function scaledMae(errors: readonly number[], scaleFloor: number): number {
  if (errors.length === 0) return NaN;
  const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
  const variance = errors.reduce((a, e) => a + (e - mae) * (e - mae), 0) / errors.length;
  return mae / Math.max(variance, scaleFloor);
}

interface SimCap {
  maxRounds: number;
  maxActions: number;
}

function terminal(state: CombatState): boolean {
  return state.status === "won" || state.status === "lost";
}

/** Drives one combat with the mapped profiles; returns the seat-0 score or null on truncation. */
function driveCombat(
  data: GameData,
  state: CombatState,
  mode: "pve" | "pvp" | "coop",
  profileFor: (seat: number) => BotProfile,
  ownFor: (seat: number) => readonly string[],
  caps: SimCap,
  seedBase: number,
): { scores: (number | null)[]; truncated: boolean } {
  const histories = new Map<number, CombatEvent[]>();
  let actions = 0;
  let step = 0;
  while (!terminal(state)) {
    if (state.round > caps.maxRounds || actions >= caps.maxActions) {
      return { scores: [null, null], truncated: true };
    }
    const seat =
      state.status === "mulligan"
        ? state.players.find((p) => !p.mulliganDone)!.index
        : mode === "coop"
          ? (state.players.find((p) => !p.done) ?? state.players[0]!).index
          : state.activePlayer;
    const obs = makeBotObservation(data, state, seat, mode, histories.get(seat) ?? [], ownFor(seat));
    const context: BotContext = { policySeed: seedBase + step, beliefSeed: seedBase * 7 + step };
    const decision = chooseBotAction(data, obs, profileFor(seat), context);
    if (decision === null) return { scores: [null, null], truncated: true };
    const result = applyAction(data, state, decision.action);
    if (!result.ok) return { scores: [null, null], truncated: true };
    state = result.state;
    actions += 1;
    step += 1;
    for (let s = 0; s < state.players.length; s++) {
      const feed = histories.get(s) ?? [];
      feed.push(...(mode === "pvp" ? redactEvents(result.events, s) : mode === "coop" ? coopRedactEvents(result.events, s) : result.events));
      histories.set(s, feed);
    }
  }
  const winner = state.winner;
  const scores: (number | null)[] = state.players.map((_, s) =>
    winner === "draw" ? 0.5 : winner === s ? 1 : 0,
  );
  return { scores, truncated: false };
}

/**
 * Re-simulates one held-out replay's pinned setup under skill-matched
 * profiles; the per-human-seat score differences feed the MAE metric.
 * Run-mode replays have no combat-level human seat simulation yet — they
 * report `null` and are excluded from MAE (their scope notes say so).
 */
function simulateSeatScores(
  data: GameData,
  replay: HumanReplay,
  profileBySkill: Map<Skill, BotProfile>,
  caps: SimCap,
): (number | null)[] | null {
  const profileFor = (seat: number): BotProfile => {
    const skill = replay.skillLabels[seat] ?? "regular";
    return profileBySkill.get(skill) ?? profileBySkill.values().next().value!;
  };
  const seedBase = Number(`0x${sha(`${replay.id}|sim`).slice(0, 8)}`);
  const ownFor = (seat: number): readonly string[] => {
    const setup = replay.setup as PvpSetup | CoopSetup;
    const side = setup.players?.[seat];
    return side?.deckCardIds ?? side?.heroIds.flatMap((id) => data.heroes[id]?.cardIds ?? []) ?? [];
  };
  switch (replay.mode) {
    case "pvp":
      return driveCombat(data, createPvpCombat(data, replay.setup as PvpSetup).state, "pvp", profileFor, ownFor, caps, seedBase).scores;
    case "coop":
      return driveCombat(data, createCoopCombat(data, replay.setup as CoopSetup).state, "coop", profileFor, ownFor, caps, seedBase).scores;
    case "story": {
      const setup = replay.setup as StorySetup;
      const own = () => setup.deckCardIds ?? setup.heroIds.flatMap((id) => data.heroes[id]?.cardIds ?? []);
      return driveCombat(data, createStoryCombat(data, setup).state, "pve", profileFor, own, caps, seedBase).scores;
    }
    case "pve": {
      const setup = replay.setup as CombatSetup;
      const own = () => setup.deckCardIds ?? setup.heroIds.flatMap((id) => data.heroes[id]?.cardIds ?? []);
      return driveCombat(data, createCombat(data, setup).state, "pve", profileFor, own, caps, seedBase).scores;
    }
    case "run":
      return null;
  }
}

/** Gate predicate — exported so boundary fixtures test it directly. */
export const gateFailure = (interval: Interval | null, gate: { estimateMax: number; upperMax: number }): string | null => {
  if (interval === null) return "no estimate";
  if (interval.estimate > gate.estimateMax) return `estimate ${interval.estimate.toFixed(3)} > ${gate.estimateMax}`;
  if (interval.upper > gate.upperMax) return `upper95 ${interval.upper.toFixed(3)} > ${gate.upperMax}`;
  return null;
};

/**
 * Held-out validation. Never sees the train split — `test` arrives already
 * partitioned by `splitHumanCorpus`. Produces per-scope pass/fail plus the
 * pinned artifact; an empty/invalid corpus yields `passed:false`, evidence
 * `synthetic` — never a human verdict without humans.
 */
export function validateCalibration(
  data: GameData,
  test: readonly HumanReplay[],
  profiles: readonly BotProfile[],
  config: CalibrationConfig,
  dataVersion: string,
): CalibrationArtifact {
  const { accepted, quality } = validateCorpus(test, dataVersion);
  const profileBySkill = new Map<Skill, BotProfile>();
  for (const profile of profiles) if (!profileBySkill.has(profile.skill)) profileBySkill.set(profile.skill, profile);

  const metrics: Record<string, Interval> = {};
  const scopeResults: CalibrationArtifact["scopeResults"][number][] = [];
  const weights: Record<string, number> = {};
  for (const profile of profiles) {
    for (const [name, value] of Object.entries(profile.weights)) weights[`${profile.id}.${name}`] = value as number;
    weights[`${profile.id}.mistakeRate`] = profile.mistakeRate;
    weights[`${profile.id}.temperature`] = profile.temperature;
  }

  const scopes = new Map<string, HumanDecision[]>();
  const outcomeClusters = new Map<string, ClusterSample>();
  // Connected participant components over the accepted corpus — transitive
  // links (shared opponents) keep replays in one resampling cluster.
  const components = componentMap(accepted);
  let floorReason: string | null = null;
  if (accepted.length < config.floors.minReplays) floorReason = `replays ${accepted.length} < ${config.floors.minReplays}`;
  else if (quality.distinctParticipants < config.floors.minPlayers)
    floorReason = `players ${quality.distinctParticipants} < ${config.floors.minPlayers}`;
  else if (quality.clusters < config.floors.minClusters)
    floorReason = `clusters ${quality.clusters} < ${config.floors.minClusters}`;

  if (floorReason === null) {
    for (const replay of accepted) {
      const { decisions } = extractDecisions(data, replay);
      for (const decision of decisions) {
        const scope = `${replay.mode}:${decision.skill ?? "unlabeled"}`;
        const list = scopes.get(scope) ?? [];
        list.push(decision);
        scopes.set(scope, list);
      }
      // Outcome MAE — per human seat, |human score − simulated score|.
      const simulated = simulateSeatScores(data, replay, profileBySkill, config.caps);
      if (simulated !== null) {
        const clusterKey = components.get(replay.id)!;
        const cluster: ClusterSample = outcomeClusters.get(clusterKey) ?? { key: clusterKey, values: [] };
        for (const seat of replay.humanSeats) {
          const human = seatScore(replay, seat);
          const sim = simulated[seat];
          if (human !== null && sim !== null && sim !== undefined) cluster.values.push(Math.abs(human - sim));
        }
        if (cluster.values.length > 0) outcomeClusters.set(cluster.key, cluster);
      }
    }

    for (const [scope, decisions] of [...scopes.entries()].sort()) {
      const reasons: string[] = [];
      if (decisions.length < config.floors.minDecisions) {
        reasons.push(`decisions ${decisions.length} < ${config.floors.minDecisions}`);
      }
      const profile = profileBySkill.get((decisions[0]?.skill ?? "regular") as Skill) ?? profiles[0]!;
      const clusterMap = new Map<string, ClusterSample>();
      for (const decision of decisions) {
        const { match } = fitDecision(data, decision, profile);
        // Corpus-level component — transitive opponent links stay clustered.
        const key = components.get(decision.replayId) ?? decision.component;
        const cluster: ClusterSample = clusterMap.get(key) ?? { key, values: [] };
        cluster.values.push(match === "miss" ? 1 : 0);
        clusterMap.set(key, cluster);
      }
      const interval = clusterInterval([...clusterMap.values()], config.seed + scopes.size, config.resamples);
      if (interval !== null) metrics[`behavioral.${scope}`] = interval;
      const failure = gateFailure(interval, config.gates.behavioral);
      if (failure !== null) reasons.push(`behavioral ${failure}`);
      scopeResults.push({ scope, passed: reasons.length === 0, reasons });
    }

    const maeInterval = clusterInterval([...outcomeClusters.values()], config.seed + 977, config.resamples);
    if (maeInterval !== null) {
      metrics["outcome.mae"] = maeInterval;
      const failure = gateFailure(maeInterval, config.gates.mae);
      scopeResults.push({
        scope: "outcome:all",
        passed: failure === null,
        reasons: failure === null ? [] : [`mae ${failure}`],
      });
    }
  }

  const precisionLoss = quality.clusters > 0 && quality.clusters < config.floors.minClusters * 2;
  const passed =
    floorReason === null &&
    scopeResults.length > 0 &&
    scopeResults.every((s) => s.passed);

  return {
    schemaVersion: 1,
    evidence: {
      kind: accepted.length === 0 ? "synthetic" : "human",
      note: floorReason ?? (passed ? "held-out gates passed" : "held-out gates failed"),
    },
    dataHash: sha256Hex(data),
    dataVersion,
    engineHash: ENGINE_FINGERPRINT,
    policyHash: sha(profiles),
    poolHash: sha([...new Set(accepted.flatMap((r) => participantHeroes(r)))].sort()),
    cohortHash: sha([...new Set(accepted.map((r) => `${r.groupId}:${r.participantIds.join("+")}`))].sort()),
    splitHash: sha(accepted.map((r) => r.id).sort()),
    weights,
    metrics,
    scope: scopeResults.map((s) => s.scope),
    scopeResults,
    precisionLoss,
    passed,
  };
}

function participantHeroes(replay: HumanReplay): string[] {
  const setup = replay.setup as { heroIds?: string[]; players?: { heroIds: string[] }[] };
  if (setup.players) return setup.players.flatMap((p) => p.heroIds);
  return setup.heroIds ?? [];
}

/**
 * Hash validity check — an artifact only speaks for the data/engine/policies/
 * split it was produced under. Any mismatch downgrades it before use.
 */
export function verifyArtifact(
  artifact: CalibrationArtifact,
  expected: { dataHash: string; engineHash?: string; policyHash?: string },
): { valid: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  if (artifact.dataHash !== expected.dataHash) mismatches.push("dataHash");
  if (expected.engineHash !== undefined && artifact.engineHash !== expected.engineHash) mismatches.push("engineHash");
  if (expected.policyHash !== undefined && artifact.policyHash !== expected.policyHash) mismatches.push("policyHash");
  return { valid: mismatches.length === 0, mismatches };
}
