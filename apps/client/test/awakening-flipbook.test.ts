import type Phaser from "phaser";
import { expect, it, vi } from "vitest";
import { registerAwakeningFrames, sampleAwakeningFrame } from "../src/ui/awakening-flipbook";

it("registers eight full illustrated cells once, without slicing hero portraits", () => {
  const frames=new Set<string>();
  const add=vi.fn((name:string)=>{frames.add(name);});
  const texture={has:(name:string)=>frames.has(name),add,getSourceImage:()=>({width:1536,height:1024})};
  const scene={textures:{exists:()=>true,get:()=>texture}} as unknown as Phaser.Scene;
  expect(registerAwakeningFrames(scene,"vfx:awakening_f08_motion")).toEqual({width:384,height:512});
  registerAwakeningFrames(scene,"vfx:awakening_f08_motion");
  expect(add).toHaveBeenCalledTimes(8);
  expect(add).toHaveBeenNthCalledWith(1,"awakening-0",0,0,0,384,512);
  expect(add).toHaveBeenNthCalledWith(8,"awakening-7",0,1152,512,384,512);
});

it("crossfades consecutive animation cells without frame popping or out-of-range frames", () => {
  expect(sampleAwakeningFrame(0)).toEqual({from:0,to:1,mix:0});
  expect(sampleAwakeningFrame(1)).toEqual({from:7,to:7,mix:0});
  for(let n=0;n<7;n++) {
    const a=sampleAwakeningFrame((n+.5)/7);
    expect(a.from).toBe(n);expect(a.to).toBe(n+1);expect(a.mix).toBeCloseTo(.5);
  }
});

it("rejects missing or malformed sheets so the dedicated static illustration remains a safe fallback", () => {
  const missing={textures:{exists:()=>false}} as unknown as Phaser.Scene;
  expect(registerAwakeningFrames(missing,"missing")).toBeNull();
  const invalid={textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:1001,height:1000}),has:()=>false,add:vi.fn()})}} as unknown as Phaser.Scene;
  expect(registerAwakeningFrames(invalid,"bad")).toBeNull();
});
