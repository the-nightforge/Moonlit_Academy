import type Phaser from "phaser";
import {
  cardDefOf,
  cardOwners,
  getCardCostBreakdown,
  getValidTargets,
  hasStatus,
  isCardPlayable,
} from "rules";
import type { CardDef, CombatState, GameData } from "rules";
import { COLORS, OWNER_COLORS, RENDER_SCALE, TEXT_BASE } from "./theme";
import { cardIconOf } from "./attack-style";
import { HUD, hudImage } from "./hud-art";
import { ensureTextures, GLOW } from "./vfx";

/** Body font ladder — the largest size that still shows the full text wins. */
export const COMPACT_BODY_FONTS = [11, 10, 9] as const;
export const PREVIEW_BODY_FONTS = [14, 12, 11] as const;
/** Compact (in-hand) card: LoR-style 124×180 — full-bleed art over a text band. */
export const COMPACT_CARD = { w: 124, h: 180 } as const;
/** Hover/inspect card: same face at 1.5× for readable full text. */
export const PREVIEW_CARD = { w: 186, h: 270 } as const;

/** Keyword ids that map onto an existing status/ui icon until art lands. */
const KEYWORD_ICON_FALLBACK: Record<string, string> = {
  khieu_khich: "ui:status_taunt",
  dong_bang: "ui:status_freeze",
  thieu_dot: "ui:status_burn",
  cuong_hoa: "ui:status_empower",
  suy_yeu: "ui:status_weak",
  an_than: "ui:status_stealth",
  danh_dau: "ui:status_mark",
  phan_don: "ui:status_reflect",
  me_hoac: "ui:status_charm",
  hoi_phuc: "ui:status_regen",
  de_vo: "ui:status_guard",
  ho_ve: "ui:shield",
  huyet_nguyet: "ui:moon_blood",
};

/**
 * The keyword icon for `kwId`: a dedicated `ui:kw_*` texture when generated,
 * else the matching status icon, else the generic seal glyph.
 */
export function keywordIconKey(scene: Phaser.Scene, kwId: string): string {
  const direct = `ui:kw_${kwId}`;
  if (scene.textures.exists(direct)) return direct;
  const mapped = KEYWORD_ICON_FALLBACK[kwId];
  if (mapped !== undefined && scene.textures.exists(mapped)) return mapped;
  return "ui:seal";
}

/**
 * Card artwork candidates, first existing texture wins: explicit `card.art`,
 * per-card art, the weapon's own art, then keyword/type art. Empty → the
 * caller falls back to the procedural glow.
 */
export function cardArtCandidates(data: GameData, card: CardDef | undefined, cardId: string): string[] {
  return [
    card?.art !== undefined ? `cards:art_${card.art}` : null,
    `cards:${cardId}`,
    data.weapons[cardId] !== undefined ? `weapons:${cardId}` : null,
    card?.keywords?.[0] !== undefined ? `cards:art_${card.keywords[0]}` : null,
    `cards:art_${card?.type === "attack" ? "attack" : "skill"}`,
  ].filter((key): key is string => key !== null);
}

/**
 * Everything a combat card view shows, sourced from authoritative state —
 * owners by seat, the effective cost with its reasons, and one Vietnamese
 * `disabledReason` in priority order: owner dead → frozen → needs Huyết
 * Nguyệt → not enough Nguyệt Lực → no valid target → turn/choice/done.
 */
export interface CombatCardModel {
  instanceId: string;
  cardId: string;
  type: "attack" | "skill";
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
  keywordIds: string[];
  /** Emblem texture for the top-right type/tag medallion. */
  iconKey: string;
  /** Artwork texture candidates, first existing wins. */
  artKeys: string[];
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
    disabledReason = "Hãy Đổi Bài trước";
  } else if (state.status !== "playerTurn") {
    disabledReason = "Chưa tới lượt người chơi";
  } else if (state.mode === "coop" && seat?.done === true) {
    disabledReason = "Bạn đã xong — chờ đồng đội";
  } else if (state.mode === "coop" && seat?.pendingChoice !== null && seat?.pendingChoice !== undefined) {
    disabledReason = "Hãy chọn 1 lá";
  } else if (seat !== undefined && !seat.hand.includes(instanceId)) {
    disabledReason = "Lá không còn trên tay";
  }

  return {
    instanceId,
    cardId: instance.cardId,
    type: card.type === "attack" ? "attack" : "skill",
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
    keywordIds: card.keywords ?? [],
    iconKey: cardIconOf({ ...card, tags: card.tags ?? [] }),
    artKeys: cardArtCandidates(data, card, instance.cardId),
  };
}

