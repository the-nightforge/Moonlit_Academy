import type Phaser from "phaser";

export const AWAKENING_FRAME_COUNT=8;
export const awakeningSheet=(heroId:string)=>`awakening_${heroId}_motion`;

/** Frames partition an authored effect sheet only; hero portraits are never cut. */
export function registerAwakeningFrames(scene:Phaser.Scene,key:string):{width:number;height:number}|null {
  if(!scene.textures.exists(key)) return null;
  const texture=scene.textures.get(key),source=texture.getSourceImage() as {width:number;height:number};
  if(!source.width||!source.height||source.width%4!==0||source.height%2!==0||source.width*2!==source.height*3
    ||typeof texture.has!=="function"||typeof texture.add!=="function") return null;
  const width=source.width/4,height=source.height/2;
  for(let i=0;i<AWAKENING_FRAME_COUNT;i++) {
    const name=`awakening-${i}`;
    if(!texture.has(name)) texture.add(name,0,(i%4)*width,Math.floor(i/4)*height,width,height);
  }
  return {width,height};
}

export function sampleAwakeningFrame(progress:number) {
  const position=Math.max(0,Math.min(1,progress))*7,from=Math.floor(position);
  return {from,to:Math.min(7,from+1),mix:position-from};
}
