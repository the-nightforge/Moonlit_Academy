import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { cloneState, createPvpCombat } from "rules";
import type { CombatEvent, CombatState } from "rules";
import { AnimationAbortedError } from "../src/ui/animation-runtime";
import { applyPresentationEvent, createPresentation } from "../src/ui/combat-presentation";
import type { PresentationBindings } from "../src/ui/combat-presentation";
import { hpLossLook } from "../src/ui/attack-style";
import { NetMatch } from "../src/net/match";
import type { NetSocket } from "../src/net/socket";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";
import { fixture, snapshot } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
  location: { href: "http://localhost/" },
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
});

const { playEventQueue, buildIntroEvents } = await import("../src/ui/event-animator");
import type { AnimContext } from "../src/ui/event-animator";

const { data, state: base } = fixture("pve");

function silentBindings(trace?: string[]): PresentationBindings {
  return {
    updateUnit: (id) => trace?.push(`unit:${id}`),
    updateSeat: (seat) => trace?.push(`seat:${seat}`),
    ensureSummon: (id) => trace?.push(`summon:${id}`),
    updateMoon: () => trace?.push("moon"),
  };
}

function ctx(rt: FakeRuntime, overrides: Partial<AnimContext> = {}): AnimContext {
  return {
    gameData: data,
    presentation: createPresentation(base),
    after: base,
    bindings: silentBindings(),
    unitAnchors: new Map(),
    unitViews: new Map(),
    seatAnchors: new Map(),
    runtime: rt,
    ...overrides,
  };
}

describe("buildIntroEvents", () => {
  it("keeps only the four intro beats from the real setup stream", () => {
    const side = { heroIds: ["m05", "f04", "m06"], loadout: { heroes: {}, relics: [] } };
    const { state, events } = createPvpCombat(data, { seed: 7, players: [side, side] });
    const intro = buildIntroEvents(state, events);
    expect(intro.length).toBeGreaterThan(0);
    expect(intro.every((event) => ["combatStarted", "moonDecreesRolled", "turnStarted", "cardsDrawn"].includes(event.type))).toBe(true);
  });

  it("synthesizes a cosmetic intro from the snapshot when no setup log travels", () => {
    const intro = buildIntroEvents(base, []);
    expect(intro[0]).toEqual({ type: "combatStarted" });
    expect(intro.some((event) => event.type === "moonDecreesRolled")).toBe(true);
    // Each seat's reveal uses the ids its hand already holds — never a re-draw.
    const draws = intro.filter((event) => event.type === "cardsDrawn");
    expect(draws.length).toBe(base.players.length);
    for (const draw of draws) {
      if (draw.type !== "cardsDrawn") continue;
      const seat = base.players[draw.player ?? 0]!;
      expect([...draw.instanceIds].sort()).toEqual([...seat.hand].sort());
    }
  });

  it("emits turnStarted only when the snapshot already left mulligan", () => {
    const mulligan = buildIntroEvents(base, []);
    expect(mulligan.some((event) => event.type === "turnStarted")).toBe(false);
    const mid = cloneState(base);
    mid.status = "playerTurn";
    const playing = buildIntroEvents(mid, []);
    const turn = playing.find((event) => event.type === "turnStarted");
    expect(turn).toMatchObject({ type: "turnStarted", side: "hero", round: mid.round, player: mid.activePlayer });
  });

  it("a match.start NetMatch is fresh; a welcome activeMatch is not", () => {
    const net = { send: () => true, sendMatch: () => true } as unknown as NetSocket;
    const start = { ...snapshot(base), type: "match.start" as const };
    expect(new NetMatch(net, start).fresh).toBe(true);
    expect(new NetMatch(net, snapshot(base)).fresh).toBe(false);
  });
});

describe("intro replay safety", () => {
  it("cardsDrawn on an already-dealt hand reveals without duplicating ids", () => {
    const visual = createPresentation(base);
    const seat = visual.players[0]!;
    const handBefore = [...seat.hand];
    const pileBefore = seat.drawPile.length;
    for (const event of buildIntroEvents(base, [])) applyPresentationEvent(data, visual, event, base);
    expect(seat.hand).toEqual(handBefore);
    expect(seat.drawPile.length).toBe(pileBefore);
  });
});

describe("hpLossLook", () => {
  it("maps every hp-loss cause to a glossary label and color", () => {
    const causes = ["loseHp", "burn", "reflect", "bloodMoon", "decree", "bloodPact"] as const;
    for (const cause of causes) {
      const look = hpLossLook(cause);
      expect(look.color).toBeTypeOf("number");
      // The cause text always shows (`hpLossLook` contract) — even plain HP loss.
      expect(look.label.length).toBeGreaterThan(0);
    }
    expect(hpLossLook("burn").color).not.toBe(hpLossLook("reflect").color);
    expect(hpLossLook("bloodMoon").color).toBe(hpLossLook("bloodPact").color);
  });
});

