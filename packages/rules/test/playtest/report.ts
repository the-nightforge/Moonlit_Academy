import { readFileSync } from "node:fs";
import type { GameData } from "../../src/index";
import type { BotProfile } from "../../src/bot/policy";
import { heroAppearances } from "./manifest";
import {
  blockDeltaInterval,
  holm,
  meanBootstrap95,
  pairedBlockDelta95,
  pairedBlockDeltas,
  quantile,
  recordScore,
  signFlipDeltaP,
  wilson95,
  type Interval,
} from "./statistics";
import type { CalibrationArtifact } from "./calibration";
import type {
  ExperimentManifest,
  MatchRecord,
  PvpSetup,
  Scenario,
  ScenarioMode,
} from "./types";

/**
 * Report + gates layer (design §"Gates", §"Thống kê"). The report can say
 * "insufficient-data" — an honest non-answer is a valid outcome.
 */

export interface Gates {
  schemaVersion: 1;
  /** Minimum complete blocks per stage before metrics mean anything. */
  minBlocks: { screen: number; confirm: number };
  /** Rejected actions must be zero — any engine rejection invalidates the set. */
  maxErrorRate: number;
  /** Spec: truncated rate strictly greater than this invalidates the report. */
  maxTruncatedRateExclusive: number;
  minPairedBlocks: number;
  /** Promotion needs |delta| above this many score points. */
  effectMinPoints: number;
  /** Promotion needs CI width below this many points. */
  precisionMaxPoints: number;
  bootstrapResamples: number;
  signFlipResamples: number;
  alpha: number;
}

export function loadGates(path: string): Gates {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Gates;
  if (raw.schemaVersion !== 1) throw new Error(`gates: schemaVersion ${raw.schemaVersion} ≠ 1`);
  return raw;
}

export const DEFAULT_GATES: Gates = {
  schemaVersion: 1,
  minBlocks: { screen: 128, confirm: 2000 },
  maxErrorRate: 0,
  maxTruncatedRateExclusive: 0.005,
  minPairedBlocks: 32,
  effectMinPoints: 0.03,
  precisionMaxPoints: 0.1,
  bootstrapResamples: 10000,
  signFlipResamples: 10000,
  alpha: 0.05,
};

export interface ModeMetrics {
  records: number;
  won: number;
  lost: number;
  draw: number;
  truncated: number;
  error: number;
  /** Wilson over decisive (won+lost) — draws are NOT squeezed into a binary. */
  decisiveWinRate: Interval | null;
  /** Mean of win1/draw0.5/loss0 with paired-block bootstrap CI. */
  score: Interval | null;
  roundsP50: number;
  roundsP90: number;
  meanActions: number;
  meanDamageDealt: number;
  /** PvP only: wins by the engine-drawn first player over decisive matches. */
  firstPlayerAdvantage: { wins: number; matches: number } | null;
}

export type ReportStatus =
  | "ok"
  | "insufficient-data"
  | "invalid-quality"
  | "policy-sensitive"
  | "human-check-required";

/**
 * Calibration artifact — the real shape lives in `calibration.ts`; re-exported
 * here so `buildBalanceReport` callers see one surface. A stale artifact
 * (hash mismatch or `passed:false`) downgrades evidence to
 * `human-check-required` — it never silently upgrades.
 */
export type { CalibrationArtifact } from "./calibration";

