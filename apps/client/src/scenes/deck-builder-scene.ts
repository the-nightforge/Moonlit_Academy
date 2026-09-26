import Phaser from "phaser";
import { saveDeck, validateDeck } from "rules";
import { saveProfile, storage } from "../profile-store";
import { session } from "../session";
import { showCardTooltip } from "../ui/card-tooltip";
import { COLORS, OWNER_COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";
import { describeDeckError } from "./deck-select-scene";

const WIDTH = 1280;
const COLUMN_W = 400;
const ROW_H = 30;

export class DeckBuilderScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tooltip: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("deck-builder");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
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
    });
    const errors = validateDeck(data, session.profile, this.deck);
    const copies = this.deck.cardIds.reduce((sum, id) => sum + (data.cards[id]?.copies ?? 0), 0);
    const curve = Array.from({ length: 9 }, (_, cost) => this.deck.cardIds.filter((id) => data.cards[id]?.cost === cost).length);
    addText(this, this.root, 40, 560, `Deck ${this.deck.cardIds.length}/${data.metaConfig.deckSize}  ·  Chồng bài ${copies} bản`, 15);
    addText(this, this.root, 40, 584, `Cost 0–8: ${curve.join(" · ")}`, 13, COLORS.dimText);
    addText(this, this.root, 40, 608, errors.length === 0 ? "✓ Deck hợp lệ" : `⚠ ${describeDeckError(data, errors[0]!)}`, 13, errors.length === 0 ? COLORS.gold : "#ff8080");
    if (storage.failed) addText(this, this.root, 40, 632, "Không lưu được tiến trình (trình duyệt chặn lưu trữ)", 12, "#ff8080");
    addButton(this, this.root, WIDTH - 470, 660, 140, "Đổi tên", () => {
      const name = window.prompt("Tên deck (tối đa 24 ký tự)", this.deck.name);
      if (name !== null) this.deck.name = name;
      this.render();
    });
    addButton(this, this.root, WIDTH - 310, 660, 140, "Lưu", () => {
      const result = saveDeck(data, session.profile, this.deck);
      if (!result.ok) {
        window.alert(result.error === "invalid name" ? "Tên deck phải có 1–24 ký tự" : "Đã đạt số deck tối đa");
        return;
      }
      session.profile = result.profile;
      saveProfile(session.profile);
      session.editingDeck = null;
      this.scene.start("deck-select");
    });
    addButton(this, this.root, WIDTH - 150, 660, 140, "Hủy", () => {
      session.editingDeck = null;
      this.scene.start("deck-select");
    });
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
