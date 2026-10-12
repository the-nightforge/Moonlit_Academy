import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGameData } from "data";
import { buildManifest, parseExperimentConfig } from "./playtest/manifest";
import { runExperiment } from "./playtest/runner";
import { buildBalanceReport, DEFAULT_GATES } from "./playtest/report";
import {
  applyDeclaredPatch,
  dataDirHash,
  dataFileKey,
  loadDataDir,
  parseCandidateExperiment,
  readRawDataDir,
  reviewCandidate,
} from "./playtest/workflow";
import type { CalibrationArtifact } from "./playtest/calibration";
import type { ExperimentManifest, MatchRecord, Scenario } from "./playtest/types";
import type { BotProfile } from "../src/bot/policy";

const RULES_SRC = fileURLToPath(new URL("../src", import.meta.url));
const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const DATA_DIR = resolve(REPO_ROOT, "packages/data");
const EXPERIMENT_PATH = resolve(REPO_ROOT, "docs/playtest/experiments/example-candidate.json");
const experiment = parseCandidateExperiment(JSON.parse(readFileSync(EXPERIMENT_PATH, "utf8")));

const profile = (id: string): BotProfile => ({
  id, version: "1", skill: "novice", style: "aggressive", mistakeRate: 0, temperature: 0,
  weights: {}, search: { maxExpansions: 0, depth: 0, beamWidth: 0, samples: 0 },
});

const scenario = (id: string, blockId: string, leg: "AB" | "BA", profs: string[]): Scenario => ({
  id, mode: "pvp",
  setup: { seed: 1, players: [{ heroIds: ["m05", "f03", "f04"], loadout: { heroes: {} } }, { heroIds: ["f06", "m09", "f03"], loadout: { heroes: {} } }] },
  profiles: profs.map(profile),
  policySeeds: [1, 2], beliefSeeds: [3, 4], blockId, leg,
});

const manifestFor = (scenarios: Scenario[], overrides: Partial<ExperimentManifest> = {}): ExperimentManifest => ({
  schemaVersion: 1, id: "exp", sourceRevision: "test",
  engineHash: "eng", dataHash: "dat", policyHash: "pol", poolHash: "pool",
  stage: "screen", evidence: { kind: "synthetic" }, scenarios,
  ...overrides,
});

const record = (s: Scenario, outcome: MatchRecord["outcome"], winnerSeat: number | null = null): MatchRecord => ({
  experimentId: "exp", scenarioId: s.id, blockId: s.blockId, leg: s.leg,
  outcome, winnerSeat, rounds: 8, actions: 40, counters: {}, traceHash: "h", error: null,
});

const artifact = (over: object = {}): CalibrationArtifact => ({
  schemaVersion: 1, evidence: { kind: "human" },
  dataHash: "dat", dataVersion: "dat", engineHash: "eng",
  policyHash: "pol", poolHash: "pool", cohortHash: "co", splitHash: "sp",
  weights: {}, metrics: {}, scope: ["pvp:novice"], scopeResults: [{ scope: "pvp:novice", passed: true, reasons: [] }],
  precisionLoss: false, passed: true, ...over,
});

const gatesLoose = { ...DEFAULT_GATES, minBlocks: { screen: 0, confirm: 0 }, minPairedBlocks: 2 };

/** 64 paired blocks where the candidate wins every block — a promotable delta. */
const promotable = () => {
  const s = Array.from({ length: 64 }, (_, i) => [
    scenario(`b${i}-AB`, `b${i}`, "AB", ["pa", "pb"]),
    scenario(`b${i}-BA`, `b${i}`, "BA", ["pb", "pa"]),
  ]).flat();
  return { scenarios: s, baseRs: s.map((x) => record(x, "lost")), candRs: s.map((x) => record(x, "won", 0)) };
};

