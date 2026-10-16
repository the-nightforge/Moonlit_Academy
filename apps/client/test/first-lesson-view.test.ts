// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { loadGameData } from "data";
import { claimFirstCard, createProfile, starterDeck } from "rules";
import { FirstLessonView } from "../src/ui/first-lesson-view";
import { displayText } from "../src/ui/display-text";

const data = loadGameData();
let view: FirstLessonView;
afterEach(() => { view?.destroy(); document.body.innerHTML = ""; });
function setup() {
  const profile = createProfile(data), heroIds = data.economyConfig.starterHeroIds as [string, string, string];
  profile.story.cleared = ["arc1_s01"];
  profile.decks = [{ id: "d1", name: "Lựa chọn đầu", heroIds, cardIds: starterDeck(data, heroIds) }];
  const claims: { cardId: string; replaceCardId: string }[] = [];
  let dismisses = 0;
  view = new FirstLessonView({ claim: (cardId, replaceCardId) => claims.push({ cardId, replaceCardId }), prepare: () => {}, deck: () => {}, dismiss: () => dismisses++ });
  document.body.append(view.element);
  const state = { data, profile, deckId: "d1", busy: false, error: "" };
  view.render(state);
  return { state, claims, dismissed: () => dismisses };
}
it("requires choosing a new card and same-owner replacement with full before/after text", () => {
  const { state, claims } = setup();
  const choice = document.querySelector<HTMLButtonElement>("[data-new-card]")!;
  const cardId = choice.dataset.newCard!;
  choice.click();
  const replacement = document.querySelector<HTMLButtonElement>("[data-replace-card]")!;
  const replaceCardId = replacement.dataset.replaceCard!;
  expect(data.cards[replaceCardId]!.ownerId).toBe(data.cards[cardId]!.ownerId);
  expect(document.querySelector<HTMLButtonElement>('[data-action="claim"]')?.disabled).toBe(true);
  replacement.click();
  expect(document.querySelector(".fl-compare")?.textContent).toContain(displayText(data.cards[replaceCardId]!.text));
  expect(document.querySelector(".fl-compare")?.textContent).toContain(displayText(data.cards[cardId]!.text));
  document.querySelector<HTMLButtonElement>('[data-action="claim"]')!.click();
  expect(claims).toEqual([{ cardId, replaceCardId }]);
  view.render({ ...state, busy: true });
  expect(document.querySelector<HTMLButtonElement>('[data-action="claim"]')?.disabled).toBe(true);
});
it("can leave the choice and reconstruct its entitlement after reloading", () => {
  const { state, dismissed } = setup();
  document.querySelector<HTMLButtonElement>('[data-action="later"]')!.click();
  expect(dismissed()).toBe(1);
  view.destroy();
  view = new FirstLessonView({ claim: () => {}, prepare: () => {}, deck: () => {}, dismiss: () => {} });
  document.body.append(view.element); view.render(state);
  expect(document.querySelectorAll("[data-new-card]")).toHaveLength(6);
});
it("restores the actual claimed card and next-fight guidance from the server profile", () => {
  const { state } = setup();
  const cardId = data.heroes.m05!.lockedCardIds[0]!, replaceCardId = data.heroes.m05!.cardIds[0]!;
  const result = claimFirstCard(data, state.profile, { deckId: "d1", cardId, replaceCardId });
  if (!result.ok) throw new Error(result.error);
  view.render({ ...state, profile: result.profile });
  expect(view.element.textContent).toContain(data.cards[cardId]!.name);
  expect(view.element.textContent).toContain("trận Cốt Truyện tiếp theo");
  expect(document.querySelector("[data-new-card]")).toBeNull();
});