describe("summon lifecycle", () => {
  it("summoned → damage → died plays view/hit/death in order", async () => {
    const rt = new FakeRuntime();
    const owner = base.heroes[0]!;
    const summonId = Object.keys(data.summons)[0]!;
    const after = cloneState(base);
    after.summons = [
      { id: "s9", defId: summonId, summonId, side: "hero", player: 0, ownerHeroId: owner.id, position: 0, hp: 0, maxHp: 0, armor: 0, statuses: [], alive: false },
    ];
    const trace: string[] = [];
    const context = ctx(rt, {
      presentation: createPresentation(base),
      after,
      bindings: {
        updateUnit: (id, visual) => {
          if (id !== "s9") return trace.push(`unit:${id}`);
          // The reducer ran first: a dead summon in `visual` means this beat was its death.
          const summon = visual.summons?.find((unit) => unit.id === id);
          trace.push(summon !== undefined && !summon.alive ? "summon-death" : "summon-hit");
        },
        updateSeat: () => {},
        ensureSummon: (id) => {
          trace.push("summon-view");
          context.unitAnchors.set(id, { x: 900, y: 400 });
          context.unitViews.set(id, stubObject() as unknown as Phaser.GameObjects.Container);
        },
        updateMoon: () => {},
      },
    });
    const events: CombatEvent[] = [
      { type: "summoned", unitId: "s9", summonId, ownerHeroId: owner.id },
      { type: "damageDealt", sourceId: "enemy:0", targetId: "s9", amount: 3, blocked: 0, hpLost: 3 },
      { type: "unitDied", unitId: "s9" },
    ];
    await runToEnd(rt, playEventQueue(rt, events, context));
    expect(trace).toEqual(["summon-view", "summon-hit", "summon-death"]);
  });
});

describe("death and revive", () => {
  it("a fallen hero revives to the event hp and brightens back to alpha 1", async () => {
    const rt = new FakeRuntime();
    const hero = base.heroes[0]!;
    const view = stubObject({ alpha: 0.55, y: 386, scale: 0.94 }) as unknown as Phaser.GameObjects.Container;
    const unitViews = new Map([[hero.id, view]]);
    const presentation = createPresentation(base);
    presentation.heroes[0]!.alive = false;
    presentation.heroes[0]!.hp = 0;
    const reviveEvent: CombatEvent = { type: "heroRevived", heroId: hero.id, hp: 7 };
    const context = ctx(rt, { presentation, unitViews, unitAnchors: new Map([[hero.id, { x: 400, y: 400 }]]) });
    await runToEnd(rt, playEventQueue(rt, [reviveEvent], context));
    const finalHero = presentation.heroes[0]!;
    expect(finalHero.alive).toBe(true);
    expect(finalHero.hp).toBe(7);
    // The revive beat must restore the view — a tween to full alpha ran on it.
    const restore = rt.tweenConfigs.find((config) => (config.targets as unknown) === view && (config as { alpha?: number }).alpha === 1);
    expect(restore).toBeDefined();
  });
});

describe("unit flash bounds", () => {
  it("flashes cover the unit view's real bounds, not a fixed 140×200", async () => {
    const rt = new FakeRuntime();
    const hero = base.heroes[0]!;
    const actualUnitBounds = { x: 300, y: 260, centerX: 360, centerY: 345, width: 120, height: 170 };
    const view = stubObject({ getBounds: () => actualUnitBounds }) as unknown as Phaser.GameObjects.Container;
    const unitViews = new Map([[hero.id, view]]);
    const context = ctx(rt, { unitViews, unitAnchors: new Map([[hero.id, { x: 360, y: 345 }]]) });
    await runToEnd(rt, playEventQueue(rt, [{ type: "hpLost", targetId: hero.id, amount: 4, cause: "burn" }], context));
    const flashBounds = rt.rects[0]!;
    expect(flashBounds.slice(0, 4)).toEqual([actualUnitBounds.centerX, actualUnitBounds.centerY, actualUnitBounds.width, actualUnitBounds.height]);
  });
});

describe("reflect beat", () => {
  it("shards the blocked blow back from the reflector into the attacker", async () => {
    const rt = new FakeRuntime();
    const hero = base.heroes[0]!;
    const enemy = base.enemies[0]!;
    const context = ctx(rt, {
      unitAnchors: new Map([
        [hero.id, { x: 400, y: 500 }],
        [enemy.id, { x: 800, y: 220 }],
      ]),
    });
    const events: CombatEvent[] = [
      { type: "damageDealt", sourceId: hero.id, targetId: enemy.id, amount: 5, blocked: 0, hpLost: 5 },
      { type: "hpLost", targetId: hero.id, amount: 2, cause: "reflect" },
    ];
    await runToEnd(rt, playEventQueue(rt, events, context));
    // The rebound shard (and its halo) land exactly on the attacker's anchor.
    const flights = rt.tweenConfigs.filter(
      (config) => (config as { x?: number; y?: number }).x === 400 && (config as { x?: number; y?: number }).y === 500,
    );
    expect(flights.length).toBeGreaterThan(0);
    expect(rt.texts.some((text) => text.includes("Phản"))).toBe(true);
  });
});

