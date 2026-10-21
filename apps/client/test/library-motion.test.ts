import type Phaser from "phaser";
import { expect, it, vi } from "vitest";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";

const { motions } = vi.hoisted(() => {
  const sources = ["combat_attack_slash", "combat_attack_spear", "combat_effect_hit", "combat_effect_guard", "combat_effect_heal",
    "combat_effect_armor", "combat_effect_armor_break", "combat_effect_status_apply", "combat_effect_status_remove", "combat_effect_death",
    "combat_effect_blood_moon", "combat_effect_cast", "combat_effect_moon_shift", "combat_effect_reflect", "awakening_m12_motion", "awakening_f13_motion"];
  return { motions: sources.map(stem => ({ sourceKey: `vfx:${stem}`, textureKey: `vfx:${stem}_smooth`, count: 8, peak: 3, stretch: 1.6,
    anchor: { x: 32, y: 80 }, presentationSize: { width: 64, height: 96 }, atlas: {
      meta: { size: { w: 256, h: 192 } }, frames: Array.from({ length: 8 }, (_, index) => ({
        frame: { x: index % 4 * 64, y: Math.floor(index / 4) * 96, w: 64, h: 96 }, rotated: false, trimmed: false,
        sourceSize: { w: 64, h: 96 }, spriteSourceSize: { x: 0, y: 0, w: 64, h: 96 }, duration: 100,
      })),
    } })) };
});
vi.mock("../src/ui/motion-library", () => ({ libraryMotions: motions, libraryMotion: (sourceKey: string) => motions.find(motion => motion.sourceKey === sourceKey) }));
vi.mock("../src/ui/texture-queue", () => ({ queueTexture: async (scene: any, key: string) => {
  if (scene.failures.has(key)) throw new Error("missing texture"); scene.available.add(key);
} }));
vi.mock("../src/ui/theme", () => ({ RENDER_SCALE: 2 }));

import { playCombatIllustration, registerCombatFrames } from "../src/ui/combat-illustration";
import { playAwakening } from "../src/ui/awakening-showcase";
import { registerAwakeningFrames } from "../src/ui/awakening-flipbook";
import { HERO_AWAKENINGS } from "../src/ui/awakening-profiles";
import { combatTextureEntries, prepareCombatAssets } from "../src/ui/combat-assets";
import { armorWard, bloodMoonSurge, castCard, deathBurn, healBloom, moonWheel, playAttack, reflectStrike, statusPop } from "../src/ui/vfx";
import { impactAnimation } from "../src/ui/impact-animation";

function setup(settings = {}, availability: "valid" | "missing" | "malformed" = "valid") {
  const rt = new FakeRuntime(settings), frames = new Map<string, Map<string, number[]>>(), cells: any[] = [], targets: any[] = [];
  rt.scene.textures.exists = key => !(availability === "missing" && String(key).endsWith("_smooth"));
  rt.scene.textures.get = ((key: string) => {
    const bounds = key.endsWith("_smooth") ? availability === "malformed" ? { width: 128, height: 128 } : { width: 256, height: 192 } : { width: 1536, height: 1024 };
    if (!frames.has(key)) frames.set(key, new Map()); const entries = frames.get(key)!;
    return { getSourceImage: () => bounds, has: (frame: string) => entries.has(frame), add: (frame: string, ...rect: number[]) => entries.set(frame, rect) };
  }) as any;
  const instrument = (node: any) => {
    for (const [method, fields] of [["setPosition", ["x", "y"]], ["setOrigin", ["originX", "originY"]], ["setScale", ["scaleX", "scaleY"]], ["setFrame", ["frame"]], ["setAlpha", ["alpha"]]] as const)
      node[method] = (...values: unknown[]) => { fields.forEach((field, index) => node[field] = values[index] ?? values[0]); return node; };
    return node;
  };
  const addImage = rt.scene.add.image.bind(rt.scene.add), addTarget = rt.scene.add.renderTexture.bind(rt.scene.add);
  rt.scene.add.image = ((...args: Parameters<typeof addImage>) => { const node = instrument(addImage(...args)); cells.push(node); return node; }) as any;
  rt.scene.add.renderTexture = ((...args: Parameters<typeof addTarget>) => { const node = instrument(addTarget(...args)); targets.push(node); return node; }) as any;
  const addContainer = rt.scene.add.container.bind(rt.scene.add);
  rt.scene.add.container = ((...args: Parameters<typeof addContainer>) => {
    const node = addContainer(...args), children: Phaser.GameObjects.GameObject[] = [];
    node.add = ((child: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) => { children.push(...Array.isArray(child) ? child : [child]); return node; }) as typeof node.add;
    const destroy = node.destroy.bind(node); node.destroy = () => { children.forEach(child => child.destroy()); destroy(); }; return node;
  }) as typeof rt.scene.add.container;
  return { rt, frames, cells, targets };
}
function sample(rt: FakeRuntime, elapsed: number) {
  const config = rt.tweenConfigs[0]!; (config.targets as { elapsed: number }).elapsed = elapsed; (config.onUpdate as () => void)();
}

