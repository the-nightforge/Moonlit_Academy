import { describe, expect, it } from "vitest";
import { parseGameData } from "data";
import { applyAction, chooseCombatAction, createCombat, createStoryCombat, replayStoryCombat, starterDeck } from "../src/index";
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
