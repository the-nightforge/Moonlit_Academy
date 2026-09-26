import Phaser from "phaser";
import { deckWeapons, validateDeck, weaponCardDef } from "rules";
import type { CardDef } from "rules";
import { errorText, mutate } from "../account";
import { session } from "../session";
import { showCardTooltip } from "../ui/card-tooltip";
import { COLORS, OWNER_COLORS, RARITY_COLORS, TEXT_BASE, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";
import { describeDeckError } from "./deck-select-scene";

const WIDTH = 1280;
const COLUMN_W = 400;
const ROW_H = 30;

export class DeckBuilderScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tooltip: Phaser.GameObjects.Container | null = null;
  /** Open gear picker: a hero's weapon slot or a relic slot index. */
  private picker: { kind: "weapon"; heroId: string } | { kind: "relic"; slot: number } | null = null;

  constructor() {
    super("deck-builder");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.picker = null;
    this.render();
  }

  private get deck() {
    return session.editingDeck!;
  }

  private isUnlocked(heroId: string, cardId: string): boolean {
    const hero = session.data.heroes[heroId]!;
    return hero.cardIds.includes(cardId) || (session.profile.heroes[heroId]?.unlockedCardIds.includes(cardId) ?? false);
  }

  private toggle(cardId: string) {
    const cards = this.deck.cardIds;
    const index = cards.indexOf(cardId);
    if (index >= 0) cards.splice(index, 1);
    else cards.push(cardId);
    this.render();
  }

  private render() {
    this.root.removeAll(true);
    this.tooltip?.destroy();
    this.tooltip = null;
    const data = session.data;
    addText(this, this.root, WIDTH / 2, 24, `Xếp deck — ${this.deck.name}`, 22, COLORS.gold).setOrigin(0.5);
    this.deck.heroIds.forEach((heroId, column) => {
      const hero = data.heroes[heroId]!;
      const x0 = 40 + column * COLUMN_W;
      const count = this.deck.cardIds.filter((id) => data.cards[id]?.ownerId === heroId).length;
      const low = count < data.metaConfig.minCardsPerHero;
      addText(this, this.root, x0, 58, `${hero.name}  (${count})`, 16, low ? "#ff8080" : COLORS.text);
      let y = 90;
      for (const branch of hero.branches) {
        addText(this, this.root, x0, y, `— ${branch.name} —`, 12, COLORS.dimText);
        y += 22;
        for (const cardId of branch.cardIds) {
          this.renderRow(heroId, cardId, x0, y);
          y += ROW_H;
        }
        y += 6;
      }
      this.renderWeaponSlot(heroId, x0, 532);
    });
    const errors = validateDeck(data, session.profile, this.deck);
    const weapons = deckWeapons(this.deck);
    const weaponCopies = weapons.reduce((sum, [, weaponId]) => sum + (data.weapons[weaponId]?.card.copies ?? 0), 0);
    const copies = this.deck.cardIds.reduce((sum, id) => sum + (data.cards[id]?.copies ?? 0), 0) + weaponCopies;
    const curve = Array.from({ length: 9 }, (_, cost) => this.deck.cardIds.filter((id) => data.cards[id]?.cost === cost).length);
    const size = this.deck.cardIds.length + weapons.length;
    const weaponNote = weapons.length > 0 ? ` (gồm ${weapons.length} lá Binh Khí)` : "";
    addText(this, this.root, 40, 560, `Deck ${size}/${data.metaConfig.deckSize}${weaponNote}  ·  Chồng bài ${copies} bản`, 15);
    addText(this, this.root, 40, 584, `Cost 0–8: ${curve.join(" · ")}`, 13, COLORS.dimText);
    addText(this, this.root, 40, 608, errors.length === 0 ? "✓ Deck hợp lệ" : `⚠ ${describeDeckError(data, errors[0]!)}`, 13, errors.length === 0 ? COLORS.gold : "#ff8080");
    for (let slot = 0; slot < data.metaConfig.maxRelics; slot++) {
      const relicId = this.deck.relicIds?.[slot];
      const relic = relicId ? data.relics[relicId] : undefined;
      const level = relicId ? session.profile.relics[relicId]?.resonance : undefined;
      const label = relic ? `☾ ${relic.name} · CM${level ?? "?"}` : `☾ Nguyệt Bảo ${slot + 1}: trống`;
      addButton(this, this.root, 130 + slot * 230, 660, 220, label, () => this.openPicker({ kind: "relic", slot }));
    }
    addButton(this, this.root, WIDTH - 470, 660, 140, "Đổi tên", () => {
      const name = window.prompt("Tên deck (tối đa 24 ký tự)", this.deck.name);
      if (name !== null) this.deck.name = name;
      this.render();
    });
    addButton(this, this.root, WIDTH - 310, 660, 140, "Lưu", () => {
      mutate("PUT", "/profile/decks", { draft: this.deck }).then(
        () => {
          session.editingDeck = null;
          this.scene.start("deck-select");
        },
        (error: unknown) => window.alert(errorText(error)),
      );
    });
    addButton(this, this.root, WIDTH - 150, 660, 140, "Hủy", () => {
      session.editingDeck = null;
      this.scene.start("deck-select");
    });
    this.renderPicker();
  }

  private openPicker(picker: NonNullable<DeckBuilderScene["picker"]>) {
    this.picker = picker;
    this.render();
  }

  private renderWeaponSlot(heroId: string, x: number, y: number) {
    const data = session.data;
    const weaponId = this.deck.weapons?.[heroId] ?? null;
    const weapon = weaponId ? data.weapons[weaponId] : undefined;
    const refinement = weaponId ? session.profile.weapons[weaponId]?.refinement : undefined;
    const label = weapon ? `⚔ ${weapon.name} · R${refinement ?? "?"}` : "⚔ Vũ khí: trống";
    addButton(this, this.root, x + (COLUMN_W - 20) / 2, y, COLUMN_W - 20, label, () => this.openPicker({ kind: "weapon", heroId }));
  }

  /** Owned weapons or relics to put in the open slot; "Bỏ trống" empties it. */
  private renderPicker() {
    const picker = this.picker;
    if (!picker) return;
    const data = session.data;
    const layer = this.add.container(0, 0).setDepth(300);
    this.root.add(layer);
    layer.add(this.add.rectangle(WIDTH / 2, 360, WIDTH, 720, 0x000000, 0.85).setInteractive());
    const close = () => {
      this.picker = null;
      this.render();
    };
    const title = picker.kind === "weapon" ? `Vũ khí cho ${data.heroes[picker.heroId]!.name}` : `Nguyệt Bảo ô ${picker.slot + 1}`;
    addText(this, layer, WIDTH / 2, 40, title, 20, COLORS.gold).setOrigin(0.5);
    const owned = picker.kind === "weapon"
      ? Object.keys(session.profile.weapons).filter((id) => data.weapons[id])
      : Object.keys(session.profile.relics).filter((id) => data.relics[id]);
    if (owned.length === 0) {
      addText(this, layer, WIDTH / 2, 120, picker.kind === "weapon" ? "Chưa có vũ khí — quay ở Binh Khí Các" : "Chưa có Nguyệt Bảo — quay ở Nguyệt Bảo Các", 15, COLORS.dimText).setOrigin(0.5);
    }
    owned.forEach((id, index) => {
      const y = 90 + index * 44;
      if (picker.kind === "weapon") {
        const def = data.weapons[id]!;
        const refinement = session.profile.weapons[id]!.refinement;
        const holder = Object.entries(this.deck.weapons ?? {}).find(([heroId, weaponId]) => weaponId === id && heroId !== picker.heroId)?.[0];
        const card = weaponCardDef(data, { heroId: picker.heroId, weaponId: id, refinement });
        const note = holder ? `  (đang gắn cho ${data.heroes[holder]?.name ?? holder} — sẽ chuyển)` : "";
        this.pickerRow(layer, y, `${def.name} · R${refinement} — lá ${card.name} (${card.cost})${note}`, RARITY_COLORS[def.rarity], () => {
          const weapons = { ...this.deck.weapons };
          if (holder) weapons[holder] = null;
          weapons[picker.heroId] = id;
          this.deck.weapons = weapons;
          close();
        }, card, [`Nội tại R1: ${def.text}`, ...def.refinement.slice(0, refinement - 1).map((level, index) => `R${index + 2}: ${level.text}`)]);
      } else {
        const def = data.relics[id]!;
        const resonance = session.profile.relics[id]!.resonance;
        const usedElsewhere = (this.deck.relicIds ?? []).some((relicId, slot) => relicId === id && slot !== picker.slot);
        const text = def.resonance[resonance - 1]?.text ?? "";
        this.pickerRow(layer, y, `${def.name} · Cộng Minh ${resonance} — ${text}${usedElsewhere ? "  (đã ở ô khác)" : ""}`, RARITY_COLORS[def.rarity], () => {
          if (usedElsewhere) return;
          const relicIds = [...(this.deck.relicIds ?? [])];
          relicIds[picker.slot] = id;
          this.deck.relicIds = relicIds.filter((relicId) => relicId !== undefined && relicId !== null);
          close();
        });
      }
    });
    addButton(this, layer, WIDTH / 2 - 110, 680, 200, "Bỏ trống", () => {
      if (picker.kind === "weapon") this.deck.weapons = { ...this.deck.weapons, [picker.heroId]: null };
      else this.deck.relicIds = (this.deck.relicIds ?? []).filter((_, slot) => slot !== picker.slot);
      close();
    });
    addButton(this, layer, WIDTH / 2 + 110, 680, 200, "Đóng", close);
  }

  private pickerRow(
    layer: Phaser.GameObjects.Container,
    y: number,
    label: string,
    color: number,
    onPick: () => void,
    card?: CardDef,
    extra: string[] = [],
  ) {
    const row = this.add.rectangle(WIDTH / 2, y, 1000, 38, 0x141b33).setStrokeStyle(1, color);
    row.setInteractive({ useHandCursor: true });
    row.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onPick();
    });
    if (card) {
      row.on("pointerover", () => {
        this.tooltip?.destroy();
        this.tooltip = showCardTooltip(this, WIDTH / 2 + 510, y, session.data, card, extra).setDepth(400);
      });
      row.on("pointerout", () => {
        this.tooltip?.destroy();
        this.tooltip = null;
      });
    }
    layer.add(row);
    layer.add(this.add.text(160, y, label, { ...TEXT_BASE, fontSize: "13px", color: COLORS.text, wordWrap: { width: 960 }, maxLines: 2 }).setOrigin(0, 0.5));
  }

  private renderRow(heroId: string, cardId: string, x: number, y: number) {
    const data = session.data;
    const card = data.cards[cardId]!;
    const unlocked = this.isUnlocked(heroId, cardId);
    const inDeck = this.deck.cardIds.includes(cardId);
    const row = this.add.rectangle(x, y, COLUMN_W - 20, ROW_H - 4, inDeck ? 0x2a3a70 : 0x141b33).setOrigin(0, 0.5);
    row.setStrokeStyle(1, inDeck ? (OWNER_COLORS[heroId] ?? COLORS.goldFill) : COLORS.panelBorder);
    this.root.add(row);
    const label = `${card.cost} · ${card.name}${unlocked ? "" : "  🔒"}${inDeck ? "  ✓" : ""}`;
    addText(this, this.root, x + 10, y, label, 13, unlocked ? COLORS.text : COLORS.dimText).setOrigin(0, 0.5);
    addText(this, this.root, x + COLUMN_W - 30, y, `×${card.copies}`, 11, COLORS.dimText).setOrigin(1, 0.5);
    if (!unlocked) row.setAlpha(0.5);
    row.setInteractive({ useHandCursor: unlocked });
    row.on("pointerover", () => {
      this.tooltip?.destroy();
      this.tooltip = showCardTooltip(this, x + COLUMN_W - 10, y, data, cardId);
    });
    row.on("pointerout", () => {
      this.tooltip?.destroy();
      this.tooltip = null;
    });
    row.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0 && unlocked) this.toggle(cardId);
    });
  }
}
