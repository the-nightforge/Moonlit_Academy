import type Phaser from "phaser";
import { cardDefOf } from "rules";
import type { CardDef, CombatState, GameData } from "rules";
import { COLORS, TEXT_BASE, visibleWorld } from "./theme";
import { roundedPanel } from "./rounded-panel";

/**
 * What one seat's pile inspector shows (`05` review): the draw pile never
 * enumerates its order — in any mode — because the client has no business
 * displaying information the rules keep closed; the discard is public and
 * resolves every instance it can against `cardDefOf`.
 */
export interface PileModel {
  title: string;
  count: number;
  cards: { instanceId: string; definition: CardDef }[];
  hidden: boolean;
}

export function pileModel(
  data: GameData,
  state: CombatState,
  player: number,
  zone: "draw" | "discard",
  _mySeat: number,
): PileModel {
  const seat = state.players[player];
  if (zone === "draw") {
    return { title: "Chồng rút", count: seat?.drawPile.length ?? 0, cards: [], hidden: true };
  }
  const cards = (seat?.discardPile ?? []).flatMap((instanceId) => {
    const instance = state.cards[instanceId];
    const definition = instance !== undefined ? cardDefOf(data, state, instance) : undefined;
    // Redacted sentinel ids (PvP `hidden_*`) never fabricate a card entry —
    // the count still matches the pile's public size.
    return definition === undefined ? [] : [{ instanceId, definition }];
  });
  return { title: "Chồng bỏ", count: seat?.discardPile.length ?? 0, cards, hidden: false };
}

/**
 * The draw pile as a bag of remaining names — the player's own deck
 * knowledge, aggregated so no draw order leaks (`17` §4.8). `undefined` for
 * another seat's pile: their remaining cards are not our business.
 */
