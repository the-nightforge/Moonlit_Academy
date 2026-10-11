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
 * Same contain-fit as `addEquipmentArt`, baked into a rounded canvas texture
 * (letterboxed on a dark fill — no display mask, so WebGL and Canvas agree).
 */
export function addRoundedEquipmentArt(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, category: EquipmentCategory, id: string,
  x: number, y: number, width: number, height: number, radius: number,
) {
  const key = `${category}:${id}`, baked = `${key}@round-${width}x${height}r${radius}`;
  if (!scene.textures.exists(key)) return null;
  if (!scene.textures.exists(baked)) {
    const source = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const scale = Math.min(width / source.width, height / source.height);
    const canvas = scene.textures.createCanvas(baked, Math.ceil(width * RENDER_SCALE), Math.ceil(height * RENDER_SCALE));
    if (!canvas) return null;
    const ctx = canvas.getContext();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.clip();
    ctx.fillStyle = "#0a1424";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, (width - source.width * scale) / 2, (height - source.height * scale) / 2, source.width * scale, source.height * scale);
    canvas.refresh();
  }
  const image = scene.add.image(x, y, baked).setDisplaySize(width, height);
  parent.add(image);
  return image;
}
