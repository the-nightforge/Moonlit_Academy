import type Phaser from "phaser";
import {
  cardDefOf,
  cardOwners,
  getCardCostBreakdown,
  getValidTargets,
  hasStatus,
  isCardPlayable,
} from "rules";
import type { CombatState, GameData } from "rules";
import { COLORS, OWNER_COLORS, TEXT_BASE } from "./theme";

/** Compact (in-hand) card typography (`05` review): body never below 11px. */
export const COMPACT_BODY_FONT = 11;
/** The hover preview's body size. */
export const PREVIEW_BODY_FONT = 14;
/** Compact cards show at most this many body lines; the rest ellipsizes. */
export const COMPACT_MAX_BODY_LINES = 4;
export const COMPACT_CARD = { w: 110, h: 160 } as const;

/**
 * Everything a combat card view shows, sourced from authoritative state —
 * owners by seat, the effective cost with its reasons, and one Vietnamese
 * `disabledReason` in priority order: owner dead → frozen → needs Huyết
 * Nguyệt → not enough Nguyệt Lực → no valid target → turn/choice/done.
 */
export interface CombatCardModel {
  instanceId: string;
  ownerNames: string[];
  ownerColors: number[];
  title: string;
  fullText: string;
  baseCost: number;
  effectiveCost: number;
  costReasons: string[];
  playable: boolean;
  disabledReason: string | null;
  category: "hero" | "bond" | "weapon";
}

/** Short labels for the signed cost modifiers the rules query reports. */
const COST_REASON_LABELS: Record<string, string> = {
  phaseOrDecree: "Pha / Nguyệt Lệnh",
  chosen: "Chiêm Bài",
  firstOwn: "Thức Tỉnh — lá đầu",
  bloodMoon: "Huyết Diện",
  ownTag: "Tự Do",
  turnDiscount: "Thiên Cơ",
};

export function combatCardModel(
  data: GameData,
  state: CombatState,
  instanceId: string,
  player?: number,
): CombatCardModel {
  const instance = state.cards[instanceId];
  const card = instance ? cardDefOf(data, state, instance) : undefined;
  if (instance === undefined || card === undefined) {
    throw new Error(`combatCardModel: unknown card instance "${instanceId}"`);
  }
  const seat = state.players[player ?? instance.player];
  const breakdown = getCardCostBreakdown(data, state, instanceId, player);
  const owners = cardOwners(state, instance);
  const ownerNames = instance.ownerIds.map((id) => data.heroes[id]?.name ?? id);
  const ownerColors = instance.ownerIds.map((id) => OWNER_COLORS[id] ?? COLORS.panelBorder);

  // A Chiêm Bài option is pickable right now — it isn't being played, so the
  // turn/power/target gates don't apply; intrinsic flags (dead/frozen owner)
  // still warn since they carry over once picked.
  const isChoiceOption =
    seat?.pendingChoice?.kind === "chooseCard" && seat.pendingChoice.options.includes(instanceId);

  let disabledReason: string | null = null;
  if (owners.some((owner) => !owner?.alive)) {
    disabledReason = "Tàn Chiêu — chủ lá đã ngã";
  } else if (owners.some((owner) => owner !== undefined && hasStatus(owner, "freeze"))) {
    disabledReason = "Chủ lá đang Đóng Băng";
  } else if (!isChoiceOption && card.requiresBloodMoon === true && state.bloodMoonRounds === 0) {
    disabledReason = "Cần Huyết Nguyệt";
  } else if (!isChoiceOption && seat !== undefined && seat.moonPower < breakdown.effective) {
    disabledReason = "Không đủ Nguyệt Lực";
  } else if (!isChoiceOption && card.target !== "none" && getValidTargets(data, state, instanceId).length === 0) {
    disabledReason = "Không có mục tiêu hợp lệ";
  } else if (isChoiceOption) {
    disabledReason = null;
  } else if (state.status === "mulligan") {
    disabledReason = "Hãy Đổi Bài trướ";
  } else if (state.status !== "playerTurn") {
    disabledReason = "Chưa tới lượt người chơi";
  } else if (state.mode === "coop" && seat?.done === true) {
    disabledReason = "Bạn đã Xong — chờ đồng đội";
  } else if (state.mode === "coop" && seat?.pendingChoice !== null && seat?.pendingChoice !== undefined) {
    disabledReason = "Hãy chọn 1 lá";
  } else if (seat !== undefined && !seat.hand.includes(instanceId)) {
    disabledReason = "Lá không còn trên tay";
  }

  return {
    instanceId,
    ownerNames,
    ownerColors,
    title: card.name,
    fullText: card.text,
    baseCost: card.cost,
    effectiveCost: breakdown.effective,
    costReasons: breakdown.modifiers
      .filter((modifier) => modifier.amount !== 0)
      .map((modifier) => `${COST_REASON_LABELS[modifier.kind] ?? modifier.kind} ${modifier.amount > 0 ? "+" : ""}${modifier.amount}`),
    playable: isCardPlayable(data, state, instanceId, player),
    disabledReason,
    category: card.bond !== undefined || instance.ownerIds.length > 1 ? "bond" : data.cards[instance.cardId] === undefined ? "weapon" : "hero",
  };
}

/**
 * `text` clamped to `maxLines` wrapped lines with an ellipsis — never a
 * smaller font (`05` review). The scene keeps the full text for tooltips.
 */
