import type Phaser from "phaser";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";
import { playAwakening } from "../src/ui/awakening-showcase";
import { HERO_AWAKENINGS } from "../src/ui/awakening-profiles";
import { createAnimationRuntime } from "../src/ui/animation-runtime";
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
    object.setPosition=vi.fn((px:number,py:number)=>{object.x=px;object.y=py;return object;});
    object.setScale=vi.fn((scale:number)=>{object.scaleX=scale;return object;});
    object.setAngle=vi.fn((angle:number)=>{object.angle=angle;return object;});
    object.setAlpha=vi.fn((alpha:number)=>{object.alpha=alpha;return object;});
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
      const config=s.rt.tweenConfigs[0]!, clock=config.targets as {elapsed:number};
      expect(s.rt.tweenConfigs).toHaveLength(1); // no tween restarts at beat boundaries
      const motif=s.images[0]!.object,frames=[];
      const positioned=(motif.setPosition as ReturnType<typeof vi.fn>).mock.calls.length;
      for(let elapsed=0;elapsed<=(reducedMotion?180:520);elapsed+=10) {
        clock.elapsed=elapsed;(config.onUpdate as ()=>void)();
        frames.push([motif.x,motif.y,motif.scaleX,motif.angle,motif.alpha]);
      }
      if(reducedMotion) expect((motif.setPosition as ReturnType<typeof vi.fn>).mock.calls.length).toBe(positioned);
      else timelines.push(JSON.stringify(frames));
      clock.elapsed=0;
      await runToEnd(s.rt,result); await result;
      expect(s.images.map(image=>image.key)).toEqual([`vfx:${profile.texture}`,`heroes:${id}`]);
      expect(s.rt.clock).toBe((reducedMotion?180:520)/2);
      expect(s.transform).toHaveBeenCalledTimes(1);
      expect(s.rt.created.every(o=>o.destroyed)).toBe(true);
      const configs=s.rt.tweenConfigs;
      if(reducedMotion) expect(configs.every(c=>c.x===undefined&&c.y===undefined&&c.scale===undefined&&c.angle===undefined)).toBe(true);
    }
  }
  expect(new Set(timelines).size).toBe(25);
});

it("keeps the two new heroes' own illustrated motifs", () => {
  expect(HERO_AWAKENINGS.m12!.texture).toBe("awakening_bronze_gate");
  expect(HERO_AWAKENINGS.f13!.texture).toBe("awakening_omen_pages");
});

it.each([false,true])("renders adjacent authored cells and cleans them on completion or abort (%s)",async abort=>{
  const s=setup(),frames=new Set<string>();
  s.rt.scene.textures.get=(()=>({getSourceImage:()=>({width:1536,height:1024}),has:(key:string)=>frames.has(key),add:(key:string)=>frames.add(key)})) as any;
  const result=s.run(),config=s.rt.tweenConfigs[0]!,clock=config.targets as {elapsed:number};
  const cells=s.images.slice(0,2).map(i=>i.object);
  for(const cell of cells)cell.setFrame=vi.fn(()=>cell);
  clock.elapsed=260;(config.onUpdate as ()=>void)();
  expect(cells[0]!.setFrame).toHaveBeenLastCalledWith("awakening-3");
  expect(cells[1]!.setFrame).toHaveBeenLastCalledWith("awakening-4");
  const target=s.rt.created.find(node=>node.frameBlendTarget===true)!;
  expect(target.compositedAlpha).toBeCloseTo(1);
  expect(cells.every(cell=>cell.blendMode==="ADD")).toBe(true);
  expect(frames.size).toBe(8);
  if(abort){s.rt.dispose();await expect(result).rejects.toThrow("animation aborted");}
  else {await runToEnd(s.rt,result);await result;expect(s.transform).toHaveBeenCalledTimes(1);}
  expect(cells.every(c=>c.destroyed)).toBe(true);
});

it("the continuous clock fades the live old portrait after the authoritative refresh", async () => {
  const s=setup(),result=s.run();
  const config=s.rt.tweenConfigs[0]!,clock=config.targets as {elapsed:number};
  clock.elapsed=120;(config.onUpdate as ()=>void)();
  expect(s.transform).toHaveBeenCalledTimes(1);
  const overlay=s.rt.created[1]!,setAlpha=vi.fn(); overlay.setAlpha=setAlpha;
  clock.elapsed=120+80;(config.onUpdate as ()=>void)();
  expect(setAlpha).toHaveBeenLastCalledWith(.5);
  clock.elapsed=120+160;(config.onUpdate as ()=>void)();
  expect(setAlpha).toHaveBeenLastCalledWith(0);
  await runToEnd(s.rt,result); await result;
  expect(overlay.destroyed).toBe(true);
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
  if (afterSwap) {
    const config=s.rt.tweenConfigs[0]!;
    (config.targets as {elapsed:number}).elapsed=120;(config.onUpdate as ()=>void)();
  }
  s.rt.dispose(); await expect(result).rejects.toThrow("animation aborted");
  expect(s.transform).toHaveBeenCalledTimes(afterSwap ? 1 : 0);
  expect(s.rt.pendingCount).toBe(0); expect(s.rt.created.every(o => o.destroyed)).toBe(true);
});