describe("candidate experiment descriptor", () => {
  it("example-candidate.json parses and declares exactly one parameter change", () => {
    expect(experiment.declaredComparisons).toEqual(["pvp"]);
    expect(experiment.patch.file).toBe("cards");
    expect(experiment.patch.path.join("/")).toBe("effects/1/amount");
    expect(() =>
      parseCandidateExperiment({ ...JSON.parse(readFileSync(EXPERIMENT_PATH, "utf8")), extra: 1 }),
    ).toThrow(/unknown key/);
  });

  it("patch applies to a copy only and verifies the declared 'from'", () => {
    const raw = readRawDataDir(DATA_DIR);
    const patched = applyDeclaredPatch(raw, experiment.patch) as Record<string, unknown[]>;
    // Exactly one element of one file changed.
    const card = (patched.cards as { id: string; effects: { amount?: number }[] }[]).find((c) => c.id === "m05_thuong_pha")!;
    expect(card.effects[1]!.amount).toBe(4);
    const untouched = (patched.cards as { id: string }[]).filter((c) => c.id !== "m05_thuong_pha");
    expect(untouched).toEqual((raw.cards as { id: string }[]).filter((c) => c.id !== "m05_thuong_pha"));
    // Declared-from guard catches stale copies and silent extra edits.
    expect(() => applyDeclaredPatch(raw, { ...experiment.patch, from: 2 })).toThrow(/declared "from"/);
    expect(() => applyDeclaredPatch(raw, { ...experiment.patch, selectId: "missing" })).toThrow(/no element/);
    // The patched copy must still pass the shipped schema + cross-checks.
    expect(() => parseGameData(patched)).not.toThrow();
  });

  it("filename mapping covers every shipped data file", () => {
    const raw = readRawDataDir(DATA_DIR);
    expect(Object.keys(raw).length).toBeGreaterThanOrEqual(20);
    expect(dataFileKey("moon-phases.json")).toBe("moonPhases");
    expect(dataFileKey("combat-config.json")).toBe("combatConfig");
    expect(dataFileKey("heroes.json")).toBe("heroes");
  });
});

describe("end-to-end candidate workflow", () => {
  it("frozen setup/policies compare a known data effect; production data stays byte-identical", { timeout: 120000 }, () => {
    const hashBefore = dataDirHash(DATA_DIR);
    const baseline = loadDataDir(DATA_DIR);
    // Materialize the candidate copy at the declared path — scratch output, never packages/data.
    const candidateDir = resolve(REPO_ROOT, experiment.candidateDataPath);
    rmSync(candidateDir, { recursive: true, force: true });
    mkdirSync(candidateDir, { recursive: true });
    for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
      copyFileSync(join(DATA_DIR, file), join(candidateDir, file));
    }
    writeFileSync(
      join(candidateDir, `${experiment.patch.file}.json`),
      `${JSON.stringify((applyDeclaredPatch(readRawDataDir(candidateDir), experiment.patch) as Record<string, unknown>)[experiment.patch.file], null, 2)}\n`,
    );
    const candidate = loadDataDir(candidateDir);
    expect(dataDirHash(candidateDir)).not.toBe(dataDirHash(DATA_DIR));

    const parsed = parseExperimentConfig(
      JSON.parse(readFileSync(resolve(REPO_ROOT, experiment.manifestPath), "utf8")),
    );
    // Descriptor paths are repo-root-relative; tests run from packages/rules.
    const config = {
      ...parsed,
      poolPath: resolve(REPO_ROOT, parsed.poolPath),
      profilePath: resolve(REPO_ROOT, parsed.profilePath),
    };
    const baseManifest = buildManifest(baseline, config, { rulesSrcDir: RULES_SRC, sourceRevision: "test" });
    const candManifest = buildManifest(candidate, { ...config, id: `${config.id}-candidate` }, { rulesSrcDir: RULES_SRC, sourceRevision: "test" });
    // Data changed, everything else frozen — the only legal comparison axis.
    expect(candManifest.dataHash).not.toBe(baseManifest.dataHash);
    expect(candManifest.policyHash).toBe(baseManifest.policyHash);
    expect(candManifest.poolHash).toBe(baseManifest.poolHash);
    expect(candManifest.engineHash).toBe(baseManifest.engineHash);

    const baseRs = runExperiment(baseline, baseManifest);
    const candRs = runExperiment(candidate, candManifest);
    const report = buildBalanceReport(baseManifest, baseRs, candManifest, candRs, null, gatesLoose);
    expect(report.comparison).not.toBeNull();
    // Synthetic evidence without a calibration artifact can never reach review-candidate.
    const review = reviewCandidate(report, experiment.declaredComparisons);
    expect(["inconclusive", "human-check-required"]).toContain(review.status);
    if (report.comparison!.promote) expect(review.status).toBe("human-check-required");
    expect(dataDirHash(DATA_DIR)).toBe(hashBefore);
  });
});