export function ellipsize(scene: Phaser.Scene, text: string, width: number, fontSize: number, maxLines: number, maxHeight = 34): string {
  const probe = scene.add
    .text(-4000, -4000, text, { ...TEXT_BASE, fontSize: `${fontSize}px`, lineSpacing: -1, wordWrap: { width } });
  const lines = probe.getWrappedText();
  if (lines.length <= maxLines && probe.height <= maxHeight) {
    probe.destroy();
    return text;
  }
  const kept = lines.slice(0, maxLines);
  while (kept.length > 1) {
    probe.setText(kept.join("\n"));
    if (probe.height <= maxHeight) break;
    kept.pop();
  }
  let last = kept.at(-1)!.trimEnd();
  // The ellipsis itself must fit the last line; appending it can wrap again.
  while (last.length > 0) {
    probe.setText(`${last}…`);
    if (probe.getWrappedText().length === 1) break;
    last = last.slice(0, -1).trimEnd();
  }
  kept[kept.length - 1] = `${last}…`;
  probe.destroy();
  return kept.join("\n");
}

const CATEGORY_GLYPH: Record<CombatCardModel["category"], string> = {
  hero: "✦",
  bond: "∞",
  weapon: "⚔",
};

/**
 * The compact 110×160 combat card (`05` review): owner-colored frame, a 16px
 * effective-cost disc (base struck through when discounted), 12px title,
 * 11px body capped at four lines, and an owner/category strip along the
 * bottom — Song Hành names both owners, Binh Khí gets its own label.
 */
export function renderCombatCard(
  scene: Phaser.Scene,
  model: CombatCardModel,
  position: { x: number; y: number },
): Phaser.GameObjects.Container {
  const { w, h } = COMPACT_CARD;
  const container = scene.add.container(position.x, position.y);
  const frame = model.ownerColors[0] ?? COLORS.panelBorder;

  container.add(
    scene.add
      .rectangle(0, 0, w, h, 0x141b33)
      .setStrokeStyle(2, model.playable ? frame : 0x4a4f66),
  );
  // Bond's second owner inner-border / the weapon's orange frame.
  if (model.category === "bond" && model.ownerColors[1] !== undefined) {
    container.add(scene.add.rectangle(0, 0, w - 8, h - 8, 0x000000, 0).setStrokeStyle(2, model.ownerColors[1]));
  } else if (model.category === "weapon") {
    container.add(scene.add.rectangle(0, 0, w - 8, h - 8, 0x000000, 0).setStrokeStyle(2, 0xe08a3c));
  }

  // The gate: a category glyph where card art would sit (art stays optional).
  container.add(
    scene.add
      .circle(0, -30, 22, 0x0a0e26, 0.9)
      .setStrokeStyle(1.5, frame),
  );
  container.add(
    scene.add
      .text(0, -30, CATEGORY_GLYPH[model.category], { ...TEXT_BASE, fontSize: "24px", color: "#f4d35e" })
      .setOrigin(0.5),
  );

  // Cost disc top-left: effective cost 16px, base struck through when lower.
  const coinX = -w / 2 + 19;
  const coinY = -h / 2 + 22;
  container.add(scene.add.circle(coinX, coinY, 13, 0x0a0e26).setStrokeStyle(1.5, COLORS.goldFill));
  container.add(
    scene.add
      .text(coinX, coinY, `${model.effectiveCost}`, {
        ...TEXT_BASE,
        fontSize: "16px",
        fontStyle: "bold",
        color: model.effectiveCost < model.baseCost ? "#8fd08f" : COLORS.gold,
      })
      .setOrigin(0.5),
  );
  if (model.effectiveCost < model.baseCost) {
    container.add(
      scene.add
        .text(coinX, coinY + 17, `${model.baseCost}`, { ...TEXT_BASE, fontSize: "10px", color: COLORS.dimText })
        .setOrigin(0.5),
    );
    container.add(scene.add.rectangle(coinX, coinY + 17, 10, 1, 0xffffff, 0.8));
  }

  // 12px title, one line, scaled down only when a name truly overflows.
  const title = scene.add
    .text(0, 12, model.title, {
      ...TEXT_BASE,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#fff1d0",
      align: "center",
    })
    .setOrigin(0.5);
  if (title.width > w - 16) title.setScale((w - 16) / title.width);
  container.add(title);

  // 11px body, four lines max — the full text lives in the hover preview.
  const body = ellipsize(scene, model.fullText, w - 16, COMPACT_BODY_FONT, COMPACT_MAX_BODY_LINES);
  container.add(
    scene.add
      .text(0, 28, body, {
        ...TEXT_BASE,
        fontSize: `${COMPACT_BODY_FONT}px`,
        color: "#cfc4a8",
        align: "center",
        lineSpacing: -1,
        wordWrap: { width: w - 16 },
      })
      .setOrigin(0.5, 0),
  );

  // Bottom strip: owners (both for Song Hành) or the Binh Khí label.
  const strip =
    model.category === "weapon"
      ? `Binh Khí${model.ownerNames.length > 0 ? ` · ${model.ownerNames[0]}` : ""}`
      : model.category === "bond"
        ? `Song Hành · ${model.ownerNames.join(" × ")}`
        : (model.ownerNames[0] ?? "");
  const ownerText = scene.add
    .text(0, h / 2 - 11, strip, {
      ...TEXT_BASE,
      fontSize: "10px",
      color: "#d8cfae",
      align: "center",
    })
    .setOrigin(0.5);
  if (ownerText.width > w - 10) ownerText.setScale((w - 10) / ownerText.width);
  container.add(ownerText);

  if (!model.playable) {
    container.setAlpha(0.55);
  }
  return container;
}
