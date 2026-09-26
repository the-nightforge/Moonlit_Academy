import Phaser from "phaser";
import { deleteDeck, starterDeck, validateDeck } from "rules";
import type { DeckError, GameData, SavedDeck } from "rules";
import { saveProfile } from "../profile-store";
import { restartSession, session, startRun } from "../session";
import { COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";

const WIDTH = 1280;

export function describeDeckError(data: GameData, error: DeckError): string {
  switch (error.code) {
    case "badHeroes":
      return "Deck phải có 3 Hero khác nhau";
    case "wrongSize":
      return `Deck cần đúng ${data.metaConfig.deckSize} lá (đang ${error.size})`;
    case "duplicateCard":
      return `Trùng lá: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    case "foreignCard":
      return `Lá không thuộc đội: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    case "tooFewForHero":
      return `${data.heroes[error.heroId]?.name ?? error.heroId} cần ít nhất ${data.metaConfig.minCardsPerHero} lá (đang ${error.count})`;
    case "lockedCard":
      return `Lá chưa mở: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    default: {
      const exhaustive: never = error;
      return String(exhaustive);
    }
  }
}

const sameTeam = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

export class DeckSelectScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private selected = "starter";

  constructor() {
    super("deck-select");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.selected = "starter";
    this.render();
  }

  private decks(): SavedDeck[] {
    const team = session.heroIds;
    const starter: SavedDeck = { id: "starter", name: "Bộ cơ bản", heroIds: [...team], cardIds: starterDeck(session.data, team) };
    return [starter, ...session.profile.decks.filter((deck) => sameTeam(deck.heroIds, team))];
  }

  private render() {
    this.root.removeAll(true);
    const data = session.data;
    const names = session.heroIds.map((id) => data.heroes[id]!.name).join(" · ");
    addText(this, this.root, WIDTH / 2, 30, "Chọn deck", 26, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 62, names, 14, COLORS.dimText).setOrigin(0.5);
    const decks = this.decks();
    decks.forEach((deck, index) => {
      const y = 110 + index * 40;
      const errors = validateDeck(data, session.profile, deck);
      const avg = deck.cardIds.reduce((sum, id) => sum + (data.cards[id]?.cost ?? 0), 0) / Math.max(1, deck.cardIds.length);
      const row = this.add.rectangle(WIDTH / 2, y, 760, 34, deck.id === this.selected ? 0x2a3a70 : 0x141b33);
      row.setStrokeStyle(1, deck.id === this.selected ? COLORS.goldFill : COLORS.panelBorder);
      row.setInteractive({ useHandCursor: true });
      row.on("pointerup", () => {
        this.selected = deck.id;
        this.render();
      });
      this.root.add(row);
      const status = errors.length === 0 ? "✓" : `⚠ ${describeDeckError(data, errors[0]!)}`;
      addText(this, this.root, WIDTH / 2 - 360, y, `${deck.name}  ·  cost TB ${avg.toFixed(1)}`, 14).setOrigin(0, 0.5);
      addText(this, this.root, WIDTH / 2 + 360, y, status, 12, errors.length === 0 ? COLORS.gold : "#ff8080").setOrigin(1, 0.5);
    });
    const deck = decks.find((entry) => entry.id === this.selected) ?? decks[0]!;
    const valid = validateDeck(data, session.profile, deck).length === 0;
    const starter = deck.id === "starter";
    const y = 640;
    addButton(this, this.root, WIDTH / 2 - 450, y, 150, "Lượt chơi", () => {
      startRun([...session.heroIds] as typeof session.heroIds, [...deck.cardIds]);
      this.scene.start("run");
    }, valid);
    addButton(this, this.root, WIDTH / 2 - 290, y, 150, "Trận lẻ", () => {
      restartSession(session.seed, session.encounterId, session.heroIds, [...deck.cardIds]);
      this.scene.start("combat");
    }, valid);
    addButton(this, this.root, WIDTH / 2 - 130, y, 150, "Sửa", () => this.edit(deck), !starter);
    addButton(this, this.root, WIDTH / 2 + 30, y, 150, "Sao chép", () => this.edit({ ...deck, id: "", name: `${deck.name} (bản sao)`.slice(0, 24) }));
    addButton(this, this.root, WIDTH / 2 + 190, y, 150, "Xóa", () => {
      if (!window.confirm(`Xóa deck "${deck.name}"?`)) return;
      const result = deleteDeck(session.profile, deck.id);
      if (!result.ok) return;
      session.profile = result.profile;
      saveProfile(session.profile);
      this.selected = "starter";
      this.render();
    }, !starter);
    addButton(this, this.root, WIDTH / 2 + 350, y, 150, "Deck mới", () =>
      this.edit({ id: "", name: "Deck mới", heroIds: [...session.heroIds] as SavedDeck["heroIds"], cardIds: starterDeck(data, session.heroIds) }),
    );
    addButton(this, this.root, 90, 30, 140, "◂ Chọn đội", () => this.scene.start("team-select"));
  }

  private edit(deck: SavedDeck) {
    session.editingDeck = { ...deck, cardIds: [...deck.cardIds], heroIds: [...deck.heroIds] as SavedDeck["heroIds"] };
    this.scene.start("deck-builder");
  }
}
