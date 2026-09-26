import Phaser from "phaser";
import { COLORS, TEXT_BASE } from "./theme";

export function addText(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  content: string,
  size = 14,
  color: string = COLORS.text,
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, { ...TEXT_BASE, fontSize: `${size}px`, color });
  parent.add(text);
  return text;
}

export function addButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  label: string,
  onClick: () => void,
  enabled = true,
): void {
  const button = scene.add.rectangle(x, y, width, 34, enabled ? COLORS.button : 0x222633);
  button.setStrokeStyle(1, enabled ? COLORS.goldFill : COLORS.panelBorder);
  if (enabled) {
    button.setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setFillStyle(0x3a5090));
    button.on("pointerout", () => button.setFillStyle(COLORS.button));
    button.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
  }
  parent.add(button);
  addText(scene, parent, x, y, label, 13, enabled ? COLORS.text : COLORS.dimText).setOrigin(0.5);
}
