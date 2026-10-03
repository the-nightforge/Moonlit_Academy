import type Phaser from "phaser";
import { DEFAULT_COMBAT_SETTINGS, ShakeBudget } from "./combat-settings";
import type { CombatSettings } from "./combat-settings";

/** Rejects awaited runtime operations when their scope aborts (rejoin, reset, shutdown). */
export class AnimationAbortedError extends Error {
  constructor(message = "animation aborted") {
    super(message);
    this.name = "AnimationAbortedError";
  }
}

/**
 * Owns the finite operations of one playback batch: the `wait`/`tween`
 * promises, the scene timers/tweens behind them and the temporary FX
 * registered via `track`. Aborting the scope rejects every awaited operation
 * with `AnimationAbortedError`, kills the runtime-owned tweens/timers and
 * destroys the tracked temporary FX — looping tweens on persistent views and
 * unit cards are untouched because they never entered the runtime.
 */
export interface AnimationRuntime {
  readonly scene: Phaser.Scene;
  /** Scales a base duration to this batch's speed — callers pass raw ms, never divide. */
  duration(ms: number): number;
  /** True when this batch prefers tints/short fades over lunges, shakes and dense motes. */
  readonly reducedMotion: boolean;
  /** Camera shake charged to the batch's budget — denied outright under reducedMotion. */
  shake(durationMs: number, intensity: number): void;
  /** Resolves after `ms` (scaled once internally) on the scene clock; rejects on abort. */
  wait(ms: number): Promise<void>;
  /** Resolves when the tween completes; abort removes the tween. */
  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void>;
  /** Marks a temporary object for destruction on abort/dispose; returns it. */
  track<T extends Phaser.GameObjects.GameObject>(object: T): T;
  /** Throws `AnimationAbortedError` once the scope is no longer live. */
  assertActive(): void;
  /** Resolves once every registered operation has settled, including fire-and-forget ones. */
  drain(): Promise<void>;
  /** Aborts the scope permanently; further operations throw. */
  dispose(): void;
}

export function createAnimationRuntime(
  scene: Phaser.Scene,
  signal: AbortSignal,
  settings: CombatSettings = DEFAULT_COMBAT_SETTINGS,
): AnimationRuntime {
  return new SceneAnimationRuntime(scene, signal, settings);
}

class SceneAnimationRuntime implements AnimationRuntime {
  /** Live operation → its cancel (kill timer/tween + reject). */
  private readonly ops = new Map<Promise<unknown>, () => void>();
  private readonly tracked = new Set<Phaser.GameObjects.GameObject>();
  private disposed = false;
  /** Copied at construction — a mid-batch settings change can't reach this batch. */
  private readonly settings: CombatSettings;
  private readonly shakeBudget: ShakeBudget;

  constructor(
    readonly scene: Phaser.Scene,
    private readonly signal: AbortSignal,
    settings: CombatSettings,
  ) {
    this.settings = { ...settings };
    this.shakeBudget = new ShakeBudget(this.settings.reducedMotion);
    if (signal.aborted) {
      this.disposed = true;
    } else {
      signal.addEventListener("abort", () => this.abortAll(), { once: true });
    }
  }

  assertActive(): void {
    if (this.disposed || this.signal.aborted) throw new AnimationAbortedError();
  }

  duration(ms: number): number {
    return Math.round(ms / this.settings.speed);
  }

  get reducedMotion(): boolean {
    return this.settings.reducedMotion;
  }

  shake(durationMs: number, intensity: number): void {
    if (this.disposed || this.signal.aborted) return;
    if (!this.shakeBudget.allow(durationMs)) return;
    this.scene.cameras.main.shake(durationMs, Math.min(intensity, 0.0025));
  }

  wait(ms: number): Promise<void> {
    this.assertActive();
    let timer: Phaser.Time.TimerEvent | undefined;
    let cancel!: () => void;
    const op = new Promise<void>((resolve, reject) => {
      timer = this.scene.time.delayedCall(this.duration(ms), () => resolve());
      cancel = () => {
        timer?.remove();
        reject(new AnimationAbortedError());
      };
    });
    return this.register(op, () => cancel());
  }

  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    this.assertActive();
    let tween: Phaser.Tweens.Tween | undefined;
    let cancel!: () => void;
    const op = new Promise<void>((resolve, reject) => {
      tween = this.scene.tweens.add({
        ...config,
        // Duration and delay scale exactly once here — callers pass base ms.
        duration: typeof config.duration === "number" ? this.duration(config.duration) : config.duration,
        delay: typeof config.delay === "number" ? this.duration(config.delay) : config.delay,
        onComplete: (t, targets, ...param) => {
          config.onComplete?.(t, targets, ...param);
          resolve();
        },
      });
      cancel = () => {
        tween?.remove();
        reject(new AnimationAbortedError());
      };
    });
    return this.register(op, () => cancel());
  }

  track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.assertActive();
    this.tracked.add(object);
    return object;
  }

  async drain(): Promise<void> {
    while (this.ops.size > 0) {
      await Promise.allSettled([...this.ops.keys()]);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.abortAll();
  }

  private register<T>(op: Promise<T>, cancel: () => void): Promise<T> {
    this.ops.set(op, cancel);
    const forget = () => {
      this.ops.delete(op);
    };
    op.then(forget, forget);
    // The runtime owns the rejection: fire-and-forget effects never surface as
    // unhandled rejections, while awaited callers still see the failure.
    void op.catch(() => {});
    return op;
  }

  private abortAll(): void {
    for (const cancel of [...this.ops.values()]) cancel();
    this.ops.clear();
    for (const object of this.tracked) object.destroy();
    this.tracked.clear();
  }
}
