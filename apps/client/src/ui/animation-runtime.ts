import type Phaser from "phaser";

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
  /** Resolves after `ms` on the scene clock; rejects on abort. */
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

export function createAnimationRuntime(scene: Phaser.Scene, signal: AbortSignal): AnimationRuntime {
  return new SceneAnimationRuntime(scene, signal);
}

class SceneAnimationRuntime implements AnimationRuntime {
  /** Live operation → its cancel (kill timer/tween + reject). */
  private readonly ops = new Map<Promise<unknown>, () => void>();
  private readonly tracked = new Set<Phaser.GameObjects.GameObject>();
  private disposed = false;

  constructor(
    readonly scene: Phaser.Scene,
    private readonly signal: AbortSignal,
  ) {
    if (signal.aborted) {
      this.disposed = true;
    } else {
      signal.addEventListener("abort", () => this.abortAll(), { once: true });
    }
  }

  assertActive(): void {
    if (this.disposed || this.signal.aborted) throw new AnimationAbortedError();
  }

  wait(ms: number): Promise<void> {
    this.assertActive();
    let timer: Phaser.Time.TimerEvent | undefined;
    let cancel!: () => void;
    const op = new Promise<void>((resolve, reject) => {
      timer = this.scene.time.delayedCall(ms, () => resolve());
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