/**
 * `text` clamped to `maxLines` wrapped lines with an ellipsis — never a
 * smaller font (`05` review). The scene keeps the full text for tooltips.
 */
export function ellipsize(scene: Phaser.Scene, text: string, width: number, fontSize: number, maxLines: number, maxHeight?: number): string {
  const probe = scene.add
    .text(-4000, -4000, text, { ...TEXT_BASE, fontSize: `${fontSize}px`, lineSpacing: -1, wordWrap: { width } });
  const lines = probe.getWrappedText();
  // Phaser's font metrics include ascent/descent, not just fontSize. Measure
  // the actual line budget so three real lines never get cut back to two.
  probe.setText(Array.from({length:maxLines},()=>"Ág").join("\n"));
  const heightLimit = maxHeight ?? probe.height;
  probe.setText(text);
  if (lines.length <= maxLines && probe.height <= heightLimit) {
    probe.destroy();
    return text;
  }
  const kept = lines.slice(0, maxLines);
  while (kept.length > 1) {
    probe.setText(kept.join("\n"));
    if (probe.height <= heightLimit) break;
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

export function cardOwnerLabel(model: CombatCardModel, expanded = false): string {
  return model.category === "weapon"
    ? `${expanded ? "Binh Khí ·" : "⚔"} ${model.ownerNames.join(" × ")}`
    : model.category === "bond"
      ? expanded ? `Song Hành · ${model.ownerNames.join(" × ")}` : `∞${model.ownerNames.join("×")}`
      : (model.ownerNames[0] ?? "");
}

/** Static face content — resolved once, drawn at either card size. */
export interface CardFaceSpec {
  title: string;
  /** Full rules text; the caller prepends the owner/category label. */
  body: string;
  cost: number;
  costBase: number;
  /** Top-right tag/type emblem texture key. */
  emblem: string;
  keywordIds: string[];
  /** Artwork texture candidates; first existing wins, else glow fallback. */
  artKeys: string[];
  /** Frame color (owner seat color, or panel border for previews). */
  border: number;
  /** Frame thickness — targeting/mulligan picks bump it to 3. */
  borderWidth?: number;
  /** Grey-tinted face for a fallen owner's card (Tàn Chiêu). */
  grey?: boolean;
}

interface FacePreset {
  w: number;
  h: number;
  faceTex: string;
  nameFont: number;
  bodyFonts: readonly number[];
  kwIcon: number;
  coinScale: number;
  costFont: number;
  emblemRing: number;
  emblemIcon: number;
}

export const FACE_PRESET: Record<"compact" | "preview", FacePreset> = {
  compact: { w: COMPACT_CARD.w, h: COMPACT_CARD.h, faceTex: HUD.cardFace, nameFont: 12, bodyFonts: COMPACT_BODY_FONTS, kwIcon: 15, coinScale: 0.9, costFont: 17, emblemRing: 12, emblemIcon: 14 },
  preview: { w: PREVIEW_CARD.w, h: PREVIEW_CARD.h, faceTex: HUD.cardFaceLg, nameFont: 17, bodyFonts: PREVIEW_BODY_FONTS, kwIcon: 22, coinScale: 1.3, costFont: 24, emblemRing: 17, emblemIcon: 20 },
};

interface FittedBody {
  font: number;
  text: string;
  /** Top edge of the opaque part of the bottom band. */
  bandTop: number;
  /** Vertical center of the rules-text block. */
  textY: number;
}

/**
 * Fits the full body text: try each font in `bodyFonts` and take the largest
 * whose band still leaves the top ~28% of the card as pure art. At the
 * smallest font an exceptionally long text ellipsizes inside that cap.
 */
function fitBody(scene: Phaser.Scene, spec: CardFaceSpec, p: FacePreset): FittedBody {
  const wrapW = p.w - 18;
  const bottom = p.h / 2 - 7;
  const nameH = p.nameFont + 6;
  const kwH = spec.keywordIds.length > 0 ? p.kwIcon + 8 : 2;
  const bandTopMin = -p.h / 2 + Math.round(p.h * 0.28);
  const measure = (text: string, font: number): number => {
    const probe = scene.add.text(-4000, -4000, text, {
      ...TEXT_BASE, fontSize: `${font}px`, lineSpacing: -1, wordWrap: { width: wrapW },
    });
    const height = probe.height;
    probe.destroy();
    return height;
  };
  for (const font of p.bodyFonts) {
    const height = measure(spec.body, font);
    const bandTop = bottom - (nameH + kwH + 4 + height);
    if (bandTop >= bandTopMin) return { font, text: spec.body, bandTop, textY: bandTop + nameH + kwH + 2 + height / 2 };
  }
  const font = p.bodyFonts[p.bodyFonts.length - 1]!;
  const bandTop = bandTopMin;
  const textTop = bandTop + nameH + kwH + 2;
  const avail = bottom - textTop;
  const lineH = measure("Ág", font);
  const text = ellipsize(scene, spec.body, wrapW, font, Math.max(1, Math.floor(avail / lineH)), avail);
  return { font, text, bandTop, textY: (textTop + bottom) / 2 };
}

/**
 * Artwork sized to the rounded card interior: a cover-crop baked into a
 * clipped canvas texture (rounded corners come free — no display mask).
 */
function artImage(scene: Phaser.Scene, key: string, w: number, h: number, parent: Phaser.GameObjects.Container): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  const baked = `${key}@card-${w}x${h}`;
  if (!scene.textures.exists(baked)) {
    const source = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const scale = Math.max(w / source.width, h / source.height);
    const cropW = Math.min(source.width, w / scale);
    const cropH = Math.min(source.height, h / scale);
    const canvas = scene.textures.createCanvas(baked, Math.ceil(w * RENDER_SCALE), Math.ceil(h * RENDER_SCALE));
    if (!canvas) return null;
    const ctx = canvas.getContext();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 7);
    ctx.clip();
    ctx.drawImage(source, (source.width - cropW) / 2, (source.height - cropH) / 2, cropW, cropH, 0, 0, w, h);
    canvas.refresh();
  }
  const img = scene.add.image(0, 0, baked).setScale(1 / RENDER_SCALE).setName("card_art");
  parent.add(img);
  return img;
}