it.each([1, 2] as const)("plays exact metadata with continuous frames and one stretched impact at speed %s", async speed => {
  const s = setup({ speed }), beat = vi.fn();
  const result = playCombatIllustration(s.rt, "attack_slash", { to: { x: 12, y: 34 }, duration: 500, impactAt: 120, onImpact: beat });
  expect(s.rt.tweenConfigs).toHaveLength(1); expect(s.rt.tweenConfigs[0]!.duration).toBe(800);
  sample(s.rt, 119); expect(beat).not.toHaveBeenCalled();
  sample(s.rt, 120); expect(beat).toHaveBeenCalledTimes(1); expect(s.cells[0].frame).toBe("combat-3");
  expect(s.targets[0]).toMatchObject({ originX: .5, originY: 80 / 96 });
  sample(s.rt, 200); expect(s.cells[0].textureKey).toBe("vfx:combat_attack_slash_smooth");
  expect(s.targets[0].compositedAlpha).toBeCloseTo(1); expect(s.targets[0].scaleX).toBe(s.targets[0].scaleY);
  await runToEnd(s.rt, result); await result;
  expect(s.rt.clock).toBe(800 / speed); expect(beat).toHaveBeenCalledTimes(1); expect(s.rt.created.every(node => node.destroyed)).toBe(true);
  expect(s.frames.get("vfx:combat_attack_slash_smooth")!.get("combat-7")).toEqual([0, 192, 96, 64, 96]);
});

it.each([1, 2] as const)("delivers the impact at the stretched wall-clock milestone at speed %s", async speed => {
  const s = setup({ speed }), observed: number[] = [];
  const result = playCombatIllustration(s.rt, "attack_slash", { to: { x: 0, y: 0 }, duration: 410, impactAt: 95, onImpact: () => observed.push(s.rt.clock) });
  await runToEnd(s.rt, result); await result; expect(observed).toHaveLength(1);
  expect(observed[0]).toBeGreaterThanOrEqual(95 * 1.6 / speed); expect(observed[0]).toBeLessThanOrEqual((95 * 1.6 + 16) / speed);
});

it("reduced library effects retain their peak in place with base timing", async () => {
  const s = setup({ reducedMotion: true }), motion = vi.fn(() => ({ x: 0, y: 0 })), beat = vi.fn();
  const result = playCombatIllustration(s.rt, "effect_heal", { to: { x: 12, y: 34 }, duration: 560, impactAt: 150, motion, onImpact: beat });
  sample(s.rt, 150); expect(s.cells).toHaveLength(1); expect(s.cells[0]).toMatchObject({ textureKey: "vfx:combat_effect_heal_smooth", frame: "combat-3", x: 12, y: 34 });
  expect(motion).not.toHaveBeenCalled(); await runToEnd(s.rt, result); await result;
  expect(s.rt.clock).toBe(560); expect(beat).toHaveBeenCalledTimes(1);
});

it.each(["missing", "malformed", "legacy"] as const)("keeps legacy playback when smooth artwork is %s", async availability => {
  const s = setup({}, availability === "legacy" ? "valid" : availability), beat = vi.fn();
  const result = playCombatIllustration(s.rt, "attack_slash", { to: { x: 0, y: 0 }, duration: 410, impactAt: 95, onImpact: beat, illustrationMode: availability === "legacy" ? "legacy" : "improved" });
  expect(s.cells.map(node => node.textureKey)).toEqual(Array(2).fill("vfx:combat_attack_slash"));
  await runToEnd(s.rt, result); await result; expect(s.rt.clock).toBe(410); expect(beat).toHaveBeenCalledTimes(1);
});

it.each([false, true])("cancels library effects before/after impact (%s) without replay or leaked cells", async after => {
  const s = setup(), beat = vi.fn(); const result = playCombatIllustration(s.rt, "effect_heal", { to: { x: 0, y: 0 }, duration: 560, impactAt: 150, onImpact: beat });
  sample(s.rt, after ? 150 : 100); s.rt.dispose(); await expect(result).rejects.toThrow("animation aborted");
  expect(beat).toHaveBeenCalledTimes(after ? 1 : 0); expect(s.rt.created.every(node => node.destroyed)).toBe(true);
});