export interface BalanceReport {
  schemaVersion: 1;
  baseId: string;
  candidateId: string | null;
  stage: "screen" | "confirm";
  versions: {
    engineHash: string;
    dataHash: string;
    policyHash: string;
    poolHash: string;
    candidateDataHash: string | null;
  };
  evidence: { kind: string; note?: string };
  coverage: {
    blocks: number;
    records: number;
    perMode: Record<string, number>;
    perProfile: Record<string, number>;
    heroAppearances: Record<string, number>;
  };
  /** Per-hero decisive win share for pvp records — descriptive, pool-relative. */
  perHero: Record<string, { records: number; wins: number; winRate: number | null }>;
  quality: {
    errorRate: number;
    truncatedRate: number;
    decisiveRecords: number;
  };
  modes: Record<string, ModeMetrics>;
  perProfile: Record<string, { records: number; score: Interval | null }>;
  /** Played-card/win association — descriptive correlation, never causation. */
  cardCorrelations: Record<string, { playedIn: number; playedWins: number; note: string }>;
  comparison: null | {
    pairedBlocks: number;
    unpairedBlocks: number;
    delta: Interval | null;
    signFlipP: number | null;
    holmAdjustedP: number | null;
    familyCI: Interval | null;
    familySize: number;
    perProfileDelta: Record<string, number>;
    promote: boolean;
    promoteReasons: string[];
  };
  /** Summary of the calibration artifact supplied, if any — scope gates promotion. */
  calibration: null | { passed: boolean; evidenceKind: string; scope: readonly string[] };
  status: ReportStatus;
  statusReasons: string[];
  artifacts: { records: string | null; manifest: string | null };
}

const mean = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

function modeMetrics(records: readonly MatchRecord[], seed: number, resamples: number): ModeMetrics {
  const won = records.filter((r) => r.outcome === "won").length;
  const lost = records.filter((r) => r.outcome === "lost").length;
  const draw = records.filter((r) => r.outcome === "draw").length;
  const scores = records.map(recordScore).filter((s): s is number => s !== null);
  const rounds = records.map((r) => r.rounds).sort((a, b) => a - b);
  let firstWins = 0;
  let firstMatches = 0;
  for (const record of records) {
    const first = record.counters.firstPlayer;
    if ((first === 0 || first === 1) && (record.outcome === "won" || record.outcome === "lost")) {
      firstMatches += 1;
      if (record.winnerSeat === first) firstWins += 1;
    }
  }
  return {
    records: records.length,
    won,
    lost,
    draw,
    truncated: records.filter((r) => r.outcome === "truncated").length,
    error: records.filter((r) => r.outcome === "error").length,
    decisiveWinRate: wilson95(won, won + lost),
    score: meanBootstrap95(scores, seed, resamples),
    roundsP50: quantile(rounds, 0.5) || 0,
    roundsP90: quantile(rounds, 0.9) || 0,
    meanActions: mean(records.map((r) => r.actions)),
    meanDamageDealt: mean(records.map((r) => r.counters.damageDealt ?? 0)),
    firstPlayerAdvantage: firstMatches === 0 ? null : { wins: firstWins, matches: firstMatches },
  };
}

/** Every profile id that sat a seat in a record's scenario. */
function recordProfiles(scenario: Scenario | undefined): readonly string[] {
  return scenario?.profiles.map((p: BotProfile) => p.id) ?? [];
}

/**
 * A record's outcome is seat-0 relative ("won" = seat 0 won). For multi-seat
 * scenarios this converts it into the score of the seat `profileId` occupied —
 * a "lost" record means seat 1 won.
 */
function profileSeatScore(
  record: MatchRecord,
  scenario: Scenario | undefined,
  profileId: string,
): number | null {
  if (scenario === undefined) return null;
  const seat = scenario.profiles.findIndex((p) => p.id === profileId);
  if (seat < 0 || recordScore(record) === null) return null;
  if (scenario.profiles.length === 1) return recordScore(record);
  switch (record.outcome) {
    case "won": return seat === 0 ? 1 : 0;
    case "lost": return seat === 0 ? 0 : 1;
    case "draw": return 0.5;
    default: return null;
  }
}

