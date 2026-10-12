import { describe, expect, it } from "vitest";
import type { Action, CombatEvent, CombatState, PvpSide } from "../src/index";
import { applyAction, createPvpCombat, makeBotObservation, redactEvents } from "../src/index";
import { canonicalActionKey, enumerateBotActions } from "../src/bot/actions";
import type { BotContext, BotProfile } from "../src/bot/policy";
import { chooseBotAction } from "../src/bot/policy";
import {
  componentMap,
  componentOf,
  extractDecisions,
  splitHumanCorpus,
  validateCorpus,
  type HumanReplay,
} from "./playtest/human";
import {
  calibrateProfiles,
  fitDecision,
  gateFailure,
  scaledMae,
  validateCalibration,
  verifyArtifact,
  type CalibrationConfig,
} from "./playtest/calibration";
import { injectCard, makeTestCombat, testData } from "./helpers";
import { testCard } from "./fixtures";

const DATA = testData();
const SIDE: PvpSide = { heroIds: ["m05", "f04", "m06"], loadout: { heroes: {}, pvp: true } };
const DRIVER: BotProfile = {
  id: "driver", version: "1", skill: "novice", style: "tempo",
  mistakeRate: 0, temperature: 0,
  weights: { damage: 3, lethal: 4, control: 1, cost: -0.1 },
  search: { maxExpansions: 0, depth: 0, beamWidth: 0, samples: 0 },
};

const TEST_CONFIG: CalibrationConfig = {
  schemaVersion: 1,
  seed: 7,
  resamples: 200,
  grid: { mistakeRates: [0, 0.2], temperatures: [0, 0.5], budgetScales: [1], weightScales: [1] },
  floors: { minPlayers: 2, minReplays: 2, minDecisions: 1, minClusters: 2, scaleFloor: 1 },
  gates: { mae: { estimateMax: 0.1, upperMax: 0.15 }, behavioral: { estimateMax: 0.25, upperMax: 0.4 } },
  caps: { maxRounds: 60, maxActions: 4000 },
};

/**
 * Drives a real PvP match like the realtime room does: each accepted action
 * is logged `{player: seat, action}` with the seat stamped inside the action.
 * Returns the recorded entries plus the terminal state.
 */
function drivePvp(seed: number, maxActions = 120): { entries: { player: number; action: Action }[]; state: CombatState } {
  let state = createPvpCombat(DATA, { seed, players: [SIDE, SIDE] }).state;
  const entries: { player: number; action: Action }[] = [];
  const histories = new Map<number, CombatEvent[]>();
  while (state.status !== "won" && state.status !== "lost" && entries.length < maxActions) {
    const seat = state.status === "mulligan"
      ? state.players.find((p) => !p.mulliganDone)!.index
      : state.activePlayer;
    const obs = makeBotObservation(DATA, state, seat, "pvp", histories.get(seat) ?? [], SIDE.heroIds.flatMap((id) => DATA.heroes[id]!.cardIds));
    const ctx: BotContext = { policySeed: seed + entries.length, beliefSeed: seed * 3 + entries.length };
    const decision = chooseBotAction(DATA, obs, DRIVER, ctx);
    if (decision === null) throw new Error("driver: no legal action");
    const action = { ...decision.action, player: seat } as Action;
    const result = applyAction(DATA, state, action);
    if (!result.ok) throw new Error(`drive failed at ${entries.length}: ${result.error}`);
    entries.push({ player: seat, action });
    state = result.state;
    for (let s = 0; s < state.players.length; s++) {
      const feed = histories.get(s) ?? [];
      feed.push(...redactEvents(result.events, s));
      histories.set(s, feed);
    }
  }
  return { entries, state };
}

function pvpReplay(id: string, seed: number, participantIds = ["pt_a", "pt_b"], overrides: Partial<HumanReplay> = {}): HumanReplay {
  const { entries, state } = drivePvp(seed);
  const winner = state.winner;
  return {
    schemaVersion: 1,
    id,
    groupId: "pilot",
    participantIds,
    humanSeats: [0, 1],
    skillLabels: ["novice", "novice"],
    mode: "pvp",
    dataHash: "v_test",
    engineHash: "e_test",
    setup: { seed, players: [SIDE, SIDE] },
    actions: entries.map((e) => e.action),
    actionSources: entries.map(() => "human" as const),
    result: JSON.stringify({ winner: winner === "draw" ? "draw" : winner, reason: "combat" }),
    termination: "combat",
    ...overrides,
  };
}

