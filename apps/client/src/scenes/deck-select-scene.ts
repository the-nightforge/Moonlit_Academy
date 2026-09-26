import Phaser from "phaser";
import { bondCardsForTeam, deleteDeck, pendingUnlocks, starterDeck, validateDeck } from "rules";
import type { DeckError, GameData, SavedDeck } from "rules";
import { saveProfile } from "../profile-store";
import { restartSession, session, startRun } from "../session";
import type { Team } from "../session";
import { COLORS, OWNER_COLORS, TEXT_BASE, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";

const WIDTH = 1280;
const ROW_H = 38;
const LIST_TOP = 110;
const LIST_BOTTOM = 560;
const VISIBLE = Math.floor((LIST_BOTTOM - LIST_TOP) / ROW_H);

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

const teamKey = (heroIds: readonly string[]) => [...heroIds].sort().join("+");

export class DeckSelectScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private selected = "";
  private scroll = 0;
  private pickingTeam = false;
  private picked: string[] = [];

  constructor() {
    super("deck-select");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.selected = `starter:${teamKey(session.heroIds)}`;
    this.scroll = 0;
    this.pickingTeam = false;
    this.picked = [];
    this.render();
  }

  /** Starter row for every team seen in saved decks + the current team, then all saved decks. */
  private decks(): SavedDeck[] {
    const starters = new Map<string, SavedDeck>();
    const addStarter = (heroIds: readonly string[]) => {
      const key = teamKey(heroIds);
      if (starters.has(key)) return;
      starters.set(key, {
        id: `starter:${key}`,
        name: "Bộ cơ bản",
        heroIds: [...heroIds] as SavedDeck["heroIds"],
        cardIds: starterDeck(session.data, heroIds as Team),
      });
    };
    addStarter(session.heroIds);
    for (const deck of session.profile.decks) addStarter(deck.heroIds);
    return [...starters.values(), ...session.profile.decks];
  }

  private heroNames(heroIds: readonly string[]): string {
    return heroIds.map((id) => session.data.heroes[id]?.name ?? id).join(" · ");
  }

  private render() {
    this.root.removeAll(true);
    if (this.pickingTeam) {
      this.renderPickTeam();
      return;
    }
    const data = session.data;
    addText(this, this.root, WIDTH / 2, 30, "Chọn deck", 26, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 62, "Đội đi theo deck — mỗi deck mang 3 Hero của nó", 13, COLORS.dimText).setOrigin(0.5);

    const canUnlock = Object.keys(data.heroes).some((id) => pendingUnlocks(data, session.profile, id) > 0);
    addButton(this, this.root, WIDTH - 100, 30, 160, `Tu Luyện${canUnlock ? " ●" : ""}`, () => this.scene.start("mastery"));

    const decks = this.decks();
    const maxScroll = Math.max(0, decks.length - VISIBLE);
    this.scroll = Math.min(this.scroll, maxScroll);
    decks.slice(this.scroll, this.scroll + VISIBLE).forEach((deck, index) => {
      const y = LIST_TOP + index * ROW_H;
      const errors = validateDeck(data, session.profile, deck);
      const avg = deck.cardIds.reduce((sum, id) => sum + (data.cards[id]?.cost ?? 0), 0) / Math.max(1, deck.cardIds.length);
      const isSelected = deck.id === this.selected;
      const row = this.add.rectangle(520, y, 780, 34, isSelected ? 0x2a3a70 : 0x141b33);
      row.setStrokeStyle(1, isSelected ? COLORS.goldFill : COLORS.panelBorder);
      row.setInteractive({ useHandCursor: true });
      row.on("pointerup", () => {
        this.selected = deck.id;
        this.render();
      });
      this.root.add(row);
      const status = errors.length === 0 ? "✓" : `⚠ ${describeDeckError(data, errors[0]!)}`;
      addText(this, this.root, 145, y, `${deck.name}  ·  ${this.heroNames(deck.heroIds)}  ·  cost TB ${avg.toFixed(1)}`, 13).setOrigin(0, 0.5);
      addText(this, this.root, 895, y, status, 12, errors.length === 0 ? COLORS.gold : "#ff8080").setOrigin(1, 0.5);
    });
    if (this.scroll > 0) {
      addButton(this, this.root, 520, LIST_TOP - 14, 780, "▲", () => {
        this.scroll -= 1;
        this.render();
      });
    }
    if (this.scroll < maxScroll) {
      addButton(this, this.root, 520, LIST_BOTTOM + 16, 780, "▼", () => {
        this.scroll += 1;
        this.render();
      });
    }

    addText(this, this.root, 1090, 84, "Trận lẻ: chọn trận", 13, COLORS.dimText).setOrigin(0.5);
    Object.values(data.encounters).forEach((encounter, index) => {
      const chosen = encounter.id === session.encounterId;
      addButton(this, this.root, 1090, 116 + index * 42, 200, `${encounter.name}${chosen ? " ✓" : ""}`, () => {
        session.encounterId = encounter.id;
        this.render();
      });
    });

    const deck = decks.find((entry) => entry.id === this.selected) ?? decks[0]!;
    const valid = validateDeck(data, session.profile, deck).length === 0;
    const starter = deck.id.startsWith("starter:");
    const y = 650;
    const play = () => {
      session.heroIds = [...deck.heroIds] as Team;
      startRun(session.heroIds, [...deck.cardIds]);
      this.scene.start("run");
    };
    const single = () => {
      session.heroIds = [...deck.heroIds] as Team;
      restartSession(session.seed, session.encounterId, session.heroIds, [...deck.cardIds]);
      this.scene.start("combat");
    };
    addButton(this, this.root, 200, y, 150, "Lượt chơi", play, valid);
    addButton(this, this.root, 360, y, 150, "Trận lẻ", single, valid);
    addButton(this, this.root, 520, y, 150, "Sửa", () => this.edit(deck), !starter);
    addButton(this, this.root, 680, y, 150, "Sao chép", () => this.edit({ ...deck, id: "", name: `${deck.name} (bản sao)`.slice(0, 24) }));
    addButton(this, this.root, 840, y, 150, "Xóa", () => {
      if (!window.confirm(`Xóa deck "${deck.name}"?`)) return;
      const result = deleteDeck(session.profile, deck.id);
      if (!result.ok) return;
      session.profile = result.profile;
      saveProfile(session.profile);
      this.selected = `starter:${teamKey(session.heroIds)}`;
      this.render();
    }, !starter);
    addButton(this, this.root, 1090, y, 200, "Deck mới", () => {
      this.pickingTeam = true;
      this.picked = [...session.heroIds];
      this.render();
    });
  }

  /** Compact team picker, only used to seed a brand-new deck's heroIds. */
  private renderPickTeam() {
    const data = session.data;
    addText(this, this.root, WIDTH / 2, 40, "Deck mới — chọn 3 Hero", 24, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 74, "Thứ tự chọn là vị trí trong đội", 13, COLORS.dimText).setOrigin(0.5);
    const heroes = Object.values(data.heroes);
    const spacing = 230;
    const startX = WIDTH / 2 - ((heroes.length - 1) * spacing) / 2;
    heroes.forEach((hero, index) => {
      const x = startX + index * spacing;
      const y = 280;
      const slot = this.picked.indexOf(hero.id);
      const panel = this.add.rectangle(x, y, 210, 110, COLORS.panelHero);
      panel.setStrokeStyle(slot >= 0 ? 3 : 1, slot >= 0 ? COLORS.goldFill : (OWNER_COLORS[hero.id] ?? COLORS.panelBorder));
      panel.setInteractive({ useHandCursor: true });
      panel.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) return;
        if (this.picked.includes(hero.id)) this.picked = this.picked.filter((id) => id !== hero.id);
        else if (this.picked.length < 3) this.picked.push(hero.id);
        this.render();
      });
      this.root.add(panel);
      if (slot >= 0) addText(this, this.root, x + 90, y - 42, `${slot + 1}`, 16, COLORS.gold).setOrigin(0.5);
      addText(this, this.root, x, y - 24, hero.name, 17).setOrigin(0.5);
      addText(this, this.root, x, y + 2, `HP ${hero.maxHp}`, 12, COLORS.dimText).setOrigin(0.5);
      this.root.add(
        this.add
          .text(x, y + 20, hero.branches.map((b) => b.name).join(" / "), { ...TEXT_BASE, fontSize: "11px", color: COLORS.dimText, align: "center", wordWrap: { width: 190 } })
          .setOrigin(0.5, 0),
      );
    });
    const bonds = bondCardsForTeam(data, this.picked);
    addText(
      this, this.root, WIDTH / 2, 380,
      bonds.length === 0 ? "Lá Song Hành: — không có —" : `Lá Song Hành: ${bonds.map((c) => c.name).join(" · ")}`,
      13, bonds.length > 0 ? COLORS.gold : COLORS.dimText,
    ).setOrigin(0.5);
    const ready = this.picked.length === 3;
    addButton(this, this.root, WIDTH / 2 - 110, 640, 200, ready ? "TẠO DECK" : `Chọn thêm ${3 - this.picked.length} Hero`, () => {
      if (!ready) return;
      const heroIds = [...this.picked] as Team;
      session.editingDeck = { id: "", name: "Deck mới", heroIds, cardIds: starterDeck(session.data, heroIds) };
      this.scene.start("deck-builder");
    }, ready);
    addButton(this, this.root, WIDTH / 2 + 110, 640, 200, "Hủy", () => {
      this.pickingTeam = false;
      this.render();
    });
  }

  private edit(deck: SavedDeck) {
    session.editingDeck = { ...deck, cardIds: [...deck.cardIds], heroIds: [...deck.heroIds] as SavedDeck["heroIds"] };
    this.scene.start("deck-builder");
  }
}
