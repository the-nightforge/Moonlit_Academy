// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { loadGameData } from "data";
import { createRun, starterDeck, type RunAction } from "rules";
import { RunView, type RunViewState } from "../src/ui/run-view";

const data = loadGameData(), heroIds: [string, string, string] = ["m05", "f04", "m06"];
let view: RunView;
afterEach(() => { view?.destroy(); document.body.innerHTML = ""; });
function setup() {
  const run = createRun(data, { heroIds, seed: 42, deckCardIds: starterDeck(data, heroIds), availableCardIds: heroIds.flatMap(id => [...data.heroes[id]!.cardIds, ...data.heroes[id]!.lockedCardIds]) }).run;
  const state: RunViewState = { data, run, visited: [], submitting: false, submitted: false, error: "", notice: "", gains: [], rewards: null, achievements: [], canUnlock: false, canRetry: true };
  const actions: RunAction[] = [];
  view = new RunView({ dispatch: a => actions.push(a), retry: () => {}, back: () => {}, mastery: () => {} });
  return { state, actions };
}
it("shows both cards and dispatches the selected single-card swap without changing the deck during preview", () => {
  const { state, actions } = setup();state.run.status = "rest";
  const before = [...state.run.deck];view.render(state);
  const source = document.querySelector<HTMLSelectElement>('[data-control="swap-from"]')!;
  source.value = data.heroes.f04!.cardIds[0]!;
  source.dispatchEvent(new Event("change", { bubbles: true }));
  const replacement = document.querySelector<HTMLSelectElement>('[data-control="swap-to"]')!;
  replacement.value = data.heroes.f04!.lockedCardIds[1]!;
  replacement.dispatchEvent(new Event("change", { bubbles: true }));
  const preview = document.querySelector('.rn-swap-preview')!;
  expect(preview.textContent).toContain("Trước khi đổi");
  expect(preview.textContent).toContain("Sau khi đổi");
  expect(preview.textContent).toContain(data.cards[replacement.value]!.name);
  expect(preview.querySelectorAll('img')).toHaveLength(2);
  document.querySelector<HTMLButtonElement>('[data-action="swap"]')!.click();
  expect(actions).toEqual([{ type: "rest", choice: "swapCard", cardId: source.value, replacementId: replacement.value }]);
  expect(state.run.deck).toEqual(before);
});
it("shows an event's exact resource tradeoff and sends the archive card selection", () => {
  const { state, actions } = setup();
  state.run.status = "event";
  const augmentId = Object.keys(data.augments)[0]!;
  state.run.pendingEvent = { id: "forgottenArchive", augmentId };
  view.render(state);
  expect(document.querySelector('.rn-event')?.textContent).toContain(data.augments[augmentId]!.name);
  expect(document.querySelector('.rn-event')?.textContent).toContain("giữ ít nhất 10 lá");
  const select = document.querySelector<HTMLSelectElement>('[data-control="event-card"]')!;
  select.value = state.run.deck[2]!;select.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector<HTMLButtonElement>('[data-action="event-trade"]')!.click();
  expect(actions).toEqual([{ type: "event", choice: "trade", cardId: state.run.deck[2] }]);
});
it("keeps both event exits usable with an exhausted pool and disables choices during submission", () => {
  const { state, actions } = setup();state.run.status = "event";state.run.pendingEvent = { id: "moonShrine" };
  view.render(state);
  expect(document.querySelector('.rn-event')?.textContent).toContain("Hồi 10%");
  expect(document.querySelector('[data-control="event-card"]')).toBeNull();
  document.querySelector<HTMLButtonElement>('[data-action="event-rest"]')!.click();
  expect(actions).toEqual([{ type: "event", choice: "rest" }]);
  state.submitting = true;view.render(state);
  expect(document.querySelector<HTMLButtonElement>('[data-action="event-trade"]')!.disabled).toBe(true);
  expect(document.querySelector<HTMLButtonElement>('[data-action="event-rest"]')!.disabled).toBe(true);
});
