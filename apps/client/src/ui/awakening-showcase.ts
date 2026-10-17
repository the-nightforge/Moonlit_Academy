import type Phaser from "phaser";
import type { AnimationRuntime } from "./animation-runtime";
import { HERO_AWAKENINGS, type AwakeningPose } from "./awakening-profiles";
export { AWAKENING_EFFECTS, awakeningEffectsFor } from "./awakening-profiles";

export interface AwakeningDetails {
  heroId: string;
  view?: Phaser.GameObjects.Container;
  /** Applies the event and rebuilds the actual card once; old image references die here. */
  transform: () => void;
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
  try {
    const sprite = (stem: string, targetHeight: number) => {
      const texture = `vfx:${stem}`;
      if (!scene.textures.exists(texture)) return null;
      const image = scene.add.image(old.x, old.y, texture).setAlpha(0);
      image.setScale(Math.min((width + 80) / image.width, targetHeight / image.height));
      effects.add(image); return image;
    };
    // Every hero uses their own authored illustration in its original colors.
    const motif = sprite(profile.texture, height + 36);
    const motifScale = motif?.scaleX ?? 1;
    const pose = (p: AwakeningPose) => ({
      x: old.x + (p.x ?? 0) * width / 160,
      y: old.y - 8 + (p.y ?? 0) * height / 240,
      angle: p.angle ?? 0, scale: motifScale * (p.scale ?? 1),
    });
    const start = pose(rt.reducedMotion ? {} : motion.from);
    motif?.setPosition(start.x, start.y).setAngle(start.angle).setScale(start.scale);
    const phase = (duration: number, configs: Phaser.Types.Tweens.TweenBuilderConfig[]) =>
      configs.length ? Promise.all(configs.map(config => rt.tween({ ...config, duration }))) : rt.wait(duration);
    await phase(rt.reducedMotion ? 60 : motion.charge, [
      ...(motif ? [{ targets: motif, alpha: rt.reducedMotion ? .16 : .95,
        ...(!rt.reducedMotion ? pose({}) : {}), ease: motion.ease }] : []),
    ]);
    rt.assertActive();
    // refreshUnit destroys the old children; detach our temporary art first.
    view.remove(effects);
    details.transform();
    const next = view.getData("unitPortrait") as Phaser.GameObjects.Image | null | undefined;
    if (next && typeof next.texture?.key === "string") {
      // Above the new art, below the existing name, health and status badges.
      blend = rt.track(scene.add.container(old.x, old.y));
      const image = scene.add.image(0, 0, old.key);
      image.setScale(Math.min(width / image.width, height / image.height));
      const frame = scene.add.rectangle(0, 0, width + 2, height + 2, color, 0).setStrokeStyle(1, color);
      blend.add([image, frame]);
      view.addAt(blend, view.getIndex(next) + 1);
      view.addAt(effects, view.getIndex(next) + 2);
    } else effects.setVisible(false);
    await phase(rt.reducedMotion ? 100 : motion.blend, [
      ...(blend ? [{ targets: blend, alpha: 0, ease: "Sine.easeInOut" }] : []),
      ...(motif && !rt.reducedMotion ? [{ targets: motif, ...pose(motion.peak), ease: motion.ease }] : []),
    ]);
    blend?.destroy(true); blend = undefined;
    rt.assertActive();
    await phase(rt.reducedMotion ? 20 : motion.release, [
      ...(motif ? [{ targets: motif, alpha: 0, ...(!rt.reducedMotion ? pose(motion.out) : {}), ease: motion.ease }] : []),
    ]);
  } finally {
    blend?.destroy(true); effects.destroy(true);
  }
}
