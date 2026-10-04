import Phaser from "phaser";
import type { CardDef, GameData } from "rules";
import { COLORS, TEXT_BASE, visibleWorld } from "./theme";
import { PREVIEW_BODY_FONT } from "./combat-card-view";
import { roundedPanel } from "./rounded-panel";

const WIDTH = 320;

function tooltipBox(scene: Phaser.Scene, lines: string[], width: number, fontSize = 12) {
  const text = scene.add.text(12, 10, lines.filter((line) => line.length > 0).join("\n"), {
    ...TEXT_BASE,
    fontSize: `${fontSize}px`,
    color: COLORS.text,
    wordWrap: { width: width - 24 },
    lineSpacing: 4,
  });
  const height = text.height + 20;
  const panel = roundedPanel(scene,width/2,height/2,width,height,0x0a0e20,0.96);
  return { height, parts: [panel, text], text };
}

/** Authoritative cost context for the header line + reason rows (`05` review). */
export interface CardTooltipPresentation {
  effectiveCost: number;
  costReasons: string[];
  disabledReason?: string;
}

/**
 * Large card view + keyword explanations; caller destroys it on pointerout.
 * Header shows the effective cost with the printed cost in parens, then the
 * signed reasons; `presentation` is optional so non-combat callers stay as-is.
 * Content taller than the window scrolls under a mask (wheel) — never shrinks.
 */
export function showCardTooltip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  data: GameData,
  cardOrId: string | CardDef,
  extraLines: string[] = [],
  presentation?: CardTooltipPresentation,
): Phaser.GameObjects.Container {
  const card = typeof cardOrId === "string" ? data.cards[cardOrId]! : cardOrId;
  const costLine =
    presentation !== undefined
      ? `${card.name}  ·  ${presentation.effectiveCost} Nguyệt Lực (${card.cost})  ·  ${card.copies} bản`
      : `${card.name}  ·  ${card.cost} Nguyệt Lực  ·  ${card.copies} bản`;
  const { height, parts, text } = tooltipBox(scene, [
    costLine,
    ...(presentation?.disabledReason !== undefined ? [`⚠ ${presentation.disabledReason}`] : []),
    card.text,
    ...(card.keywords ?? []).map((id) => {
      const keyword = data.keywords[id];
      return keyword ? `• ${keyword.name}: ${keyword.text}` : "";
    }),
    ...(presentation?.costReasons.map((reason) => `· ${reason}`) ?? []),
    ...extraLines,
  ], WIDTH, PREVIEW_BODY_FONT);
  const view = visibleWorld(scene);
  const maxHeight = view.h - 16;
  const left = Phaser.Math.Clamp(x, view.x + 8, view.x + view.w - WIDTH - 8);
  if (height <= maxHeight) {
    const top = Phaser.Math.Clamp(y - height, view.y + 8, view.y + view.h - height - 8);
    return scene.add.container(left, top, parts).setDepth(200);
  }
  // Overflow: clip the text to the window and let the wheel scroll it.
  parts[0]!.destroy(); // the snug panel isn't used — the window replaces it
  const top = view.y + 8;
  const viewH = maxHeight;
  const container = scene.add.container(left, top);
  const panel = roundedPanel(scene,WIDTH/2,viewH/2,WIDTH,viewH,0x0a0e20,0.96);
  const content = scene.add.container(0, 0, [text]);
  const veil = scene.add.rectangle(left + WIDTH / 2, top + viewH / 2, WIDTH, viewH).setVisible(false);
  content.setMask(veil.createGeometryMask());
  const scroll = (dy: number) => {
    const min = -(text.height + 20 - viewH);
    content.y = Phaser.Math.Clamp(content.y - dy, min, 0);
  };
  const onWheel = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
    const wp = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (dy !== 0 && wp.x >= left && wp.x <= left + WIDTH && wp.y >= top && wp.y <= top + viewH) {
      scroll(dy * 0.6);
    }
  };
  scene.input.on("wheel", onWheel);
  container.on(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off("wheel", onWheel);
    veil.destroy();
  });
  const hint = scene.add
    .text(WIDTH - 10, viewH - 8, "▼", { ...TEXT_BASE, fontSize: "10px", color: COLORS.dimText })
    .setOrigin(1, 1);
  container.add([panel, content, hint]);
  return container.setDepth(200);
}

/** Plain text tooltip whose top-left sits at (x, y), kept on screen; caller destroys it. */
export function showTextTooltip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  lines: string[],
  width = 240,
): Phaser.GameObjects.Container {
  const { height, parts, text } = tooltipBox(scene, lines, width);
  const view = visibleWorld(scene);
  const left = Phaser.Math.Clamp(x, view.x + 8, view.x + view.w - width - 8);
  const viewH = Math.min(height, view.h - 16);
  const top = Phaser.Math.Clamp(y, view.y + 8, view.y + view.h - viewH - 8);
  if (height <= viewH) return scene.add.container(left, top, parts).setDepth(200).setName("text_tooltip");
  parts[0]!.destroy();
  const container = scene.add.container(left, top).setDepth(200).setName("text_tooltip");
  const panel = roundedPanel(scene, width / 2, viewH / 2, width, viewH, 0x0a0e20, 0.96);
  const content = scene.add.container(0, 0, [text]).setName("tooltip_scroll_content");
  const veil = scene.add.rectangle(left + width / 2, top + viewH / 2, width, viewH).setVisible(false);
  const mask = veil.createGeometryMask();
  content.setMask(mask);
  // Hover tooltips remain tied to their source: wheel works while hovering it.
  const onWheel = (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
    content.y = Phaser.Math.Clamp(content.y - dy * 0.6, -(height - viewH), 0);
  };
  scene.input.on("wheel", onWheel);
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off("wheel", onWheel);
    mask.destroy();
    veil.destroy();
  });
  const hint = scene.add.text(width - 10, viewH - 8, "▼ Cuộn", { ...TEXT_BASE, fontSize: "10px", color: COLORS.dimText }).setOrigin(1, 1);
  container.add([panel, content, hint]);
  return container;
}
