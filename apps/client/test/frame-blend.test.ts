import { expect, it } from "vitest";
import { createFrameBlend } from "../src/ui/frame-blend";
import { FakeRuntime, stubObject } from "./helpers/fake-runtime";

it.each([1,.5])("keeps identical authored pixel alpha %s constant across every blend fraction",alpha=>{
  const rt=new FakeRuntime(),sources:any[]=[],visible:any[]=[];
  rt.scene.add.image=((..._args:unknown[])=>{
    const node=stubObject({alpha:1,blendMode:"NORMAL",onField:true});
    node.setFrame=(frame:string)=>{node.frame=frame;return node;};node.setAlpha=(a:number)=>{node.alpha=a;return node;};
    node.setBlendMode=(mode:string)=>{node.blendMode=mode;return node;};node.removeFromDisplayList=()=>{node.onField=false;return node;};sources.push(node);return node;
  }) as any;
  rt.scene.add.renderTexture=((..._args:unknown[])=>{
    const node=stubObject({blendMode:"NORMAL",pixel:[0,0,0,0]});
    node.setBlendMode=(mode:string)=>{node.blendMode=mode;return node;};
    node.clear=()=>{node.pixel=[0,0,0,0];return node;};
    node.draw=(cells:any[])=>{for(const cell of cells){expect(cell.onField).toBe(false);expect(cell.blendMode).toBe("ADD");const weight=cell.alpha as number;const pixel=node.pixel as number[];node.pixel=[pixel[0]!+.1*alpha*weight,pixel[1]!+.2*alpha*weight,pixel[2]!+.3*alpha*weight,pixel[3]!+alpha*weight];}return node;};
    node.render=()=>node;visible.push(node);return node;
  }) as any;
  const blend=createFrameBlend(rt,"vfx:combat_attack_ink",384,512,"combat");
  for(const mix of [0,.25,.5,.75,1]){blend.setFrames(2,3,mix);expect(visible[0].pixel).toEqual([.1*alpha,.2*alpha,.3*alpha,alpha]);expect(visible[0].blendMode).toBe("NORMAL");}
  blend.destroy();expect([...sources,...visible].every(node=>node.destroyed)).toBe(true);
});
it("falls back to a discrete full-alpha authored cell when no offscreen renderer exists",()=>{
  const rt=new FakeRuntime();(rt.scene.add as any).renderTexture=undefined;
  const blend=createFrameBlend(rt,"vfx:combat_attack_ink",384,512,"combat");
  const frame=blend.view.setFrame.bind(blend.view),visited:string[]=[];
  blend.view.setFrame=((key:string)=>{visited.push(key);return frame(key);}) as any;
  blend.setFrames(2,3,.49);blend.setFrames(2,3,.5);expect(visited).toEqual(["combat-2","combat-3"]);
  expect(rt.created).toHaveLength(1);blend.destroy();expect(rt.created.every(node=>node.destroyed)).toBe(true);
});
