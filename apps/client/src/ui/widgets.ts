import Phaser from "phaser";
import { COLORS, CURRENCY_LABELS, TEXT_BASE } from "./theme";

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

/** "Nguyệt Ngọc N · Nguyệt Tinh M" from the local profile copy. */
export function addCurrencyBar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  currencies: { moonJade: number; moonStar: number },
): Phaser.GameObjects.Text {
  const text = `◆ ${CURRENCY_LABELS.moonJade} ${currencies.moonJade}   ✦ ${CURRENCY_LABELS.moonStar} ${currencies.moonStar}`;
  return addText(scene, parent, x, y, text, 14, COLORS.gold).setOrigin(0, 0.5);
}

/** A message that fades out by itself (gifts, achievements). */
export function showToast(scene: Phaser.Scene, lines: string[], y = 110): void {
  if (lines.length === 0) return;
  const text = scene.add
    .text(640, y, lines.join("\n"), { ...TEXT_BASE, fontSize: "15px", color: COLORS.gold, align: "center", lineSpacing: 4 })
    .setOrigin(0.5)
    .setDepth(1001);
  const box = scene.add
    .rectangle(640, y, text.width + 40, text.height + 20, 0x101830, 0.95)
    .setStrokeStyle(1, COLORS.goldFill)
    .setDepth(1000);
  scene.tweens.add({ targets: [text, box], alpha: 0, delay: 2800, duration: 600, onComplete: () => {
    text.destroy();
    box.destroy();
  } });
}
