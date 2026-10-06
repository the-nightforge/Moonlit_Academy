import type Phaser from "phaser";
import manifest from "virtual:assets-manifest";
import { session } from "../session";

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
