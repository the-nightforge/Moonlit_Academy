import type Phaser from "phaser";
import { expect, it, vi } from "vitest";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";
import { playAwakening } from "../src/ui/awakening-showcase";
import { HERO_AWAKENINGS } from "../src/ui/awakening-profiles";
vi.mock("../src/ui/theme", () => ({ TEXT_BASE: {} }));

function setup(settings = {}, heroId = "m12") {
  const rt = new FakeRuntime(settings);
  const portrait = stubObject({ texture: { key: `heroes:${heroId}` }, x: 0, y: 0, displayWidth: 80, displayHeight: 120 });
  const fresh = stubObject({ texture: { key: `heroes:${heroId}_up` } });
  let current = portrait;
  const view = stubObject({ x: 600, y: 480, scaleX: 1, scaleY: 1, angle: 0, depth: 0,
    getData: (key: string) => key === "unitPortrait" ? current : undefined,
    getIndex: () => 3, addAt: vi.fn(), remove: vi.fn(), parentContainer: null,
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
    run: () => playAwakening(rt, { heroId, view, transform }) };
}

it("keeps illustrated effects inside the card below badges even during charge", async () => {
  const s=setup(); const result=s.run();
  const inserted = (s.view.addAt as ReturnType<typeof vi.fn>).mock.calls.length;
  s.rt.dispose(); await expect(result).rejects.toThrow("animation aborted");
  expect(inserted).toBe(1);
});

it("actually plays 25 different illustrated timelines and retains identities with reduced motion", async () => {
  const timelines:string[]=[];
  for (const [id,profile] of Object.entries(HERO_AWAKENINGS)) {
    for (const reducedMotion of [false,true]) {
      const s=setup({reducedMotion,speed:2},id), result=s.run();
      await runToEnd(s.rt,result); await result;
      expect(s.images.map(image=>image.key)).toEqual([`vfx:${profile.texture}`,`heroes:${id}`]);
      expect(s.rt.clock).toBe((reducedMotion?180:520)/2);
      expect(s.transform).toHaveBeenCalledTimes(1);
      expect(s.rt.created.every(o=>o.destroyed)).toBe(true);
      const configs=s.rt.tweenConfigs;
      if(reducedMotion) expect(configs.every(c=>c.x===undefined&&c.y===undefined&&c.scale===undefined&&c.angle===undefined)).toBe(true);
      else timelines.push(JSON.stringify(configs.map(({duration,x,y,scale,angle,alpha,ease})=>({duration,x,y,scale,angle,alpha,ease}))));
    }
  }
  expect(new Set(timelines).size).toBe(25);
});

it("keeps the two new heroes' own illustrated motifs", () => {
  expect(HERO_AWAKENINGS.m12!.texture).toBe("awakening_bronze_gate");
  expect(HERO_AWAKENINGS.f13!.texture).toBe("awakening_omen_pages");
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

it("reduced motion retains the hero's own illustration and only fades for 180 milliseconds", async () => {
  const s = setup({ reducedMotion: true }); await runToEnd(s.rt, s.run());
  expect(s.rt.clock).toBe(180);
  expect(s.images.map(i => i.key)).toContain("vfx:awakening_bronze_gate");
  expect(s.rt.tweenConfigs.every(c => c.x === undefined && c.y === undefined && c.scale === undefined && c.angle === undefined && c.rotation === undefined)).toBe(true);
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

it("does not leave detached artwork at the scene origin when refreshed art disappears", async () => {
  const s=setup();
  s.transform.mockImplementation(()=>{s.view.getData=()=>null;});
  const result=s.run(); const effects=s.rt.created[0]!;
  const setVisible=vi.fn(); effects.setVisible=setVisible;
  await runToEnd(s.rt,result); await result;
  expect(setVisible).toHaveBeenCalledWith(false);
  expect(s.transform).toHaveBeenCalledTimes(1);
});

it.each([false, true])("abort before/after the art swap (%s) cleans up without replaying the event", async afterSwap => {
  const s = setup(); const result = s.run();
  if (afterSwap) { s.rt.step(); for (let i = 0; i < 12; i++) await Promise.resolve(); }
  s.rt.dispose(); await expect(result).rejects.toThrow("animation aborted");
  expect(s.transform).toHaveBeenCalledTimes(afterSwap ? 1 : 0);
  expect(s.rt.pendingCount).toBe(0); expect(s.rt.created.every(o => o.destroyed)).toBe(true);
});
