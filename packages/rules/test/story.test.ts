import { describe, expect, it } from "vitest";
import { parseGameData } from "data";
import { rawTestInput } from "./helpers";

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
