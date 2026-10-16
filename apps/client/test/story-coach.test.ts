// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { loadGameData } from "data";
import { createCombat, createProfile, starterDeck } from "rules";
import { storyCoachTips } from "../src/ui/story-coach";
import { displayText } from "../src/ui/display-text";
it("teaches finite cards, actual moon cost and awakening during the first story battle only", () => {
  const data = loadGameData(), profile = createProfile(data), heroIds = data.economyConfig.starterHeroIds as [string, string, string];
  const state = createCombat(data, { heroIds, seed: 1, encounterId: "enc_01", deckCardIds: starterDeck(data, heroIds) }).state;
  const tips = storyCoachTips(data, profile, "arc1_s01", state);
  expect(tips.join(" ")).toContain("không xáo lại");
  expect(tips.join(" ")).toContain("Nguyệt Lực");
  expect(tips.join(" ")).toContain(displayText(data.heroes[heroIds[0]]!.levelUp.description));
  expect(storyCoachTips(data, profile, "arc1_s02", state)).toEqual([]);
  profile.story.cleared = ["arc1_s01"];
  expect(storyCoachTips(data, profile, "arc1_s01", state)).toEqual([]);
});
