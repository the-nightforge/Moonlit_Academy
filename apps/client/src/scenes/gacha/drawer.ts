import Phaser from "phaser";
import { featuredEntry, featuredRotationEnd } from "rules";
import { session } from "../../session";
import { roundedPanel } from "../../ui/rounded-panel";
import { COLORS, visibleWorld } from "../../ui/theme";
import type { GachaScene } from "../gacha-scene";
import { coverCrop, itemName, splashKey } from "./shared";

/** Left slide-in banner switcher. Owns its layer so the scene can ask via getters. */
export class GachaDrawer {
  layer: Phaser.GameObjects.Container | null = null;
  panel: Phaser.GameObjects.Container | null = null;
  private scrim: Phaser.GameObjects.Rectangle | null = null;

  constructor(private s: GachaScene) {}

  toggle() {
    if (this.s.busy || this.s.modal) return;
    if (this.layer) { this.close(); return; }
    const s = this.s;
    const view = visibleWorld(s), data = session.data;
    const layer = s.add.container(0, 0).setDepth(480);
    const panel = s.add.container(0, 0);
    const scrim = s.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x030914, 0.62);
    scrim.setInteractive().on("pointerup", () => this.close());
    this.scrim = scrim;
    layer.add([scrim, panel]);
    this.layer = layer;
    this.panel = panel;
    panel.add(roundedPanel(s, 202, 360, 404, 700, 0x0b182b, 0.98, 0x9a8965, 18));
    s.text(panel, 36, 34, "CHỌN DUYÊN TRIỆU HỒI", 14, "#bfad85");
    s.text(panel, 36, 58, "Duyên đổi theo tuần — ↑↓ chuyển nhanh", 12, "#8fa2bd");
    Object.values(data.banners).forEach((entry, index) => {
      const y = 134 + index * 134, selected = entry.id === s.bannerId;
      const card = roundedPanel(s, 202, y, 356, 116, selected ? 0x2c3a55 : 0x14243a, 0.95, selected ? 0xe8c784 : 0x53627d, 12);
      const thumb = s.image(card, splashKey(s, entry, featuredEntry(entry, Date.now())), -102, 0, 128, 88);
      if (thumb) coverCrop(thumb, 128, 88);
      s.text(card, -30, -28, entry.name, 17, selected ? "#f4dfb2" : COLORS.text);
      const entryFeatured = featuredEntry(entry, Date.now());
      const caption = entryFeatured ? `Tuần này: ${itemName(data, entryFeatured.heroId)}` : entry.kind === "hero" ? "Anh hùng thường trực" : entry.kind === "weapon" ? "Trang bị · binh khí" : "Trang bị · nguyệt bảo";
      s.text(card, -30, -2, caption, 12, "#aab9d0");
      const end = featuredRotationEnd(entry, Date.now());
      const status = selected ? "● ĐANG MỞ" : end !== undefined ? `Đổi sau ${Math.max(0, Math.floor((end - Date.now()) / 86_400_000))}d` : "";
      s.text(card, -30, 24, status, 12, selected ? "#e8c784" : "#8fa2bd");
      const hit = s.add.rectangle(0, 0, 356, 116, 0, 0);
      card.add(hit);
      if (!selected) {
        hit.setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => { s.bannerId = entry.id; this.close(); s.render(); });
        hit.on("pointerover", () => card.setAlpha(0.85));
        hit.on("pointerout", () => card.setAlpha(1));
      }
      panel.add(card);
    });
    panel.add(s.add.rectangle(202, 618, 356, 1, 0x53627d, 0.6));
    s.text(panel, 36, 630, "TÚI ĐỒ", 12, "#bfad85");
    // Kho Hero / Kho đồ are the existing inventory screens (spec P6d: reuse, no
    // duplicate inventory scene).
    const bag = (label: string, x: number, scene: string) => {
      const btn = roundedPanel(s, x, 664, 168, 36, 0x16253e, 0.98, 0xc8ad73, 10);
      const hit = s.add.rectangle(0, 0, 168, 36, 0, 0);
      btn.add(hit);
      hit.setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => s.scene.start(scene));
      hit.on("pointerover", () => btn.setAlpha(0.85));
      hit.on("pointerout", () => btn.setAlpha(1));
      s.text(btn, 0, 0, label, 13, COLORS.text).setOrigin(0.5);
      panel.add(btn);
    };
    bag("Kho Hero", 112, "heroes");
    bag("Kho đồ", 292, "armory");
    if (!s.reducedMotion) {
      panel.x = -440;
      panel.setAlpha(0.6);
      s.tweens.add({ targets: panel, x: 0, alpha: 1, duration: 260, ease: "Cubic.easeOut" });
    }
  }

  close(instant = false) {
    const layer = this.layer, panel = this.panel;
    if (!layer) return;
    this.layer = null;
    this.panel = null;
    // Stop the fading scrim from swallowing clicks during the close tween.
    this.scrim?.disableInteractive();
    this.scrim = null;
    if (instant || this.s.reducedMotion || !panel) { layer.destroy(); return; }
    this.s.tweens.add({ targets: panel, x: -440, alpha: 0, duration: 180, ease: "Cubic.easeIn" });
    this.s.tweens.add({ targets: layer, alpha: 0, delay: 140, duration: 80, onComplete: () => layer.destroy() });
  }
}
