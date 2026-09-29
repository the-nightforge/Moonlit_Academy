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

/** "Nguyệt Ngọc N · Nguyệt Tinh M · Vinh Dự K" from the local profile copy. */
export function addCurrencyBar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  currencies: { moonJade: number; moonStar: number; honor?: number },
): Phaser.GameObjects.Text {
  const honor = currencies.honor === undefined ? "" : `   ❖ ${CURRENCY_LABELS.honor} ${currencies.honor}`;
  return addText(
    scene, parent, x, y,
    `◆ ${CURRENCY_LABELS.moonJade} ${currencies.moonJade}   ✦ ${CURRENCY_LABELS.moonStar} ${currencies.moonStar}${honor}`,
    14, COLORS.gold,
  ).setOrigin(0, 0.5);
}

/**
 * Scrolls a list by whole rows: the scene renders only rows `range()` returns,
 * so a list longer than the screen never spills over other controls. Wheel
 * over `area` and the ▲▼ bars step one row. Create once in `create()`; the
 * wheel listener is dropped with the scene.
 */
export class RowScroller {
  first = 0;
  private total = 0;
  private visible = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly area: { x: number; y: number; width: number; height: number },
    private readonly onScroll: () => void,
  ) {
    const bounds = new Phaser.Geom.Rectangle(area.x, area.y, area.width, area.height);
    const onWheel = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const point = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (dy !== 0 && bounds.contains(point.x, point.y)) this.scrollBy(Math.sign(dy));
    };
    scene.input.on("wheel", onWheel);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off("wheel", onWheel));
  }

  /** Clamps the scroll for `total` rows, `visible` at a time; returns [start, end). */
  range(total: number, visible: number): [number, number] {
    this.total = total;
    this.visible = visible;
    this.first = Phaser.Math.Clamp(this.first, 0, Math.max(0, total - visible));
    return [this.first, Math.min(total, this.first + visible)];
  }

  scrollBy(rows: number): void {
    const next = Phaser.Math.Clamp(this.first + rows, 0, Math.max(0, this.total - this.visible));
    if (next === this.first) return;
    this.first = next;
    this.onScroll();
  }

  /** ▲ bar just above / ▼ bar just below the area while rows are hidden that way. */
  addArrows(parent: Phaser.GameObjects.Container): void {
    const { x, y, width, height } = this.area;
    const bar = (barY: number, label: string, rows: number) => {
      const rect = this.scene.add.rectangle(x + width / 2, barY, width, 20, COLORS.button, 0.8);
      rect.setStrokeStyle(1, COLORS.panelBorder);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerover", () => rect.setFillStyle(0x3a5090, 1));
      rect.on("pointerout", () => rect.setFillStyle(COLORS.button, 0.8));
      rect.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.scrollBy(rows);
      });
      parent.add(rect);
      addText(this.scene, parent, x + width / 2, barY, label, 11, COLORS.text).setOrigin(0.5);
    };
    if (this.first > 0) bar(y - 12, "▲", -1);
    if (this.first + this.visible < this.total) bar(y + height + 12, "▼", 1);
  }
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
