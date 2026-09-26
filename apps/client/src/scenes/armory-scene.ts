import Phaser from "phaser";
import { weaponAt } from "rules";
import type { CardDef } from "rules";
import { session } from "../session";
import { showCardTooltip } from "../ui/card-tooltip";
import { COLORS, RARITY_COLORS, RARITY_LABELS, TEXT_BASE, useDesignCamera } from "../ui/theme";
import { addButton, addCurrencyBar, addText } from "../ui/widgets";

const WIDTH = 1280;
const MAX_LEVEL = 5;
type Tab = "weapons" | "relics";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Weapons and moon relics: owned level, the weapon card and every level's change (`14` §13). */
export class ArmoryScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tab: Tab = "weapons";
  private selected = "";
  private tooltip: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("armory");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.selectFirst();
    this.render();
  }

  private ids(): string[] {
    return Object.keys(this.tab === "weapons" ? session.data.weapons : session.data.relics);
  }

  private selectFirst() {
    this.selected = this.ids()[0] ?? "";
  }

  private level(id: string): number | undefined {
    return this.tab === "weapons" ? session.profile.weapons[id]?.refinement : session.profile.relics[id]?.resonance;
  }

  private render() {
    this.root.removeAll(true);
    this.tooltip?.destroy();
    this.tooltip = null;
    const data = session.data;
    const currencies = session.profile.currencies;
    addText(this, this.root, WIDTH / 2, 28, "Kho đồ", 26, COLORS.gold).setOrigin(0.5);
    addCurrencyBar(this, this.root, 40, 28, currencies);
    addText(this, this.root, WIDTH - 40, 28, `Huyền Thiết ${currencies.darkIron} · Nguyệt Trần ${currencies.moonDust}`, 13, COLORS.dimText).setOrigin(1, 0.5);
    (["weapons", "relics"] as const).forEach((tab, index) => {
      const label = tab === "weapons" ? "Binh Khí" : "Nguyệt Bảo";
      addButton(this, this.root, 130 + index * 190, 80, 170, `${label}${tab === this.tab ? " ✓" : ""}`, () => {
        this.tab = tab;
        this.selectFirst();
        this.render();
      });
    });

    this.ids().forEach((id, index) => {
      const def = this.tab === "weapons" ? data.weapons[id]! : data.relics[id]!;
      const level = this.level(id);
      const y = 132 + index * 50;
      const chosen = id === this.selected;
      const row = this.add.rectangle(230, y, 380, 44, chosen ? 0x2a3a70 : 0x141b33).setAlpha(level ? 1 : 0.55);
      row.setStrokeStyle(chosen ? 2 : 1, chosen ? COLORS.goldFill : RARITY_COLORS[def.rarity]);
      row.setInteractive({ useHandCursor: true });
      row.on("pointerup", () => {
        this.selected = id;
        this.render();
      });
      this.root.add(row);
      addText(this, this.root, 55, y, def.name, 15).setOrigin(0, 0.5);
      const tag = this.tab === "weapons" ? "R" : "CM";
      addText(this, this.root, 405, y, level ? `${tag}${level}` : "chưa có", 13, level ? COLORS.gold : COLORS.dimText).setOrigin(1, 0.5);
    });

    if (this.selected) {
      if (this.tab === "weapons") this.renderWeapon(this.selected);
      else this.renderRelic(this.selected);
    }
    addButton(this, this.root, 90, 680, 140, "◂ Quay lại", () => this.scene.start("deck-select"));
    addButton(this, this.root, 250, 680, 150, "Triệu Hồi", () => this.scene.start("gacha"));
  }

  private header(name: string, rarity: keyof typeof RARITY_LABELS, subtitle: string, level: number | undefined, tag: string) {
    const x = 470;
    addText(this, this.root, x, 118, name, 24, COLORS.gold);
    addText(this, this.root, x, 150, `${RARITY_LABELS[rarity]}  ·  ${subtitle}`, 14, COLORS.dimText);
    addText(this, this.root, x, 174, level ? `Đang có: ${tag} ${level}/${MAX_LEVEL}` : "Chưa sở hữu", 15, level ? COLORS.gold : "#ff8080");
  }

  private renderWeapon(id: string) {
    const data = session.data;
    const def = data.weapons[id]!;
    const owned = this.level(id);
    const shown = owned ?? 1;
    const subtitle = def.signatureHeroId
      ? `Bản mệnh: ${data.heroes[def.signatureHeroId]?.name ?? def.signatureHeroId} (nội tại mạnh hơn khi Hero này mang)`
      : `Vũ khí chung (${capitalize(def.archetype ?? "")})`;
    this.header(def.name, def.rarity, subtitle, owned, "Tinh Luyện");
    const x = 470;
    const card = weaponAt(def, shown).card;
    const cardDef: CardDef = { ...card, id: def.id, ownerId: def.signatureHeroId ?? "" };
    const row = this.add.rectangle(x, 214, 700, 36, 0x1f3a2a).setOrigin(0, 0.5).setStrokeStyle(1, 0xe08a3c);
    row.setInteractive();
    row.on("pointerover", () => {
      this.tooltip?.destroy();
      this.tooltip = showCardTooltip(this, 900, 360, data, cardDef);
    });
    row.on("pointerout", () => {
      this.tooltip?.destroy();
      this.tooltip = null;
    });
    this.root.add(row);
    addText(this, this.root, x + 12, 214, `⚔ Lá Binh Khí R${shown}: ${card.cost} · ${card.name} ×${card.copies}  (di chuột để xem)`, 14).setOrigin(0, 0.5);

    addText(this, this.root, x, 256, "Tinh Luyện (quay trùng để tăng)", 15);
    const levels = [`Lá: ${def.card.text} — Nội tại: ${def.text}`, ...def.refinement.map((entry) => entry.text)];
    levels.forEach((text, index) => {
      const reached = owned !== undefined && owned > index;
      const line = this.add.text(x, 284 + index * 48, `${reached ? "★" : "☆"} R${index + 1}. ${text}`, {
        ...TEXT_BASE, fontSize: "13px", color: reached ? COLORS.gold : COLORS.dimText, wordWrap: { width: 760 },
      });
      this.root.add(line);
    });
  }

  private renderRelic(id: string) {
    const def = session.data.relics[id]!;
    const owned = this.level(id);
    this.header(def.name, def.rarity, "Mang 2 Nguyệt Bảo mỗi deck; có hiệu lực mọi trận", owned, "Cộng Minh");
    const x = 470;
    addText(this, this.root, x, 214, "Cộng Minh (quay trùng để tăng; mỗi cấp thay hẳn cấp trước)", 15);
    def.resonance.forEach((level, index) => {
      const current = owned === index + 1;
      const reached = owned !== undefined && owned > index;
      const line = this.add.text(x, 244 + index * 52, `${current ? "▶" : reached ? "★" : "☆"} CM${index + 1}. ${level.text}`, {
        ...TEXT_BASE, fontSize: "13px", color: current ? COLORS.gold : reached ? COLORS.text : COLORS.dimText, wordWrap: { width: 760 },
      });
      this.root.add(line);
    });
  }
}
