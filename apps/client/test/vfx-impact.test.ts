import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { AnimationAbortedError } from "../src/ui/animation-runtime";
import type { AttackLook } from "../src/ui/attack-style";
import { playAttack } from "../src/ui/vfx";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";

const look = (kind: AttackLook["kind"]): AttackLook => ({ kind, color: 0xff4466 });
const from = { x: 0, y: 0 };
const to = { x: 320, y: 120 };
const attacker = () => stubObject() as unknown as Phaser.GameObjects.Container;

describe("playAttack onImpact", () => {
  it("a blue unblocked spell remains a hit, and reduced motion does not start frame bursts", async () => {
    for (const reducedMotion of [false, true]) {
      const rt = new FakeRuntime({ reducedMotion });
      await runToEnd(rt, playAttack({ kind: "spell", color: 0x9fd4ff }, from, to, { blocked: false, runtime: rt }));
      await rt.drain();
      expect(rt.spriteKeys).toEqual(reducedMotion ? [] : ["combat-impact-hit"]);
      rt.dispose();
    }
  });

  it.each(["slash", "spear"] as const)("%s winds up, strikes within 36 pixels and recovers", async kind => {
    const rt = new FakeRuntime();
    const view = attacker();
    await runToEnd(rt, playAttack(look(kind), from, to, { blocked: false, runtime: rt, attackerView: view }));
    await rt.drain();
    const motion = rt.tweenConfigs.filter(config => config.targets === view);
    expect(motion[0]!.x).toBeLessThan(from.x);
    expect(motion).toHaveLength(3);
    expect(Math.hypot(Number(motion[1]!.x) - from.x, Number(motion[1]!.y) - from.y)).toBeLessThanOrEqual(36.01);
    expect(motion[2]).toMatchObject({ x: from.x, y: from.y });
    rt.dispose();
  });

  it.each([false, true])("uses a distinct frame animation for a blocked=%s impact", async blocked => {
    const rt = new FakeRuntime();
    await runToEnd(rt, playAttack(look("slash"), from, to, { blocked, runtime: rt }));
    await rt.drain();
    expect(rt.spriteKeys).toContain(blocked ? "combat-impact-guard" : "combat-impact-hit");
    rt.dispose();
    expect(rt.created.every(object => object.destroyed)).toBe(true);
  });

  for (const kind of ["slash", "spear"] as const) {
    it(`reduced motion ${kind} keeps the attacker stationary with one impact`, async () => {
      const rt = new FakeRuntime({ reducedMotion: true });
      const view = attacker();
      let impacts = 0;
      await runToEnd(rt, playAttack(look(kind), from, to, { blocked: false, runtime: rt, attackerView: view, onImpact: () => impacts++ }));
      await rt.drain();
      expect(impacts).toBe(1);
      expect(rt.tweenConfigs.filter(config => config.targets === view && (config.x !== undefined || config.y !== undefined))).toEqual([]);
    });
  }
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
    // Three visual impacts still land — the shake budget caps the camera at two.
    expect(rt.shakes.length).toBe(2);
    expect(shakesAtImpact).toBe(2);
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
