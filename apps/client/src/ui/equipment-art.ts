import type Phaser from "phaser";
import manifest from "virtual:assets-manifest";
import { session } from "../session";
import { RENDER_SCALE } from "./theme";

export type EquipmentCategory = "weapons" | "relics";

/** Art is optional: only queue uploaded files whose stem is a known item ID. */
export function preloadEquipmentArt(scene: Phaser.Scene) {
  for (const category of ["weapons", "relics"] as const) {
    for (const id of Object.keys(session.data[category])) {
      const url = manifest[category]?.[id];
      const key = `${category}:${id}`;
      if (url && !scene.textures.exists(key)) scene.load.image(key, url);
    }
  }
}

/** Contain the entire uploaded image; never stretch or crop equipment. */
export function addEquipmentArt(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, category: EquipmentCategory, id: string,
  x: number, y: number, width: number, height: number,
) {
  const key = `${category}:${id}`;
  if (!scene.textures.exists(key)) return null;
  const image = scene.add.image(x, y, key);
  image.setScale(Math.min(width / image.width, height / image.height));
  parent.add(image);
  return image;
}

/**
 * The image scaled to the frame width and top-anchored inside a rounded
 * canvas texture — always edge-to-edge horizontally; tall art continues past
 * the frame and gets clipped, short art leaves the `band` side empty (no
 * display mask, so WebGL and Canvas agree). `band` adds a dark bottom
 * gradient for text drawn over the art.
 */
export function addRoundedEquipmentArt(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, category: EquipmentCategory, id: string,
  x: number, y: number, width: number, height: number, radius: number, band = 0,
) {
  const key = `${category}:${id}`, baked = `${key}@round-${width}x${height}r${radius}b${band}`;
  if (!scene.textures.exists(key)) return null;
  if (!scene.textures.exists(baked)) {
    const source = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const scale = width / source.width;
    const canvas = scene.textures.createCanvas(baked, Math.ceil(width * RENDER_SCALE), Math.ceil(height * RENDER_SCALE));
    if (!canvas) return null;
    const ctx = canvas.getContext();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.clip();
    ctx.drawImage(source, 0, 0, width, source.height * scale);
    if (band > 0) {
      const fade = ctx.createLinearGradient(0, height - band, 0, height);
      fade.addColorStop(0, "rgba(10, 20, 38, 0)");
      fade.addColorStop(1, "rgba(10, 20, 38, 0.85)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, height - band, width, band);
    }
    canvas.refresh();
  }
  const image = scene.add.image(x, y, baked).setDisplaySize(width, height);
  parent.add(image);
  return image;
}
