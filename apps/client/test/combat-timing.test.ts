import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type Phaser from "phaser";
import type { CombatEvent } from "rules";
import { applyAction, cloneState } from "rules";
import { createPresentation } from "../src/ui/combat-presentation";
import type { PresentationBindings } from "../src/ui/combat-presentation";
import type { CombatSettings } from "../src/ui/combat-settings";
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
const { createAnimationRuntime } = await import("../src/ui/animation-runtime");
import type { AnimContext } from "../src/ui/event-animator";

const { data, state: base } = fixture("pve");
const ON: CombatSettings = { speed: 1, reducedMotion: false, volume: 0.5 };
// Cosmetic scatter must be identical at both speeds; take its longest duration.
beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(1));
afterEach(() => vi.restoreAllMocks());

/** A scene stub that records what the real runtime asks of Phaser. */
function recordingScene() {
  const delays: number[] = [];
  const tweenDurations: unknown[] = [];
  const tweenDelays: unknown[] = [];
  const shakes: number[][] = [];
  const scene = {
    time: {
      delayedCall: (ms: number, _cb: () => void) => {
        delays.push(ms);
        return { remove() {} };
      },
    },
    tweens: {
      add: (config: { duration?: unknown; delay?: unknown }) => {
        tweenDurations.push(config.duration);
        tweenDelays.push(config.delay);
        return { remove() {} };
      },
    },
    cameras: { main: { shake: (ms: number, intensity: number) => shakes.push([ms, intensity]) } },
  } as unknown as Phaser.Scene;
  return { scene, delays, tweenDurations, tweenDelays, shakes };
}

describe("runtime speed scaling", () => {
  it("duration halves at speed 2", () => {
    const { scene } = recordingScene();
    const rt = createAnimationRuntime(scene, new AbortController().signal, { ...ON, speed: 2 });
    expect(rt.duration(300)).toBe(150);
    rt.dispose();
  });

  it("wait and tween scale exactly once — callers pass base milliseconds", () => {
    const { scene, delays, tweenDurations, tweenDelays } = recordingScene();
    const rt = createAnimationRuntime(scene, new AbortController().signal, { ...ON, speed: 2 });
    void rt.wait(300);
    void rt.tween({ targets: {}, duration: 400, delay: 100 });
    expect(delays).toEqual([150]);
    expect(tweenDurations).toEqual([200]);
    expect(tweenDelays).toEqual([50]);
    rt.dispose();
  });

  it("batch settings are immutable — a mid-batch change applies to the next runtime", () => {
    const { scene } = recordingScene();
    const settings = { speed: 2 as 1 | 2, reducedMotion: false, volume: 0.5 };
    const rt = createAnimationRuntime(scene, new AbortController().signal, settings);
    settings.speed = 1;
    expect(rt.duration(300)).toBe(150);
    const next = createAnimationRuntime(scene, new AbortController().signal, settings);
    expect(next.duration(300)).toBe(300);
    rt.dispose();
    next.dispose();
  });
});

describe("runtime shake budget", () => {
  it("allows at most two shakes totaling 120 ms, intensity clamped", () => {
    const { scene, shakes } = recordingScene();
    const rt = createAnimationRuntime(scene, new AbortController().signal, ON);
    rt.shake(80, 0.01);
    rt.shake(40, 0.0025);
    rt.shake(10, 0.0025); // a third shake — denied
    expect(shakes.length).toBe(2);
    expect(shakes[0]![1]).toBeLessThanOrEqual(0.0025);
    rt.dispose();
  });

  it("reduced motion rejects every shake", () => {
    const { scene, shakes } = recordingScene();
    const rt = createAnimationRuntime(scene, new AbortController().signal, { ...ON, reducedMotion: true });
    rt.shake(60, 0.0025);
    expect(shakes.length).toBe(0);
    rt.dispose();
  });
});

// ---- queue timeline budgets ----

function tracingBindings(trace: string[]): PresentationBindings {
  return {
    updateUnit: (id) => trace.push(`unit:${id}`),
    updateSeat: (seat) => trace.push(`seat:${seat}`),
    ensureSummon: (id) => trace.push(`summon:${id}`),
    updateMoon: () => trace.push("moon"),
  };
}