/**
 * The shared LoR-style card face: full-bleed art under a dark gradient band
 * carrying name, keyword icons, and auto-fitted full rules text. Cost coin
 * sits top-left, the tag/type emblem top-right. Caller adds gameplay
 * overlays (borders, mulligan, targeting) on top of the returned container.
 */
export function drawCardFace(
  scene: Phaser.Scene,
  spec: CardFaceSpec,
  size: keyof typeof FACE_PRESET = "compact",
  into?: Phaser.GameObjects.Container,
): Phaser.GameObjects.Container {
  const p = FACE_PRESET[size];
  const { w, h } = p;
  const c = into ?? scene.add.container(0, 0);
  const tint = spec.grey === true ? 0x8a8f9a : 0xffffff;

  c.add(hudImage(scene, p.faceTex, 0, 0).setTint(tint));

  const artKey = spec.artKeys.find((key) => scene.textures.exists(key));
  if (artKey !== undefined) {
    artImage(scene, artKey, w - 10, h - 10, c)?.setTint(tint);
  } else {
    // No artwork yet: the old glow + emblem cluster fills the art zone.
    ensureTextures(scene);
    const glow = scene.add.image(0, -16, GLOW).setDisplaySize(w * 0.8, w * 0.8).setAlpha(0.5);
    c.add(glow);
    const icon = scene.add.image(0, -18, spec.emblem).setDisplaySize(40, 40).setName("card_art_fallback_icon");
    c.add(icon);
    if (spec.grey === true) { glow.setTint(tint); icon.setTint(tint); }
  }

  const fit = fitBody(scene, spec, p);
  // Gradient band: transparent feather top → near-opaque dark bottom.
  const gradTop = fit.bandTop - 14;
  const grad = scene.add.graphics();
  grad.fillGradientStyle(0x060a18, 0x060a18, 0x060a18, 0x060a18, 0, 0, 0.94, 0.94);
  grad.fillRect(-w / 2 + 5, gradTop, w - 10, h / 2 - 5 - gradTop);
  c.add(grad);

  // Cost coin top-left, effective cost (green when discounted) + struck base.
  const coinX = -w / 2 + 17, coinY = -h / 2 + 19;
  c.add(hudImage(scene, HUD.cost, coinX, coinY, p.coinScale).setTint(tint));
  c.add(
    scene.add.text(coinX, coinY - 1, `${spec.cost}`, {
      ...TEXT_BASE, fontSize: `${p.costFont}px`, fontStyle: "bold",
      color: spec.cost < spec.costBase ? "#8fd08f" : "#1a1030",
      stroke: "#f4ead0", strokeThickness: spec.cost < spec.costBase ? 0 : 1,
    }).setOrigin(0.5).setName("card_cost"),
  );
  if (spec.cost < spec.costBase) {
    c.add(
      scene.add.text(coinX, coinY + Math.round(16 * p.coinScale), `${spec.costBase}`, {
        ...TEXT_BASE, fontSize: `${Math.round(10 * p.coinScale)}px`, color: COLORS.dimText,
      }).setOrigin(0.5).setName("card_cost_base"),
    );
    c.add(scene.add.rectangle(coinX, coinY + Math.round(16 * p.coinScale), 10, 1, 0xffffff, 0.8));
  }

  // Tag/type emblem medallion top-right (LoR's region-emblem slot).
  const embX = w / 2 - 17, embY = -h / 2 + 19;
  c.add(scene.add.circle(embX, embY, p.emblemRing, 0x0a0e26, 0.92).setStrokeStyle(1.5, COLORS.goldFill));
  const emblem = scene.add.image(embX, embY, spec.emblem).setDisplaySize(p.emblemIcon, p.emblemIcon).setName("card_emblem_icon");
  c.add(emblem);
  if (spec.grey === true) emblem.setTint(tint);

  // Card name printed on the gradient, over the art's lower edge.
  const name = scene.add.text(0, fit.bandTop + 3 + p.nameFont / 2, spec.title, {
    ...TEXT_BASE, fontSize: `${p.nameFont}px`, fontStyle: "bold", color: "#fff1d0",
    align: "center", stroke: "#0a0612", strokeThickness: 2,
  }).setOrigin(0.5).setName("card_name");
  if (name.width > w - 20) name.setScale((w - 20) / name.width);
  c.add(name);

  // Keyword icons row under the name — the tooltip keeps the full glossary.
  if (spec.keywordIds.length > 0) {
    const shown = spec.keywordIds.slice(0, 5);
    const step = p.kwIcon + 3;
    const rowW = shown.length * step + (spec.keywordIds.length > 5 ? p.kwIcon : 0);
    const ky = fit.bandTop + p.nameFont + 6 + p.kwIcon / 2;
    shown.forEach((kwId, i) => {
      const icon = scene.add.image(-rowW / 2 + step / 2 + i * step, ky, keywordIconKey(scene, kwId))
        .setDisplaySize(p.kwIcon, p.kwIcon).setName("card_kw_icon");
      c.add(icon);
      if (spec.grey === true) icon.setTint(tint);
    });
    if (spec.keywordIds.length > shown.length) {
      c.add(
        scene.add.text(rowW / 2 - p.kwIcon / 2, ky, `+${spec.keywordIds.length - shown.length}`, {
          ...TEXT_BASE, fontSize: `${Math.round(p.nameFont * 0.8)}px`, fontStyle: "bold", color: "#cdb68a",
        }).setOrigin(0.5).setName("card_kw_more"),
      );
    }
  }

  c.add(
    scene.add.text(0, fit.textY, fit.text, {
      ...TEXT_BASE, fontSize: `${fit.font}px`, color: "#efe4c8",
      align: "center", lineSpacing: -1, wordWrap: { width: w - 18 },
    }).setOrigin(0.5).setName("card_body"),
  );

  // Owner-colored frame — the seat color stays readable at hand size.
  const frame = scene.add.graphics();
  frame.lineStyle(spec.borderWidth ?? 2, spec.border, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
  frame.setName("card_frame");
  c.add(frame);

  return c;
}

/**
 * The compact 124×180 combat card face for a `CombatCardModel` — used by the
 * scene's `renderCard` and by tests/tooltips that render a card standalone.
 */
export function renderCombatCard(
  scene: Phaser.Scene,
  model: CombatCardModel,
  position: { x: number; y: number },
  size: keyof typeof FACE_PRESET = "compact",
): Phaser.GameObjects.Container {
  const face = drawCardFace(
    scene,
    {
      title: model.title,
      body: `${cardOwnerLabel(model)} ${model.fullText}`,
      cost: model.effectiveCost,
      costBase: model.baseCost,
      emblem: model.iconKey,
      keywordIds: model.keywordIds,
      artKeys: model.artKeys,
      border: model.ownerColors[0] ?? COLORS.panelBorder,
    },
    size,
  );
  face.setPosition(position.x, position.y);
  if (!model.playable) face.setAlpha(0.55);
  return face;
}
