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

export function fakeScene(shakeLog: number[], created?: Record<string | symbol, unknown>[], texts?: string[]): Phaser.Scene {
  const textures = { exists: () => true, addCanvas: () => undefined, createCanvas: () => undefined, get: () => ({ getSourceImage: () => ({ width: 128, height: 128 }) }) };
  const spawn = () => () => {
    const object = stubObject();
    created?.push(object);
    return object;
  };
  const add = {
    image: spawn(),
    rectangle: spawn(),
    circle: spawn(),
    text: (...args: unknown[]) => {
      const object = stubObject();
      created?.push(object);
      texts?.push(String(args[2] ?? ""));
      return object;
    },
    graphics: spawn(),
    particles: spawn(),
    container: spawn(),
    zone: spawn(),
  };
  const cameras = {
    main: {
      shake: () => shakeLog.push(1),
      flash: () => undefined,
      width: 1280,
      height: 720,
      midPoint: { x: 640, y: 360 },
      worldView: { x: 0, y: 0, width: 1280, height: 720, centerX: 640, centerY: 360 },
    },
  };
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
  /** Objects the fake scene created (for leak/destroy assertions). */
  readonly created: Record<string | symbol, unknown>[] = [];
  /** Text contents the fake scene received (banner/label assertions). */
  readonly texts: string[] = [];
  /** Rectangle spawn args `[x, y, w, h, color, alpha]` (bounds assertions). */
  readonly rects: unknown[][] = [];
  /** Tween configs the runtime was asked to run. */
  readonly tweenConfigs: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
  private readonly pending: PendingOp[] = [];
  private readonly tracked = new Set<Record<string | symbol, unknown>>();
  private dead = false;

  constructor() {
    this.scene = fakeScene(this.shakes, this.created, this.texts);
    const rects = this.rects;
    const baseRect = this.scene.add.rectangle;
    this.scene.add.rectangle = ((...args: unknown[]) => {
      rects.push(args);
      return baseRect(...args);
    }) as typeof baseRect;
  }

  wait(_ms: number): Promise<void> {
    return this.enqueue();
  }

  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    this.tweenConfigs.push(config);
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