function mkReplay(id: string, overrides: Partial<HumanReplay> = {}): HumanReplay {
  return {
    schemaVersion: 1, id, groupId: "g",
    participantIds: ["pt_x"], humanSeats: [0], skillLabels: ["novice"],
    mode: "story", dataHash: "v_test", engineHash: "e_test",
    setup: { stageId: "s1" },
    actions: [{ type: "endTurn" }] as Action[],
    actionSources: ["human"], result: "won", termination: "combat",
    ...overrides,
  };
}

describe("human corpus", () => {
  it("component split never separates replays sharing a participant", () => {
    const replays = [
      mkReplay("r1", { participantIds: ["pt_a", "pt_b"] }),
      mkReplay("r2", { participantIds: ["pt_a", "pt_c"] }),
      mkReplay("r3", { participantIds: ["pt_d", "pt_e"] }),
      mkReplay("r4", { participantIds: ["pt_c", "pt_f"] }),
    ];
    // a→b→c→f form one transitive component (a-c linked, c-f linked) → same key.
    const components = componentMap(replays);
    expect(components.get("r1")).toBe(components.get("r2"));
    expect(components.get("r2")).toBe(components.get("r4"));
    expect(components.get("r3")).not.toBe(components.get("r1"));
    // Holds for every salt, not just a lucky hash.
    for (let salt = 0; salt < 16; salt++) {
      const { train } = splitHumanCorpus(replays, `salt-${salt}`);
      const sideOf = (id: string) => (train.some((r) => r.id === id) ? "train" : "test");
      expect(sideOf("r1")).toBe(sideOf("r2"));
      expect(sideOf("r2")).toBe(sideOf("r4"));
    }
    // Deterministic: same input + salt → identical split.
    const { train } = splitHumanCorpus(replays, "salt-1");
    const again = splitHumanCorpus(replays, "salt-1");
    expect(again.train.map((r) => r.id)).toEqual(train.map((r) => r.id));
  });

  it("the literal bot seat never links two human components", () => {
    const a = mkReplay("ra", { participantIds: ["pt_a", "bot"] });
    const b = mkReplay("rb", { participantIds: ["pt_y", "bot"] });
    expect(componentOf(a)).not.toBe(componentOf(b));
  });

  it("validateCorpus drops are counted, never silently skipped", () => {
    const replays = [
      mkReplay("ok"),
      mkReplay("old", { dataHash: "v_other" }),
      mkReplay("inc", { termination: "incomplete" }),
      mkReplay("empty", { actions: [] }),
      mkReplay("lost", { result: "lost", termination: "resign" }),
      mkReplay("drop", { result: "lost", termination: "disconnect" }),
    ];
    const { accepted, quality } = validateCorpus(replays, "v_test");
    expect(accepted.map((r) => r.id).sort()).toEqual(["drop", "lost", "ok"]);
    expect(quality).toMatchObject({
      total: 6, accepted: 3, droppedIncomplete: 1, droppedVersion: 1, droppedEmpty: 1,
    });
    expect(quality.terminations.resign).toBe(1);
    expect(quality.terminations.disconnect).toBe(1);
  });
});

