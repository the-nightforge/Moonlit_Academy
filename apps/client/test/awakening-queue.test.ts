import type Phaser from "phaser";
import { expect, it, vi } from "vitest";
import { cloneState, type CombatEvent } from "rules";
import { fixture } from "./helpers/combat-fixture";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";
import { createPresentation } from "../src/ui/combat-presentation";

vi.stubGlobal("window", {devicePixelRatio:1,screen:{width:1280,height:720},location:{href:"http://localhost/"}});
const { playEventQueue } = await import("../src/ui/event-animator");

function setup(mode: "pve" | "pvp" | "coop", speed: 1 | 2 = 1, reducedMotion = false) {
  const { data, state: before } = fixture(mode);
  const hero = before.heroes.at(-1)!; // remote seat in online modes
  const after = cloneState(before);
  after.heroes.find(h => h.id === hero.id)!.leveledUp = true;
  const rt = new FakeRuntime({speed, reducedMotion});
  let portrait = stubObject({ texture: {key:`heroes:${hero.defId}`}, displayWidth:80, displayHeight:120 });
  const view = stubObject({ parentContainer:null, getData:()=>portrait, getIndex:()=>2 }) as unknown as Phaser.GameObjects.Container;
  const updates: [string, number, boolean][] = [];
  const presentation = createPresentation(before);
  const updateUnit = vi.fn((id: string) => {
    updates.push([id,rt.clock,presentation.heroes.find(h=>h.id===id)!.leveledUp]);
    (portrait.destroy as () => void)();
    portrait = stubObject({texture:{key:`heroes:${hero.defId}_up`}});
  });
  const events: CombatEvent[] = [{type:"heroLeveledUp",heroId:hero.id,name:data.heroes[hero.defId]!.levelUp.name}];
  const run = () => playEventQueue(rt,events,{gameData:data,presentation,before,after,
    bindings:{updateUnit,updateSeat:vi.fn(),ensureSummon:vi.fn(),updateMoon:vi.fn()},
    unitViews:new Map([[hero.id,view]]),unitAnchors:new Map(),seatAnchors:new Map(),runtime:rt});
  return {rt,run,updates,hero,before,after,presentation};
}

it.each(["pve","pvp","coop"] as const)("%s swaps only the event's hero, once at the charge boundary, without changing snapshots", async mode => {
  for (const speed of [1,2] as const) {
    for (const reduced of [false,true]) {
      const s=setup(mode,speed,reduced);
      const before=JSON.stringify(s.before), after=JSON.stringify(s.after);
      const result=s.run(); expect(s.updates).toEqual([]);
      await runToEnd(s.rt,result); await result;
      expect(s.updates).toEqual([[s.hero.id,(reduced?60:120)/speed,true]]);
      expect(s.rt.clock).toBe((reduced?180:520)/speed);
      expect(JSON.stringify(s.before)).toBe(before); expect(JSON.stringify(s.after)).toBe(after);
    }
  }
});

it("aborting a charge cannot repaint the replacement state after rejoin", async () => {
  const s=setup("pvp"); const result=s.run(); s.rt.dispose();
  await expect(result).rejects.toThrow("animation aborted");
  expect(s.updates).toEqual([]); expect(s.presentation.heroes.find(h=>h.id===s.hero.id)!.leveledUp).toBe(false);
});
