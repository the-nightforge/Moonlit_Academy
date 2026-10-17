// @vitest-environment happy-dom
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterAll, expect, it, vi } from "vitest";
import { createFrameBlend } from "../src/ui/frame-blend";
import { FakeRuntime, stubObject } from "./helpers/fake-runtime";
const require=createRequire(import.meta.url),root=join(dirname(require.resolve("phaser/package.json")),"src");
// Skip browser boot feature probes; this exercises the native command/render methods directly.
vi.stubGlobal("importScripts",()=>{});afterAll(()=>vi.unstubAllGlobals());
const DynamicTexture=require(join(root,"textures/DynamicTexture"));
const RenderTexture=require(join(root,"gameobjects/rendertexture/RenderTexture"));
const ImageCanvasRenderer=require(join(root,"gameobjects/image/ImageCanvasRenderer"));
const BlendMode=require(join(root,"gameobjects/components/BlendMode"));
const BlendParameters=require(join(root,"renderer/webgl/parameters/WebGLBlendParametersFactory"));
const canvasModes=require(join(root,"renderer/canvas/utils/GetBlendModes"))();

it.each([1,.5])("native Phaser Canvas offscreen draw keeps RGBA alpha %s constant and source-overs ink once",alpha=>{
  const rt=new FakeRuntime(),sources:any[]=[];let pixel=[0,0,0,0],output:any;
  const texture=Object.create(DynamicTexture.prototype);
  const context={save(){},restore(){},setTransform(){},clearRect(){pixel=[0,0,0,0];}};
  const renderer={type:1,setContext(){},batchSprite(src:any){
    const a=alpha*src.alpha,rgba=[.1*a,.2*a,.3*a,a];
    const destination=canvasModes[src.blendMode]==="lighter"?1:1-a;
    pixel=rgba.map((value,i)=>value+pixel[i]!*destination);
  }};
  Object.assign(texture,{renderer,context,manager:{},camera:{preRender(){},addToRenderList(){}},commandBuffer:[],width:384,height:512});
  rt.scene.add.renderTexture=(()=>{
    const node:any=stubObject({texture});Object.defineProperty(node,"blendMode",BlendMode.blendMode);node.setBlendMode=BlendMode.setBlendMode;
    for(const method of ["clear","draw","render"])node[method]=RenderTexture.prototype[method];
    output=node;return node;
  }) as any;
  rt.scene.add.image=(()=>{
    const node:any=stubObject({alpha:1,onField:true});Object.defineProperty(node,"blendMode",BlendMode.blendMode);node.setBlendMode=BlendMode.setBlendMode;node.renderCanvas=ImageCanvasRenderer;
    node.removeFromDisplayList=()=>{node.onField=false;return node;};node.setAlpha=(a:number)=>{node.alpha=a;return node;};node.setFrame=(frame:string)=>{node.frame=frame;return node;};sources.push(node);return node;
  }) as any;
  const blend=createFrameBlend(rt,"vfx:combat_attack_ink",384,512,"combat");
  for(const mix of [0,.25,.5,.75,1]){
    blend.setFrames(1,2,mix);
    expect(pixel[3]).toBeCloseTo(alpha);pixel.slice(0,3).forEach((value,i)=>expect(value).toBeCloseTo([.1,.2,.3][i]!*alpha));
    expect(canvasModes[output.blendMode]).toBe("source-over");
    const background=[.03,.02,.01];const field=pixel.slice(0,3).map((value,i)=>value+background[i]!*(1-pixel[3]!));
    field.forEach((value,i)=>expect(value).toBeCloseTo([.1,.2,.3][i]!*alpha+background[i]!*(1-alpha)));
    expect(texture.commandBuffer).toEqual([]);expect(sources.every(node=>!node.onField)).toBe(true);
  }
  blend.destroy();expect([...sources,output].every(node=>node.destroyed)).toBe(true);
});

it("uses a cached true ONE/ONE WebGL blend slot despite Phaser 4's preceding-index return",()=>{
  const rt=new FakeRuntime(),calls:any[]=[],modes:any[]=new Array(28),sourceModes:any[]=[];
  (rt.scene as any).game={renderer:{gl:{ONE:1,FUNC_ADD:32774},blendModes:modes,addBlendMode(func:number[],equation:number){calls.push([func,equation]);const index=modes.push(BlendParameters.createCombined(this,true,undefined,equation,func[0],func[1]))-1;return index-1;}}};
  const image=rt.scene.add.image.bind(rt.scene.add);
  rt.scene.add.image=((...args:Parameters<typeof image>)=>{const node=image(...args);node.setBlendMode=((mode:any)=>{sourceModes.push(mode);return node;}) as any;return node;}) as any;
  const a=createFrameBlend(rt,"vfx:combat_attack_ink",384,512,"combat"),b=createFrameBlend(rt,"vfx:combat_attack_ink",384,512,"combat");
  expect(calls).toEqual([[[1,1],32774]]);expect(sourceModes).toEqual([28,28,28,28]);expect(modes[28].func).toEqual([1,1,1,1]);a.destroy();b.destroy();
});
