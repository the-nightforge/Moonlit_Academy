import type Phaser from "phaser";
import { expect, it, vi } from "vitest";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";
import { playAwakening, awakeningTheme } from "../src/ui/awakening-showcase";
vi.mock("../src/ui/theme", () => ({ TEXT_BASE: {} }));

function setup(settings = {}) {
  const rt = new FakeRuntime(settings);
  const portrait = stubObject({ texture: { key: "heroes:m12" }, x: 0, y: 0, displayWidth: 80, displayHeight: 120 });
  const fresh = stubObject({ texture: { key: "heroes:m12_up" } });
  let current = portrait;
  const view = stubObject({ x: 600, y: 480, scaleX: 1, scaleY: 1, angle: 0, depth: 0,
    getData: (key: string) => key === "unitPortrait" ? current : undefined,
    getIndex: () => 3, addAt: vi.fn(), parentContainer: null,
  }) as unknown as Phaser.GameObjects.Container;
  const transform = vi.fn(() => { (portrait.destroy as () => void)(); current = fresh; });
  const images: { key: string; object: ReturnType<typeof stubObject> }[] = [];
  rt.scene.add.image = ((x: number, y: number, key: string) => {
    const object = stubObject({ x, y, width: 1024, height: 1536, texture: { key }, scaleX: 1 });
    images.push({ key, object }); return object;
  }) as unknown as typeof rt.scene.add.image;
  const graphics = vi.spyOn(rt.scene.add, "graphics");
  const createContainer = rt.scene.add.container.bind(rt.scene.add);
  rt.scene.add.container = ((...args: Parameters<typeof createContainer>) => {
    const node = createContainer(...args);
    const children: Phaser.GameObjects.GameObject[] = [];
    node.add = ((child: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) => {
      children.push(...(Array.isArray(child) ? child : [child])); return node;
    }) as typeof node.add;
    const destroy = node.destroy.bind(node);
    node.destroy = () => { children.forEach(child => child.destroy()); destroy(); };
    return node;
  }) as typeof rt.scene.add.container;
  return { rt, portrait, view, transform, images, graphics,
    run: () => playAwakening(rt, { heroId: "m12", style: "slash", view, transform }) };
}

it("keeps the two new heroes' own illustrated motifs", () => {
  expect(awakeningTheme("m12", "slash").motif).toBe("gate");
  expect(awakeningTheme("f13", "moon").motif).toBe("pages");
});

it.each([1, 2] as const)("changes the real portrait once after charge and completes in 520 / speed %s", async speed => {
  const s = setup({ speed }); const result = s.run();
  expect(s.transform).not.toHaveBeenCalled();
  await runToEnd(s.rt, result); await result;
  expect(s.transform).toHaveBeenCalledTimes(1);
  expect(s.portrait.destroyed).toBe(true);
  expect(s.rt.clock).toBe(520 / speed);
  expect(s.images.map(i => i.key)).toContain("vfx:awakening_bronze_gate");
  expect(s.rt.created.every(o => o.destroyed)).toBe(true);
});

it("uses the unit's local art bounds, with the old art underneath badges and no modal or drawn ornaments", async () => {
  const s = setup(); await runToEnd(s.rt, s.run());
  expect(s.view.addAt).toHaveBeenCalledWith(expect.anything(), 4);
  expect(s.rt.rects).toEqual([[0, 0, 82, 122, expect.any(Number), 0]]);
  expect(s.rt.texts).toEqual([]); expect(s.graphics).not.toHaveBeenCalled();
  expect(s.rt.shakes).toEqual([]);
});

it("reduced motion only fades for 180 milliseconds, with no travelling or scaling motif", async () => {
  const s = setup({ reducedMotion: true }); await runToEnd(s.rt, s.run());
  expect(s.rt.clock).toBe(180);
  expect(s.images.map(i => i.key)).not.toContain("vfx:awakening_bronze_gate");
  expect(s.rt.tweenConfigs.every(c => c.x === undefined && c.y === undefined && c.scale === undefined && c.rotation === undefined)).toBe(true);
});

it("missing art still applies the event exactly once without an empty frame or textual substitute", async () => {
  const s = setup(); s.rt.scene.textures.exists = () => false;
  await s.run(); expect(s.transform).toHaveBeenCalledTimes(1);
  expect(s.rt.created).toEqual([]); expect(s.rt.texts).toEqual([]);
});

it("missing effect assets preserve the charge/blend timing and event", async () => {
  const s = setup(); s.rt.scene.textures.exists = key => !String(key).startsWith("vfx:");
  await runToEnd(s.rt, s.run()); expect(s.rt.clock).toBe(520);
  expect(s.transform).toHaveBeenCalledTimes(1);
});

it.each([false, true])("abort before/after the art swap (%s) cleans up without replaying the event", async afterSwap => {
  const s = setup(); const result = s.run();
  if (afterSwap) { s.rt.step(); for (let i = 0; i < 12; i++) await Promise.resolve(); }
  s.rt.dispose(); await expect(result).rejects.toThrow("animation aborted");
  expect(s.transform).toHaveBeenCalledTimes(afterSwap ? 1 : 0);
  expect(s.rt.pendingCount).toBe(0); expect(s.rt.created.every(o => o.destroyed)).toBe(true);
});
