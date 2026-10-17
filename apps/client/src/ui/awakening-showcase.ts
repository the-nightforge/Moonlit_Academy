import type Phaser from "phaser";
import type { AttackStyle } from "rules";
import type { AnimationRuntime } from "./animation-runtime";

type Motif = "gate" | "pages" | "moon" | "rays";

export function awakeningTheme(heroId: string, style: AttackStyle): { color: number; motif: Motif } {
  if (heroId === "m12") return { color: 0xe7b86a, motif: "gate" };
  if (heroId === "f13") return { color: 0xbceef0, motif: "pages" };
  if (style === "ink" || style === "talisman") return { color: 0xb8cafa, motif: "pages" };
  if (style === "moon" || style === "star") return { color: 0xdceaff, motif: "moon" };
  if (style === "herb" || style === "fan" || style === "music") return { color: 0xa0e6c9, motif: "rays" };
  return { color: style === "blood" || style === "fire" ? 0xf2a08d : 0xf0d397, motif: "rays" };
}

export const AWAKENING_EFFECTS = ["awakening_bronze_gate", "awakening_omen_pages", "awakening_lunar_aura"] as const;

/** Only the public roster determines the illustrated effect preload. */
export function awakeningEffectsFor(heroId: string): string[] {
  return ["awakening_lunar_aura", ...(heroId === "m12" ? ["awakening_bronze_gate"] : heroId === "f13" ? ["awakening_omen_pages"] : [])];
}

export interface AwakeningDetails {
  heroId: string;
  style: AttackStyle;
  view?: Phaser.GameObjects.Container;
  /** Applies the event and rebuilds the actual card once; old image references die here. */
  transform: () => void;
}

/** In-place illustrated transition. Owns temporary artwork only, never the unit's pose or HUD. */
export async function playAwakening(rt: AnimationRuntime, details: AwakeningDetails): Promise<void> {
  rt.assertActive();
  const scene = rt.scene, view = details.view;
  const portrait = view?.getData("unitPortrait") as Phaser.GameObjects.Image | null | undefined;
  const key = portrait?.texture?.key;
  const width = portrait?.displayWidth, height = portrait?.displayHeight;
  if (!view || typeof key !== "string" || !width || !height || !Number.isFinite(width + height)
    || !scene.textures.exists(key) || !scene.textures.exists(`heroes:${details.heroId}_up`)) {
    details.transform(); return;
  }
  // Capture values, not an image the authoritative refresh is about to destroy.
  const old = { key, width, height, x: portrait!.x, y: portrait!.y };
  const { color } = awakeningTheme(details.heroId, details.style);
  const effects = rt.track(scene.add.container(view.x, view.y).setDepth(view.depth + 1)
    .setScale(view.scaleX, view.scaleY).setAngle(view.angle));
  view.parentContainer?.add(effects);
  let blend: Phaser.GameObjects.Container | undefined;
  try {
    const sprite = (stem: string, targetHeight: number) => {
      const texture = `vfx:${stem}`;
      if (!scene.textures.exists(texture)) return null;
      const image = scene.add.image(old.x, old.y, texture).setAlpha(0);
      image.setScale(Math.min((width + 80) / image.width, targetHeight / image.height));
      effects.add(image); return image;
    };
    const aura = sprite("awakening_lunar_aura", height + 52);
    aura?.setTint(color).setBlendMode("ADD");
    const motifStem = awakeningEffectsFor(details.heroId).find(stem => stem !== "awakening_lunar_aura");
    const motif = !rt.reducedMotion && motifStem ? sprite(motifStem, height + 36) : null;
    motif?.setY(old.y - 8);
    const auraScale = aura?.scaleX ?? 1, motifScale = motif?.scaleX ?? 1;
    if (!rt.reducedMotion) { aura?.setScale(auraScale * .94); motif?.setScale(motifScale * .96); }
    const phase = (duration: number, configs: Phaser.Types.Tweens.TweenBuilderConfig[]) =>
      configs.length ? Promise.all(configs.map(config => rt.tween({ ...config, duration }))) : rt.wait(duration);
    await phase(rt.reducedMotion ? 60 : 120, [
      ...(aura ? [{ targets: aura, alpha: rt.reducedMotion ? .16 : .4, ease: "Sine.easeIn" }] : []),
      ...(motif ? [{ targets: motif, alpha: .95, scale: motifScale, ease: "Sine.easeOut" }] : []),
    ]);
    rt.assertActive();
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
      await rt.tween({ targets: blend, alpha: 0, duration: rt.reducedMotion ? 100 : 160, ease: "Sine.easeInOut" });
      blend.destroy(true); blend = undefined;
    } else await rt.wait(rt.reducedMotion ? 100 : 160);
    rt.assertActive();
    if (!rt.reducedMotion) aura?.setAlpha(.7);
    await phase(rt.reducedMotion ? 20 : 240, [
      ...(aura ? [{ targets: aura, alpha: 0, ...(!rt.reducedMotion ? { scale: auraScale * 1.13 } : {}), ease: "Cubic.easeOut" }] : []),
      ...(motif ? [{ targets: motif, alpha: 0, scale: motifScale * 1.04, y: old.y - 13, ease: "Cubic.easeOut" }] : []),
    ]);
  } finally {
    blend?.destroy(true); effects.destroy(true);
  }
}