function ctx(rt: FakeRuntime, trace: string[], overrides: Partial<AnimContext> = {}): AnimContext {
  return {
    gameData: data,
    presentation: createPresentation(base),
    after: base,
    bindings: tracingBindings(trace),
    unitAnchors: new Map(
      [...base.enemies, ...base.heroes].map((unit, i) => [unit.id, { x: 260 + i * 180, y: i < base.enemies.length ? 240 : 520 }]),
    ),
    unitViews: new Map([...base.enemies, ...base.heroes].map((unit) => [unit.id, stubObject() as unknown as Phaser.GameObjects.Container])),
    seatAnchors: new Map(),
    runtime: rt,
    ...overrides,
  };
}

function firstIntentId(enemyId: string): string {
  const defId = base.enemies.find((enemy) => enemy.id === enemyId)!.defId;
  return data.enemies[defId]!.intents[0]!.id;
}

/** 3 enemy actors × 3 attack intents each — the heaviest routine turn. */
function enemyTurnEvents(): CombatEvent[] {
  const hero = base.heroes.find((unit) => unit.alive)!;
  const slots = [0, 1, 2].map((i) => base.enemies[i % base.enemies.length]!);
  const events: CombatEvent[] = [
    { type: "turnStarted", side: "enemy", round: 2 },
    ...slots.map(
      (enemy): CombatEvent => ({
        type: "intentsRevealed",
        enemyId: enemy.id,
        moonPower: 3,
        intents: [{ intentId: firstIntentId(enemy.id), cost: 1, targetId: hero.id }],
      }),
    ),
  ];
  for (const enemy of slots) {
    const intentId = firstIntentId(enemy.id);
    for (let i = 0; i < 3; i++) {
      events.push(
        { type: "intentExecuted", enemyId: enemy.id, intentId, targetId: hero.id },
        { type: "damageDealt", sourceId: enemy.id, targetId: hero.id, amount: 4, blocked: 0, hpLost: 4 },
      );
    }
  }
  return events;
}

async function playAndMeasure(events: CombatEvent[], settings: Partial<CombatSettings> = {}, overrides: Partial<AnimContext> = {}) {
  const rt = new FakeRuntime(settings);
  const trace: string[] = [];
  const promise = playEventQueue(rt, events, ctx(rt, trace, overrides)).then(() => rt.drain());
  await runToEnd(rt, promise);
  return { rt, trace };
}

describe("timeline budgets", () => {
  it("seed 42 encounter round 6 drains every cosmetic before the 3000 ms commit budget", async () => {
    let state = fixture().state;
    state = applyAction(data, state, { type: "mulligan", instanceIds: [] }).state;
    for (let round = 1; round <= 6; round++) {
      const before = cloneState(state);
      const result = applyAction(data, state, { type: "endTurn" });
      state = result.state;
      if (round !== 6) continue;
      expect(result.events.some(e => ["unitDied", "heroLeveledUp", "coopComboTriggered"].includes(e.type))).toBe(false);
      const { rt } = await playAndMeasure(result.events, {}, { presentation: createPresentation(before), before, after: state });
      expect(rt.pendingCount).toBe(0);
      expect(rt.clock).toBeLessThanOrEqual(3000);
    }
  });
  it("a routine enemy turn finishes within 3000 ms at speed 1", async () => {
    const { rt } = await playAndMeasure(enemyTurnEvents());
    expect(rt.clock).toBeLessThanOrEqual(3000);
  });

  it("speed 2 plays the identical beat order in less time", async () => {
    const one = await playAndMeasure(enemyTurnEvents());
    const two = await playAndMeasure(enemyTurnEvents(), { speed: 2 });
    expect(two.trace).toEqual(one.trace);
    expect(two.rt.clock).toBeLessThan(one.rt.clock);
    // Roughly half — odd base durations round up when halved.
    expect(two.rt.clock).toBeLessThanOrEqual(Math.ceil(one.rt.clock / 2) + 40);
  });

  it("a death + revive + level-up + combo chain finishes within 5000 ms", async () => {
    const enemy = base.enemies[0]!;
    const hero = base.heroes[0]!;
    const { rt } = await playAndMeasure([
      { type: "unitDied", unitId: enemy.id },
      { type: "heroRevived", heroId: hero.id, hp: 30 },
      { type: "heroLeveledUp", heroId: hero.id, name: "Thức Tỉnh" },
      { type: "coopComboTriggered", comboId: "unknown_combo", cardIds: ["a", "b"], player: 0 },
    ]);
    expect(rt.clock).toBeLessThanOrEqual(5000);
  });

  it("reduced motion keeps the same beat order and drops shakes", async () => {
    const plain = await playAndMeasure(enemyTurnEvents());
    const reduced = await playAndMeasure(enemyTurnEvents(), { reducedMotion: true });
    expect(reduced.trace).toEqual(plain.trace);
    expect(reduced.rt.shakes.length).toBe(0);
  });
});

