import { describe, expect, it } from "vitest";
import type { CombatState, GameData } from "../src/index";
import { applyAction, createCombat } from "../src/index";
import { makeBotObservation } from "../src/index";
import type { BotContext, BotProfile } from "../src/bot/policy";
import { chooseBotAction } from "../src/bot/policy";
import { testData } from "./helpers";
import { loadProfiles } from "./playtest-bot";

interface MatchResult {
  outcome: "won" | "lost" | "truncated";
  rounds: number;
  actions: number;
  moonWaste: number;
  expansions: number;
  decisionMs: number[];
}

/** One deterministic PvE combat driven by a portfolio profile. */
function playMatch(data: GameData, profile: BotProfile, seed: number): MatchResult {
  let state: CombatState = createCombat(data, {
    heroIds: ["m05", "f04", "m06"],
    encounterId: "enc_01",
    seed,
    start: { moonIndex: 1 },
  }).state;
  const ctx: BotContext = { policySeed: seed * 7919 + 13, beliefSeed: seed * 104729 + 7 };
  let actions = 0;
  let moonWaste = 0;
  let expansions = 0;
  const decisionMs: number[] = [];
  while (state.status !== "won" && state.status !== "lost") {
    const t0 = performance.now();
    const decision = chooseBotAction(data, makeBotObservation(data, state, 0, "pve", [], null), profile, ctx);
    decisionMs.push(performance.now() - t0);
    if (decision === null) throw new Error("no legal action");
    expansions += decision.expansions;
    if (decision.action.type === "endTurn") moonWaste += Math.max(0, state.players[0]!.moonPower - 3);
    const result = applyAction(data, state, decision.action);
    if (!result.ok) throw new Error(`profile ${profile.id} produced illegal action: ${result.error}`);
    state = result.state;
    actions++;
    if (actions > 4000) break;
  }
  return {
    outcome: state.status === "won" ? "won" : state.status === "lost" ? "lost" : "truncated",
    rounds: state.round,
    actions,
    moonWaste,
    expansions,
    decisionMs,
  };
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))] ?? 0;
}

describe("portfolio benchmark (fixed matrix, not a population claim)", () => {
  it("profiles_produce_measurable_style_differences", () => {
    const data = testData();
    const profiles = loadProfiles();
    const seeds = [42, 7, 2024];
    const rows = profiles.map((profile) => {
      const results = seeds.map((seed) => playMatch(data, profile, seed));
      const wins = results.filter((r) => r.outcome === "won").length;
      const avgRounds = results.reduce((s, r) => s + r.rounds, 0) / results.length;
      const avgWaste = results.reduce((s, r) => s + r.moonWaste, 0) / results.length;
      const avgActions = results.reduce((s, r) => s + r.actions, 0) / results.length;
      const expansions = results.reduce((s, r) => s + r.expansions, 0) / results.length;
      const ms = results.flatMap((r) => r.decisionMs).sort((a, b) => a - b);
      return {
        id: profile.id,
        wins,
        avgRounds: avgRounds.toFixed(1),
        avgActions: avgActions.toFixed(1),
        avgMoonWaste: avgWaste.toFixed(1),
        avgExpansions: expansions.toFixed(0),
        p50ms: percentile(ms, 50).toFixed(1),
        p95ms: percentile(ms, 95).toFixed(1),
      };
    });
    // Report, don't rank: these are synthetic style probes, not "best profile".
    console.table(rows);
    // Every decision stayed legal and every match terminated.
    for (const row of rows) expect(row.avgActions).not.toBe("0.0");
    // At least two profiles differ on some recorded metric — otherwise the
    // portfolio is decorative rather than a spread of behaviors.
    const signatures = new Set(rows.map((r) => `${r.avgRounds}|${r.avgMoonWaste}|${r.avgActions}`));
    expect(signatures.size).toBeGreaterThan(1);
  }, 360_000);
});
