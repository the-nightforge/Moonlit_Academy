import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { AnimationAbortedError } from "../src/ui/animation-runtime";
import type { AnimationRuntime } from "../src/ui/animation-runtime";
import type { AttackLook } from "../src/ui/attack-style";
import { playAttack } from "../src/ui/vfx";

/**
 * A chainable stand-in for any Phaser game object: unknown property reads
 * return a function that returns the proxy, so `.setTint(...).setScale(...)`
 * chains work, while declared fields (x, y, alpha, ...) stay real values.
 */
function stubObject(fields: Record<string, unknown> = {}): Record<string | symbol, unknown> {
  const state: Record<string | symbol, unknown> = { x: 0, y: 0, alpha: 1, scale: 1, rotation: 0, ...fields };
  const proxy: Record<string | symbol, unknown> = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        if (key === "destroy") target.destroyed = true;
        return proxy;
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  return proxy;
}

function fakeScene(shakeLog: number[]): Phaser.Scene {
  const textures = { exists: () => true, addCanvas: () => undefined };
  const add = {
    image: () => stubObject(),
    rectangle: () => stubObject(),
    text: () => stubObject(),
    graphics: () => stubObject(),
    particles: () => stubObject(),
    container: () => stubObject(),
  };
  const cameras = { main: { shake: () => shakeLog.push(1), flash: () => undefined, width: 1280, height: 720 } };
  return { textures, add, cameras, time: {}, tweens: {} } as unknown as Phaser.Scene;
}

type PendingOp = { resolve: () => void; reject: (error: Error) => void };

/** Runtime with a manual clock: `step()` resolves every currently-pending op. */
class FakeRuntime implements AnimationRuntime {
  readonly scene: Phaser.Scene;
  readonly shakes: number[] = [];
  private readonly pending: PendingOp[] = [];
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
      const ops = this.pending.splice(0).map((op) => {
        op.resolve();
        return Promise.resolve();
      });
      await Promise.all(ops);
    }
  }

  dispose(): void {
    this.dead = true;
    for (const op of this.pending.splice(0)) op.reject(new AnimationAbortedError());
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

/** Drives the manual clock until `promise` settles; returns false if it never did. */
async function runToEnd(rt: FakeRuntime, promise: Promise<unknown>): Promise<void> {
  let done = false;
  void promise.then(() => (done = true), () => (done = true));
  for (let i = 0; i < 500 && !done; i++) {
    rt.step();
    await Promise.resolve();
    await Promise.resolve();
  }
  expect(done).toBe(true);
}

const look = (kind: AttackLook["kind"]): AttackLook => ({ kind, color: 0xff4466 });
const from = { x: 0, y: 0 };
const to = { x: 320, y: 120 };
const attacker = () => stubObject() as unknown as Phaser.GameObjects.Container;

describe("playAttack onImpact", () => {
  it("slash fires onImpact exactly once, before cleanup completes", async () => {
    const rt = new FakeRuntime();
    const order: string[] = [];
    const attack = playAttack(look("slash"), from, to, {
      blocked: false,
      runtime: rt,
      attackerView: attacker(),
      onImpact: () => {
        order.push("impact");
        order.push("damage");
      },
    });
    await runToEnd(rt, attack);
    order.push("cleanup");
    expect(order).toEqual(["impact", "damage", "cleanup"]);
  });

  it("ribbon fires onImpact exactly once, before cleanup completes", async () => {
    const rt = new FakeRuntime();
    let impacts = 0;
    const attack = playAttack(look("ribbon"), from, to, {
      blocked: false,
      runtime: rt,
      onImpact: () => {
        impacts += 1;
      },
    });
    await runToEnd(rt, attack);
    expect(impacts).toBe(1);
  });

  it("darts fires onImpact once at the decisive hit even with three projectiles", async () => {
    const rt = new FakeRuntime();
    let impacts = 0;
    let shakesAtImpact = -1;
    const attack = playAttack(look("darts"), from, to, {
      blocked: false,
      runtime: rt,
      onImpact: () => {
        impacts += 1;
        shakesAtImpact = rt.shakes.length;
      },
    });
    await runToEnd(rt, attack);
    expect(impacts).toBe(1);
    expect(rt.shakes.length).toBe(3); // three visual impacts, one decisive callback
    expect(shakesAtImpact).toBe(3);
  });

  it("abort before impact never calls onImpact", async () => {
    const rt = new FakeRuntime();
    let impacts = 0;
    const attack = playAttack(look("slash"), from, to, {
      blocked: false,
      runtime: rt,
      attackerView: attacker(), // slash waits before lunging when an attacker view exists
      onImpact: () => {
        impacts += 1;
      },
    });
    await Promise.resolve();
    rt.dispose();
    await expect(attack).rejects.toBeInstanceOf(AnimationAbortedError);
    expect(impacts).toBe(0);
  });

  it("abort after impact keeps exactly one call", async () => {
    const rt = new FakeRuntime();
    let impacts = 0;
    const attack = playAttack(look("ribbon"), from, to, {
      blocked: false,
      runtime: rt,
      onImpact: () => {
        impacts += 1;
      },
    });
    await runToEnd(rt, attack); // reaches the decisive impact, then the lash-back runs
    rt.dispose();
    expect(impacts).toBe(1);
  });
});
