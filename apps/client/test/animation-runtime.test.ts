import { flushMicrotasks } from "./helpers/async";
import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { AnimationAbortedError, createAnimationRuntime } from "../src/ui/animation-runtime";


interface FakeTimer {
  readonly removed: boolean;
  fire(): void;
  remove(): void;
}

interface FakeTween {
  readonly removed: boolean;
  remove(): void;
  complete(): void;
}

/** The two Phaser APIs the runtime owns: `time.delayedCall` and `tweens.add`. */
function fakeScene(): { scene: Phaser.Scene; timers: FakeTimer[]; tweens: FakeTween[] } {
  const timers: { removed: boolean; fire(): void; remove(): void }[] = [];
  const tweens: { removed: boolean; remove(): void; complete(): void }[] = [];
  const scene = {
    time: {
      delayedCall: (_ms: number, callback: () => void) => {
        const timer = {
          removed: false,
          fire: () => callback(),
          remove() {
            this.removed = true;
          },
        };
        timers.push(timer);
        return timer;
      },
    },
    tweens: {
      add: (config: Phaser.Types.Tweens.TweenBuilderConfig) => {
        const tween = {
          removed: false,
          remove() {
            this.removed = true;
          },
          complete: () => config.onComplete?.({} as never, {} as never, [] as never),
        };
        tweens.push(tween);
        return tween;
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, timers, tweens };
}

describe("AnimationRuntime", () => {
  it("wait resolves when the scene timer fires", async () => {
    const { scene, timers } = fakeScene();
    const rt = createAnimationRuntime(scene, new AbortController().signal);
    let done = false;
    const promise = rt.wait(50).then(() => {
      done = true;
    });
    expect(done).toBe(false);
    timers[0]!.fire();
    await promise;
    expect(done).toBe(true);
  });

  it("abort rejects a pending wait with AnimationAbortedError and removes the timer", async () => {
    const { scene, timers } = fakeScene();
    const controller = new AbortController();
    const rt = createAnimationRuntime(scene, controller.signal);
    const captured = rt.wait(50).catch((error: unknown) => error);
    controller.abort();
    const error = await captured;
    expect(error).toBeInstanceOf(AnimationAbortedError);
    expect(timers[0]!.removed).toBe(true);
  });

  it("tween resolves on completion; abort kills the tween and rejects", async () => {
    const { scene, tweens } = fakeScene();
    const controller = new AbortController();
    const rt = createAnimationRuntime(scene, controller.signal);

    const first = rt.tween({ targets: {}, alpha: 0, duration: 100 });
    tweens[0]!.complete();
    await first;

    const captured = rt.tween({ targets: {}, alpha: 0, duration: 100 }).catch((error: unknown) => error);
    controller.abort();
    const error = await captured;
    expect(error).toBeInstanceOf(AnimationAbortedError);
    expect(tweens[1]!.removed).toBe(true);
  });

  it("dispose destroys tracked temporary FX but not the unit view", () => {
    const { scene } = fakeScene();
    const rt = createAnimationRuntime(scene, new AbortController().signal);
    const fx = { destroy: vi.fn() };
    const unitView = { destroy: vi.fn() };
    rt.track(fx as unknown as Phaser.GameObjects.GameObject);
    rt.dispose();
    expect(fx.destroy).toHaveBeenCalledTimes(1);
    expect(unitView.destroy).not.toHaveBeenCalled();
  });

  it("drain waits for fire-and-forget effects before resolving", async () => {
    const { scene, timers } = fakeScene();
    const rt = createAnimationRuntime(scene, new AbortController().signal);
    void rt.wait(30);
    let drained = false;
    const promise = rt.drain().then(() => {
      drained = true;
    });
    await flushMicrotasks();
    expect(drained).toBe(false);
    timers[0]!.fire();
    await promise;
    expect(drained).toBe(true);
  });

  it("assertActive and new operations throw AnimationAbortedError after abort", () => {
    const { scene } = fakeScene();
    const controller = new AbortController();
    const rt = createAnimationRuntime(scene, controller.signal);
    controller.abort();
    expect(() => rt.assertActive()).toThrow(AnimationAbortedError);
    expect(() => rt.wait(1)).toThrow(AnimationAbortedError);
    expect(() => rt.tween({ targets: {}, duration: 1 })).toThrow(AnimationAbortedError);
  });
});
