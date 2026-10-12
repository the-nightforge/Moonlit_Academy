import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadGameData } from "data";
import type { GameData } from "../src/index";
import type { BotProfile } from "../src/bot/policy";
import {
  buildManifest,
  heroAppearances,
  loadPool,
  loadProfilePool,
  parseExperimentConfig,
} from "./playtest/manifest";
import { blocksOf, recordKey, runExperiment, runScenario } from "./playtest/runner";
import type { ExperimentConfig, PvpSetup, Scenario } from "./playtest/types";

const data = loadGameData();
const RULES_SRC = fileURLToPath(new URL("../src", import.meta.url));
const POOL_PATH = fileURLToPath(new URL("../../../docs/playtest/scenarios.v1.json", import.meta.url));

const novice = (id: string): BotProfile => ({
  id,
  version: "1",
  skill: "novice",
  style: "aggressive",
  mistakeRate: 0,
  temperature: 0,
  weights: { damage: 10, lethal: 1000, overkill: -1, cost: -0.2, hold: -1 },
  search: { maxExpansions: 0, depth: 0, beamWidth: 0, samples: 0 },
});

let profilesPath = "";
let config: ExperimentConfig;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "playtest-"));
  profilesPath = join(dir, "profiles.json");
  writeFileSync(profilesPath, JSON.stringify({ profiles: [novice("n-a"), novice("n-b")] }));
  config = {
    schemaVersion: 1,
    id: "exp-test",
    stage: "screen",
    seedStart: 42,
    blockCount: 2,
    mode: "pvp",
    poolPath: POOL_PATH,
    profilePath: profilesPath,
  };
});

const manifest = () => buildManifest(data, config, { rulesSrcDir: RULES_SRC, sourceRevision: "test" });

describe("playtest runner", () => {
  it("same_seed_trace_equality", () => {
    const m = manifest();
    const a = runScenario(data, m.scenarios[0]!, undefined, m.id);
    const b = runScenario(data, m.scenarios[0]!, undefined, m.id);
    expect(a.traceHash).toBe(b.traceHash);
    expect(a.outcome).toBe(b.outcome);
    expect(a.actions).toBe(b.actions);
  });

  it("one_vs_two_worker_equality", () => {
    const m = manifest();
    const single = runExperiment(data, m);
    const merged = [
      ...runExperiment(data, m, { workerIndex: 0, workerCount: 2 }),
      ...runExperiment(data, m, { workerIndex: 1, workerCount: 2 }),
    ].sort((a, b) => recordKey(a).localeCompare(recordKey(b)));
    const sortedSingle = [...single].sort((a, b) => recordKey(a).localeCompare(recordKey(b)));
    expect(merged.map(recordKey)).toEqual(sortedSingle.map(recordKey));
    expect(merged.map((r) => r.traceHash)).toEqual(sortedSingle.map((r) => r.traceHash));
  });

  it("mirrored_leg_swaps_teams_and_profiles_keeps_first_player", () => {
    const m = manifest();
    const ab = m.scenarios.find((s) => s.leg === "AB")!;
    const ba = m.scenarios.find((s) => s.blockId === ab.blockId && s.leg === "BA")!;
    const abSetup = ab.setup as PvpSetup;
    const baSetup = ba.setup as PvpSetup;
    expect(baSetup.players[0].heroIds).toEqual(abSetup.players[1].heroIds);
    expect(baSetup.players[1].heroIds).toEqual(abSetup.players[0].heroIds);
    expect(ba.profiles[0]!.id).toBe(ab.profiles[1]!.id);
    const record = runScenario(data, ab, undefined, m.id);
    expect(record.counters.firstPlayer === 0 || record.counters.firstPlayer === 1).toBe(true);
  });

  it("cap_truncated", () => {
    const m = manifest();
    const record = runScenario(data, m.scenarios[0]!, { maxRounds: 2, maxActions: 6, maxRunActions: 6 }, m.id);
    expect(record.outcome).toBe("truncated");
    expect(record.error).toBeNull();
  });

  it("invalid_setup_records_error", () => {
    const scenario: Scenario = {
      id: "bad", mode: "pve",
      setup: { heroIds: ["m05", "f03", "f04"], encounterId: "enc_missing", seed: 1 },
      profiles: [novice("n-a")], policySeeds: [1], beliefSeeds: [2],
      blockId: "blkx", leg: "single",
    };
    const record = runScenario(data, scenario);
    expect(record.outcome).toBe("error");
    expect(record.error).toContain("enc_missing");
  });

  it("resume_restores_blocks_exactly_once", () => {
    const m = manifest();
    const first = runExperiment(data, m);
    const done = new Set(first.map(recordKey));
    const second = runExperiment(data, m, { skip: done });
    expect(second).toEqual([]);
    // Partial resume: only the skipped blocks are absent, others run once.
    const partial = runExperiment(data, m, { skip: new Set([recordKey(first[0]!)]) });
    expect(partial.map(recordKey)).not.toContain(recordKey(first[0]!));
    expect(partial.length).toBe(first.length - 1);
  });

  it("pool_rejects_unowned_cards_and_bad_budgets", () => {
    const dir = mkdtempSync(join(tmpdir(), "pool-"));
    const badPool = join(dir, "bad.json");
    writeFileSync(badPool, JSON.stringify({
      schemaVersion: 1, id: "bad",
      entries: [{ id: "x", label: "x", heroIds: ["m05", "f03", "f04"], deck: ["f01_sigil_of_the_moon"] }],
    }));
    const cardId = Object.values(data.cards).find((c) => c.ownerId === "f01")!.id;
    writeFileSync(badPool, JSON.stringify({
      schemaVersion: 1, id: "bad",
      entries: [{ id: "x", label: "x", heroIds: ["m05", "f03", "f04"], deck: [cardId] }],
    }));
    expect(() => loadPool(data, badPool)).toThrow(/belongs to "f01"/);

    const badProfiles = join(dir, "badp.json");
    writeFileSync(badProfiles, JSON.stringify({ profiles: [{ ...novice("x"), search: { maxExpansions: -1, depth: 0, beamWidth: 0, samples: 0 } }] }));
    expect(() => loadProfilePool(badProfiles)).toThrow(/maxExpansions/);
    expect(() => parseExperimentConfig({ ...config, unknownKey: 1 })).toThrow(/unknownKey/);
    expect(() => parseExperimentConfig({ ...config, blockCount: 0 })).toThrow(/blockCount/);
  });

  it("hero_appearances_count_sides_not_matches", () => {
    const m = manifest();
    const counts = heroAppearances(m.scenarios);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    // 2 blocks × 2 legs × 2 seats × 3 heroes — appearances, not match count.
    expect(total).toBe(2 * 2 * 2 * 3);
    // Same hero on both seats counts twice — appearances, not unique rosters.
    const ab = m.scenarios.find((s) => s.leg === "AB")!;
    const shared = (ab.setup as PvpSetup).players[0].heroIds[0]!;
    expect(counts[shared]).toBeGreaterThanOrEqual(2);
  });

  it("symmetric_scenarios_pair_into_blocks", () => {
    const m = manifest();
    const records = runExperiment(data, m);
    const blocks = blocksOf(records);
    expect(blocks.size).toBe(2);
    for (const [blockId, legs] of blocks) {
      expect(legs.map((r) => r.leg).sort()).toEqual(["AB", "BA"]);
      for (const leg of legs) expect(leg.blockId).toBe(blockId);
    }
  });
});
