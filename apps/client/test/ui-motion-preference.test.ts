// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveCombatSettings } from "../src/ui/combat-settings";
import { installUiMotion } from "../src/ui/ui-motion";

let cleanup: (() => void) | undefined;
let media: EventTarget & { matches: boolean };
const preference = () => document.documentElement.dataset.vnReducedMotion;
const settings = (reducedMotion: boolean) => ({ speed: 1 as const, volume: 0.5, reducedMotion });

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.vnReducedMotion;
  media = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
});
afterEach(() => { cleanup?.(); cleanup = undefined; localStorage.clear(); vi.restoreAllMocks(); });

it("stages whole panels once at screen entry and cancels them when motion is reduced", () => {
  document.body.innerHTML='<section class="vn-story"><header class="st-header"></header><main class="st-layout"><nav class="st-arcs"></nav><section class="st-journey"></section></main></section>';
  const cancel=vi.fn(),animate=vi.fn((_frames:Keyframe[]|PropertyIndexedKeyframes|null,_options?:number|KeyframeAnimationOptions)=>({cancel,finished:new Promise(()=>{})}) as unknown as Animation);
  vi.spyOn(HTMLElement.prototype,"animate").mockImplementation(animate);
  cleanup=installUiMotion();
  const root=document.querySelector('.vn-story')!;
  const start=()=>root.dispatchEvent(Object.assign(new Event('animationstart',{bubbles:true}),{animationName:'vn-screen-enter'}));
  start();expect(animate).toHaveBeenCalledTimes(3);
  expect(animate.mock.calls[0]?.[0]).toEqual([{opacity:.55,translate:'0 6px'},{opacity:1,translate:'0 0'}]);
  start();expect(animate).toHaveBeenCalledTimes(3);
  saveCombatSettings(localStorage,settings(true));expect(cancel).toHaveBeenCalledTimes(3);
  document.body.replaceChildren();
});

describe("shared UI motion preference", () => {
  it("turns off DOM movement when the saved preference is true and the OS allows motion", () => {
    saveCombatSettings(localStorage, settings(true));
    cleanup = installUiMotion();
    expect(preference()).toBe("true");
  });

  it("reacts immediately when the in-game setting changes in this window", () => {
    cleanup = installUiMotion();
    expect(preference()).toBe("false");
    saveCombatSettings(localStorage, settings(true));
    expect(preference()).toBe("true");
    saveCombatSettings(localStorage, settings(false));
    expect(preference()).toBe("false");
  });

  it("follows OS changes when no explicit preference is saved", () => {
    cleanup = installUiMotion();
    media.matches = true; media.dispatchEvent(new Event("change"));
    expect(preference()).toBe("true");
    media.matches = false; media.dispatchEvent(new Event("change"));
    expect(preference()).toBe("false");
  });

  it("keeps explicit settings ahead of the OS default, matching canvas controls", () => {
    media.matches = true;
    saveCombatSettings(localStorage, settings(false));
    cleanup = installUiMotion();
    expect(preference()).toBe("false");
  });

  it("updates when another window changes storage", () => {
    cleanup = installUiMotion();
    localStorage.setItem("vongnguyet.combatSettings.v1", JSON.stringify(settings(true)));
    window.dispatchEvent(new StorageEvent("storage", { key: "vongnguyet.combatSettings.v1" }));
    expect(preference()).toBe("true");
  });

  it("removes its event listeners when the game is destroyed", () => {
    cleanup = installUiMotion(); cleanup(); cleanup = undefined;
    saveCombatSettings(localStorage, settings(true));
    media.matches = true; media.dispatchEvent(new Event("change"));
    window.dispatchEvent(new StorageEvent("storage"));
    expect(preference()).toBe("false");
  });
});