export function drawComposition(
  data: GameData,
  state: CombatState,
  player: number,
  mySeat?: number,
): { name: string; count: number }[] | undefined {
  if (player !== (mySeat ?? player)) return undefined;
  const counts = new Map<string, number>();
  for (const instanceId of state.players[player]?.drawPile ?? []) {
    const instance = state.cards[instanceId];
    const definition = instance !== undefined ? cardDefOf(data, state, instance) : undefined;
    if (definition === undefined) continue;
    counts.set(definition.name, (counts.get(definition.name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/** One icon in the relic strip (`05` review) — moon relic, Kỳ Vật, Lõi or a hero's Trang Bị. */
export interface RelicHudEntry {
  id: string;
  kind: "relic" | "runRelic" | "augment" | "weapon";
  name: string;
  description: string;
  /** Cộng Minh resonance for moon relics. */
  count?: number;
}

export function relicHudEntries(data: GameData, state: CombatState, player: number): RelicHudEntry[] {
  const seat = state.players[player];
  if (seat === undefined) return [];
  const entries: RelicHudEntry[] = [];
  for (const relic of seat.relics) {
    const def = data.relics[relic.id];
    const level = Math.max(1, Math.min(relic.resonance, def?.resonance.length ?? 1));
    entries.push({
      id: relic.id,
      kind: "relic",
      name: def?.name ?? relic.id,
      description: def?.resonance[level - 1]?.text ?? "",
      count: relic.resonance,
    });
  }
  for (const id of seat.runRelicIds) {
    const runRelic = data.runRelics[id];
    const augment = runRelic === undefined ? data.augments[id] : undefined;
    const def = runRelic ?? augment;
    entries.push({
      id,
      kind: augment !== undefined ? "augment" : "runRelic",
      name: def?.name ?? id,
      description: def?.text ?? "",
    });
  }
  return entries;
}

/** The shared key between the scene's anchor map and the animator's trigger flashes. */
export function triggerAnchorKey(player: number, kind: "relic" | "runRelic" | "augment" | "weapon", id: string): string {
  return `${player}:${kind}:${id}`;
}

const PANEL_W = 460;
const KIND_LABEL: Record<RelicHudEntry["kind"], string> = {
  relic: "Nguyệt Bảo",
  runRelic: "Kỳ Vật",
  augment: "Lõi",
  weapon: "Trang Bị",
};

/**
 * The combat-side modal for piles and relic details (`05` review). One panel
 * at a time, scene-owned, closed by Esc/Đóng/right-click outside — and it
 * marks itself modal so the E/cast hotkeys stand down while it is open.
 */
export class InspectorView {
  private layer?: Phaser.GameObjects.Container;
  private modalCleanup?: () => void;
  private onEsc?: () => void;
  private onPointer?: (pointer: Phaser.Input.Pointer) => void;
  private onWheel?: (pointer: Phaser.Input.Pointer, over: unknown, dx: number, dy: number) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly setModal: (cancel: () => void) => () => void,
  ) {}

  get open(): boolean {
    return this.layer !== undefined;
  }

  openPile(model: PileModel, composition?: { name: string; count: number }[]): void {
    const lines: string[] = [`Còn ${model.count} lá`];
    if (model.hidden) {
      lines.push("Thứ tự chồng rút được giữ kín");
      if (composition !== undefined && composition.length > 0) {
        lines.push("", "Lá còn lại:", ...composition.map((entry) => `· ${entry.name} ×${entry.count}`));
      }
    } else {
      for (const card of model.cards) {
        lines.push(`· ${card.definition.name} (${card.definition.cost}) — ${card.definition.text}`);
      }
    }
    this.show(model.title, lines, model.count > 0 && !model.hidden);
  }

  openRelic(entry: RelicHudEntry): void {
    this.show(`${entry.name}${entry.count !== undefined ? ` · Cộng Minh ${entry.count}` : ""}`, [
      KIND_LABEL[entry.kind],
      entry.description.length > 0 ? entry.description : "Chưa có mô tả.",
    ]);
  }

  /** The strip's overflow view — every entry the icons could not fit. */
  openRelics(entries: RelicHudEntry[]): void {
    const lines = entries.map(
      (entry) => `· [${KIND_LABEL[entry.kind]}] ${entry.name}${entry.count !== undefined ? ` ×${entry.count}` : ""} — ${entry.description}`,
    );
    this.show("Nguyệt Bảo · Kỳ Vật · Lõi · Trang Bị", lines, lines.length > 4);
  }

  close(): void {
    if (this.onEsc !== undefined) this.scene.input.keyboard?.off("keydown-ESC", this.onEsc);
    if (this.onWheel !== undefined) this.scene.input.off("wheel", this.onWheel);
    if (this.onPointer !== undefined) this.scene.input.off("pointerdown", this.onPointer);
    this.modalCleanup?.();
    this.modalCleanup = undefined;
    this.onEsc = undefined;
    this.onWheel = undefined;
    this.onPointer = undefined;
    this.layer?.destroy();
    this.layer = undefined;
  }

  destroy(): void {
    this.close();
  }

  private show(title: string, lines: string[], scroll = false): void {
    this.close();
    const view = visibleWorld(this.scene);
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    const layer = this.scene.add.container(0, 0).setDepth(1600);
    const dim = this.scene.add
      .rectangle(cx, cy, view.w, view.h, 0x000000, 0.55)
      .setInteractive();
    layer.add(dim);

    const text = this.scene.add.text(0, 0, lines.join("\n"), {
      ...TEXT_BASE,
      fontSize: "13px",
      color: COLORS.text,
      wordWrap: { width: PANEL_W - 48 },
      lineSpacing: 5,
    });
    const maxPanelH = view.h - 120;
    const panelH = Math.min(56 + text.height + 48, maxPanelH);
    const panel = roundedPanel(this.scene,cx,cy,PANEL_W,panelH);
    layer.add(panel);
    layer.add(this.scene.add.text(cx, cy - panelH / 2 + 20, title, { ...TEXT_BASE, fontSize: "18px", color: COLORS.gold }).setOrigin(0.5));

    const bodyTop = cy - panelH / 2 + 48;
    const bodyH = panelH - 48 - 40;
    if (scroll && text.height > bodyH) {
      // Tall lists scroll under a mask — the font never shrinks.
      const content = this.scene.add.container(0, 0, [text.setPosition(cx - PANEL_W / 2 + 24, bodyTop)]);
      const veil = this.scene.add
        .rectangle(cx, bodyTop + bodyH / 2, PANEL_W, bodyH)
        .setVisible(false);
      content.setMask(veil.createGeometryMask());
      layer.add(content);
      veil.once("destroy", () => content.clearMask());
      layer.once("destroy", () => veil.destroy());
      this.onWheel = (_p, _o, _dx, dy) => {
        const wp = this.scene.cameras.main.getWorldPoint(_p.x, _p.y);
        if (dy === 0 || Math.abs(wp.x - cx) > PANEL_W / 2 || wp.y < bodyTop || wp.y > bodyTop + bodyH) return;
        text.y = Math.min(Math.max(text.y - dy * 0.6, bodyTop + bodyH - text.height - 8), bodyTop);
      };
      this.scene.input.on("wheel", this.onWheel);
      layer.add(
        this.scene.add
          .text(cx + PANEL_W / 2 - 14, cy + panelH / 2 - 30, "▼", { ...TEXT_BASE, fontSize: "10px", color: COLORS.dimText })
          .setOrigin(1, 0.5),
      );
    } else {
      layer.add(text.setPosition(cx - PANEL_W / 2 + 24, bodyTop));
    }

    const closeBtn = this.scene.add
      .text(cx + PANEL_W / 2 - 16, cy - panelH / 2 + 14, "✕", { ...TEXT_BASE, fontSize: "16px", color: COLORS.dimText })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.close();
    });
    closeBtn.on("pointerover", () => closeBtn.setColor(COLORS.gold));
    closeBtn.on("pointerout", () => closeBtn.setColor(COLORS.dimText));
    layer.add(closeBtn);

    this.onEsc = () => this.close();
    this.scene.input.keyboard?.on("keydown-ESC", this.onEsc);
    this.onPointer = (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.close();
    };
    this.scene.input.on("pointerdown", this.onPointer);
    this.modalCleanup = this.setModal(() => this.close());
    this.layer = layer;
  }
}
