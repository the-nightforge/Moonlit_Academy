import { expect } from "vitest";
import type Phaser from "phaser";
import { AnimationAbortedError } from "../../src/ui/animation-runtime";
import type { AnimationRuntime } from "../../src/ui/animation-runtime";

/**
 * A chainable stand-in for any Phaser game object: unknown property reads
 * return a function that returns the proxy, so `.setTint(...).setScale(...)`
 * chains work, while declared fields (x, y, alpha, ...) stay real values.
 * `destroy()` flips `destroyed`.
 */
export function stubObject(fields: Record<string, unknown> = {}): Record<string | symbol, unknown> {
  const state: Record<string | symbol, unknown> = { x: 0, y: 0, alpha: 1, scale: 1, rotation: 0, destroyed: false, ...fields };
  const proxy: Record<string | symbol, unknown> = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      return () => proxy;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  // destroy records instead of chaining.
  state.destroy = () => {
    state.destroyed = true;
    return proxy;
  };
  return proxy;
}

export function fakeScene(shakeLog: number[]): Phaser.Scene {
  const textures = { exists: () => true, addCanvas: () => undefined, createCanvas: () => undefined, get: () => ({ getSourceImage: () => ({ width: 128, height: 128 }) }) };
  const add = {
    image: () => stubObject(),
    rectangle: () => stubObject(),
    circle: () => stubObject(),
    text: () => stubObject(),
    graphics: () => stubObject(),
    particles: () => stubObject(),
    container: () => stubObject(),
    zone: () => stubObject(),
  };
  const cameras = { main: { shake: () => shakeLog.push(1), flash: () => undefined, width: 1280, height: 720 } };
  return { textures, add, cameras, time: {}, tweens: {} } as unknown as Phaser.Scene;
}

type PendingOp = { resolve: () => void; reject: (error: Error) => void };

/**
 * Runtime with a manual clock: `step()` resolves every op queued so far,
 * `dispose()` rejects them like an abort and destroys tracked objects.
 */
export class FakeRuntime implements AnimationRuntime {
  readonly scene: Phaser.Scene;
  readonly shakes: number[] = [];
  private readonly pending: PendingOp[] = [];
  private readonly tracked = new Set<Record<string | symbol, unknown>>();
  private dead = false;

  constructor() {
    this.scene = fakeScene(this.shakes);
  }

  wait(_ms: number): Promise<void> {
    return this.enqueue();
  }

  tween(_config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return this.enqueue();
  }

  track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.assertActive();
    this.tracked.add(object as unknown as Record<string | symbol, unknown>);
    return object;
  }

  assertActive(): void {
    if (this.dead) throw new AnimationAbortedError();
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Resolves every op queued so far; continuations may enqueue more. */
  step(): void {
    for (const op of this.pending.splice(0)) op.resolve();
  }

  async drain(): Promise<void> {
    while (this.pending.length > 0) {
      this.step();
      await Promise.resolve();
    }
  }

  dispose(): void {
    this.dead = true;
    for (const op of this.pending.splice(0)) op.reject(new AnimationAbortedError());
    for (const object of this.tracked) {
      (object.destroy as (() => void) | undefined)?.();
    }
    this.tracked.clear();
  }

  private enqueue(): Promise<void> {
    this.assertActive();
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // The runtime owns the rejection, like SceneAnimationRuntime.register.
    void promise.catch(() => {});
    this.pending.push({ resolve, reject });
    return promise;
  }
}

/** Drives the manual clock until `promise` settles; fails if it never did. */
export async function runToEnd(rt: FakeRuntime, promise: Promise<unknown>): Promise<void> {
  let done = false;
  void promise.then(() => (done = true), () => (done = true));
  for (let i = 0; i < 500 && !done; i++) {
    rt.step();
    await Promise.resolve();
    await Promise.resolve();
  }
  expect(done).toBe(true);
}