describe("reviewCandidate", () => {
  it("hash mismatch prevents promotion", () => {
    const { scenarios, baseRs, candRs } = promotable();
    expect(() =>
      buildBalanceReport(manifestFor(scenarios), baseRs, manifestFor(scenarios, { id: "c", policyHash: "other" }), candRs, null, gatesLoose),
    ).toThrow(/policyHash/);
    // Stale artifact → human-check-required, never review-candidate.
    const stale = buildBalanceReport(
      manifestFor(scenarios), baseRs, manifestFor(scenarios, { id: "c", dataHash: "d2" }), candRs,
      artifact({ dataHash: "dat-old" }), gatesLoose,
    );
    expect(reviewCandidate(stale).status).toBe("human-check-required");
  });

  it("insufficient evidence and contradictory profiles block recommendation", () => {
    const { scenarios, baseRs, candRs } = promotable();
    const few = scenarios.slice(0, 4);
    const thin = buildBalanceReport(
      manifestFor(few), baseRs.slice(0, 4), manifestFor(few, { id: "c", dataHash: "d2" }), candRs.slice(0, 4),
      artifact(), { ...gatesLoose, minBlocks: { screen: 8, confirm: 8 } },
    );
    expect(thin.status).toBe("insufficient-data");
    expect(reviewCandidate(thin).status).toBe("inconclusive");

    const s = [
      scenario("b1-AB", "b1", "AB", ["pa", "pb"]), scenario("b1-BA", "b1", "BA", ["pb", "pa"]),
      scenario("b2-AB", "b2", "AB", ["pb", "pa"]), scenario("b2-BA", "b2", "BA", ["pa", "pb"]),
    ];
    const drawRs = s.map((x) => record(x, "draw"));
    const splitRs = [record(s[0]!, "won", 0), record(s[1]!, "lost"), record(s[2]!, "lost"), record(s[3]!, "won", 0)];
    const sensitive = buildBalanceReport(manifestFor(s), drawRs, manifestFor(s, { id: "c", dataHash: "d2" }), splitRs, null, gatesLoose);
    expect(sensitive.status).toBe("policy-sensitive");
    expect(reviewCandidate(sensitive).status).toBe("policy-sensitive");
  });

  it("a passed artifact promotes only inside declared calibrated scope", () => {
    const { scenarios, baseRs, candRs } = promotable();
    const cand = manifestFor(scenarios, { id: "c", dataHash: "d2" });
    // Fresh human artifact covering pvp → review-candidate.
    const ok = buildBalanceReport(manifestFor(scenarios), baseRs, cand, candRs, artifact(), gatesLoose);
    expect(ok.status).toBe("ok");
    expect(ok.comparison!.promote).toBe(true);
    expect(reviewCandidate(ok, ["pvp"])).toEqual({
      status: "review-candidate",
      reasons: ["all gates passed — decision packet ready for manual review"],
    });
    // Artifact calibrated only for "run" — pvp evidence is outside its scope.
    const offScope = buildBalanceReport(
      manifestFor(scenarios), baseRs, cand, candRs,
      artifact({ scope: ["run:novice"], scopeResults: [{ scope: "run:novice", passed: true, reasons: [] }] }),
      gatesLoose,
    );
    const review = reviewCandidate(offScope, ["pvp"]);
    expect(review.status).toBe("human-check-required");
    expect(review.reasons.join(" ")).toMatch(/no calibrated scope covers mode "pvp"/);
    // Mode outside the preregistered family also blocks promotion.
    const out = reviewCandidate(ok, ["story"]);
    expect(out.status).toBe("human-check-required");
    expect(out.reasons.join(" ")).toMatch(/outside declared comparisons/);
  });
});