function awakening(settings = {}, availability: "valid" | "missing" | "malformed" = "valid", illustrationMode: "improved" | "legacy" = "improved") {
  const s = setup(settings, availability), portrait = stubObject({ texture: { key: "heroes:m12" }, displayWidth: 80, displayHeight: 120, x: 0, y: 0 });
  const view = stubObject({ getData: () => portrait, getIndex: () => 0, addAt: vi.fn(), remove: vi.fn() }) as unknown as Phaser.GameObjects.Container;
  const transform = vi.fn(); return { ...s, transform, run: () => playAwakening(s.rt, { heroId: "m12", view, transform, illustrationMode }) };
}

it.each([1, 2] as const)("awakening peak and exact-once refresh share the hero charge clock at speed %s", async speed => {
  const s = awakening({ speed }), result = s.run(), charge = HERO_AWAKENINGS.m12!.motion.charge;
  sample(s.rt, charge - 1); expect(s.transform).not.toHaveBeenCalled();
  sample(s.rt, charge); expect(s.transform).toHaveBeenCalledTimes(1); expect(s.cells[0].frame).toBe("awakening-3");
  expect(s.cells[0].textureKey).toBe("vfx:awakening_m12_motion_smooth");
  expect(s.targets[0]).toMatchObject({ originX: .5, originY: 80 / 96 });
  await runToEnd(s.rt, result); await result; expect(s.rt.clock).toBe(832 / speed); expect(s.transform).toHaveBeenCalledTimes(1); expect(s.rt.created.every(node => node.destroyed)).toBe(true);
});

it.each([1, 2] as const)("delivers awakening refresh once at its stretched charge at speed %s", async speed => {
  const s = awakening({ speed }), observed: number[] = []; s.transform.mockImplementation(() => observed.push(s.rt.clock));
  await runToEnd(s.rt, s.run()); expect(observed).toHaveLength(1);
  expect(observed[0]).toBeGreaterThanOrEqual(120 * 1.6 / speed); expect(observed[0]).toBeLessThanOrEqual((120 * 1.6 + 16) / speed);
});

it.each(["missing", "malformed", "legacy"] as const)("awakening falls back to the original timing and illustration when smooth is %s", async availability => {
  for (const reducedMotion of [false, true]) {
    const s = awakening({ reducedMotion }, availability === "legacy" ? "valid" : availability, availability === "legacy" ? "legacy" : "improved");
    await runToEnd(s.rt, s.run()); expect(s.rt.clock).toBe(reducedMotion ? 180 : 520); expect(s.transform).toHaveBeenCalledTimes(1);
    expect(s.cells[0].textureKey).toBe(reducedMotion ? "vfx:awakening_bronze_gate" : "vfx:awakening_m12_motion");
  }
});

it("reduced awakening shows only the smooth peak and preserves the 180 millisecond fade", async () => {
  const s = awakening({ reducedMotion: true }), result = s.run();
  expect(s.cells[0]).toMatchObject({ textureKey: "vfx:awakening_m12_motion_smooth", frame: "awakening-3" });
  const pose = [s.cells[0].x, s.cells[0].y, s.cells[0].scaleX]; sample(s.rt, 100);
  expect([s.cells[0].x, s.cells[0].y, s.cells[0].scaleX]).toEqual(pose);
  await runToEnd(s.rt, result); await result; expect(s.rt.clock).toBe(180); expect(s.transform).toHaveBeenCalledTimes(1);
});

it.each([false, true])("cancels awakening before/after its refresh (%s) and removes owned artwork", async after => {
  const s = awakening(), result = s.run(); sample(s.rt, after ? 120 : 100); s.rt.dispose(); await expect(result).rejects.toThrow("animation aborted");
  expect(s.transform).toHaveBeenCalledTimes(after ? 1 : 0); expect(s.rt.created.every(node => node.destroyed)).toBe(true);
});

it("registers both smooth families once and rejects malformed exports before adding frames", () => {
  const s = setup(); expect(registerCombatFrames(s.rt.scene, "vfx:combat_effect_heal_smooth")).toEqual({ width: 64, height: 96 });
  expect(registerAwakeningFrames(s.rt.scene, "vfx:awakening_m12_motion_smooth")).toEqual({ width: 64, height: 96 });
  registerCombatFrames(s.rt.scene, "vfx:combat_effect_heal_smooth"); expect(s.frames.get("vfx:combat_effect_heal_smooth")!.size).toBe(8);
  const invalid = setup({}, "malformed"); expect(registerCombatFrames(invalid.rt.scene, "vfx:combat_effect_heal_smooth")).toBeNull();
  expect(invalid.frames.get("vfx:combat_effect_heal_smooth")!.size).toBe(0);
});

