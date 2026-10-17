import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnimationRuntime } from "../src/ui/animation-runtime";
import { playCombatIllustration, registerCombatFrames } from "../src/ui/combat-illustration";
import { FakeRuntime } from "./helpers/fake-runtime";
import { buttonMotion, enterUi } from "../src/ui/ui-motion";

// Actual Phaser 4 components, stepped deterministically; only the canvas renderer is omitted.
const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve("phaser/package.json")), "src");
const Emitter = require(join(source, "events/EventEmitter"));
const AnimationManager = require(join(source, "animations/AnimationManager"));
const AnimationState = require(join(source, "animations/AnimationState"));
const TweenManager = require(join(source, "tweens/TweenManager"));

function fixture() {
  const frames = new Map<string, { name: string; texture: object }>();
  const textures = new Map<string, object>();
  const context = new Proxy({}, { get: (_target, key) => key === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  const texture = {
    getContext: () => context, refresh() {}, frameTotal: 9, getSourceImage: () => ({ width:1536, height:1024 }),
    add(name: string, _source: number, _x: number, _y: number, width: number, height: number) {
      expect(width).toBe(384); expect(height).toBe(512);
      frames.set(String(name), { name: String(name), texture });
    },
    has: (name: string) => frames.has(String(name)),
  };
  const textureManager = {
    exists: (key: string) => key.startsWith("vfx:combat_") || textures.has(key), get: () => texture,
    getFrame: (_key: string, frame: number | string) => frames.get(String(frame)),
    createCanvas: (key: string) => { textures.set(key, texture); return texture; },
  };
  const game = { events: new Emitter(), textures: textureManager };
  const manager = new AnimationManager(game);
  game.events.emit("boot");
  const scene = { anims: manager, textures: textureManager, sys: { events: new Emitter() } } as unknown as Phaser.Scene;
  const tweenManager = new TweenManager(scene);
  scene.tweens = tweenManager;
  const fake = new FakeRuntime();
  scene.add=fake.scene.add;scene.cameras=fake.scene.cameras;
  return { scene, manager, tweenManager, frames, created:fake.created };
}

describe("real Phaser animation clocks", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("registers eight complete authored cells once without creating global procedural animations", () => {
    const { scene, frames } = fixture();
    registerCombatFrames(scene,"vfx:combat_effect_hit");registerCombatFrames(scene,"vfx:combat_effect_hit");
    expect(frames.size).toBe(8);
  });
  it.each([1, 2] as const)("native tween visits authored cells, lands its milestone and cleans up at speed %s", async speed => {
    const { scene, tweenManager, created } = fixture();
    const visited=new Set<string>(),add=scene.add.image.bind(scene.add);
    scene.add.image=((...args:Parameters<typeof add>)=>{const image=add(...args);image.setFrame=((frame:string)=>{visited.add(frame);return image;}) as any;return image;}) as any;
    const runtime=createAnimationRuntime(scene,new AbortController().signal,{speed,reducedMotion:false,volume:0});
    let complete=false,elapsed=0,impactTime=-1,impacts=0;
    const promise=playCombatIllustration(runtime,"effect_hit",{to:{x:100,y:100},duration:300,impactAt:90,onImpact:()=>{impactTime=elapsed;impacts++;}}).then(()=>{complete=true;});
    for(;!complete&&elapsed<1000;elapsed+=5){for(const tween of [...tweenManager.tweens])tween.update(5);await Promise.resolve();}
    await promise;await runtime.drain();
    expect(impacts).toBe(1);expect(impactTime).toBeGreaterThanOrEqual(90/speed-5);expect(impactTime).toBeLessThanOrEqual(90/speed+10);
    expect(visited.size).toBe(8);expect(elapsed).toBeLessThanOrEqual(300/speed+20);
    expect(created.every(node=>node.destroyed)).toBe(true);runtime.dispose();
  });

  it("native tween scaling halves nested durations, yoyo holds and completion delays", async () => {
    const run = async (speed: 1 | 2) => {
      const { scene, tweenManager } = fixture();
      const runtime = createAnimationRuntime(scene, new AbortController().signal, { speed, reducedMotion: false, volume: 0 });
      const target = { x: 0 };
      let complete = false;
      const promise = runtime.tween({ targets: target, x: { value: 100, duration: 200, hold: 80, yoyo: true }, completeDelay: 100 }).then(() => { complete = true; });
      let elapsed = 0;
      for (; !complete && elapsed < 2000; elapsed += 5) {
        for (const tween of [...tweenManager.tweens]) tween.update(5);
        await Promise.resolve();
      }
      expect(complete).toBe(true);
      await promise;
      expect(target.x).toBe(0);
      runtime.dispose();
      return elapsed;
    };
    expect(Math.abs(await run(1) - await run(2) * 2)).toBeLessThanOrEqual(15);
  });

  it("canvas popup and button transitions complete and release their tweens on destroy", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null } });
    const { scene, tweenManager } = fixture();
    const object = Object.assign(new Emitter(), { alpha: 1, setAlpha(alpha: number) { this.alpha = alpha; return this; } });
    enterUi(scene, object);
    expect(object.alpha).toBe(0.6);
    for (let time = 0; time < 200; time += 5) for (const tween of [...tweenManager.tweens]) tween.update(5);
    expect(object.alpha).toBe(1);
    object.emit("destroy");
    expect(tweenManager.tweens).toHaveLength(0);
    buttonMotion(scene, object);
    object.emit("pointerdown", { button: 0 });
    expect(object.alpha).toBe(0.82);
    object.emit("pointerup");
    for (let time = 0; time < 160; time += 5) for (const tween of [...tweenManager.tweens]) tween.update(5);
    expect(object.alpha).toBe(1);
    object.emit("pointerdown", { button: 0 });
    object.emit("pointerout");
    object.emit("destroy");
    expect(tweenManager.tweens).toHaveLength(0);
  });

  it("reduced motion keeps canvas controls still and creates no UI tweens", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }), localStorage: { getItem: () => null } });
    const { scene, tweenManager } = fixture();
    const object = Object.assign(new Emitter(), { alpha: 1, setAlpha(alpha: number) { this.alpha = alpha; return this; } });
    enterUi(scene, object);
    buttonMotion(scene, object);
    object.emit("pointerdown", { button: 0 });
    object.emit("pointerup");
    expect(object.alpha).toBe(1);
    expect(tweenManager.tweens).toHaveLength(0);
  });
});
