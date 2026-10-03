import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { cloneState } from "rules";
import type { CombatEvent } from "rules";
import { AnimationAbortedError } from "../src/ui/animation-runtime";
import { castCard } from "../src/ui/vfx";
import { createPresentation } from "../src/ui/combat-presentation";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";
import { fixture } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
  location: { href: "http://localhost/" },
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
});

const { playEventQueue } = await import("../src/ui/event-animator");
import type { AnimContext } from "../src/ui/event-animator";

const container = () => stubObject({ parentContainer: { bringToTop: () => {} } }) as unknown as Phaser.GameObjects.Container;

describe("castCard clone ownership", () => {
  it("abort destroys the cast clone — the real card view is never touched", async () => {
    const rt = new FakeRuntime();
    const clone = container() as Phaser.GameObjects.Container & { destroyed: boolean };
    const cast = castCard(rt, clone, { x: 640, y: 300 }, 0xff4466, { x: 640, y: 140 });
    await Promise.resolve();
    rt.dispose();
    await expect(cast).rejects.toBeInstanceOf(AnimationAbortedError);
    expect(clone.destroyed).toBe(true);
  });

  it("a clean cast finishes without destroying the clone", async () => {
    const rt = new FakeRuntime();
    const clone = container() as Phaser.GameObjects.Container & { destroyed: boolean };
    await runToEnd(rt, castCard(rt, clone, { x: 640, y: 300 }, 0xff4466));
    expect(clone.destroyed).toBe(false);
  });
});

describe("playEventQueue cardPlayed", () => {
  const { data, state } = fixture("pve");

  function ctx(rt: FakeRuntime, castView: AnimContext["castView"], cardViews: Map<string, Phaser.GameObjects.Container>): AnimContext {
    return {
      gameData: data,
      presentation: createPresentation(state),
      after: state,
      bindings: { updateUnit: () => {}, updateSeat: () => {}, ensureSummon: () => {}, updateMoon: () => {} },
      unitAnchors: new Map(),
      unitViews: new Map(),
      cardViews,
      seatAnchors: new Map(),
      castView,
      runtime: rt,
    };
  }

  it("flies the cast clone, not the interactive hand card — abort spares the source", async () => {
    const rt = new FakeRuntime();
    const instanceId = state.players[0]!.hand[0]!;
    const source = container() as Phaser.GameObjects.Container & { destroyed: boolean };
    const clone = container() as Phaser.GameObjects.Container & { destroyed: boolean };
    const casting = new Set<string>();
    const castView = vi.fn((id: string) => {
      casting.add(id);
      return clone;
    });
    const cardViews = new Map([[instanceId, source as Phaser.GameObjects.Container]]);
    const events: CombatEvent[] = [{ type: "cardPlayed", instanceId, cost: 1 }];
    const queue = playEventQueue(rt, events, ctx(rt, castView, cardViews));
    await Promise.resolve();
    rt.dispose();
    await expect(queue).rejects.toBeInstanceOf(AnimationAbortedError);
    expect(castView).toHaveBeenCalledWith(instanceId);
    expect(casting.has(instanceId)).toBe(true);
    expect(clone.destroyed).toBe(true);
    expect(source.destroyed).toBe(false);
  });

  it("summoned → damage → died: ensureSummon plants the anchor before the hit lands", async () => {
    const rt = new FakeRuntime();
    const owner = state.heroes[0]!;
    const summonId = Object.keys(data.summons)[0]!;
    // The authoritative snapshot already holds the summon (dead, after the whole beat).
    const after = cloneState(state);
    after.summons = [
      { id: "s9", defId: summonId, summonId, side: "hero", player: 0, ownerHeroId: owner.id, position: 0, hp: 0, maxHp: 0, armor: 0, statuses: [], alive: false },
    ];
    const calls: string[] = [];
    const context: AnimContext = {
      gameData: data,
      presentation: createPresentation(state),
      after,
      bindings: {
        updateUnit: (id) => calls.push(`unit:${id}`),
        updateSeat: () => {},
        ensureSummon: (id) => {
          calls.push(`summon:${id}`);
          // The real scene plants an anchor+view here — the damage beat needs it.
          context.unitAnchors.set(id, { x: 900, y: 400 });
        },
        updateMoon: () => {},
      },
      unitAnchors: new Map(),
      unitViews: new Map(),
      seatAnchors: new Map(),
      runtime: rt,
    };
    const events: CombatEvent[] = [
      { type: "summoned", unitId: "s9", summonId, ownerHeroId: owner.id },
      { type: "damageDealt", sourceId: "enemy:0", targetId: "s9", amount: 3, blocked: 0, hpLost: 3 },
      { type: "unitDied", unitId: "s9" },
    ];
    await runToEnd(rt, playEventQueue(rt, events, context));
    expect(calls[0]).toBe("summon:s9");
    expect(calls).toContain("unit:s9");
  });
});