it("selects smooth attacks and awakenings only for the public roster", () => {
  const vfx = Object.fromEntries(motions.map(motion => [motion.textureKey.slice(4), "/effect.png"]));
  const keys = combatTextureEntries({ vfx }, { heroIds: ["m12"] }).map(entry => entry.key);
  expect(keys).toContain("vfx:awakening_m12_motion_smooth"); expect(keys).not.toContain("vfx:awakening_f13_motion_smooth");
  expect(keys).toContain("vfx:combat_attack_slash_smooth"); expect(keys).not.toContain("vfx:combat_attack_spear_smooth");
  expect(keys).toContain("vfx:combat_effect_heal_smooth");
});

it("treats failed smooth files as optional only when their source successfully loaded", async () => {
  const source = "vfx:combat_effect_heal", smooth = `${source}_smooth`, files = [source, smooth].map(key => ({ key, url: "/effect.png" }));
  const scene = (failures: string[]) => { const available = new Set<string>(); return { available, failures: new Set(failures), textures: { exists: (key: string) => available.has(key) }, scene: { isActive: () => true } } as any; };
  expect(await prepareCombatAssets(scene([smooth]), { files })).toEqual({ loaded: 1, failed: [], optionalFailed: [smooth] });
  expect(await prepareCombatAssets(scene([source, smooth]), { files })).toEqual({ loaded: 0, failed: [source, smooth] });
});

it("keeps legacy mode through every support helper and the attack's impact tail", async () => {
  const point = { x: 0, y: 0 };
  const calls = [
    (rt: FakeRuntime) => impactAnimation(rt, point, 0xffffff, false, 1, "legacy"),
    (rt: FakeRuntime) => healBloom(rt, point, "legacy"), (rt: FakeRuntime) => armorWard(rt, point, false, "legacy"),
    (rt: FakeRuntime) => statusPop(rt, point, "ui:status_burn", 0xffffff, false, "legacy"),
    (rt: FakeRuntime) => deathBurn(rt, undefined, point, false, "legacy"), (rt: FakeRuntime) => bloodMoonSurge(rt, point, "legacy"),
    (rt: FakeRuntime) => castCard(rt, stubObject({ x: 0, y: 0, parentContainer: null }) as unknown as Phaser.GameObjects.Container, point, 0xffffff, point, "legacy"),
    (rt: FakeRuntime) => moonWheel(rt, point, point, ["new", "full"], 0, 1, 0xffffff, 550, "legacy"),
    (rt: FakeRuntime) => reflectStrike(rt, point, point, "legacy"),
    (rt: FakeRuntime) => playAttack({ kind: "slash", color: 0xffffff }, point, point, { runtime: rt, blocked: false, illustrationMode: "legacy" }),
  ];
  for (const call of calls) { const s = setup(); await runToEnd(s.rt, call(s.rt)); expect(s.cells.some(node => node.textureKey?.endsWith("_smooth"))).toBe(false); }
});

const point = { x: 0, y: 0 };
const supportCalls: [string, number, (rt: FakeRuntime) => Promise<void>][] = [
  ["hit", 270, rt => impactAnimation(rt, point, 0xffffff, false, 1)], ["guard", 270, rt => impactAnimation(rt, point, 0xffffff, true, 1)],
  ["heal", 560, rt => healBloom(rt, point)], ["armor", 520, rt => armorWard(rt, point)], ["armor_break", 450, rt => armorWard(rt, point, true)],
  ["status_apply", 420, rt => statusPop(rt, point, "ui:status_burn", 0xffffff)], ["status_remove", 420, rt => statusPop(rt, point, "ui:status_burn", 0xffffff, true)],
  ["death", 650, rt => deathBurn(rt, undefined, point)], ["blood_moon", 760, rt => bloodMoonSurge(rt, point)],
  ["cast", 570, rt => castCard(rt, stubObject({ x: 0, y: 0, parentContainer: null }) as unknown as Phaser.GameObjects.Container, point, 0xffffff, point)],
  ["moon_shift", 550, rt => moonWheel(rt, point, point, ["new", "full"], 0, 1)], ["reflect", 590, rt => reflectStrike(rt, point, point)],
];
it.each(supportCalls)("uses improved %s by default and keeps reduced timing", async (kind, duration, call) => {
  for (const reducedMotion of [false, true]) {
    const s = setup({ reducedMotion }); await runToEnd(s.rt, call(s.rt));
    expect(s.cells.some(node => node.textureKey === `vfx:combat_effect_${kind}_smooth`)).toBe(true);
    expect(s.rt.clock).toBe(Math.round(duration * (reducedMotion ? 1 : 1.6))); expect(s.rt.created.every(node => node.destroyed)).toBe(true);
  }
});
