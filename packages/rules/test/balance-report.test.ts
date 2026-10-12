import { describe, expect, it } from "vitest";
import { holm, pairedBlockDelta95, pairedBlockDeltas, wilson95 } from "./playtest/statistics";
import { buildBalanceReport, DEFAULT_GATES } from "./playtest/report";
import type { ExperimentManifest, MatchRecord, Scenario } from "./playtest/types";
import type { BotProfile } from "../src/bot/policy";

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

const record = (scenario: Scenario, outcome: MatchRecord["outcome"], winnerSeat: number | null = null): MatchRecord => ({
  experimentId: "exp", scenarioId: scenario.id, blockId: scenario.blockId, leg: scenario.leg,
  outcome, winnerSeat, rounds: 8, actions: 40, counters: {}, traceHash: "h", error: null,
});

describe("statistics", () => {
  it("wilson95 boundaries", () => {
    expect(wilson95(0, 0)).toBeNull();
    const zero = wilson95(0, 100)!;
    expect(zero.estimate).toBe(0);
    expect(zero.lower).toBeGreaterThanOrEqual(0);
    expect(zero.upper).toBeLessThanOrEqual(0.1);
    const full = wilson95(100, 100)!;
    expect(full.upper).toBeLessThanOrEqual(1);
    const half = wilson95(50, 100)!;
    expect(half.lower).toBeCloseTo(0.40383, 4);
    expect(half.upper).toBeCloseTo(0.59617, 4);
  });

  it("paired identical outcomes → delta 0", () => {
    const s = [scenario("a-AB", "b1", "AB", ["p"]), scenario("a-BA", "b1", "BA", ["p"])];
    const rs = s.map((x) => record(x, "won", 0));
    const delta = pairedBlockDelta95(rs, rs, 7, 500)!;
    expect(delta.estimate).toBe(0);
    expect(delta.lower).toBe(0);
    expect(delta.upper).toBe(0);
  });

  it("constant block improvement → zero-width delta", () => {
    const base = [scenario("b-AB", "b1", "AB", ["p"]), scenario("b-BA", "b1", "BA", ["p"])];
    const cand = [scenario("b-AB", "b1", "AB", ["p"]), scenario("b-BA", "b1", "BA", ["p"])];
    const baseRs = base.map((x) => record(x, "lost"));
    const candRs = cand.map((x) => record(x, "won", 0));
    const delta = pairedBlockDelta95(baseRs, candRs, 7, 500)!;
    expect(delta.estimate).toBeCloseTo(1);
    expect(delta.lower).toBeCloseTo(1);
    expect(delta.upper).toBeCloseTo(1);
  });

  it("AB/BA correlated legs stay inside the same block", () => {
    // Candidate improves exactly one leg of b1. A leg-level statistic would
    // produce four deltas; block-level pairing must produce two — b1 +0.5
    // (block mean 0.5 → 1.0), b2 unchanged.
    const mk = (blk: string, leg: "AB" | "BA") => scenario(`${blk}-${leg}`, blk, leg, ["p"]);
    const sc = [mk("b1", "AB"), mk("b1", "BA"), mk("b2", "AB"), mk("b2", "BA")];
    const baseRs = [record(sc[0]!, "won", 0), record(sc[1]!, "lost"), record(sc[2]!, "won", 0), record(sc[3]!, "won", 0)];
    const candRs = [record(sc[0]!, "won", 0), record(sc[1]!, "won", 0), record(sc[2]!, "won", 0), record(sc[3]!, "won", 0)];
    const { deltas, pairedBlocks } = pairedBlockDeltas(baseRs, candRs);
    expect(pairedBlocks).toBe(2);
    expect(deltas.sort((a, b) => a - b)).toEqual([0, 0.5]);
  });

  it("draw half-score uses bootstrap, not binary wilson", () => {
    const s = [scenario("x-AB", "b1", "AB", ["p"]), scenario("x-BA", "b1", "BA", ["p"])];
    const allDraw = s.map((x) => record(x, "draw"));
    const report = buildBalanceReport(manifestFor(s), allDraw, null, null, null, { ...DEFAULT_GATES, minBlocks: { screen: 0, confirm: 0 } });
    expect(report.modes.pvp!.score!.estimate).toBe(0.5);
    expect(report.modes.pvp!.decisiveWinRate).toBeNull(); // no decisive records
  });

  it("holm fixture", () => {
    expect(holm([0.01, 0.03, 0.2])).toEqual([0.03, 0.06, 0.2]);
  });
});