describe("decision reconstruction", () => {
  it("rebuilds observations from the action prefix only — later divergence changes nothing", () => {
    const base = pvpReplay("r_base", 11);
    const k = 10;
    const diverged: HumanReplay = { ...base, id: "r_div", actions: base.actions.slice(0, k) };
    const a = extractDecisions(DATA, base);
    const b = extractDecisions(DATA, diverged);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const aEarly = a.decisions.filter((d) => d.actionIndex < k);
    const bEarly = b.decisions;
    expect(bEarly.length).toBe(aEarly.length);
    for (let i = 0; i < aEarly.length; i++) {
      // Same prefix → byte-identical observation, even though the replay
      // continues differently afterwards.
      expect(bEarly[i]!.observation).toEqual(aEarly[i]!.observation);
    }
  });

  it("the observation at a divergent action is the state, not the logged action", () => {
    const base = pvpReplay("r_base2", 13);
    // Find the earliest index whose rebuilt state offers a different legal
    // action than the logged one — both replays then share the prefix.
    let state = createPvpCombat(DATA, base.setup as Parameters<typeof createPvpCombat>[1]).state;
    const own = SIDE.heroIds.flatMap((id) => DATA.heroes[id]!.cardIds);
    let k = -1;
    let altAction: Action | null = null;
    for (let i = 0; i < base.actions.length; i++) {
      const logged = base.actions[i] as Action;
      const seat = (logged as { player?: number }).player ?? state.activePlayer;
      const obs = makeBotObservation(DATA, state, seat, "pvp", [], own);
      const alt = enumerateBotActions(DATA, obs).find(
        (a) => canonicalActionKey(a) !== canonicalActionKey(logged),
      );
      if (alt !== undefined) {
        k = i;
        altAction = { ...alt, player: seat } as Action;
        break;
      }
      const applied = applyAction(DATA, state, logged);
      if (!applied.ok) throw new Error(applied.error);
      state = applied.state;
    }
    expect(altAction).not.toBeNull();
    const changed: HumanReplay = { ...base, id: "r_div2", actions: [...base.actions.slice(0, k), altAction!] };
    const a = extractDecisions(DATA, base);
    const b = extractDecisions(DATA, changed);
    const atK_A = a.decisions.find((d) => d.actionIndex === k);
    const atK_B = b.decisions.find((d) => d.actionIndex === k);
    expect(atK_A).toBeDefined();
    expect(atK_B).toBeDefined();
    // Same state → identical observation even though the recorded action differs.
    expect(atK_B!.observation).toEqual(atK_A!.observation);
  });

  it("only human-sourced actions become decisions; bot/system are excluded", () => {
    const replay = pvpReplay("r_mixed", 17, ["pt_a", "bot"], {
      humanSeats: [0],
      skillLabels: ["novice", "novice"],
    });
    const sources = replay.actions.map((_, i) =>
      i % 5 === 0 ? "system" : replay.actions[i] && (replay.actions[i] as { player?: number }).player === 1 ? "bot" : "human",
    );
    const mixed: HumanReplay = { ...replay, actionSources: sources };
    const { decisions, error } = extractDecisions(DATA, mixed);
    expect(error).toBeNull();
    expect(decisions.every((d) => d.seat === 0)).toBe(true);
    expect(decisions.length).toBe(sources.filter((s) => s === "human").length);
    expect(decisions.length).toBeGreaterThan(0);
  });

  it("a corrupt log returns the prefix decisions plus an error", () => {
    const replay = pvpReplay("r_bad", 19);
    const broken: HumanReplay = {
      ...replay,
      actions: [...replay.actions.slice(0, 6), { type: "playCard", instanceId: "nope" } as Action],
    };
    const { decisions, error } = extractDecisions(DATA, broken);
    expect(error).not.toBeNull();
    expect(decisions.length).toBeGreaterThan(0);
  });
});

