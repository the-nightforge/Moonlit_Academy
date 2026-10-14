import { expect, it } from "vitest";
import { loadGameData } from "data";
import { storyProgressModel } from "../src/ui/story-presentation";

const data = loadGameData();
it("continues at the server's open stage and chapter after completing the previous chapter", () => {
  const progress = { cleared: data.storyArcs.arc1!.stageIds, unlocked: ["arc2_s01"] };
  const model = storyProgressModel(data, progress);
  expect(model.selectedArcId).toBe("arc2");
  expect(model.selectedStageId).toBe("arc2_s01");
  expect(model.arcs[0]).toMatchObject({ completed: 8, total: 8 });
});
it("never treats a sequential stage as open without server authorization", () => {
  const model = storyProgressModel(data, { cleared: ["arc1_s01"], unlocked: [] }, "arc1", "arc1_s02");
  expect(model.stages.find(row => row.stage.id === "arc1_s02")?.status).toBe("locked");
});
it("cleared takes precedence over an unlocked entry and remains inspectable", () => {
  const model = storyProgressModel(data, { cleared: ["arc1_s01"], unlocked: ["arc1_s01", "arc1_s02"] }, "arc1", "arc1_s01");
  expect(model.selectedStageId).toBe("arc1_s01");
  expect(model.stages[0]?.status).toBe("cleared");
});
it("explains the prerequisite for the first stage of a locked chapter", () => {
  const model = storyProgressModel(data, { cleared: [], unlocked: ["arc1_s01"] }, "arc2");
  expect(model.selectedArcId).toBe("arc2");
  expect(model.stages[0]?.requirement).toBe("Hoàn thành chương Vọng Nguyệt để mở");
});
it("repairs stale selections within their chapter and handles empty content", () => {
  const model = storyProgressModel(data, { cleared: [], unlocked: ["arc1_s03"] }, "arc1", "arc2_s01");
  expect(model.selectedStageId).toBe("arc1_s03");
  expect(storyProgressModel({ ...data, storyArcs: {}, storyStages: {} }, { cleared: [], unlocked: [] }).stages).toEqual([]);
});
