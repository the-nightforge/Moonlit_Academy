import type Phaser from "phaser";

/** Entire source, centered inside the padded image region. */
export function containedRect(sw:number, sh:number, w:number, h:number, padding=0) {
  const scale=Math.min(Math.max(0,w-padding*2)/sw,Math.max(0,h-padding*2)/sh);
  const width=sw*scale, height=sh*scale;
  return {x:(w-width)/2,y:(h-height)/2,width,height};
}

export function paintContained(
  ctx:CanvasRenderingContext2D, source:CanvasImageSource & {width:number;height:number},
  w:number, h:number, padding=0,
) {
  const r=containedRect(source.width,source.height,w,h,padding);
  ctx.drawImage(source,r.x,r.y,r.width,r.height);
}

/** A visible frame and an unmasked, undistorted source image. */
export function framedImage(
  scene:Phaser.Scene, parent:Phaser.GameObjects.Container, key:string,
  x:number, y:number, w:number, h:number, padding=4,
) {
  if(!scene.textures.exists(key))return null;
  parent.add(scene.add.rectangle(x,y,w,h,0x0c1628,.6).setStrokeStyle(1,0x526580));
  const image=scene.add.image(x,y,key);
  image.setScale(Math.min((w-padding*2)/image.width,(h-padding*2)/image.height));
  image.setData("imageFrame",{x,y,width:w,height:h});
  parent.add(image);
  return image;
}