describe("armorRemoved beat", () => {
  it("breaks the shield badge at the unit, not silently", async () => {
    const rt = new FakeRuntime();
    const hero = base.heroes[0]!;
    const context = ctx(rt, { unitAnchors: new Map([[hero.id, { x: 400, y: 400 }]]) });
    await runToEnd(rt, playEventQueue(rt, [{ type: "armorRemoved", targetId: hero.id }], context));
    expect(rt.texts.some((text) => text.includes("Giáp") || text.includes("🛡"))).toBe(true);
  });
});

describe("zone flights", () => {
  it("cardDiscarded flies a back to the seat's discard anchor", async () => {
    const rt = new FakeRuntime();
    const context = ctx(rt);
    const seat = context.presentation.players[0]!;
    const id = seat.hand[0]!;
    await runToEnd(rt, playEventQueue(rt, [{ type: "cardDiscarded", instanceIds: [id], player: 0 }], context));
    const flight = rt.tweenConfigs.find((config) => {
      const at = config as unknown as { x?: number; y?: number };
      return at.x === 54 && at.y === 540; // seatAnchors(0,0,pve).discard
    });
    expect(flight).toBeDefined();
  });

  it("cardsRecycled flies backs from the discard anchor to the draw anchor", async () => {
    const rt = new FakeRuntime();
    const context = ctx(rt);
    const seat = context.presentation.players[0]!;
    seat.discardPile.push("cz1");
    await runToEnd(rt, playEventQueue(rt, [{ type: "cardsRecycled", instanceIds: ["cz1"], player: 0 }], context));
    const flight = rt.tweenConfigs.find((config) => {
      const at = config as unknown as { x?: number; y?: number };
      return at.x === 54 && at.y === 424; // seatAnchors(0,0,pve).draw
    });
    expect(flight).toBeDefined();
  });
});

describe("queue-time banners", () => {
  it("coopComboTriggered banners while the batch is still playing, not after", async () => {
    const rt = new FakeRuntime();
    const context = ctx(rt);
    const queue = playEventQueue(rt, [{ type: "coopComboTriggered", comboId: Object.keys(data.coopCombos)[0]!, cardIds: ["a", "b"], player: 0 }], context);
    await Promise.resolve();
    // The banner text exists already — it did not wait for commit.
    expect(rt.texts.some((text) => text.includes("HỢP KÍCH"))).toBe(true);
    await runToEnd(rt, queue);
  });

  it("bossPhaseChanged banners in-queue", async () => {
    const rt = new FakeRuntime();
    const context = ctx(rt);
    const queue = playEventQueue(rt, [{ type: "bossPhaseChanged", enemyId: "e0", phase: 2 }], context);
    await Promise.resolve();
    expect(rt.texts.some((text) => text.includes("Giai đoạn 2") || text.includes("giai đoạn 2"))).toBe(true);
    await runToEnd(rt, queue);
  });
});

describe("blood moon ignition", () => {
  it("surges at the moon with a stroked banner — no flat full-screen wash", async () => {
    const rt = new FakeRuntime();
    const context = ctx(rt);
    await runToEnd(rt, playEventQueue(rt, [{ type: "bloodMoonChanged", rounds: 2, cause: "card" }], context));
    // The old flat red rectangle is gone; the edge pulse is an image vignette.
    expect(rt.rects.some((r) => (r[4] as number) === 0xc01030)).toBe(false);
    expect(rt.texts.some((t) => t.includes("HUYẾT NGUYỆT"))).toBe(true);
    // Corona + ring + ember emitter + vignette veil + banner — all runtime-tracked.
    expect(rt.created.length).toBeGreaterThanOrEqual(5);
    // The veil pulse is a brief yoyo alpha tween, not a lingering overlay.
    expect(rt.tweenConfigs.some((c) => c.yoyo === true && c.alpha !== undefined)).toBe(true);
    expect(rt.shakes.length).toBeGreaterThan(0);
  });

  it("a roundEnd decrement only floats the countdown — no surge, no shake", async () => {
    const rt = new FakeRuntime();
    const context = ctx(rt);
    await runToEnd(rt, playEventQueue(rt, [{ type: "bloodMoonChanged", rounds: 1, cause: "roundEnd" }], context));
    expect(rt.texts.some((t) => t.includes("còn 1 vòng"))).toBe(true);
    expect(rt.texts.some((t) => t.includes("HUYẾT NGUYỆT"))).toBe(false);
    expect(rt.shakes.length).toBe(0);
  });
});

describe("abort mid-transition", () => {
  it("disposing mid-moonWheel destroys every temporary object", async () => {
    const rt = new FakeRuntime();
    const context = ctx(rt);
    const queue = playEventQueue(rt, [{ type: "moonShifted", from: 0, to: 3, cause: "card" }], context);
    await Promise.resolve();
    rt.dispose();
    await expect(queue).rejects.toBeInstanceOf(AnimationAbortedError);
    expect(rt.created.length).toBeGreaterThan(0);
    expect(rt.created.every((object) => object.destroyed === true)).toBe(true);
  });
});
