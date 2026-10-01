import { describe, expect, it } from "vitest";
import { parseGameData } from "data";
import {
  applyAction, applyStoryResult, chooseCombatAction, createCombat, createProfile, createStoryCombat,
  mergeImportedProfile, parseProfile, replayStoryCombat, starterDeck, storyStageUnlocked, unlockedStageIds,
} from "../src/index";
import type { Action, StorySetup } from "../src/index";
import { rawTestInput, testData, withTestStory } from "./helpers";

const arc = (over: object = {}) => ({ id: "t_arc1", name: "A", stageIds: ["t_s1"], rewardHeroId: "m10", ...over });
const stage = (over: object = {}) => ({
  id: "t_s1", arcId: "t_arc1", name: "S", encounterId: "t_story_enc", before: [{ speaker: "narrator", text: "…" }],
  after: [], firstClear: { moonJade: 50 }, ...over,
});
const withStory = (story: { arcs: object[]; stages: object[] }) => {
  const raw = rawTestInput();
  raw.encounters = [...raw.encounters, { id: "t_story_enc", name: "E", enemyIds: ["puppet_guard"], tier: "story" }];
  raw.story = story;
  return () => parseGameData(raw);
};

describe("story data", () => {
  it("T300: story.json cross-checks arcs, stages, encounters, speakers and start", () => {
    expect(() => withStory({ arcs: [arc()], stages: [stage()] })()).not.toThrow();
    expect(withStory({ arcs: [arc({ stageIds: ["t_missing"] })], stages: [stage()] })).toThrow(/t_missing/);
    expect(withStory({ arcs: [arc(), arc({ id: "t_arc2" })], stages: [stage()] })).toThrow(/more than one arc/);
    expect(withStory({ arcs: [arc()], stages: [stage({ arcId: "t_arc2" })] })).toThrow(/arcId/);
    expect(withStory({ arcs: [arc()], stages: [stage({ encounterId: "enc_01" })] })).toThrow(/tier "story"/);
    expect(withStory({ arcs: [arc({ rewardHeroId: "x99" })], stages: [stage()] })).toThrow(/x99/);
    expect(withStory({ arcs: [arc()], stages: [stage({ after: [{ speaker: "nobody", text: "a" }] })] })).toThrow(/nobody/);
    expect(withStory({ arcs: [arc()], stages: [stage({ start: { moonIndex: 8 } })] })).toThrow();
  });
});

const TEAM: [string, string, string] = ["m05", "f04", "m06"];
const storyData = () => { const data = testData(); withTestStory(data); return data; };
const setupFor = (data: ReturnType<typeof testData>, stageId: string, seed = 7): StorySetup =>
  ({ stageId, seed, heroIds: TEAM, deckCardIds: starterDeck(data, TEAM) });

function playOut(data: ReturnType<typeof testData>, setup: StorySetup): Action[] {
  let state = createStoryCombat(data, setup).state;
  const actions: Action[] = [];
  for (let i = 0; i < 2000 && state.status !== "won" && state.status !== "lost"; i++) {
    const action = chooseCombatAction(data, state, 0);
    const result = applyAction(data, state, action);
    if (!result.ok) throw new Error(result.error);
    actions.push(action);
    state = result.state;
  }
  return actions;
}

