import type Phaser from "phaser";
import manifest from "virtual:assets-manifest";

export type ActionIcon = "add" | "edit" | "copy" | "close" | "more" | "back" | "reset" | "left" | "right" | "up" | "down" | "remove";

const ART: Record<ActionIcon, { key: string; rotation?: number }> = {
  add: { key: "action_new" }, edit: { key: "action_edit" }, copy: { key: "action_copy" },
  close: { key: "action_close" }, more: { key: "action_more" }, reset: { key: "action_reset" }, remove: { key: "action_remove" },
  back: { key: "nav_back" }, left: { key: "nav_back" }, right: { key: "nav_back", rotation: Math.PI },
  up: { key: "nav_back", rotation: Math.PI / 2 }, down: { key: "nav_back", rotation: -Math.PI / 2 },
};

/** Load raster controls on either entry path, including a direct editor entry. */
export function preloadActionIcons(scene: Phaser.Scene) {
  for (const key of new Set(Object.values(ART).map((art) => art.key))) {
    const url = manifest.ui?.[key];
    if (url && /\.(png|webp|jpe?g)$/i.test(url) && !scene.textures.exists(`ui:${key}`)) scene.load.image(`ui:${key}`, url);
  }
}

/** Use painted PNG/WebP art; the existing back arrow supplies all directions. */
export function actionIcon(scene: Phaser.Scene, icon: ActionIcon): Phaser.GameObjects.Image | null {
  const art = ART[icon], key = `ui:${art.key}`;
  if (!scene.textures.exists(key)) return null;
  const image = scene.add.image(0, 0, key);
  image.setScale(Math.min(28 / image.width, 28 / image.height)).setRotation(art.rotation ?? 0);
  return image;
}
