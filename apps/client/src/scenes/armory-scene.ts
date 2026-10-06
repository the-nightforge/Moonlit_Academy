import Phaser from "phaser";
import { upgradeCost, weaponAt } from "rules";
import type { CardDef, UpgradeKind } from "rules";
import { errorText, mutate } from "../account";
import { session } from "../session";
import { showCardTooltip } from "../ui/card-tooltip";
import { addEquipmentArt, preloadEquipmentArt } from "../ui/equipment-art";
import { roundedPanel } from "../ui/rounded-panel";
import { COLORS, RARITY_COLORS, RARITY_LABELS, TEXT_BASE, useDesignCamera } from "../ui/theme";
import { addButton, addScreenHeader, addTabs, addText, showToast } from "../ui/widgets";

const WIDTH = 1280;
const MAX_LEVEL = 5;
const PAGE_SIZE = 10;
const DETAIL_X = 770;
const DETAIL_WIDTH = 460;
type Tab = "weapons" | "relics";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Weapons and moon relics: owned level, the weapon card and every level's change (`14` §13). */
export class ArmoryScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tab: Tab = "weapons";
  private selected = "";
  private page = 0;
  private tooltip: Phaser.GameObjects.Container | null = null;
  /** An upgrade request is in flight (the button stays disabled). */
  private busy = false;

  constructor() {
    super("armory");
  }

  preload() { preloadEquipmentArt(this); }

  create() {
    useDesignCamera(this);
    this.busy = false;
    this.root = this.add.container(0, 0);
    this.selectFirst();
    this.render();
  }

  private ids(): string[] {
    return Object.keys(this.tab === "weapons" ? session.data.weapons : session.data.relics);
  }

  private selectFirst() {
    this.page = 0;
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
    addScreenHeader(this, this.root, {
      title: "Kho đồ",
      back: { onBack: () => this.scene.start("deck-select") },
      currencies,
      extra: `Huyền Thiết ${currencies.darkIron} · Nguyệt Trần ${currencies.moonDust}`,
    });
    addTabs(this, this.root, 230, 80, 182, (["weapons", "relics"] as const).map((tab) => ({
      label: tab === "weapons" ? "Binh Khí" : "Nguyệt Bảo",
      active: tab === this.tab,
      onClick: () => {
        this.tab = tab;
        this.selectFirst();
        this.render();
      },
    })));

    const ids = this.ids();
    const pages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
    this.page = Math.min(this.page, pages - 1);
    ids.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE).forEach((id, index) => {
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
      addEquipmentArt(this, this.root, this.tab, id, 65, y, 32, 36)?.setAlpha(level ? 1 : 0.55);
      addText(this, this.root, 90, y, def.name, 14).setOrigin(0, 0.5);
      const tag = this.tab === "weapons" ? "R" : "CM";
      addText(this, this.root, 405, y, level ? `${tag}${level}` : "chưa có", 13, level ? COLORS.gold : COLORS.dimText).setOrigin(1, 0.5);
    });
    if (pages > 1) {
      const move = (delta: number) => { this.page += delta; this.render(); };
      addButton(this, this.root, 95, 640, 105, "Trước", () => move(-1), this.page > 0);
      addText(this, this.root, 230, 640, `${this.page + 1}/${pages}`, 14, COLORS.dimText).setOrigin(0.5);
      addButton(this, this.root, 365, 640, 105, "Sau", () => move(1), this.page < pages - 1);
    }

    if (this.selected) {
      this.root.add(roundedPanel(this, 610, 427, 280, 432, 0x101b2c, 1, COLORS.panelBorder, 18));
      if (!addEquipmentArt(this, this.root, this.tab, this.selected, 610, 427, 256, 408)) {
        addText(this, this.root, 610, 416, "Chưa có art", 17, COLORS.dimText).setOrigin(0.5);
        addText(this, this.root, 610, 450, this.tab === "weapons" ? "Binh Khí" : "Nguyệt Bảo", 13, COLORS.dimText).setOrigin(0.5);
      }
      if (this.tab === "weapons") this.renderWeapon(this.selected);
      else this.renderRelic(this.selected);
    }
    addButton(this, this.root, 115, 680, 150, "Triệu Hồi", () => this.scene.start("gacha"));
  }

  private header(name: string, rarity: keyof typeof RARITY_LABELS, subtitle: string, level: number | undefined, tag: string) {
    const x = 470;
    addText(this, this.root, x, 118, name, 24, COLORS.gold);
    addText(this, this.root, x, 153, `${RARITY_LABELS[rarity]}  ·  ${subtitle}`, 13, COLORS.dimText).setWordWrapWidth(760);
    addText(this, this.root, x, 190, level ? `Đang có: ${tag} ${level}/${MAX_LEVEL}` : "Chưa sở hữu", 14, level ? COLORS.gold : "#ff8080");
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
    const x = DETAIL_X;
    const card = weaponAt(def, shown).card;
    const cardDef: CardDef = { ...card, id: def.id, ownerId: def.signatureHeroId ?? "" };
    const row = this.add.rectangle(x, 232, DETAIL_WIDTH, 40, 0x1f3a2a).setOrigin(0, 0.5).setStrokeStyle(1, 0xe08a3c);
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
    addText(this, this.root, x + 12, 232, `⚔ R${shown}: ${card.cost} · ${card.name} ×${card.copies}\nDi chuột để xem lá Binh Khí`, 13).setOrigin(0, 0.5).setWordWrapWidth(DETAIL_WIDTH - 24);

    addText(this, this.root, x, 266, "Tinh Luyện (quay trùng để tăng)", 14);
    let y = 296;
    const levels = [`Lá: ${def.card.text} — Nội tại: ${def.text}`, ...def.refinement.map((entry) => entry.text)];
    levels.forEach((text, index) => {
      const reached = owned !== undefined && owned > index;
      const line = this.add.text(x, y, `${reached ? "★" : "☆"} R${index + 1}. ${text}`, {
        ...TEXT_BASE, fontSize: "13px", color: reached ? COLORS.gold : COLORS.dimText, wordWrap: { width: DETAIL_WIDTH },
      });
      this.root.add(line);
      y += Math.max(40, line.height + 12);
    });
    this.renderUpgrade(id, "weapon", y + 8);
  }

  private renderRelic(id: string) {
    const def = session.data.relics[id]!;
    const owned = this.level(id);
    this.header(def.name, def.rarity, "Mang 2 Nguyệt Bảo mỗi deck; có hiệu lực mọi trận", owned, "Cộng Minh");
    const x = DETAIL_X;
    addText(this, this.root, x, 220, "Cộng Minh (quay trùng để tăng; mỗi cấp thay hẳn cấp trước)", 14).setWordWrapWidth(DETAIL_WIDTH);
    let y = 272;
    def.resonance.forEach((level, index) => {
      const current = owned === index + 1;
      const reached = owned !== undefined && owned > index;
      const line = this.add.text(x, y, `${current ? "▶" : reached ? "★" : "☆"} CM${index + 1}. ${level.text}`, {
        ...TEXT_BASE, fontSize: "13px", color: current ? COLORS.gold : reached ? COLORS.text : COLORS.dimText, wordWrap: { width: DETAIL_WIDTH },
      });
      this.root.add(line);
      y += Math.max(44, line.height + 12);
    });
    this.renderUpgrade(id, "relic", y + 8);
  }

  /**
   * Cost line and the Nâng Cấp button under the level list (`18` §5.4). The
   * shown cost is a client-side preview via `upgradeCost`; the server decides.
   * Nothing is drawn while the item is unowned.
   */
  private renderUpgrade(id: string, kind: UpgradeKind, y: number) {
    const level = this.level(id);
    if (level === undefined) return;
    const x = DETAIL_X;
    const cost = upgradeCost(session.data, kind, id, level);
    if (cost === null) {
      addText(this, this.root, x, y, "Đã đạt cấp tối đa", 15, COLORS.gold);
      return;
    }
    const material = kind === "weapon" ? "Huyền Thiết" : "Nguyệt Trần";
    const have = session.profile.currencies[kind === "weapon" ? "darkIron" : "moonDust"];
    const nextTag = kind === "weapon" ? `R${level + 1}` : `Cộng Minh ${level + 1}`;
    const enough = have >= cost;
    addText(
      this, this.root, x, y,
      `Nâng Cấp → ${nextTag} · giá ${cost} ${material} · đang có ${have}`,
      13, enough ? COLORS.text : "#ff8080",
    ).setWordWrapWidth(DETAIL_WIDTH);
    addButton(this, this.root, x + 90, y + 34, 180, "Nâng Cấp", () => this.upgrade(kind, id), session.online && enough && !this.busy);
  }

  /** `POST /api/profile/{weapons|relics}/:id/upgrade` (`16` §4.3); `mutate` swaps in the server profile + rev. */
  private upgrade(kind: UpgradeKind, id: string) {
    if (this.busy) return;
    this.busy = true;
    this.render();
    mutate("POST", `/profile/${kind === "weapon" ? "weapons" : "relics"}/${id}/upgrade`).then(
      () => {
        this.busy = false;
        this.render();
      },
      (error: unknown) => {
        this.busy = false;
        this.render();
        showToast(this, [errorText(error)]);
      },
    );
  }
}
