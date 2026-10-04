import type Phaser from "phaser";

/** Soft panel chrome; a transparent rectangle supplies measurable bounds. */
export function roundedPanel(
  scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  fill = 0x101830, alpha = 0.98, border = 0x66759d, radius = 12,
): Phaser.GameObjects.Container {
  const chrome = scene.add.graphics();
  chrome.fillStyle(fill, alpha).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  chrome.lineStyle(1, border, 0.8).strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  const bounds = scene.add.rectangle(0, 0, width, height, 0, 0);
  return scene.add.container(x, y, [bounds, chrome]).setSize(width, height);
}
