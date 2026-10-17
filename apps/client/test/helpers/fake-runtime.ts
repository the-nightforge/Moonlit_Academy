import { expect } from "vitest";
import type Phaser from "phaser";
import { AnimationAbortedError } from "../../src/ui/animation-runtime";
import type { AnimationRuntime } from "../../src/ui/animation-runtime";
import { ShakeBudget } from "../../src/ui/combat-settings";
import type { CombatSettings } from "../../src/ui/combat-settings";

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
  state.setBlendMode = (mode: string | number) => { state.blendMode = mode; return proxy; };
  return proxy;
}

export function fakeScene(shakeLog: number[], created?: Record<string | symbol, unknown>[], texts?: string[]): Phaser.Scene {
  const textures = { exists: () => true, addCanvas: () => undefined, createCanvas: () => undefined,
    get: (key: string) => /^vfx:combat_(attack|effect)_/.test(key)
      ? { getSourceImage: () => ({ width: 1536, height: 1024 }), has: () => false, add: () => undefined }
      : { getSourceImage: () => ({ width: 128, height: 128 }) } };
  const spawn = () => () => {
    const object = stubObject();
    created?.push(object);
    return object;
  };
  const add = {
    image: (_x: number, _y: number, key: string) => { const object = spawn()(); object.textureKey = key; return object; },
    renderTexture: () => {
      const object = spawn()(); object.frameBlendTarget = true; object.compositedAlpha = 0;
      object.clear = () => { object.compositedAlpha = 0; return object; };
      object.draw = (cells: Record<string | symbol, unknown>[]) => {
        for (const cell of cells) {
          const alpha = Number(cell.alpha), previous = Number(object.compositedAlpha);
          object.compositedAlpha = alpha + previous * (cell.blendMode === "ADD" || cell.blendMode === 1 ? 1 : 1 - alpha);
        }
        return object;
      };
      return object;
    },
    sprite: spawn(),
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
  const anims = { exists: () => true, get: () => ({ repeat: 0, duration: 300 }) };
  return { textures, add, cameras, anims, time: {}, tweens: {} } as unknown as Phaser.Scene;
}

type PendingOp = { due: number; resolve: () => void; reject: (error: Error) => void };

/**
 * Runtime with a manual virtual clock: `wait`/`tween` enqueue ops due at
 * `clock + duration(ms)`, and `step()` advances the clock to the next due
 * time and resolves everything reached. `dispose()` rejects them like an
 * abort and destroys tracked objects.
 */
export class FakeRuntime implements AnimationRuntime {
  readonly scene: Phaser.Scene;
  readonly shakes: number[] = [];
  /** Virtual milliseconds elapsed — the queue's perceived wall time. */
  clock = 0;
  /** Objects the fake scene created (for leak/destroy assertions). */
  readonly created: Record<string | symbol, unknown>[] = [];
  /** Text contents the fake scene received (banner/label assertions). */
  readonly texts: string[] = [];
  /** Rectangle spawn args `[x, y, w, h, color, alpha]` (bounds assertions). */
  readonly rects: unknown[][] = [];
  /** Tween configs the runtime was asked to run. */
  readonly tweenConfigs: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
  readonly spriteKeys: string[] = [];
  private readonly settings: CombatSettings;
  private readonly budget: ShakeBudget;
  private readonly pending: PendingOp[] = [];
  private readonly tracked = new Set<Record<string | symbol, unknown>>();
  private dead = false;

  constructor(settings: Partial<CombatSettings> = {}) {
    // The runtime copies its batch's settings — a later change can't reach in.
    this.settings = { speed: 1, reducedMotion: false, volume: 0.5, ...settings };
    this.budget = new ShakeBudget(this.settings.reducedMotion);
    this.scene = fakeScene(this.shakes, this.created, this.texts);
    const rects = this.rects;
    const baseRect = this.scene.add.rectangle;
    this.scene.add.rectangle = ((...args: Parameters<typeof baseRect>) => {
      rects.push(args);
      return baseRect(...args);
    }) as typeof baseRect;
  }

  duration(ms: number): number {
    return Math.round(ms / this.settings.speed);
  }

  get reducedMotion(): boolean {
    return this.settings.reducedMotion;
  }

  shake(durationMs: number, intensity: number): void {
    if (!this.budget.allow(durationMs)) return;
    this.scene.cameras.main.shake(durationMs, Math.min(intensity, 0.0025));
  }

  wait(ms: number): Promise<void> {
    return this.enqueue(this.duration(ms));
  }

  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    this.tweenConfigs.push(config);
    const delay = typeof config.delay === "number" ? config.delay : 0;
    const base = (config.duration ?? 0) as number;
    const total = delay + base * ((config.repeat ?? 0) + 1) * (config.yoyo === true ? 2 : 1);
    // Illustration clocks drive gameplay during onUpdate, before their tails finish.
    // Sample at scene-frame intervals rather than treating the whole tween as a wait.
    const target = config.targets as { elapsed?: number } | undefined;
    if (target && typeof target.elapsed === "number" && typeof config.elapsed === "number" && config.onUpdate) {
      const start = target.elapsed, end = config.elapsed;
      let failed = false;
      const samples = Array.from({ length: Math.max(1, Math.ceil(base / 16)) }, (_, i) => Math.min(base, (i + 1) * 16));
      const updates = samples.map(elapsed => this.enqueue(this.duration(delay + elapsed), () => {
        if (failed) return;
        target.elapsed = Math.max(target.elapsed ?? start, start + (end - start) * elapsed / Math.max(1, base));
        try { (config.onUpdate as () => void)(); } catch (error) { failed = true; throw error; }
      }));
      return Promise.all(updates).then(() => undefined);
    }
    return this.enqueue(this.duration(total));
  }

  play(_sprite: Phaser.GameObjects.Sprite, key: string): Promise<void> {
    this.spriteKeys.push(key);
    return this.enqueue(this.duration(300));
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

  /** Advances the clock to the earliest due op and resolves everything due. */
  step(): void {
    if (this.pending.length === 0) return;
    const due = Math.min(...this.pending.map((op) => op.due));
    this.clock = Math.max(this.clock, due);
    const ready = this.pending.filter((op) => op.due <= this.clock);
    this.pending.splice(0, this.pending.length, ...this.pending.filter((op) => op.due > this.clock));
    for (const op of ready) op.resolve();
  }

  async drain(): Promise<void> {
    let idle = 0;
    while (idle < 8) {
      if (this.pending.length > 0) idle = 0; else idle++;
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

  private enqueue(ms: number, action?: () => void): Promise<void> {
    this.assertActive();
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // The runtime owns the rejection, like SceneAnimationRuntime.register.
    void promise.catch(() => {});
    this.pending.push({ due: this.clock + Math.max(0, ms), resolve: () => { try { action?.(); resolve(); } catch (error) { reject(error as Error); } }, reject });
    return promise;
  }
}

/** Drives the manual clock until `promise` settles; fails if it never did. */
export async function runToEnd(rt: FakeRuntime, promise: Promise<unknown>): Promise<void> {
  let done = false;
  void promise.then(() => (done = true), () => (done = true));
  for (let i = 0; i < 5000 && !done; i++) {
    rt.step();
    await Promise.resolve();
    await Promise.resolve();
  }
  expect(done).toBe(true);
}