describe("story combat", () => {
  it("T301: replayStoryCombat is deterministic and rejects bad or trailing actions", () => {
    const data = storyData();
    const setup = setupFor(data, "t_a1s1");
    const actions = playOut(data, setup);
    const a = replayStoryCombat(data, setup, actions);
    const b = replayStoryCombat(data, setup, actions);
    expect(a.ok && ["won", "lost"].includes(a.state.status)).toBe(true);
    expect(a).toEqual(b);
    expect(replayStoryCombat(data, setup, [...actions, { type: "endTurn" }])).toEqual({ ok: false, step: actions.length, reason: "actions after end" });
    const bad = replayStoryCombat(data, setup, [{ type: "playCard", instanceId: "nope" }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.step).toBe(0);
  });

  it("T302: start sets the moon and blood moon before round 1 is planned; no start = old createCombat", () => {
    const data = storyData();
    const full = createStoryCombat(data, setupFor(data, "t_a1s2"));
    expect(full.state.moonIndex).toBe(4);
    const blood = createStoryCombat(data, setupFor(data, "t_a2s1"));
    expect(blood.state.bloodMoonRounds).toBe(2);
    expect(blood.events).toContainEqual({ type: "bloodMoonChanged", rounds: 2, cause: "start" });
    // Round-1 intents are planned in the start phase: an enemy with a full-moon override uses it.
    data.enemies["puppet_guard"]!.moonOverrides = [{ phase: "full", intent: { id: "t_full", name: "T", kind: "buff", effects: [{ type: "gainArmor", amount: 1, to: "self" }] } }];
    data.storyStages["t_a1s1"] = { ...data.storyStages["t_a1s1"]!, start: { moonIndex: 4 } };
    const planned = createStoryCombat(data, setupFor(data, "t_a1s1")).state.enemies[0]!.plannedIntents.map((p) => p.intent.id);
    expect(planned).toContain("t_full");
    // Without start, a story combat is exactly createCombat on the stage encounter.
    const plain = createStoryCombat(data, setupFor(data, "t_a2s2"));
    expect(plain).toEqual(createCombat(data, { heroIds: TEAM, encounterId: "enc_01", seed: 7, deckCardIds: starterDeck(data, TEAM) }));
  });
});

describe("story progress", () => {
  it("T303: stages open in order; arc 2 needs all of arc 1", () => {
    const data = storyData();
    const profile = createProfile(data);
    expect(unlockedStageIds(data, profile)).toEqual(["t_a1s1"]);
    profile.story.cleared = ["t_a1s1"];
    expect(storyStageUnlocked(data, profile, "t_a1s2")).toBe(true);
    expect(storyStageUnlocked(data, profile, "t_a2s1")).toBe(false);
    profile.story.cleared = ["t_a1s1", "t_a1s2"];
    expect(storyStageUnlocked(data, profile, "t_a2s1")).toBe(true);
    expect(storyStageUnlocked(data, profile, "t_a2s2")).toBe(false);
    expect(storyStageUnlocked(data, profile, "nope")).toBe(false);
  });

  it("T304: first clear pays once; the last stage of an arc grants its hero, a dupe becomes Tinh Hồn", () => {
    const data = storyData();
    const start = createProfile(data);
    const setup = setupFor(data, "t_a1s1");
    const lost = applyStoryResult(data, start, setup, false);
    expect(lost.rewards).toEqual({ firstClear: false, moonJade: 0, darkIron: 0, gains: [], hero: null });
    expect(lost.profile).toEqual(start);

    const won = applyStoryResult(data, start, setup, true);
    expect(won.profile.story.cleared).toEqual(["t_a1s1"]);
    expect(won.rewards).toMatchObject({ firstClear: true, moonJade: 40, darkIron: 1, hero: null });
    expect(won.rewards.gains.map((g) => [g.heroId, g.xp])).toEqual([["m05", 30], ["f04", 30], ["m06", 30]]);
    expect(won.profile.currencies.moonJade).toBe(start.currencies.moonJade + 40);
    expect(start.story.cleared).toEqual([]); // input not mutated

    const again = applyStoryResult(data, won.profile, setup, true);
    expect(again.rewards.firstClear).toBe(false);
    expect(again.profile).toEqual(won.profile);

    const last = applyStoryResult(data, won.profile, setupFor(data, "t_a1s2"), true);
    expect(last.rewards.hero).toMatchObject({ itemId: "m10", outcome: "newHero" });
    expect(last.profile.heroes["m10"]).toBeDefined();

    const dupe = structuredClone(won.profile);
    dupe.heroes["m10"] = { xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" };
    const dupeResult = applyStoryResult(data, dupe, setupFor(data, "t_a1s2"), true);
    expect(dupeResult.rewards.hero?.outcome).not.toBe("newHero");
    expect(dupeResult.profile.heroes["m10"]!.constellation).toBe(1);
  });

  it("T307: old profiles get an empty story; imports never touch story", () => {
    const data = storyData();
    const saved = JSON.parse(JSON.stringify(createProfile(data))) as Record<string, unknown>;
    delete saved.story;
    expect(parseProfile(data, saved).profile.story).toEqual({ cleared: [] });
    expect(parseProfile(data, { ...saved, story: { cleared: ["t_a1s1", "ghost"] } }).profile.story).toEqual({ cleared: ["t_a1s1"] });
    const server = createProfile(data);
    server.story.cleared = ["t_a1s1"];
    const local = createProfile(data);
    local.story.cleared = ["t_a1s1", "t_a1s2"];
    const merged = mergeImportedProfile(data, server, local);
    expect(merged.ok && merged.profile.story).toEqual({ cleared: ["t_a1s1"] });
  });
});