/** Per-block mean deltas for one profile's seat scores (paired by blockId). */
function profileBlockDelta(
  baseline: readonly MatchRecord[],
  candidate: readonly MatchRecord[],
  baseScenarios: Map<string, Scenario>,
  candidateScenarios: Map<string, Scenario>,
  profileId: string,
): number | null {
  const baseScores = new Map<string, number[]>();
  const candidateScores = new Map<string, number[]>();
  const push = (map: Map<string, number[]>, record: MatchRecord, scenarios: Map<string, Scenario>) => {
    const score = profileSeatScore(record, scenarios.get(record.scenarioId), profileId);
    if (score === null) return;
    const list = map.get(record.blockId) ?? [];
    list.push(score);
    map.set(record.blockId, list);
  };
  for (const r of baseline) push(baseScores, r, baseScenarios);
  for (const r of candidate) push(candidateScores, r, candidateScenarios);
  const deltas: number[] = [];
  for (const [blockId, bs] of baseScores) {
    const cs = candidateScores.get(blockId);
    if (cs === undefined) continue;
    deltas.push(mean(cs) - mean(bs));
  }
  return deltas.length === 0 ? null : mean(deltas);
}

function scenarioIndex(manifest: ExperimentManifest): Map<string, Scenario> {
  return new Map(manifest.scenarios.map((s) => [s.id, s]));
}

/**
 * Builds the report. Baseline/candidate manifests must share engine, policy
 * and pool; only dataHash may differ — a declared data intervention. Anything
 * else mixed together rejects the comparison (throws).
 */
