import type Phaser from "phaser";
import type { AttackStyle } from "rules";
import type { AnimationRuntime } from "./animation-runtime";
import { framedImage } from "./contained-art";
import { TEXT_BASE } from "./theme";

type Motif = "gate" | "pages" | "moon" | "rays";

export function awakeningTheme(heroId: string, style: AttackStyle): { color: number; motif: Motif } {
  if (heroId === "m12") return { color: 0xe7b86a, motif: "gate" };
  if (heroId === "f13") return { color: 0xbceef0, motif: "pages" };
  if (style === "ink" || style === "talisman") return { color: 0xb8cafa, motif: "pages" };
  if (style === "moon" || style === "star") return { color: 0xdceaff, motif: "moon" };
  if (style === "herb" || style === "fan" || style === "music") return { color: 0xa0e6c9, motif: "rays" };
  return { color: style === "blood" || style === "fire" ? 0xf2a08d : 0xf0d397, motif: "rays" };
}

function drawMotif(graphics: Phaser.GameObjects.Graphics, motif: Motif, color: number): void {
  graphics.lineStyle(2, color, 0.8);
  if (motif === "gate") {
    for (const x of [-90, 18]) {
      graphics.strokeRoundedRect(x, -42, 72, 84, 4);
      graphics.strokeRect(x + 12, -28, 48, 56);
      graphics.lineBetween(x + 36, -28, x + 36, 28);
    }
  } else if (motif === "pages") {
    for (const x of [-72, -12, 48]) {
      graphics.strokeRoundedRect(x, -32, 42, 64, 3);
      graphics.lineBetween(x + 9, -12, x + 33, -12);
      graphics.strokeCircle(x + 21, 10, 8);
    }
  } else if (motif === "moon") {
    graphics.strokeCircle(0, 0, 38);
    graphics.beginPath().arc(10, -4, 28, -Math.PI / 2, Math.PI / 2).strokePath();
    graphics.lineBetween(-96, 0, -52, 0).lineBetween(52, 0, 96, 0);
  } else {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      graphics.lineBetween(Math.cos(a) * 18, Math.sin(a) * 18, Math.cos(a) * 44, Math.sin(a) * 44);
    }
    graphics.strokeCircle(0, 0, 30);
    graphics.lineBetween(-96, 0, -52, 0).lineBetween(52, 0, 96, 0);
  }
}

export interface AwakeningDetails {
  heroId: string;
  heroName: string;
  formName: string;
  style: AttackStyle;
}

/** A short character beat using the full existing artwork, with no rig/crop or rule changes. */
export async function playAwakening(rt: AnimationRuntime, details: AwakeningDetails): Promise<void> {
  rt.assertActive();
  const scene = rt.scene, theme = awakeningTheme(details.heroId, details.style);
  const veil = rt.track(scene.add.rectangle(640, 360, 1280, 720, 0x050d1c, 0.66).setDepth(150).setAlpha(0));
  const group = rt.track(scene.add.container(640, 360).setDepth(151).setAlpha(0));
  try {
    group.add(scene.add.rectangle(0, 0, 708, 414, 0x102237, 0.97).setRounded(18).setStrokeStyle(1, theme.color, 0.85));
    const key = scene.textures.exists(`heroes:${details.heroId}_up`) ? `heroes:${details.heroId}_up` : `heroes:${details.heroId}`;
    const portrait = framedImage(scene, group, key, -197, 0, 254, 382, 1);
    const x = portrait ? 76 : 0, width = portrait ? 294 : 600;
    const label = (y: number, text: string, size: number, color: string) => {
      const node = scene.add.text(x, y, text, { ...TEXT_BASE, fontSize: `${size}px`, color, align: "center", wordWrap: { width }, lineSpacing: 4 }).setOrigin(0.5);
      group.add(node);
    };
    label(-126, "THỨC TỈNH", 15, "#d2e0e9");
    label(-78, details.heroName, 23, "#fff5df");
    label(-12, details.formName, 29, `#${theme.color.toString(16).padStart(6, "0")}`);
    const motif = scene.add.graphics().setPosition(x, 100);
    drawMotif(motif, theme.motif, theme.color); group.add(motif);
    const entry = rt.reducedMotion ? 100 : 180;
    if (!rt.reducedMotion) group.x = 616;
    await Promise.all([
      rt.tween({ targets: veil, alpha: 1, duration: entry, ease: "Sine.easeOut" }),
      rt.tween({ targets: group, alpha: 1, ...(!rt.reducedMotion ? { x: 640 } : {}), duration: entry, ease: "Cubic.easeOut" }),
    ]);
    await rt.wait(rt.reducedMotion ? 240 : 320);
    await rt.tween({ targets: [group, veil], alpha: 0, duration: rt.reducedMotion ? 100 : 160, ease: "Sine.easeIn" });
  } finally {
    // Runtime disposal and normal completion both own only these temporary objects.
    group.destroy(true); veil.destroy();
  }
}