describe("abort and error discipline", () => {
  it("an error inside onImpact rejects the queue instead of silently continuing", async () => {
    const hero = base.heroes[0]!;
    const enemy = base.enemies[0]!;
    const rt = new FakeRuntime();
    const boom = new Error("binding exploded");
    const context = ctx(rt, [], {
      bindings: {
        updateUnit: () => {
          throw boom;
        },
        updateSeat: () => {},
        ensureSummon: () => {},
        updateMoon: () => {},
      },
    });
    const queue = playEventQueue(
      rt,
      [
        { type: "damageDealt", sourceId: enemy.id, targetId: hero.id, amount: 4, blocked: 0, hpLost: 4 },
        { type: "healed", targetId: hero.id, amount: 2 },
      ],
      context,
    );
    await expect(queue).rejects.toThrow("binding exploded");
    rt.dispose();
  });

  it("an abort between beats never runs the next beat's applyBeat or leaks objects", async () => {
    const rt = new FakeRuntime();
    const trace: string[] = [];
    const hero = base.heroes[0]!;
    const context = ctx(rt, trace);
    const queue = playEventQueue(
      rt,
      [
        { type: "turnStarted", side: "hero", round: 1, player: 0 },
        { type: "healed", targetId: hero.id, amount: 2 },
      ],
      context,
    );
    void queue.catch(() => {});
    rt.step(); // resolve turnStarted's hold — the loop's next iteration is a pending microtask
    const createdAtAbort = rt.created.length;
    rt.dispose(); // abort before the continuation runs
    await expect(queue).rejects.toThrow();
    expect(trace.filter((entry) => entry.startsWith("unit:"))).toEqual([]);
    expect(rt.created.length).toBe(createdAtAbort);
  });
});

describe("audio cues in the queue", () => {
  function fakeAudio() {
    const played: string[] = [];
    return {
      played,
      audio: {
        configure: () => {},
        play: (cue: string) => played.push(cue),
        unlock: () => Promise.resolve(),
        dispose: () => {},
      } as never,
    };
  }

  it("plays hit/block/cast cues at the right beats", async () => {
    const hero = base.heroes[0]!;
    const enemy = base.enemies[0]!;
    const { played, audio } = fakeAudio();
    await playAndMeasure(
      [
        { type: "cardPlayed", instanceId: "c0", cost: 0, player: 0 },
        { type: "damageDealt", sourceId: enemy.id, targetId: hero.id, amount: 4, blocked: 0, hpLost: 4 },
        { type: "damageDealt", sourceId: enemy.id, targetId: hero.id, amount: 2, blocked: 2, hpLost: 0 },
        { type: "healed", targetId: hero.id, amount: 5 },
        { type: "unitDied", unitId: enemy.id },
        { type: "moonShifted", from: 0, to: 1, cause: "roundEnd" },
      ],
      {},
      { audio },
    );
    expect(played).toEqual(expect.arrayContaining(["hit", "block", "heal", "death", "moon"]));
    expect(played.indexOf("hit")).toBeLessThan(played.indexOf("block"));
  });

  it("combatEnded resolves the terminal cue from the local seat", async () => {
    const { played, audio } = fakeAudio();
    await playAndMeasure(
      [{ type: "combatEnded", result: "won", winner: 0 }],
      {},
      { audio, mySeat: 0 },
    );
    expect(played).toEqual(["victory"]);

    const second = fakeAudio();
    await playAndMeasure([{ type: "combatEnded", result: "lost", winner: 1 }], {}, { audio: second.audio, mySeat: 0 });
    expect(second.played).toEqual(["defeat"]);

    const draw = fakeAudio();
    await playAndMeasure([{ type: "combatEnded", result: "draw", winner: "draw" }], {}, { audio: draw.audio, mySeat: 0 });
    expect(draw.played).toEqual(["resultDraw"]);
  });
});