export function buildBalanceReport(
  base: ExperimentManifest,
  baseline: readonly MatchRecord[],
  candidate: ExperimentManifest | null,
  candidateRecords: readonly MatchRecord[] | null,
  calibration: CalibrationArtifact | null,
  gates: Gates = DEFAULT_GATES,
  seed = 0x5eed,
): BalanceReport {
  const hasCandidate = candidate !== null && candidateRecords !== null;
  if (hasCandidate) {
    for (const [name, a, b] of [
      ["engineHash", base.engineHash, candidate!.engineHash],
      ["policyHash", base.policyHash, candidate!.policyHash],
      ["poolHash", base.poolHash, candidate!.poolHash],
    ] as const) {
      if (a !== b) {
        throw new Error(`incomparable manifests: ${name} differs (${a.slice(0, 12)}… vs ${b.slice(0, 12)}…)`);
      }
    }
  }

  const scenarios = scenarioIndex(base);
  const byMode = new Map<string, MatchRecord[]>();
  const perProfileRecords = new Map<string, MatchRecord[]>();
  const cardStats = new Map<string, { playedIn: number; playedWins: number }>();
  const perHeroStats = new Map<string, { records: number; wins: number }>();
  for (const record of baseline) {
    const mode = scenarios.get(record.scenarioId)?.mode ?? "unknown";
    const list = byMode.get(mode) ?? [];
    list.push(record);
    byMode.set(mode, list);
    for (const id of recordProfiles(scenarios.get(record.scenarioId))) {
      const pl = perProfileRecords.get(id) ?? [];
      pl.push(record);
      perProfileRecords.set(id, pl);
    }
    for (const [key, value] of Object.entries(record.counters)) {
      if (!key.startsWith("card:") || value === 0) continue;
      const entry = cardStats.get(key.slice(5)) ?? { playedIn: 0, playedWins: 0 };
      entry.playedIn += 1;
      if (record.outcome === "won") entry.playedWins += 1;
      cardStats.set(key.slice(5), entry);
    }
    // Per-hero win attribution (pvp): winnerSeat marks the winning side —
    // decisive records only, so draws/errors shift nobody's rate.
    const pvpScenario = scenarios.get(record.scenarioId);
    if (pvpScenario?.mode === "pvp" && record.winnerSeat !== null) {
      const players = (pvpScenario.setup as PvpSetup).players;
      for (let seat = 0; seat < 2; seat++) {
        for (const heroId of players[seat]!.heroIds) {
          const entry = perHeroStats.get(heroId) ?? { records: 0, wins: 0 };
          entry.records += 1;
          entry.wins += seat === record.winnerSeat ? 1 : 0;
          perHeroStats.set(heroId, entry);
        }
      }
    }
  }

  const modes: Record<string, ModeMetrics> = {};
  for (const [mode, records] of byMode) {
    modes[mode] = modeMetrics(records, seed + mode.length, Math.min(gates.bootstrapResamples, 2000));
  }

  const errors = baseline.filter((r) => r.outcome === "error").length;
  const truncated = baseline.filter((r) => r.outcome === "truncated").length;
  const errorRate = baseline.length === 0 ? 0 : errors / baseline.length;
  const truncatedRate = baseline.length === 0 ? 0 : truncated / baseline.length;
  const blocks = new Set(baseline.map((r) => r.blockId)).size;

  const statusReasons: string[] = [];
  let status: ReportStatus = "ok";
  if (errorRate > gates.maxErrorRate) {
    status = "invalid-quality";
    statusReasons.push(`errorRate ${(errorRate * 100).toFixed(2)}% > ${gates.maxErrorRate * 100}% (spec: rejection rate must be 0)`);
  }
  // Spec boundary is strict: rate must EXCEED 0.5% to invalidate.
  if (truncatedRate > gates.maxTruncatedRateExclusive) {
    status = "invalid-quality";
    statusReasons.push(`truncatedRate ${(truncatedRate * 100).toFixed(2)}% > ${gates.maxTruncatedRateExclusive * 100}%`);
  }
  if (status === "ok" && blocks < gates.minBlocks[base.stage]) {
    status = "insufficient-data";
    statusReasons.push(`blocks ${blocks} < ${gates.minBlocks[base.stage]} (${base.stage} stage)`);
  }

  // --- Comparison -------------------------------------------------------------
  let comparison: BalanceReport["comparison"] = null;
  if (hasCandidate) {
    const { deltas, pairedBlocks, unpaired } = pairedBlockDeltas(baseline, candidateRecords!);
    const delta = pairedBlockDelta95(baseline, candidateRecords!, seed, gates.bootstrapResamples);
    const signFlipP = signFlipDeltaP(baseline, candidateRecords!, seed, gates.signFlipResamples);
    // Confirm family: one predeclared comparison per mode present.
    const familySize = Math.max(1, byMode.size);
    const holmAdjustedP = signFlipP === null ? null : holm([signFlipP])[0]!;
    // Conservative family CI at alpha/familySize per tail pair.
    const familyAlpha = gates.alpha / familySize;
    const familyCI =
      pairedBlocks === 0
        ? null
        : blockDeltaInterval(baseline, candidateRecords!, seed, gates.bootstrapResamples, familyAlpha);
    // Policy sensitivity: per-profile seat-score deltas that disagree in sign.
    const candidateScenarios = scenarioIndex(candidate!);
    const perProfileDelta: Record<string, number> = {};
    const signs = new Set<number>();
    for (const id of perProfileRecords.keys()) {
      const d = profileBlockDelta(baseline, candidateRecords!, scenarios, candidateScenarios, id);
      if (d !== null) {
        perProfileDelta[id] = d;
        if (Math.abs(d) > 1e-9) signs.add(Math.sign(d));
      }
    }
    const policySensitive = signs.size > 1;
    if (policySensitive) statusReasons.push("delta sign differs across profiles — policy-sensitive");

    const promoteReasons: string[] = [];
    let promote = true;
    if (delta === null) { promote = false; promoteReasons.push("no paired blocks"); }
    else {
      if (pairedBlocks < gates.minPairedBlocks) { promote = false; promoteReasons.push(`pairedBlocks ${pairedBlocks} < ${gates.minPairedBlocks}`); }
      if (Math.abs(delta.estimate) < gates.effectMinPoints) { promote = false; promoteReasons.push(`|delta| ${(Math.abs(delta.estimate) * 100).toFixed(1)}pp < ${gates.effectMinPoints * 100}pp effect gate`); }
      if (delta.upper - delta.lower > gates.precisionMaxPoints) { promote = false; promoteReasons.push(`CI width ${((delta.upper - delta.lower) * 100).toFixed(1)}pp > ${gates.precisionMaxPoints * 100}pp precision gate`); }
      if (holmAdjustedP !== null && holmAdjustedP >= gates.alpha) { promote = false; promoteReasons.push(`Holm p ${holmAdjustedP.toFixed(4)} ≥ ${gates.alpha}`); }
      if (familyCI !== null && familyCI.lower <= 0 && familyCI.upper >= 0) { promote = false; promoteReasons.push("family CI includes 0"); }
    }
    if (pairedBlocks < gates.minPairedBlocks && status === "ok") {
      status = "insufficient-data";
      statusReasons.push(`pairedBlocks ${pairedBlocks} < ${gates.minPairedBlocks}`);
    }
    if (policySensitive && status === "ok") status = "policy-sensitive";
    comparison = {
      pairedBlocks,
      unpairedBlocks: unpaired,
      delta,
      signFlipP,
      holmAdjustedP,
      familyCI,
      familySize,
      perProfileDelta,
      promote,
      promoteReasons,
    };
    // A promotable candidate still needs real-human calibration before action —
    // and the artifact must be valid *and* current: stale evidence downgrades.
    if (promote) {
      const stale =
        calibration !== null &&
        (calibration.dataHash !== base.dataHash || calibration.policyHash !== base.policyHash);
      if (calibration === null) {
        status = "human-check-required";
        statusReasons.push("no calibration artifact — human verification required before acting on delta");
      } else if (stale) {
        status = "human-check-required";
        statusReasons.push("calibration artifact hash mismatch — stale evidence, human verification required");
      } else if (!calibration.passed) {
        status = "human-check-required";
        statusReasons.push(`calibration held-out gates not passed (${calibration.evidence.note ?? "see artifact"}) — human verification required`);
      }
    }
  }

  const perProfile: BalanceReport["perProfile"] = {};
  for (const [id, records] of perProfileRecords) {
    const scores = records.map(recordScore).filter((s): s is number => s !== null);
    perProfile[id] = { records: records.length, score: meanBootstrap95(scores, seed + id.length, 1000) };
  }

  const cardCorrelations: BalanceReport["cardCorrelations"] = {};
  for (const [cardId, stats] of cardStats) {
    cardCorrelations[cardId] = { ...stats, note: "correlation, not causation" };
  }

  return {
    schemaVersion: 1,
    baseId: base.id,
    candidateId: candidate?.id ?? null,
    stage: base.stage,
    versions: {
      engineHash: base.engineHash,
      dataHash: base.dataHash,
      policyHash: base.policyHash,
      poolHash: base.poolHash,
      candidateDataHash: candidate?.dataHash ?? null,
    },
    evidence: { kind: base.evidence.kind, ...(base.evidence.note ? { note: base.evidence.note } : {}) },
    coverage: {
      blocks,
      records: baseline.length,
      perMode: Object.fromEntries([...byMode].map(([m, r]) => [m, r.length])),
      perProfile: Object.fromEntries([...perProfileRecords].map(([id, r]) => [id, r.length])),
      heroAppearances: heroAppearances(base.scenarios),
    },
    quality: {
      errorRate,
      truncatedRate,
      decisiveRecords: baseline.filter((r) => r.outcome === "won" || r.outcome === "lost" || r.outcome === "draw").length,
    },
    modes,
    perHero: Object.fromEntries(
      [...perHeroStats].map(([id, e]) => [id, { ...e, winRate: e.records === 0 ? null : e.wins / e.records }]),
    ),
    perProfile,
    cardCorrelations,
    comparison,
    calibration: calibration === null
      ? null
      : { passed: calibration.passed, evidenceKind: calibration.evidence.kind, scope: calibration.scope },
    status,
    statusReasons,
    artifacts: { records: null, manifest: null },
  };
}

