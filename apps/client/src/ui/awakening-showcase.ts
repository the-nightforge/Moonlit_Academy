import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";
import { HERO_AWAKENINGS } from "./awakening-profiles";
import { sampleAwakening } from "./awakening-motion";
import { awakeningSheet, registerAwakeningFrames, sampleAwakeningFrame } from "./awakening-flipbook";
import { createFrameBlend } from "./frame-blend";
import type { FrameBlend } from "./frame-blend";
import { ATTACK_FLOWS, createFrameSequence, F06_FLOW, flowFrame } from "./illustrated-flow";
import type { IllustrationMode } from "./illustrated-flow";
export { AWAKENING_EFFECTS, awakeningEffectsFor } from "./awakening-profiles";

export interface AwakeningDetails {
  heroId: string;
  view?: Phaser.GameObjects.Container;
  /** Applies the event and rebuilds the actual card once; old image references die here. */
  transform: () => void;
  illustrationMode?: IllustrationMode;
}

/** In-place illustrated transition. Owns temporary artwork only, never the unit's pose or HUD. */
export async function playAwakening(rt: AnimationRuntime, details: AwakeningDetails): Promise<void> {
  rt.assertActive();
  const scene = rt.scene, view = details.view;
  const profile = HERO_AWAKENINGS[details.heroId];
  const portrait = view?.getData("unitPortrait") as Phaser.GameObjects.Image | null | undefined;
  const key = portrait?.texture?.key;
  const width = portrait?.displayWidth, height = portrait?.displayHeight;
  if (!profile || !view || typeof key !== "string" || !width || !height || !Number.isFinite(width + height)
    || !scene.textures.exists(key) || !scene.textures.exists(`heroes:${details.heroId}_up`)) {
    details.transform(); return;
  }
  // Capture values, not an image the authoritative refresh is about to destroy.
  const old = { key, width, height, x: portrait!.x, y: portrait!.y };
  const { color, motion } = profile;
  // Inside the same unit hierarchy: follow its seat transform, behind all HUD.
  const effects = rt.track(scene.add.container(0, 0));
  view.addAt(effects, view.getIndex(portrait!) + 1);
  let blend: Phaser.GameObjects.Container | undefined;
  let frameBlend: FrameBlend | undefined;
  try {
    const sprite = (stem: string, targetHeight: number) => {
      const texture = `vfx:${stem}`;
      if (!scene.textures.exists(texture)) return null;
      const image = scene.add.image(old.x, old.y, texture).setAlpha(0);
      image.setScale(Math.min((width + 80) / image.width, targetHeight / image.height));
      effects.add(image); return image;
    };
    // Each illustrated cell changes the actual flame/cloth/petal shapes, not just the whole quad.
    const flowBounds=details.heroId==="f06" && details.illustrationMode!=="legacy" ? registerAwakeningFrames(scene,"vfx:awakening_f06_flow") : null;
    const sheetKey=flowBounds?"vfx:awakening_f06_flow":`vfx:${awakeningSheet(details.heroId)}`;
    const sheet=flowBounds??(!rt.reducedMotion?registerAwakeningFrames(scene,sheetKey):null);
    frameBlend=sheet?flowBounds?createFrameSequence(rt,sheetKey,"awakening"):createFrameBlend(rt,sheetKey,sheet.width,sheet.height,"awakening"):undefined;
    const motif=frameBlend?frameBlend.view.setPosition(old.x,old.y):sprite(profile.texture,height+36);
    if(sheet && motif) {
      motif.setScale(Math.min((width+80)/sheet.width,(height+36)/sheet.height));
      effects.add(motif);
    }
    const motifScale = motif?.scaleX ?? 1;
    const layers=flowBounds&&!rt.reducedMotion?ATTACK_FLOWS.ribbon.layers.flatMap(stem=>{
      const image=sprite(stem,height+44);return image?[{image,scale:image.scaleX}]:[];
    }):[];
    const clock={elapsed:0};
    const charge=rt.reducedMotion?60:motion.charge, blendDuration=rt.reducedMotion?100:motion.blend;
    let transformed=false;
    const swap=()=>{
      rt.assertActive();
      transformed=true;
      // The authoritative refresh destroys old children, so detach temporary art first.
      view.remove(effects);
      details.transform();
      const next=view.getData("unitPortrait") as Phaser.GameObjects.Image | null | undefined;
      if(next && typeof next.texture?.key==="string") {
        blend=rt.track(scene.add.container(old.x,old.y));
        const image=scene.add.image(0,0,old.key);
        image.setScale(Math.min(width/image.width,height/image.height));
        const frame=scene.add.rectangle(0,0,width+2,height+2,color,0).setStrokeStyle(1,color);
        blend.add([image,frame]);
        view.addAt(blend,view.getIndex(next)+1);
        view.addAt(effects,view.getIndex(next)+2);
      } else effects.setVisible(false);
    };
    const draw=()=>{
      // Native Phaser initializes tween data on its first tick. All milestones must
      // use this same clock, rather than scene timers that start a frame earlier.
      if(!transformed && clock.elapsed>=charge)swap();
      const pose=sampleAwakening(profile,clock.elapsed,rt.reducedMotion);
      if(frameBlend) {
        const coherent=rt.reducedMotion?F06_FLOW.peak:flowFrame(clock.elapsed,520,motion.charge,F06_FLOW.count,F06_FLOW.peak);
        const frame=flowBounds?{from:coherent,to:coherent,mix:0}:sampleAwakeningFrame(clock.elapsed/(motion.charge+motion.blend+motion.release));
        frameBlend.setFrames(frame.from,frame.to,frame.mix);
      }
      motif?.setAlpha(pose.alpha);
      if(!rt.reducedMotion) motif?.setPosition(old.x+pose.x*width/160,old.y-8+pose.y*height/240)
        .setAngle(pose.angle).setScale(motifScale*pose.scale);
      layers.forEach(({image,scale},index)=>{
        const delay=index*34,progress=Math.max(0,Math.min(1,(clock.elapsed-delay)/(520-delay))),sweep=progress*Math.PI*2;
        image.setPosition(old.x+Math.sin(sweep+(index?Math.PI:0))*(index?16:9)*width/160,
          old.y-8+(10-32*progress+Math.cos(sweep)*5)*height/240)
          .setAngle((index?-1:1)*(12+20*progress)).setScale(scale*(.92+.14*progress))
          .setAlpha(Math.max(0,Math.min(1,progress*5,(1-progress)*4))*(index?.65:.5));
      });
      blend?.setAlpha(pose.oldAlpha);
      if(blend && clock.elapsed>=charge+blendDuration){blend.destroy(true);blend=undefined;}
    };
    motif?.setPosition(old.x,old.y-8);
    draw();
    const total=rt.reducedMotion?180:motion.charge+motion.blend+motion.release;
    // A single linear clock drives the whole curve; phase changes never restart its velocity.
    await rt.tween({targets:clock,elapsed:total,duration:total,ease:"Linear",onUpdate:draw});
    rt.assertActive();
    clock.elapsed=total;draw();
  } finally {
    frameBlend?.destroy(); blend?.destroy(true); effects.destroy(true);
  }
}