it.each([1,2] as const)("native Phaser keeps swap, fade and cleanup on one clock at speed %s",async speed=>{
  const require=createRequire(import.meta.url);
  const TweenManager=require(join(dirname(require.resolve("phaser/package.json")),"src/tweens/TweenManager"));
  const s=setup();
  (s.rt.scene as any).sys={events:new EventEmitter()};
  const manager=new TweenManager(s.rt.scene);s.rt.scene.tweens=manager;
  const add=vi.spyOn(manager,"add");
  const runtime=createAnimationRuntime(s.rt.scene,new AbortController().signal,{speed,reducedMotion:false,volume:0});
  const wait=vi.spyOn(runtime,"wait");
  let done=false;
  const promise=playAwakening(runtime,{heroId:"m12",view:s.view,transform:s.transform}).then(()=>{done=true;});
  const clock=(add.mock.calls[0]![0] as Phaser.Types.Tweens.TweenBuilderConfig).targets as {elapsed:number};
  let overlay:ReturnType<typeof stubObject>|undefined;
  for(let wall=0;!done&&wall<1000;wall+=1000/30){
    for(const tween of [...manager.tweens])tween.update(1000/30);
    if(clock.elapsed<120)expect(s.transform).not.toHaveBeenCalled();
    else expect(s.transform).toHaveBeenCalledTimes(1);
    if(s.rt.created.length>1&&!overlay){
      overlay=s.rt.created[1];
      const destroy=overlay!.destroy as ()=>void;
      overlay!.destroy=()=>{expect(clock.elapsed).toBeGreaterThanOrEqual(280);destroy();};
    }
    await Promise.resolve();await Promise.resolve();
  }
  expect(done).toBe(true);await promise;
  expect(wait).not.toHaveBeenCalled();expect(overlay!.destroyed).toBe(true);
  runtime.dispose();
});

it("native refresh failure rejects playback and cleans effects without escaping Phaser update",async()=>{
  const require=createRequire(import.meta.url);
  const TweenManager=require(join(dirname(require.resolve("phaser/package.json")),"src/tweens/TweenManager"));
  const s=setup();(s.rt.scene as any).sys={events:new EventEmitter()};
  const manager=new TweenManager(s.rt.scene);s.rt.scene.tweens=manager;
  const runtime=createAnimationRuntime(s.rt.scene,new AbortController().signal,{speed:1,reducedMotion:false,volume:0});
  s.transform.mockImplementation(()=>{throw new Error("refresh failed");});
  const promise=playAwakening(runtime,{heroId:"m12",view:s.view,transform:s.transform});
  const rejected=expect(promise).rejects.toThrow("refresh failed");
  for(let wall=0;wall<300;wall+=1000/30){
    expect(()=>{for(const tween of [...manager.tweens])tween.update(1000/30);}).not.toThrow();
    await Promise.resolve();await Promise.resolve();
  }
  await rejected;await runtime.drain();
  expect(s.transform).toHaveBeenCalledTimes(1);
  expect(s.rt.created.every(o=>o.destroyed)).toBe(true);
  runtime.dispose();
});

it.each([false,true])("f06 flow uses coherent cells, its own secondary motion, one refresh and owned cleanup (reduced=%s)",async reducedMotion=>{
  const s=setup({reducedMotion},"f06"),frames=new Set<string>();
  s.rt.scene.textures.get=(()=>({getSourceImage:()=>({width:1024,height:1536}),has:(name:string)=>frames.has(name),add:(name:string)=>frames.add(name)})) as any;
  const promise=s.run(),config=s.rt.tweenConfigs[0]!,clock=config.targets as {elapsed:number};
  expect(s.images[0]!.key).toBe("vfx:awakening_f06_flow");expect(frames.size).toBe(16);
  const motif=s.images[0]!.object;motif.setFrame=vi.fn(()=>motif);
  const peak=reducedMotion?60:130;
  clock.elapsed=peak;(config.onUpdate as ()=>void)();
  expect(motif.setFrame).toHaveBeenLastCalledWith("awakening-7");expect(s.transform).toHaveBeenCalledTimes(1);
  if(reducedMotion)expect(s.images.filter(i=>i.key.startsWith("vfx:"))).toHaveLength(1);
  else expect(s.images.map(i=>i.key)).toEqual(expect.arrayContaining(["vfx:combat_layer_ribbon_silk","vfx:combat_layer_ribbon_petals"]));
  clock.elapsed=reducedMotion?180:520;(config.onUpdate as ()=>void)();
  expect(motif.setFrame).toHaveBeenLastCalledWith(`awakening-${reducedMotion?7:15}`);
  if(!reducedMotion)expect(s.images.filter(i=>i.key.includes("combat_layer_")).map(i=>i.object.alpha)).toEqual([0,0]);
  await runToEnd(s.rt,promise);await promise;expect(s.transform).toHaveBeenCalledTimes(1);expect(s.rt.created.every(n=>n.destroyed)).toBe(true);expect(s.rt.shakes).toEqual([]);
});
it.each([false,true])("f06 layer cancellation cleans every child around the authoritative refresh (%s)",async after=>{
  const s=setup({},"f06"),frames=new Set<string>();
  s.rt.scene.textures.get=(()=>({getSourceImage:()=>({width:1024,height:1536}),has:(name:string)=>frames.has(name),add:(name:string)=>frames.add(name)})) as any;
  const promise=s.run(),config=s.rt.tweenConfigs[0]!,clock=config.targets as {elapsed:number};
  clock.elapsed=after?130:60;(config.onUpdate as ()=>void)();
  expect(s.images.filter(i=>i.key.includes("combat_layer_"))).toHaveLength(2);
  s.rt.dispose();await expect(promise).rejects.toThrow("animation aborted");
  expect(s.transform).toHaveBeenCalledTimes(after?1:0);expect(s.rt.created.every(n=>n.destroyed)).toBe(true);expect(s.images.every(i=>i.object.destroyed)).toBe(true);
});
