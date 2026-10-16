// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { loadGameData } from "data";
import { StoryView } from "../src/ui/story-view";
const data = loadGameData();
let view: StoryView;
afterEach(() => { view?.destroy(); document.body.innerHTML = ""; });
it("lets cleared stages challenge again and read both parts while rewards stay claimed", () => {
  let started = ""; const read: string[] = [];
  view = new StoryView({ back: () => {}, retry: () => {}, start: id => { started = id; }, read: (id, part) => read.push(`${id}:${part}`) });
  view.render({ data, progress: { cleared: ["arc1_s01"], unlocked: ["arc1_s01", "arc1_s02"] }, online: true, loading: false, error: "", notice: "" });
  document.querySelector<HTMLButtonElement>('[data-action="stage"][data-id="arc1_s01"]')!.click();
  document.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
  expect(started).toBe("arc1_s01");
  expect(document.querySelector(".st-rewards")?.textContent).toContain("Đã nhận");
  document.querySelector<HTMLButtonElement>('[data-read="before"]')!.click();
  document.querySelector<HTMLButtonElement>('[data-read="after"]')!.click();
  expect(read).toEqual(["arc1_s01:before", "arc1_s01:after"]);
});
