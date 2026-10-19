import { expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { FakeRuntime, runToEnd } from "./helpers/fake-runtime";
import { playCombatIllustration, registerCombatFrames } from "../src/ui/combat-illustration";
import { createAnimationRuntime } from "../src/ui/animation-runtime";

function atlas(rt: FakeRuntime, width = 1536, height = 1024) {
  const frames = new Map<string, number[]>();
  const trims = new Map<string, number[]>();
  rt.scene.textures.get = (() => ({ getSourceImage: () => ({ width, height }), has: (n: string) => frames.has(n),
    add: (n: string, ...bounds: number[]) => { frames.set(n,bounds);return {setTrim:(...trim:number[])=>trims.set(n,trim)}; } })) as any;
  const image = rt.scene.add.image.bind(rt.scene.add), nodes: any[] = [];
  const texture = rt.scene.add.renderTexture.bind(rt.scene.add);
  let view: any;
  const instrument = (node: any) => {
    for (const [method, fields] of [["setPosition", ["x", "y"]], ["setRotation", ["rotation"]], ["setScale", ["scaleX", "scaleY"]], ["setFrame", ["frame"]], ["setAlpha", ["alpha"]]] as const) {
      node[method] = (...values: unknown[]) => { fields.forEach((field, i) => node[field] = values[i] ?? values[0]); return node; };
    }
    return node;
  };
  rt.scene.add.renderTexture=((...args:Parameters<typeof texture>)=>{view=instrument(texture(...args));return view;}) as any;
  rt.scene.add.image = ((...args: any[]) => {
    const node: any = image(...args as [number, number, string]); nodes.push(node);
    return instrument(node);
  }) as any;
  return { frames, trims, nodes, view: () => view };
}
function sample(rt: FakeRuntime, elapsed: number) {
  const config = rt.tweenConfigs[0]!; (config.targets as { elapsed: number }).elapsed = elapsed; (config.onUpdate as () => void)();
}
it("crossfades adjacent authored cells and lands one milestone on the same clock", async () => {
  const rt = new FakeRuntime(), { frames, nodes, view } = atlas(rt);
  const beat = vi.fn(), promise = playCombatIllustration(rt, "attack_slash", { from: { x: 0, y: 0 }, to: { x: 100, y: 20 }, duration: 500, impactAt: 200, onImpact: beat });
  expect(rt.tweenConfigs).toHaveLength(1);
  sample(rt, 100); expect(nodes[0].frame).toBe("combat-1"); expect(nodes[1].frame).toBe("combat-2");
  expect(view().compositedAlpha * view().alpha).toBeCloseTo(1);
  sample(rt, 199); expect(beat).not.toHaveBeenCalled();
  sample(rt, 200); expect(beat).toHaveBeenCalledTimes(1); expect(nodes[0].frame).toBe("combat-3");
  sample(rt, 300); expect(beat).toHaveBeenCalledTimes(1);
  expect(view().alpha).toBe(1);expect(view().scaleX).toBe(view().scaleY);expect(view().scaleX).toBeLessThanOrEqual(260/512);
  await runToEnd(rt, promise); await promise;
  expect(frames.size).toBe(8); expect(frames.get("combat-7")).toEqual([0,1152,512,384,512]);
  expect(nodes).toHaveLength(2); expect(nodes.every(node => node.destroyed)).toBe(true);
});
it("reduced motion fades the dedicated peak in place with no trajectory sampling", async () => {
  const rt = new FakeRuntime({ reducedMotion: true }), { nodes, view } = atlas(rt), motion = vi.fn(() => ({ x: 0, y: 0, rotation: 1, scale: 4 }));
  const beat = vi.fn(), promise = playCombatIllustration(rt, "effect_heal", { to: { x: 100, y: 50 }, duration: 300, impactAt: 80, onImpact: beat, motion });
  sample(rt, 80); expect(view()).toMatchObject({ x: 100, y: 50, rotation: 0 });expect(nodes[0].frame).toBe("combat-3"); expect(motion).not.toHaveBeenCalled();
  await runToEnd(rt, promise); await promise; expect(beat).toHaveBeenCalledTimes(1); expect(nodes.every(node => node.destroyed)).toBe(true);
});
it.each(["missing", "malformed"])("%s artwork keeps timing and one impact without fallback art", async condition => {
  const rt = new FakeRuntime(); atlas(rt, 128, 128); if (condition === "missing") rt.scene.textures.exists = () => false;
  const beat = vi.fn(), promise = playCombatIllustration(rt, "effect_heal", { to: { x: 100, y: 50 }, duration: 300, impactAt: 80, onImpact: beat });
  sample(rt, 79); expect(beat).not.toHaveBeenCalled(); sample(rt, 80); expect(beat).toHaveBeenCalledTimes(1);
  expect(rt.created).toEqual([]); await runToEnd(rt, promise); await promise; expect(rt.clock).toBe(300);
});
it("registers finite effect cells once and rejects portrait dimensions", () => {
  const rt = new FakeRuntime(), { frames } = atlas(rt); registerCombatFrames(rt.scene, "vfx:combat_attack_bow"); registerCombatFrames(rt.scene, "vfx:combat_attack_bow"); expect(frames.size).toBe(8);
  atlas(rt, 768, 1024); expect(registerCombatFrames(rt.scene, "heroes:m12")).toBeNull();
});
it.each([false, true])("abort after impact=%s destroys owned images without firing again", async after => {
  const rt = new FakeRuntime(), { nodes } = atlas(rt), beat = vi.fn();
  const promise = playCombatIllustration(rt, "attack_bow", { to: { x: 10, y: 10 }, duration: 500, impactAt: 200, onImpact: beat });
  sample(rt, after ? 200 : 150); rt.dispose(); await expect(promise).rejects.toThrow("animation aborted"); expect(beat).toHaveBeenCalledTimes(after ? 1 : 0); expect(nodes.every(node => node.destroyed)).toBe(true);
});
it("callback failures reject through the real runtime wrapper and dispose both images", async () => {
  const fake = new FakeRuntime(), { nodes } = atlas(fake); let tween!: Phaser.Types.Tweens.TweenBuilderConfig;
  const remove = vi.fn(); fake.scene.tweens.add = ((config: Phaser.Types.Tweens.TweenBuilderConfig) => { tween = config; return { setTimeScale: () => {}, remove }; }) as any;
  const rt = createAnimationRuntime(fake.scene, new AbortController().signal), failure = new Error("impact failed");
  const promise = playCombatIllustration(rt, "attack_bow", { to: { x: 0, y: 0 }, duration: 300, impactAt: 90, onImpact: () => { throw failure; } });
  (tween.targets as { elapsed: number }).elapsed = 90; (tween.onUpdate as () => void)();
  await expect(promise).rejects.toBe(failure); expect(remove).toHaveBeenCalled(); expect(nodes.every(node => node.destroyed)).toBe(true);
});

it.each([["bow",20,5,4,-20,0],["ribbon",24,4,6,10,32]] as const)("partitions the %s flow sheet with safe shifted bounds and uniform contain dimensions",(kind,count,cols,rows,offsetX,offsetY)=>{
  for(const [width,height] of [[1536,1024],[1024,1536]] as const) {
    const rt=new FakeRuntime(),{frames,trims}=atlas(rt,width,height);
    expect(registerCombatFrames(rt.scene,`vfx:combat_attack_${kind}_flow`)).toMatchObject({width:Math.ceil(width/cols),height:Math.ceil(height/rows)});
    expect(frames.size).toBe(count);
    for(let i=0;i<count;i++) {
      const x=Math.round(i%cols*width/cols)+offsetX, y=Math.round(Math.floor(i/cols)*height/rows)+offsetY;
      const left=Math.max(0,x),top=Math.max(0,y),right=Math.min(width,Math.round((i%cols+1)*width/cols)+offsetX),bottom=Math.min(height,Math.round((Math.floor(i/cols)+1)*height/rows)+offsetY);
      expect(frames.get(`combat-${i}`)).toEqual([0,left,top,right-left,bottom-top]);
      expect(trims.get(`combat-${i}`)).toEqual([Math.ceil(width/cols),Math.ceil(height/rows),left-x,top-y,right-left,bottom-top]);
    }
  }
});
it.each(["bow","ribbon"] as const)("plays %s coherent flow cells and secondary layers on one impact clock",async kind=>{
  const rt=new FakeRuntime(),{nodes}=atlas(rt),beat=vi.fn(),count=kind==="bow"?20:24,peak=kind==="bow"?9:10;
  const duration=kind==="bow"?640:830,impactAt=kind==="bow"?310:340;
  const promise=playCombatIllustration(rt,`attack_${kind}`,{from:{x:640,y:450},to:{x:640,y:160},duration,impactAt,onImpact:beat});
  expect(nodes.map(n=>n.textureKey)).toEqual([`vfx:combat_attack_${kind}_flow`,...kind==="bow"?["vfx:combat_layer_bow_air","vfx:combat_layer_bow_leaves"]:["vfx:combat_layer_ribbon_silk","vfx:combat_layer_ribbon_petals"]]);
  expect(nodes[0].frame).toBe("combat-0");
  sample(rt,100);const early=nodes.slice(1).map(n=>[n.x,n.y,n.rotation]);
  sample(rt,impactAt);expect(nodes[0].frame).toBe(`combat-${peak}`);expect(beat).toHaveBeenCalledTimes(1);
  expect(nodes.slice(1).map(n=>[n.x,n.y,n.rotation])).not.toEqual(early);
  sample(rt,duration);expect(nodes[0].frame).toBe(`combat-${count-1}`);expect(beat).toHaveBeenCalledTimes(1);
  expect(rt.tweenConfigs).toHaveLength(1);
  await runToEnd(rt,promise);await promise;expect(nodes.every(n=>n.destroyed)).toBe(true);
});
it("reduced flow motion fixes the source peak and excludes travelling secondary layers",async()=>{
  const rt=new FakeRuntime({reducedMotion:true}),{nodes}=atlas(rt),motion=vi.fn(()=>({x:0,y:0}));
  const promise=playCombatIllustration(rt,"attack_bow",{from:{x:0,y:0},to:{x:12,y:34},duration:640,impactAt:310,motion});
  sample(rt,120);expect(nodes).toHaveLength(1);expect(nodes[0]).toMatchObject({frame:"combat-9",x:12,y:34});expect(motion).not.toHaveBeenCalled();
  rt.dispose();await expect(promise).rejects.toThrow("animation aborted");expect(nodes.every(n=>n.destroyed)).toBe(true);
});