function candidateScenarioIndex(manifest: ExperimentManifest) {
  return scenarioIndex(manifest);
}

// --- Rendering ---------------------------------------------------------------

const pp = (x: number) => `${(x * 100).toFixed(1)}pp`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const fmt = (i: Interval | null) => (i === null ? "—" : `${pct(i.estimate)} [${pct(i.lower)}–${pct(i.upper)}] n=${i.n}`);

export function reportMarkdown(report: BalanceReport): string {
  const lines = [
    `# Balance report — ${report.baseId}${report.candidateId ? ` vs ${report.candidateId}` : ""}`,
    "",
    `**Status:** ${report.status}${report.statusReasons.length ? ` — ${report.statusReasons.join("; ")}` : ""}`,
    `**Stage:** ${report.stage} · **Evidence:** ${report.evidence.kind}`,
    `**Coverage:** ${report.coverage.blocks} blocks / ${report.coverage.records} records`,
    `**Quality:** errors ${pct(report.quality.errorRate)} · truncated ${pct(report.quality.truncatedRate)}`,
    "",
    "## Per-mode metrics",
    "",
    "| Mode | n | win% (Wilson, decisive) | score (bootstrap) | rounds p50/p90 |",
    "|---|---:|---|---|---|",
    ...Object.entries(report.modes).map(
      ([mode, m]) =>
        `| ${mode} | ${m.records} | ${fmt(m.decisiveWinRate)} | ${fmt(m.score)} | ${m.roundsP50}/${m.roundsP90} |`,
    ),
  ];
  const heroRows = Object.entries(report.perHero)
    .filter(([, e]) => e.winRate !== null)
    .sort((a, b) => b[1].winRate! - a[1].winRate!);
  if (heroRows.length > 0) {
    lines.push(
      "",
      "## Per-hero win rates (pvp, decisive)",
      "",
      "| Hero | n | win% |",
      "|---|---:|---:|",
      ...heroRows.map(([id, e]) => `| ${id} | ${e.records} | ${pct(e.winRate!)} |`),
      "",
      "_Win shares are pool-relative: a hero's rate is measured inside the teams this pool gave them._",
    );
  }
  if (report.comparison) {
    const c = report.comparison;
    lines.push(
      "",
      "## Baseline vs candidate",
      "",
      `Paired blocks: ${c.pairedBlocks} (unpaired ${c.unpairedBlocks})`,
      `Delta: ${c.delta ? `${pp(c.delta.estimate)} [${pp(c.delta.lower)}–${pp(c.delta.upper)}]` : "—"}`,
      `Sign-flip p: ${c.signFlipP?.toFixed(4) ?? "—"} · Holm-adjusted: ${c.holmAdjustedP?.toFixed(4) ?? "—"}`,
      `Family CI (α/${c.familySize}): ${c.familyCI ? `[${pp(c.familyCI.lower)}–${pp(c.familyCI.upper)}]` : "—"}`,
      `Promote: **${c.promote ? "yes" : "no"}**${c.promoteReasons.length ? ` — ${c.promoteReasons.join("; ")}` : ""}`,
      "",
      "Playtest deltas estimate effects inside the bot model; they do not prove real-world causality.",
    );
  }
  lines.push("", "_Card/win entries in cardCorrelations are correlations, not causation._");
  return `${lines.join("\n")}\n`;
}

export function reportCsv(report: BalanceReport): string {
  const rows = [
    "mode,records,won,lost,draw,truncated,error,decisive_win_rate,score_mean,score_lower,score_upper,rounds_p50,rounds_p90",
    ...Object.entries(report.modes).map(([mode, m]) =>
      [
        mode, m.records, m.won, m.lost, m.draw, m.truncated, m.error,
        m.decisiveWinRate?.estimate.toFixed(4) ?? "",
        m.score?.estimate.toFixed(4) ?? "",
        m.score?.lower.toFixed(4) ?? "",
        m.score?.upper.toFixed(4) ?? "",
        m.roundsP50, m.roundsP90,
      ].join(","),
    ),
  ];
  return `${rows.join("\n")}\n`;
}