describe("gates", () => {
  const gatesLoose = { ...DEFAULT_GATES, minBlocks: { screen: 2, confirm: 4 }, minPairedBlocks: 1 };

  it("low coverage → insufficient-data", () => {
    const s = [scenario("s-AB", "b1", "AB", ["p"])];
    const report = buildBalanceReport(manifestFor(s), [record(s[0]!, "won", 0)], null, null, null, DEFAULT_GATES);
    expect(report.status).toBe("insufficient-data");
  });

  it("mixed policy hash rejects comparison; data may differ", () => {
    const s = [scenario("s-AB", "b1", "AB", ["p"]), scenario("s-BA", "b1", "BA", ["p"])];
    const rs = s.map((x) => record(x, "won", 0));
    const base = manifestFor(s);
    const candOk = manifestFor(s, { id: "cand", dataHash: "dat-v2" });
    expect(() => buildBalanceReport(base, rs, candOk, rs, null, gatesLoose)).not.toThrow();
    const candBad = manifestFor(s, { id: "cand", policyHash: "pol-v2" });
    expect(() => buildBalanceReport(base, rs, candBad, rs, null, gatesLoose)).toThrow(/policyHash/);
  });

  it("truncate boundary is strict >0.5%", () => {
    const scenarios = Array.from({ length: 200 }, (_, i) => scenario(`s${i}`, `b${i}`, "single" as never, ["p"]));
    // 1 truncated / 200 = 0.5% exactly → still valid.
    const exact = scenarios.map((s, i) => record(s, i === 0 ? "truncated" : "won", i === 0 ? null : 0));
    const ok = buildBalanceReport(manifestFor(scenarios), exact, null, null, null, { ...gatesLoose, minBlocks: { screen: 0, confirm: 0 } });
    expect(ok.status).not.toBe("invalid-quality");
    // 2/200 = 1% → invalid.
    const over = scenarios.map((s, i) => record(s, i < 2 ? "truncated" : "won", i < 2 ? null : 0));
    const bad = buildBalanceReport(manifestFor(scenarios), over, null, null, null, { ...gatesLoose, minBlocks: { screen: 0, confirm: 0 } });
    expect(bad.status).toBe("invalid-quality");
  });

  it("policy sign reversal → policy-sensitive", () => {
    // Two profiles, opposite deltas across paired blocks.
    const mkSc = (blk: string, leg: "AB" | "BA", profs: string[]) => scenario(`${blk}-${leg}`, blk, leg, profs);
    const s = [mkSc("b1", "AB", ["pa", "pb"]), mkSc("b1", "BA", ["pb", "pa"]), mkSc("b2", "AB", ["pb", "pa"]), mkSc("b2", "BA", ["pa", "pb"])];
    const baseRs = s.map((x) => record(x, "draw"));
    const candRs = [
      record(s[0]!, "won", 0), record(s[1]!, "lost"), // b1: pa wins → delta + for pa
      record(s[2]!, "lost"), record(s[3]!, "won", 0), // b2: pb loses → delta − for pb
    ];
    const report = buildBalanceReport(manifestFor(s), baseRs, manifestFor(s, { id: "c", dataHash: "d2" }), candRs, null, { ...gatesLoose, minBlocks: { screen: 0, confirm: 0 } });
    const signs = new Set(Object.values(report.comparison!.perProfileDelta).map((d) => Math.sign(d)));
    expect(signs.size).toBe(2);
    expect(report.status).toBe("policy-sensitive");
  });

  it("no calibration → human-check-required on promotable delta", () => {
    const s = Array.from({ length: 64 }, (_, i) => [
      scenario(`b${i}-AB`, `b${i}`, "AB", ["pa", "pb"]),
      scenario(`b${i}-BA`, `b${i}`, "BA", ["pb", "pa"]),
    ]).flat();
    const baseRs = s.map((x) => record(x, "lost"));
    const candRs = s.map((x) => record(x, "won", 0));
    const report = buildBalanceReport(
      manifestFor(s), baseRs, manifestFor(s, { id: "c", dataHash: "d2" }), candRs, null,
      { ...gatesLoose, minBlocks: { screen: 0, confirm: 0 }, minPairedBlocks: 2 },
    );
    expect(report.comparison!.promote).toBe(true);
    expect(report.status).toBe("human-check-required");
  });

  it("a stale or failed calibration artifact downgrades evidence", () => {
    const s = Array.from({ length: 64 }, (_, i) => [
      scenario(`b${i}-AB`, `b${i}`, "AB", ["pa", "pb"]),
      scenario(`b${i}-BA`, `b${i}`, "BA", ["pb", "pa"]),
    ]).flat();
    const baseRs = s.map((x) => record(x, "lost"));
    const candRs = s.map((x) => record(x, "won", 0));
    const gates = { ...gatesLoose, minBlocks: { screen: 0, confirm: 0 }, minPairedBlocks: 2 };
    const artifact = (over: object) => ({
      schemaVersion: 1 as const,
      evidence: { kind: "human" as const },
      dataHash: "dat", dataVersion: "dat", engineHash: "eng",
      policyHash: "pol", poolHash: "pool", cohortHash: "co", splitHash: "sp",
      weights: {}, metrics: {}, scope: [], scopeResults: [],
      precisionLoss: false, passed: true, ...over,
    });
    // Fresh + passed → no downgrade.
    const fresh = buildBalanceReport(manifestFor(s), baseRs, manifestFor(s, { id: "c", dataHash: "d2" }), candRs, artifact({}), gates);
    expect(fresh.status).toBe("ok");
    // Failed held-out gates → human-check-required.
    const failed = buildBalanceReport(manifestFor(s), baseRs, manifestFor(s, { id: "c", dataHash: "d2" }), candRs,
      artifact({ passed: false, evidence: { kind: "human", note: "gates failed" } }), gates);
    expect(failed.status).toBe("human-check-required");
    expect(failed.statusReasons.join(" ")).toMatch(/held-out gates not passed/);
    // Stale hash → human-check-required.
    const stale = buildBalanceReport(manifestFor(s), baseRs, manifestFor(s, { id: "c", dataHash: "d2" }), candRs,
      artifact({ dataHash: "dat-old" }), gates);
    expect(stale.status).toBe("human-check-required");
    expect(stale.statusReasons.join(" ")).toMatch(/hash mismatch/);
  });

  it("card correlation labelled not-causal", () => {
    const s = [scenario("s-AB", "b1", "AB", ["p"])];
    const r = { ...record(s[0]!, "won", 0), counters: { "card:m05_strike": 2 } };
    const report = buildBalanceReport(manifestFor(s), [r], null, null, null, { ...gatesLoose, minBlocks: { screen: 0, confirm: 0 } });
    expect(report.cardCorrelations["m05_strike"]!.note).toContain("not causation");
  });
});
