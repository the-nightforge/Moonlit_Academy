// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: { Scene: class {
  scene = { start: vi.fn(), isActive: () => true };
  events = { once: vi.fn() };
}, Scenes: { Events: { SHUTDOWN: "shutdown" } } } }));
vi.mock("../src/ui/theme", () => ({ useDesignCamera: () => {}, CURRENCY_LABELS: {} }));
import { DialogueScene } from "../src/scenes/dialogue-scene";
import { StoryScene } from "../src/scenes/story-scene";
import { session } from "../src/session";
afterEach(() => { document.body.innerHTML = ""; document.body.style.overflow = ""; session.pendingStageId = null; session.lastStory = null; });
it.each(["before", "after"] as const)("reader mode for %s returns to story and never selects a combat deck", part => {
  session.pendingStageId = "arc1_s01";
  const last = { won: true, rewards: { firstClear: true, moonJade: 40, darkIron: 1, gains: [], hero: null } };
  session.lastStory = last;
  const scene = new DialogueScene();
  scene.create({ stageId: "arc1_s01", part, replayOnly: true });
  document.querySelector<HTMLButtonElement>('[data-action="skip"]')!.click();
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("story");
  expect(session.pendingStageId).toBeNull();
  expect(session.lastStory).toBe(last);
});
it("cleared stage challenge enters the ordinary before-dialogue ticket flow", () => {
  const scene = new StoryScene();
  session.online = true;
  const internal = scene as unknown as { progress: { cleared: string[]; unlocked: string[] }; start: (id: string) => void };
  internal.progress = { cleared: ["arc1_s01"], unlocked: ["arc1_s02"] };
  internal.start("arc1_s01");
  expect(session.pendingStageId).toBe("arc1_s01");
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("dialogue", { stageId: "arc1_s01", part: "before" });
});
