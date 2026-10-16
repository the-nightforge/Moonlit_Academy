import { describe, expect, it } from "vitest";
import { applyStoryResult, createProfile, mergeImportedProfile, parseProfile, pendingUnlocks, starterDeck, validateDeck } from "../src/index";
import { claimFirstCard, firstCardChoices } from "../src/meta/onboarding";
import { testData } from "./helpers";

function ready() {
  const data = testData(), profile = createProfile(data);
  const heroIds = data.economyConfig.starterHeroIds as [string, string, string];
  profile.decks.push({ id: "d1", name: "Đầu tiên", heroIds, cardIds: starterDeck(data, heroIds) });
  const first = Object.values(data.storyArcs)[0]!.stageIds[0]!;
  profile.story.cleared.push(first);
  return { data, profile, first };
}
describe("first story deck lesson", () => {
  it("offers two still locked cards per owned deck hero only after verified first clear", () => {
    const { data, profile } = ready();
    expect(firstCardChoices(data, profile, "d1")).toHaveLength(6);
    profile.story.cleared = [];
    expect(firstCardChoices(data, profile, "d1")).toEqual([]);
  });
  it("atomically grants a free unlock and replaces one same-owner card without spending mastery choices", () => {
    const { data, profile } = ready();
    const cardId = firstCardChoices(data, profile, "d1")[0]!;
    const owner = data.cards[cardId]!.ownerId!;
    profile.heroes[owner]!.xp = data.metaConfig.masteryLevels[0]!;
    const replaceCardId = profile.decks[0]!.cardIds.find(id => data.cards[id]?.ownerId === owner)!;
    const snapshot = JSON.stringify(profile), before = pendingUnlocks(data, profile, owner);
    const result = claimFirstCard(data, profile, { deckId: "d1", cardId, replaceCardId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(profile)).toBe(snapshot);
    expect(result.profile.firstLesson).toEqual({ deckId: "d1", cardId, replacedCardId: replaceCardId, practiced: false });
    expect(result.profile.decks[0]!.cardIds).toContain(cardId);
    expect(result.profile.decks[0]!.cardIds).not.toContain(replaceCardId);
    expect(validateDeck(data, result.profile, result.profile.decks[0]!)).toEqual([]);
    expect(pendingUnlocks(data, result.profile, owner)).toBe(before);
    expect(claimFirstCard(data, result.profile, { deckId: "d1", cardId, replaceCardId }).ok).toBe(false);
    expect(parseProfile(data, result.profile).profile.firstLesson).toEqual(result.profile.firstLesson);
    const imported = mergeImportedProfile(data, profile, result.profile);
    expect(imported.ok && imported.profile.firstLesson).toBeUndefined();
  });
  it("refuses invalid replacements without mutations and ignores malformed claimed state", () => {
    const { data, profile } = ready();
    const cardId = firstCardChoices(data, profile, "d1")[0]!;
    const replaceCardId = profile.decks[0]!.cardIds.find(id => data.cards[id]?.ownerId !== data.cards[cardId]!.ownerId)!;
    const snapshot = JSON.stringify(profile);
    expect(claimFirstCard(data, profile, { deckId: "d1", cardId, replaceCardId }).ok).toBe(false);
    expect(JSON.stringify(profile)).toBe(snapshot);
    expect(parseProfile(data, { ...profile, firstLesson: { deckId: "d1", cardId: "fake", replacedCardId: replaceCardId, practiced: true } }).profile.firstLesson).toBeUndefined();
  });
  it("marks practice only after a verified different story win using the chosen card, including replay", () => {
    const { data, profile, first } = ready();
    const cardId = firstCardChoices(data, profile, "d1")[0]!;
    const deck = profile.decks[0]!;
    const replaceCardId = deck.cardIds.find(id => data.cards[id]?.ownerId === data.cards[cardId]!.ownerId)!;
    const claimed = claimFirstCard(data, profile, { deckId: deck.id, cardId, replaceCardId });
    if (!claimed.ok) throw new Error(claimed.error);
    const stageId = Object.values(data.storyArcs)[0]!.stageIds[1]!;
    const setup = { stageId, heroIds: deck.heroIds, seed: 1, deckCardIds: claimed.profile.decks[0]!.cardIds };
    expect(applyStoryResult(data, claimed.profile, { ...setup, stageId: first }, true).profile.firstLesson?.practiced).toBe(false);
    expect(applyStoryResult(data, claimed.profile, setup, false).profile.firstLesson?.practiced).toBe(false);
    const completed = applyStoryResult(data, claimed.profile, setup, true);
    expect(completed.profile.firstLesson?.practiced).toBe(true);
    const replay = applyStoryResult(data, completed.profile, setup, true);
    expect(replay.rewards).toMatchObject({ firstClear: false, moonJade: 0, darkIron: 0, gains: [], hero: null });
  });
});
