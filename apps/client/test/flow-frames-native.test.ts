import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type Phaser from "phaser";
import { expect,it } from "vitest";
import { ATTACK_FLOWS, registerFlowFrames } from "../src/ui/illustrated-flow";

const require=createRequire(import.meta.url);
const Frame=require(join(dirname(require.resolve("phaser/package.json")),"src/textures/Frame"));
const TextureComponent=require(join(dirname(require.resolve("phaser/package.json")),"src/gameobjects/components/Texture"));
const Size=require(join(dirname(require.resolve("phaser/package.json")),"src/gameobjects/components/Size"));
const Origin=require(join(dirname(require.resolve("phaser/package.json")),"src/gameobjects/components/Origin"));
it.each(["bow","ribbon"] as const)("native Phaser %s frames keep shifted first/last cuts inside the source and one virtual size",style=>{
  for(const [width,height] of [[1536,1024],[1024,1536]] as const) {
    const frames=new Map<string,any>(),texture:any={source:[{width,height}],getSourceImage:()=>({width,height}),has:(name:string)=>frames.has(name),
      add(name:string,index:number,x:number,y:number,w:number,h:number) {const frame=new Frame(texture,name,index,x,y,w,h);frames.set(name,frame);return frame;}};
    const scene={textures:{exists:()=>true,get:()=>texture}} as unknown as Phaser.Scene;
    const grid=ATTACK_FLOWS[style],bounds=registerFlowFrames(scene,`vfx:combat_attack_${style}_flow`,"combat",grid)!;
    expect(frames.size).toBe(grid.count);
    const image:any={texture:{get:(name:string)=>frames.get(name)},_sizeComponent:true,_originComponent:true,renderFlags:15,originX:.5,originY:.5,
      setSizeToFrame:Size.setSizeToFrame,updateDisplayOrigin:Origin.updateDisplayOrigin};
    for(const [name,frame] of frames) {
      expect(frame.cutX, name).toBeGreaterThanOrEqual(0);expect(frame.cutY,name).toBeGreaterThanOrEqual(0);
      expect(frame.cutX+frame.cutWidth,name).toBeLessThanOrEqual(width);expect(frame.cutY+frame.cutHeight,name).toBeLessThanOrEqual(height);
      expect([frame.realWidth,frame.realHeight],name).toEqual([bounds.width,bounds.height]);
      expect(frame.x+frame.cutWidth,name).toBeLessThanOrEqual(frame.realWidth);expect(frame.y+frame.cutHeight,name).toBeLessThanOrEqual(frame.realHeight);
      TextureComponent.setFrame.call(image,name);
      expect([image.width,image.height],name).toEqual([bounds.width,bounds.height]);
      expect([image._displayOriginX,image._displayOriginY],name).toEqual([bounds.width/2,bounds.height/2]);
    }
    const first=frames.get("combat-0"),last=frames.get(`combat-${grid.count-1}`);
    if(style==="bow") {expect(first.cutX).toBe(0);expect(first.x).toBe(20);expect(last.cutX+last.cutWidth).toBe(width-20);}
    else {expect(first.cutX).toBe(10);expect(first.cutY).toBe(32);expect(last.cutX+last.cutWidth).toBe(width);expect(last.cutY+last.cutHeight).toBe(height);}
  }
});
