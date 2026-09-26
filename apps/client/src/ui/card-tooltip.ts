import Phaser from "phaser";
import type { GameData } from "rules";
import { COLORS, TEXT_BASE } from "./theme";

const WIDTH = 300;

/** Large card view + keyword explanations; caller destroys it on pointerout. */
export function showCardTooltip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  data: GameData,
  cardId: string,
): Phaser.GameObjects.Container {
  const card = data.cards[cardId]!;
  const lines = [
    `${card.name}  ·  ${card.cost} Nguyệt Lực  ·  ${card.copies} bản`,
    card.text,
    ...(card.keywords ?? []).map((id) => {
      const keyword = data.keywords[id];
      return keyword ? `• ${keyword.name}: ${keyword.text}` : "";
    }),
  ].filter((line) => line.length > 0);
  const text = scene.add.text(12, 10, lines.join("\n"), {
    ...TEXT_BASE,
    fontSize: "12px",
    color: COLORS.text,
    wordWrap: { width: WIDTH - 24 },
    lineSpacing: 4,
  });
  const height = text.height + 20;
  const left = Math.min(Math.max(8, x), 1280 - WIDTH - 8);
  const top = Math.min(Math.max(8, y - height), 720 - height - 8);
  const panel = scene.add.rectangle(0, 0, WIDTH, height, 0x0a0e20, 0.96).setOrigin(0, 0);
  panel.setStrokeStyle(1, COLORS.goldFill);
  return scene.add.container(left, top, [panel, text]).setDepth(200);
}
