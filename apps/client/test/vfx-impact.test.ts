import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { AnimationAbortedError } from "../src/ui/animation-runtime";
import { ATTACK_MOTION, playAttack, healBloom, armorWard, statusPop, deathBurn, castCard, moonWheel, bloodMoonSurge, reflectStrike } from "../src/ui/vfx";
import { finishImpactReaction } from "../src/ui/impact-reaction";
import type { AttackKind } from "../src/ui/attack-style";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";

const from = { x: 640, y: 450 }, to = { x: 640, y: 160 };
const kinds: AttackKind[] = ["slash","spear","darts","bow","herb","fan","ink","music","ribbon","fire","star","moon","talisman","blood","spell"];
function authored(rt: FakeRuntime) {
  const keys: string[] = [];
  const add = rt.scene.add.image.bind(rt.scene.add);
  const texture = rt.scene.add.renderTexture.bind(rt.scene.add);
  const instrument = (image: Phaser.GameObjects.Image | Phaser.GameObjects.RenderTexture) => {
    image.setPosition=((x:number,y:number)=>{image.x=x;image.y=y;return image;}) as any;
    image.setRotation=((r:number)=>{image.rotation=r;return image;}) as any;
    image.setScale=((s:number)=>{image.scaleX=s;image.scaleY=s;return image;}) as any;
    return image;
  };
  rt.scene.add.renderTexture=((...args:Parameters<typeof texture>)=>instrument(texture(...args))) as any;
  rt.scene.add.image = ((x: number, y: number, key: string, frame?: string) => {
    keys.push(key);const image = add(x,y,key,frame);
    return instrument(image);
  }) as any;
  return keys;
}
function sample(rt: FakeRuntime, elapsed: number, index=0) {
  const config=rt.tweenConfigs[index]!;(config.targets as {elapsed:number}).elapsed=elapsed;(config.onUpdate as ()=>void)();
}
describe("authored combat attacks", () => {
  it.each(["bow", "ribbon"] as const)("%s gives the layered artwork 60 percent more time with synchronized impact at either speed", async kind => {
    for (const speed of [1, 2] as const) {
      const rt = new FakeRuntime({ speed }); authored(rt);
      const impactTimes: number[] = [];
      const attack = playAttack({ kind, color: 0xffffff }, from, to, {
        runtime: rt, blocked: true, onImpact: () => impactTimes.push(rt.clock),
      });
      await runToEnd(rt, attack); await attack;
      expect(rt.clock).toBe(Math.round(ATTACK_MOTION[kind].duration * 1.6 / speed));
      expect(impactTimes).toHaveLength(1);
      const expectedImpact = ATTACK_MOTION[kind].impactAt * 1.6 / speed;
      expect(impactTimes[0]).toBeGreaterThanOrEqual(expectedImpact);
      expect(impactTimes[0]).toBeLessThanOrEqual(expectedImpact + 16 / speed);
      expect(rt.created.every(node => node.destroyed)).toBe(true);
    }
  });
  it.each(kinds)("%s has a dedicated illustration, one exact impact, a tail and complete cleanup", async kind => {
    const rt=new FakeRuntime(),keys=authored(rt),impact=vi.fn();
    const attack=playAttack({kind,color:0xff4466},from,to,{runtime:rt,blocked:false,onImpact:impact});
    const profile=ATTACK_MOTION[kind];
    sample(rt,profile.impactAt-1);expect(impact).not.toHaveBeenCalled();
    sample(rt,profile.impactAt);expect(impact).toHaveBeenCalledTimes(1);
    sample(rt,profile.duration-1);expect(impact).toHaveBeenCalledTimes(1);
    expect(keys).toContain(`vfx:combat_attack_${kind}${kind==="bow"||kind==="ribbon"?"_flow":""}`);expect(keys).toContain("vfx:combat_effect_hit");
    expect(profile.duration).toBeGreaterThan(profile.impactAt+120);
    await runToEnd(rt,attack);await attack;await rt.drain();expect(rt.created.every(node=>node.destroyed)).toBe(true);
  });
  it("all fifteen styles have distinct timing/movement profiles",()=>{
    expect(new Set(Object.values(ATTACK_MOTION).map(p=>JSON.stringify(p))).size).toBe(15);
  });
  it.each([to,{x:640,y:650},{x:980,y:200}])("orients right-authored projectiles towards %j without stretching",async target=>{
    const rt=new FakeRuntime();authored(rt);
    const attack=playAttack({kind:"bow",color:0xffffff},from,target,{runtime:rt,blocked:true});
    sample(rt,ATTACK_MOTION.bow.impactAt);
    expect(rt.created[0]!.rotation).toBeCloseTo(Math.atan2(target.y-from.y,target.x-from.x));
    expect(rt.created[0]!.scaleX).toBe(rt.created[0]!.scaleY);
    await runToEnd(rt,attack);await attack;
  });
  it.each(["bow","ribbon"] as const)("legacy %s remains available and missing flow art falls back to eight blended cells",async kind=>{
    for(const missing of [false,true]) {
      const rt=new FakeRuntime(),keys=authored(rt),impact=vi.fn();
      if(missing)rt.scene.textures.exists=key=>!key.endsWith("_flow");
      const promise=playAttack({kind,color:0xffffff},from,to,{runtime:rt,blocked:true,onImpact:impact,illustrationMode:missing?"improved":"legacy"});
      expect(keys).toContain(`vfx:combat_attack_${kind}`);expect(keys).not.toContain(`vfx:combat_attack_${kind}_flow`);
      await runToEnd(rt,promise);await promise;await rt.drain();expect(impact).toHaveBeenCalledTimes(1);expect(rt.created.every(n=>n.destroyed)).toBe(true);
      expect(rt.clock).toBe(ATTACK_MOTION[kind].duration);
    }
  });
  it.each(["bow","ribbon"] as const)("%s layer cancellation restores the unit before and after its single impact",async kind=>{
    for(const after of [false,true]) {
      const rt=new FakeRuntime(),keys=authored(rt),view=stubObject({x:640,y:450}) as unknown as Phaser.GameObjects.Container,impact=vi.fn();
      const promise=playAttack({kind,color:0xffffff},from,to,{runtime:rt,blocked:false,onImpact:impact,attackerView:view});
      sample(rt,after?ATTACK_MOTION[kind].impactAt:45);expect(keys.filter(k=>k.includes("combat_layer_"))).toHaveLength(2);
      rt.dispose();await expect(promise).rejects.toBeInstanceOf(AnimationAbortedError);
      expect(impact).toHaveBeenCalledTimes(after?1:0);expect(view).toMatchObject({x:640,y:450});expect(rt.created.every(n=>n.destroyed)).toBe(true);expect(rt.pendingCount).toBe(0);
    }
  });
  it.each(["spear", "bow", "ribbon"] as const)("reduced motion %s stays at the target with the peak artwork and one impact",async kind=>{
    const rt=new FakeRuntime({reducedMotion:true});authored(rt);const view=stubObject({x:640,y:450}) as unknown as Phaser.GameObjects.Container;
    const impact=vi.fn(),attack=playAttack({kind,color:0xffffff},from,to,{runtime:rt,blocked:true,attackerView:view,onImpact:impact});
    sample(rt,ATTACK_MOTION[kind].impactAt);
    expect(view.x).toBe(640);expect(view.y).toBe(450);expect(rt.created[0]).toMatchObject({x:to.x,y:to.y});
    expect(rt.shakes).toEqual([]);await runToEnd(rt,attack);await attack;expect(impact).toHaveBeenCalledTimes(1);
    expect(rt.clock).toBe(ATTACK_MOTION[kind].duration);
  });
  it.each([false,true])("abort after impact=%s restores ownership without repeating gameplay",async after=>{
    const rt=new FakeRuntime();authored(rt);const view=stubObject({x:640,y:450}) as unknown as Phaser.GameObjects.Container;
    const impact=vi.fn(),attack=playAttack({kind:"slash",color:0xffffff},from,to,{runtime:rt,blocked:false,attackerView:view,onImpact:impact});
    sample(rt,after?ATTACK_MOTION.slash.impactAt:40);rt.dispose();await expect(attack).rejects.toBeInstanceOf(AnimationAbortedError);
    expect(impact).toHaveBeenCalledTimes(after?1:0);expect(view.x).toBe(640);expect(view.y).toBe(450);
  });
  it("a relinquished attack tail cannot restore over a death pose",async()=>{
    const rt=new FakeRuntime();authored(rt);const view=stubObject({x:640,y:450}) as unknown as Phaser.GameObjects.Container;
    const attack=playAttack({kind:"slash",color:0xffffff},from,to,{runtime:rt,blocked:false,attackerView:view});
    sample(rt,ATTACK_MOTION.slash.impactAt);finishImpactReaction(view);view.y=420;view.alpha=.4;
    sample(rt,ATTACK_MOTION.slash.duration-1);await runToEnd(rt,attack);await attack;expect(view.y).toBe(420);expect(view.alpha).toBe(.4);
  });
});

describe("production support illustrations",()=>{
  it("uses authored heal, armor, broken armor, statuses, death, cast, moon, blood moon and reflect",async()=>{
    const rt=new FakeRuntime();const keys=authored(rt),view=stubObject({x:640,y:450,parentContainer:undefined}) as unknown as Phaser.GameObjects.Container;
    const jobs=[healBloom(rt,to),armorWard(rt,to),armorWard(rt,to,true),statusPop(rt,to,"ui:status_burn",0xffffff),statusPop(rt,to,"ui:status_burn",0xffffff,true),deathBurn(rt,view,to),castCard(rt,view,from,0xffffff,to),moonWheel(rt,from,to,["new","full"],0,1),bloodMoonSurge(rt,to),reflectStrike(rt,from,to)];
    for(const job of jobs){await runToEnd(rt,job);await job;}await rt.drain();
    for(const kind of ["heal","armor","armor_break","status_apply","status_remove","death","cast","moon_shift","blood_moon","reflect"])expect(keys).toContain(`vfx:combat_effect_${kind}`);
    expect(rt.created.every(node=>node.destroyed)).toBe(true);
  });
});