describe("gates and artifact", () => {
  it("MAE 0.10 passes only when upper95 ≤ 0.15; behavioral 0.25 only when upper ≤ 0.40", () => {
    const mae = TEST_CONFIG.gates.mae;
    const behavior = TEST_CONFIG.gates.behavioral;
    const iv = (estimate: number, upper: number, n = 50) => ({ estimate, lower: estimate - 0.02, upper, n });
    expect(gateFailure(iv(0.1, 0.15), mae)).toBeNull();
    expect(gateFailure(iv(0.1, 0.16), mae)).not.toBeNull();
    expect(gateFailure(iv(0.11, 0.14), mae)).not.toBeNull();
    expect(gateFailure(iv(0.25, 0.4), behavior)).toBeNull();
    expect(gateFailure(iv(0.24, 0.41), behavior)).not.toBeNull();
    expect(gateFailure(null, mae)).not.toBeNull();
  });

  it("zero-variance strata normalize by the scale floor, never divide by zero", () => {
    expect(scaledMae([0.2, 0.2, 0.2], 1)).toBeCloseTo(0.2);
    expect(scaledMae([], 1)).toBeNaN();
    // Variance (0.027) < floor 1 → denominator is 1, result is the raw MAE.
    expect(scaledMae([0, 0.4, 0.2], 1)).toBeCloseTo(0.2);
  });

  it("an empty corpus reports synthetic evidence and fails", () => {
    const artifact = validateCalibration(DATA, [], [DRIVER], TEST_CONFIG, "v_test");
    expect(artifact.passed).toBe(false);
    expect(artifact.evidence.kind).toBe("synthetic");
  });

  it("a corpus below the player floor fails with the reason surfaced", () => {
    const replays = [pvpReplay("r_p1", 21, ["pt_a", "pt_b"])];
    const artifact = validateCalibration(DATA, replays, [DRIVER], TEST_CONFIG, "v_test");
    expect(artifact.passed).toBe(false);
    expect(artifact.evidence.kind).toBe("human");
    expect(artifact.evidence.note).toMatch(/replays 1 < 2/);
  });

  it("a hash mismatch invalidates the artifact", () => {
    const replay = pvpReplay("r_h", 23);
    const artifact = validateCalibration(DATA, [replay], [DRIVER], TEST_CONFIG, "v_test");
    expect(artifact.dataVersion).toBe("v_test");
    expect(verifyArtifact(artifact, { dataHash: artifact.dataHash }).valid).toBe(true);
    const bad = verifyArtifact(artifact, { dataHash: "v_new", policyHash: "other" });
    expect(bad.valid).toBe(false);
    expect(bad.mismatches).toContain("dataHash");
    expect(bad.mismatches).toContain("policyHash");
  });

  it("equal-public-benefit alternatives count as equivalent, separate from exact", () => {
    const { data, state } = makeTestCombat();
    // Overwhelming damage so the two copies are strictly the top scorers.
    const strikeA = testCard({ id: "t_hit_a", cost: 0, target: "enemy", effects: [{ type: "damage", amount: 999, to: "chosen" }] });
    const strikeB = testCard({ id: "t_hit_b", cost: 0, target: "enemy", effects: [{ type: "damage", amount: 999, to: "chosen" }] });
    const a = injectCard(state, data, strikeA, 0);
    const b = injectCard(state, data, strikeB, 0);
    const obs = makeBotObservation(data, state, 0, "pve", [], null);
    const profile: BotProfile = { ...DRIVER, weights: { damage: 100 } };
    // Find which copy argmax prefers, then feed the OTHER as the human play.
    const first = chooseBotAction(data, obs, profile, { policySeed: 1, beliefSeed: 2 })!;
    expect((first.action as { instanceId?: string }).instanceId).toMatch(/^test_t_hit/);
    const humanInstance = (first.action as { instanceId?: string }).instanceId === a ? b : a;
    const enemyId = state.enemies[0]!.id;
    const human: Action = { type: "playCard", instanceId: humanInstance, targetId: enemyId, player: 0 };
    const fit = fitDecision(data, {
      replayId: "r_eq", actionIndex: 0, seat: 0, participant: "pt_a",
      skill: "novice", observation: obs, action: human, component: "pt_a",
    }, profile);
    expect(fit.match).toBe("equivalent");
    // And the argmax copy itself is an exact match.
    const fitExact = fitDecision(data, {
      replayId: "r_eq", actionIndex: 0, seat: 0, participant: "pt_a",
      skill: "novice", observation: obs, action: first.action, component: "pt_a",
    }, profile);
    expect(fitExact.match).toBe("exact");
  });
});

describe("calibrate + held-out", () => {
  it("calibrateProfiles returns every candidate's training loss", () => {
    const replay = pvpReplay("r_tr", 29);
    const { profiles, candidates } = calibrateProfiles(DATA, [replay], [DRIVER], TEST_CONFIG);
    expect(profiles).toHaveLength(1);
    expect(candidates.length).toBe(2 * 2 * 1); // 2 mistake × 2 temp × 1 budget
    expect(candidates.every((c) => c.loss >= 0 && c.loss <= 1)).toBe(true);
    // A driver-built corpus is argmax-consistent → the zero-noise candidate wins.
    const best = [...candidates].sort((a, b) => a.loss - b.loss)[0]!;
    expect(best.mistakeRate).toBe(0);
    expect(best.temperature).toBe(0);
  });

  it("held-out validation emits per-scope results, not one global badge", () => {
    const corpus = [
      pvpReplay("r_v1", 31, ["pt_a", "pt_b"]),
      pvpReplay("r_v2", 37, ["pt_c", "pt_d"]),
      pvpReplay("r_v3", 41, ["pt_e", "pt_f"]),
    ];
    const artifact = validateCalibration(DATA, corpus, [DRIVER], TEST_CONFIG, "v_test");
    expect(artifact.schemaVersion).toBe(1);
    expect(artifact.scopeResults.length).toBeGreaterThan(0);
    for (const scope of artifact.scopeResults) {
      expect(scope.scope).toMatch(/^[a-z]+:[a-z]+$/);
    }
    // Same-corpus determinism.
    const again = validateCalibration(DATA, corpus, [DRIVER], TEST_CONFIG, "v_test");
    expect(again.splitHash).toBe(artifact.splitHash);
    expect(again.policyHash).toBe(artifact.policyHash);
  }, 30000);
});
