import Phaser from "phaser";
import { validateDeck, weaponCardDef } from "rules";
import type { CardDef, DeckError } from "rules";
import manifest from "virtual:assets-manifest";
import { auth } from "../api";
import { errorText, mutate, type ProfileReply } from "../account";
import { session } from "../session";
import { showCardTooltip, showTextTooltip } from "../ui/card-tooltip";
import { cardArtCandidates, ellipsize } from "../ui/combat-card-view";
import { loadCombatSettings } from "../ui/combat-settings";
import { DeckDraftSave } from "../ui/deck-builder-save";
import { matchesBuilderCard, type BuilderFilters } from "../ui/deck-builder-filter";
import { summarizeDeck } from "../ui/deck-presentation";
import { addEquipmentArt, preloadEquipmentArt, type EquipmentCategory } from "../ui/equipment-art";
import { HomeControls } from "../ui/home-controls";
import { roundedPanel } from "../ui/rounded-panel";
import { queueTexture } from "../ui/texture-queue";
import { COLORS, FACTION_LABELS, RARITY_COLORS, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, confirmModal, isModalOpen, RowScroller, type ButtonOptions } from "../ui/widgets";
import { describeDeckError } from "./deck-select-scene";

const WIDTH = 1280, COLUMN_W = 296, COLUMN_STEP = 308, ROW_H = 42, LIST_Y = 250, VISIBLE_ROWS = 8, SIDEBAR_X = 964;
const JADE = "#94d9bb";
type Picker = { kind: "weapon"; heroId: string } | { kind: "relic"; slot: number };
type CatalogRow = { branch: string } | { cardId: string };
interface CardPreview { card: CardDef; sourceX: number; unlocked: boolean; extra: string[]; pinned: boolean }

export class DeckBuilderScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private picker: Picker | null = null;
  private gearPage = 0;
  private gearPreview: string | null = null;
  private pvpView = false;
  private generation = 0;
  private controls!: HomeControls;
  private saving!: DeckDraftSave;
  private filters: BuilderFilters = { query: "", cost: null, unlockedOnly: false, selectedOnly: false };
  private scrolls: RowScroller[] = [];
  private errorsScroll!: RowScroller;
  private fields: { name: HTMLInputElement; search: HTMLInputElement } | null = null;
  private collapsed = new Set<string>();
  private focusedHero: string | null = null;
  private artJobs = new Set<string>();
  private failedArt = new Set<string>();
  private cardPreview: CardPreview | null = null;

  constructor() { super("deck-builder"); }
  preload() { preloadEquipmentArt(this); }
  create() {
    useDesignCamera(this);
    if (!session.editingDeck) { this.scene.start("deck-select"); return; }
    this.generation++;
    const generation = this.generation, authGeneration = auth.generation;
    this.picker = null; this.gearPage = 0; this.gearPreview = null; this.pvpView = false;
    this.filters = { query: "", cost: null, unlockedOnly: false, selectedOnly: false };
    this.collapsed.clear(); this.focusedHero = null; this.artJobs.clear(); this.failedArt.clear(); this.cardPreview = null;
    const reduced = loadCombatSettings(localStorage, window.matchMedia("(prefers-reduced-motion: reduce)").matches).reducedMotion;
    this.controls = new HomeControls(this, reduced, () => isModalOpen() || this.saving?.busy || !!this.cardPreview?.pinned);
    this.saving = new DeckDraftSave({
      deck: () => this.deck, online: () => session.online, valid: () => this.errors.length === 0,
      current: () => this.isCurrent(authGeneration, generation),
      request: (draft) => mutate<ProfileReply & { deckId: string }>("PUT", "/profile/decks", { draft }),
      activate: (id) => { session.selectedDeckId = id; session.editingDeck = null; this.scene.start("deck-select"); },
      changed: () => this.render(), error: errorText,
    });
    this.scrolls = this.deck.heroIds.map((_, index) => new RowScroller(this,
      { x: 32 + index * COLUMN_STEP, y: LIST_Y, width: COLUMN_W, height: ROW_H * VISIBLE_ROWS },
      () => this.render(), () => !this.picker && !this.saving.busy && !this.cardPreview?.pinned));
    this.errorsScroll = new RowScroller(this, { x: SIDEBAR_X + 12, y: 379, width: 256, height: 126 }, () => this.render(), () => !this.picker && !this.saving.busy && !this.cardPreview?.pinned);
    this.root = this.add.container(0, 0).setName("deck_editor");
    const view = visibleWorld(this);
    this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x07101f).setDepth(-1);
    this.createFields();
    const onEsc = () => {
      if (isModalOpen()) return;
      if (this.cardPreview?.pinned) { this.hideTip(true); return; }
      void this.back();
    };
    const onOutside = (pointer: Phaser.Input.Pointer) => {
      if (!this.cardPreview?.pinned || !this.tooltip) return;
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (!this.tooltip.getBounds().contains(point.x, point.y)) this.hideTip(true);
    };
    this.input.on("pointerdown", onOutside);
    this.input.keyboard?.on("keydown-ESC", onEsc);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      this.input.keyboard?.off("keydown-ESC", onEsc);
      this.input.off("pointerdown", onOutside);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.placeFields, this);
      this.events.off(Phaser.Scenes.Events.UPDATE, this.syncFields, this);
      this.fields?.name.remove(); this.fields?.search.remove(); this.fields = null;
      this.hideTip(true);
    });
    this.render();
  }
  private isCurrent(authGeneration: number, generation: number) {
    return auth.generation === authGeneration && this.generation === generation && this.scene.isActive();
  }
  private get deck() { return session.editingDeck!; }
  private get errors() { return validateDeck(session.data, session.profile, this.deck, this.pvpView ? { mode: "pvp" } : undefined); }
  private isUnlocked(heroId: string, cardId: string) {
    return session.data.heroes[heroId]!.cardIds.includes(cardId) || (session.profile.heroes[heroId]?.unlockedCardIds.includes(cardId) ?? false);
  }
  private createFields() {
    const field = (id: string, value: string, placeholder: string, maxLength: number) => {
      const input = document.createElement("input");
      input.id = id; input.value = value; input.placeholder = placeholder; input.maxLength = maxLength; input.setAttribute("aria-label", placeholder);
      input.style.cssText = "position:fixed;box-sizing:border-box;padding:0 12px;background:#102039;color:#e8ecf8;border:1px solid #71809a;border-radius:9px;font-family:sans-serif;z-index:10;outline-color:#d3bb83";
      input.addEventListener("keydown", (event) => { event.stopPropagation(); if (event.key === "Escape") input.blur(); });
      input.addEventListener("pointerdown", () => this.hideTip(true));
      document.body.appendChild(input); return input;
    };
    const name = field("vn-deck-name", this.deck.name, "Tên deck (tối đa 24 ký tự)", 24);
    const search = field("vn-deck-search", "", "Tìm tên hoặc mô tả lá", 80);
    name.addEventListener("input", () => { if (this.saving.busy) return; this.deck.name = name.value; this.render(); });
    search.addEventListener("input", () => { this.filters.query = search.value; this.resetScroll(); this.render(); });
    this.fields = { name, search };
    this.scale.on(Phaser.Scale.Events.RESIZE, this.placeFields, this);
    this.events.on(Phaser.Scenes.Events.UPDATE, this.syncFields, this); this.placeFields();
  }
  private placeFields() {
    if (!this.fields) return;
    const rect = this.game.canvas.getBoundingClientRect(), camera = this.cameras.main;
    const sx = rect.width / this.game.scale.width, sy = rect.height / this.game.scale.height;
    const place = (input: HTMLInputElement, x: number, y: number, width: number) => {
      input.style.left = `${rect.left + (camera.x + (x - camera.worldView.x) * camera.zoom) * sx}px`;
      input.style.top = `${rect.top + (camera.y + (y - camera.worldView.y) * camera.zoom) * sy}px`;
      input.style.width = `${width * camera.zoom * sx}px`; input.style.height = `${36 * camera.zoom * sy}px`;
      input.style.fontSize = `${14 * camera.zoom * sx}px`;
    };
    place(this.fields.name, 374, 18, 330); place(this.fields.search, 32, 90, 354);
  }
  private syncFields() {
    if (!this.fields) return;
    const hidden = !!this.picker || isModalOpen();
    for (const field of Object.values(this.fields)) { field.style.visibility = hidden ? "hidden" : "visible"; field.disabled = this.saving.busy; }
    if (this.saving.notice === "Đã lưu bản nháp" && !this.saving.dirty && this.fields.name.value !== this.deck.name) this.fields.name.value = this.deck.name;
    this.placeFields();
  }
  private resetScroll() { this.scrolls.forEach((scroll) => { scroll.first = 0; }); }
  private hideTip(force = false) {
    if (this.cardPreview?.pinned && !force) return;
    this.tooltip?.destroy(); this.tooltip = null; this.cardPreview = null;
  }
  private text(parent: Phaser.GameObjects.Container, x: number, y: number, text: string, size = 14, color: string = COLORS.text, width?: number) {
    const label = addText(this, parent, x, y, text, size, color); if (width) label.setWordWrapWidth(width); return label;
  }
  private button(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, action: () => void, enabled = true, name = "", options: ButtonOptions = {}, reason?: string) {
    const control = this.controls.button(parent, x, y, width, label, enabled, options);
    control.panel.setName(name); control.hit.setName(name ? `${name}_hit` : "");
    this.controls.bind(control.hit, control.panel, { enabled, activate: action, fill: control.fill, border: control.border, radius: 9,
      showTip: reason ? () => { if (this.cardPreview?.pinned) return; this.hideTip(); this.tooltip = showTextTooltip(this, Math.min(930, x - width / 2), y + 24, [reason], 280); } : undefined,
      hideTip: () => this.hideTip() });
    return control;
  }
  private render(preservePreview = false) {
    if (!this.root || !session.editingDeck) return;
    const preview = preservePreview ? this.cardPreview : null;
    this.hideTip(true); this.root.removeAll(true); this.controls.setLayer(this.root);
    const busy = this.saving.busy;
    this.button(this.root, 90, 36, 116, "‹ Trở về", () => void this.back(), !busy, "deck_editor_back");
    this.text(this.root, 166, 22, "Chỉnh sửa deck", 20, COLORS.gold);
    this.text(this.root, 716, 29, `${this.deck.name.length}/24`, 12, COLORS.dimText);
    const status = this.deck.id === "" ? "Bản sao mới · Chưa lưu" : this.saving.dirty ? "Có thay đổi chưa lưu" : "Đã lưu";
    this.text(this.root, 32, 65, status, 12, this.saving.dirty || !this.deck.id ? COLORS.gold : JADE).setName("deck_dirty_status");
    this.text(this.root, 770, 65, "Xem luật / chỉ số · không đổi nâng cấp tài khoản", 11, COLORS.dimText);
    this.button(this.root, 1018, 36, 100, this.pvpView ? "Thường" : "● Thường", () => { this.pvpView = false; this.render(); }, !busy, "deck_mode_normal");
    this.button(this.root, 1130, 36, 100, this.pvpView ? "● PvP" : "PvP", () => { this.pvpView = true; this.render(); }, !busy, "deck_mode_pvp");
    const costLabel = this.filters.cost === null ? "Lực: Tất cả" : `Lực: ${this.filters.cost === 8 ? "8+" : this.filters.cost}`;
    this.button(this.root, 466, 108, 142, costLabel, () => { this.filters.cost = this.filters.cost === null ? 0 : this.filters.cost === 8 ? null : this.filters.cost + 1; this.resetScroll(); this.render(); }, !busy, "deck_filter_cost");
    this.button(this.root, 614, 108, 132, `${this.filters.unlockedOnly ? "● " : ""}Đã mở`, () => { this.filters.unlockedOnly = !this.filters.unlockedOnly; this.resetScroll(); this.render(); }, !busy, "deck_filter_unlocked");
    this.button(this.root, 772, 108, 166, `${this.filters.selectedOnly ? "● " : ""}Đang trong deck`, () => { this.filters.selectedOnly = !this.filters.selectedOnly; this.resetScroll(); this.render(); }, !busy, "deck_filter_selected");
    this.button(this.root, 918, 108, 96, "Xóa lọc", () => { this.filters = { query: "", cost: null, unlockedOnly: false, selectedOnly: false }; if (this.fields) this.fields.search.value = ""; this.resetScroll(); this.render(); }, !busy, "deck_filter_reset");
    this.deck.heroIds.forEach((heroId, column) => this.renderHero(heroId, column));
    this.renderSidebar();
    this.text(this.root, 32, 697, "×N bản là số bản cố định trong chồng bài. Chọn / bỏ toàn bộ lá bằng một thao tác.", 12, COLORS.dimText);
    this.renderPicker(); this.syncFields();
    if (preview) this.showCard(preview.card, preview.sourceX, preview.unlocked, preview.extra, preview.pinned);
    this.queueArt();
  }
  private catalog(heroId: string): CatalogRow[] {
    const rows: CatalogRow[] = [];
    for (const branch of session.data.heroes[heroId]!.branches) {
      const cards = branch.cardIds.filter((id) => matchesBuilderCard(session.data.cards[id]!, this.filters, this.isUnlocked(heroId, id), this.deck.cardIds.includes(id)));
      if (!cards.length) continue;
      rows.push({ branch: branch.name });
      if (!this.collapsed.has(`${heroId}:${branch.name}`)) cards.forEach((cardId) => rows.push({ cardId }));
    }
    return rows;
  }
  private renderHero(heroId: string, column: number) {
    const data = session.data, hero = data.heroes[heroId]!, x = 32 + column * COLUMN_STEP;
    const panel = roundedPanel(this, x + COLUMN_W / 2, 415, COLUMN_W, 540, 0x0e1a2e, 1, this.focusedHero === heroId ? 0xd3bb83 : 0x445770, 14);
    panel.setName(`deck_hero_${heroId}`); this.root.add(panel);
    this.thumbnail(this.root, [`heroes:${heroId}`], x + 36, 181, 46, 54);
    this.text(this.root, x + 72, 157, hero.name, 17);
    this.text(this.root, x + 72, 183, FACTION_LABELS[hero.faction], 12, COLORS.dimText);
    const count = this.deck.cardIds.filter((id) => data.cards[id]?.ownerId === heroId).length, min = data.metaConfig.minCardsPerHero;
    this.text(this.root, x + 14, 215, count < min ? `${count}/${min} — thiếu ${min - count} lá` : `${count} lá · Tối thiểu ${min}`, 13, count < min ? "#ffa4a4" : JADE).setName(`deck_hero_count_${heroId}`);
    const rows = this.catalog(heroId), scroll = this.scrolls[column]!, [start, end] = scroll.range(rows.length, VISIBLE_ROWS);
    if (!rows.length) this.text(this.root, x + 18, 279, "Không có lá khớp bộ lọc", 13, COLORS.dimText);
    rows.slice(start, end).forEach((row, index) => {
      const y = LIST_Y + index * ROW_H + ROW_H / 2;
      if ("branch" in row) {
        const key = `${heroId}:${row.branch}`, collapsed = this.collapsed.has(key);
        const control = this.button(this.root, x + COLUMN_W / 2, y, COLUMN_W - 20, "", () => { if (collapsed) this.collapsed.delete(key); else this.collapsed.add(key); this.render(); }, !this.saving.busy, `deck_branch_${heroId}_${start + index}`);
        this.text(control.panel, -120, 0, `${collapsed ? "▸" : "▾"} ${row.branch}`, 12, COLORS.gold).setOrigin(0, 0.5);
      } else this.renderRow(heroId, row.cardId, x, y);
    });
    this.button(this.root, x + 46, 609, 66, "↑", () => scroll.scrollBy(-3), !this.saving.busy && start > 0, `deck_cards_up_${heroId}`);
    this.text(this.root, x + COLUMN_W / 2, 609, `${rows.length ? start + 1 : 0}–${end}/${rows.length}`, 11, COLORS.dimText).setOrigin(0.5);
    this.button(this.root, x + COLUMN_W - 46, 609, 66, "↓", () => scroll.scrollBy(3), !this.saving.busy && end < rows.length, `deck_cards_down_${heroId}`);
    this.renderWeaponSlot(heroId, x + 10, 658);
  }
  private thumbnail(parent: Phaser.GameObjects.Container, keys: string[], x: number, y: number, width: number, height: number) {
    parent.add(roundedPanel(this, x, y, width, height, 0x20334b, 1, 0x586681, 5));
    const key = keys.find((candidate) => this.textures.exists(candidate));
    if (key) { const image = this.add.image(x, y, key); image.setScale(Math.min(width / image.width, height / image.height)); parent.add(image); }
    else this.text(parent, x, y, "✦", 17, COLORS.dimText).setOrigin(0.5);
  }
  private showCard(card: CardDef, sourceX: number, unlocked = true, extra: string[] = [], pinned = false) {
    if (this.cardPreview?.pinned && !pinned) return;
    this.hideTip(true);
    this.cardPreview = { card, sourceX, unlocked, extra, pinned };
    this.tooltip = showCardTooltip(this, sourceX < 640 ? 924 : 32, 695, session.data, card,
      [`×${card.copies} bản cố định — chọn / bỏ cả lá`, ...(!unlocked ? ["🔒 Mở lá qua Tu Luyện của Hero"] : []), ...extra]).setDepth(400);
    if (pinned) {
      const background = this.tooltip.list[0] as Phaser.GameObjects.Container;
      this.tooltip.add(this.add.rectangle(background.x, background.y, background.width, background.height, 0, 0).setInteractive().setName("deck_preview_blocker"));
    }
    this.queueArt();
  }
  private renderRow(heroId: string, cardId: string, x: number, y: number) {
    const card = session.data.cards[cardId]!, unlocked = this.isUnlocked(heroId, cardId), inDeck = this.deck.cardIds.includes(cardId);
    const fill = inDeck ? 0x173b3c : unlocked ? 0x16253e : 0x20293a;
    const panel = roundedPanel(this, x + COLUMN_W / 2, y, COLUMN_W - 20, ROW_H - 4, fill, 1, inDeck ? 0x6cbea3 : 0x425570, 8);
    this.root.add(panel); panel.setName(`deck_card_${cardId}`);
    const hit = this.add.rectangle(0, 0, COLUMN_W - 20, ROW_H - 4, 0, 0).setName(`deck_card_hit_${cardId}`); panel.add(hit);
    this.thumbnail(panel, cardArtCandidates(session.data, card, cardId), -114, 0, 32, 32);
    panel.add(this.add.circle(-88, 8, 10, 0x27374a).setStrokeStyle(1, 0xc9b074));
    this.text(panel, -88, 8, `${card.cost}`, 11, COLORS.gold).setOrigin(0.5);
    this.text(panel, -71, -14, ellipsize(this, card.name, 146, 14, 1), 14);
    this.text(panel, -71, 5, unlocked ? `${inDeck ? "Đã chọn · " : ""}×${card.copies} bản` : "🔒 Mở qua Tu Luyện", 10, inDeck ? JADE : COLORS.dimText);
    const info = this.text(panel, 88, 0, "ⓘ", 17, COLORS.dimText).setOrigin(0.5).setName(`deck_card_info_${cardId}`);
    this.controls.info(info, () => this.showCard(card, x, unlocked), () => this.hideTip());
    info.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) this.showCard(card, x, unlocked, [], true); });
    this.text(panel, 116, 0, unlocked ? inDeck ? "−" : "+" : "🔒", 17, inDeck ? JADE : COLORS.gold).setOrigin(0.5);
    this.controls.bind(hit, panel, { enabled: unlocked && !this.saving.busy, activate: () => this.toggle(cardId), fill, border: inDeck ? 0x6cbea3 : 0x425570, radius: 8,
      showTip: () => this.showCard(card, x, unlocked), hideTip: () => this.hideTip() });
  }
  private toggle(cardId: string) {
    if (this.saving.busy) return;
    const index = this.deck.cardIds.indexOf(cardId);
    if (index >= 0) this.deck.cardIds.splice(index, 1); else this.deck.cardIds.push(cardId);
    this.saving.notice = ""; this.render();
  }
  private renderWeaponSlot(heroId: string, x: number, y: number) {
    const weaponId = this.deck.weapons?.[heroId], weapon = weaponId ? session.data.weapons[weaponId] : undefined;
    const level = this.pvpView ? 1 : weaponId ? session.profile.weapons[weaponId]?.refinement : undefined;
    const control = this.button(this.root, x + 138, y, 276, "", () => this.openPicker({ kind: "weapon", heroId }), !this.saving.busy, `deck_weapon_${heroId}`);
    if (weaponId) addEquipmentArt(this, control.panel, "weapons", weaponId, -108, 0, 40, 34);
    this.text(control.panel, -78, -13, weapon ? ellipsize(this, weapon.name, 185, 12, 1) : "+ Gắn vũ khí", 12, weapon ? COLORS.text : COLORS.gold);
    this.text(control.panel, -78, 5, weapon ? `R${level ?? "?"} · 1 ô deck · ×${weapon.card.copies} bản` : "Vũ khí chiếm 1 ô deck", 10, COLORS.dimText);
  }
  private renderSidebar() {
    const data = session.data, summary = summarizeDeck(data, this.deck, { profile: session.profile, mode: this.pvpView ? "pvp" : undefined }), errors = this.errors, x = SIDEBAR_X;
    this.root.add(roundedPanel(this, x + 140, 415, 280, 540, 0x101f34, 1, 0x726449, 14));
    this.text(this.root, x + 16, 160, "Tổng quan", 17, COLORS.gold);
    this.text(this.root, x + 16, 194, `${summary.slots}/${data.metaConfig.deckSize} ô deck`, 21, summary.slots === data.metaConfig.deckSize ? JADE : "#ffa4a4").setName("deck_slots");
    this.text(this.root, x + 16, 225, `${summary.copies} bản trong chồng bài`, 13).setName("deck_copies");
    this.text(this.root, x + 16, 247, `Nguyệt Lực TB ${summary.averageCost.toFixed(1)} · gồm vũ khí`, 12, COLORS.dimText);
    this.text(this.root, x + 16, 269, "Đường cong · số bản", 12, COLORS.dimText);
    const max = Math.max(1, ...summary.curve);
    summary.curve.forEach((count, index) => {
      const bx = x + 26 + index * 28, h = count ? Math.max(3, count / max * 29) : 1;
      this.root.add(this.add.rectangle(bx, 332 - h / 2, 17, h, count ? 0x6dbb9f : 0x35445b));
      this.text(this.root, bx, 328 - h, `${count}`, 9).setOrigin(0.5, 1);
      this.text(this.root, bx, 340, index === 8 ? "8+" : `${index}`, 10, COLORS.dimText).setOrigin(0.5);
    });
    this.text(this.root, x + 16, 357, errors.length ? `${errors.length} mục cần chỉnh · ${this.pvpView ? "PvP" : "Thường"}` : `Sẵn sàng · ${this.pvpView ? "PvP" : "Thường"}`, 13, errors.length ? "#ffa4a4" : JADE).setName("deck_validation_status");
    const [start, end] = this.errorsScroll.range(errors.length, 3);
    errors.slice(start, end).forEach((error, index) => {
      const control = this.button(this.root, x + 140, 395 + index * 42, 248, "", () => this.focusError(error), !this.saving.busy, `deck_error_${start + index}`);
      this.text(control.panel, -114, 0, ellipsize(this, describeDeckError(data, error), 226, 11, 2), 11, "#ffb1a8", 226).setOrigin(0, 0.5);
    });
    if (errors.length > 3) {
      this.button(this.root, x + 225, 520, 66, "↓ lỗi", () => this.errorsScroll.scrollBy(3), end < errors.length, "deck_errors_next");
      this.button(this.root, x + 55, 520, 66, "↑ lỗi", () => this.errorsScroll.scrollBy(-3), start > 0, "deck_errors_previous");
    } else this.text(this.root, x + 16, 504, errors.length ? "Chọn một lỗi để đến vị trí cần sửa" : "Có thể lưu và dùng đội hình này", 11, COLORS.dimText, 248);
    for (let slot = 0; slot < Math.min(2, data.metaConfig.maxRelics); slot++) {
      const id = this.deck.relicIds?.[slot], relic = id ? data.relics[id] : undefined;
      const panel = roundedPanel(this, x + 76 + slot * 128, 584, 116, 86, 0x14263c, 1, 0x68778e, 10);
      this.root.add(panel); panel.setName(`deck_relic_${slot}`);
      const hit = this.add.rectangle(0, 0, 116, 86, 0, 0); panel.add(hit);
      if (id) addEquipmentArt(this, panel, "relics", id, 0, -11, 46, 42); else this.text(panel, 0, -12, "+", 24, COLORS.gold).setOrigin(0.5);
      this.text(panel, 0, 17, relic ? ellipsize(this, relic.name, 106, 11, 1) : `Nguyệt Bảo ${slot + 1}`, 11).setOrigin(0.5);
      if (id) this.text(panel, 0, 33, `CM${this.pvpView ? 1 : session.profile.relics[id]?.resonance ?? "?"}`, 10, COLORS.dimText).setOrigin(0.5);
      this.controls.bind(hit, panel, { enabled: !this.saving.busy, activate: () => this.openPicker({ kind: "relic", slot }), radius: 10 });
    }
    const reason = this.saving.disabledReason;
    this.button(this.root, x + 140, 654, 248, this.saving.busy ? "Đang lưu…" : errors.length ? "Lưu bản nháp" : "Lưu và dùng", () => void this.saving.save(), !reason, "deck_editor_save", { variant: "primary" }, reason || (errors.length ? "Lưu bản nháp; giữ nguyên đội hình đang dùng" : "Lưu rồi dùng đội hình này trên Home"));
    this.text(this.root, x + 16, 684, this.saving.notice || reason, 11, this.saving.notice === "Đã lưu bản nháp" ? JADE : COLORS.dimText, 248).setName("deck_save_notice");
  }
  private focusError(error: DeckError) {
    if (this.saving.busy) return;
    if ("relicId" in error || error.code === "tooManyRelics") { this.openPicker({ kind: "relic", slot: 0 }); return; }
    if ("weaponId" in error) { const heroId = Object.entries(this.deck.weapons ?? {}).find(([, id]) => id === error.weaponId)?.[0] ?? this.deck.heroIds[0]; this.openPicker({ kind: "weapon", heroId }); return; }
    if (error.code === "weaponSlot") { this.openPicker({ kind: "weapon", heroId: error.heroId }); return; }
    const heroId = "heroId" in error ? error.heroId : "cardId" in error ? session.data.cards[error.cardId]?.ownerId : this.deck.heroIds[0];
    this.focusedHero = heroId ?? null; this.filters = { query: "", cost: null, unlockedOnly: false, selectedOnly: false };
    if (this.fields) this.fields.search.value = "";
    if ("cardId" in error && heroId) {
      this.collapsed.clear(); const index = this.deck.heroIds.indexOf(heroId);
      if (index >= 0) this.scrolls[index]!.first = Math.max(0, this.catalog(heroId).findIndex((row) => "cardId" in row && row.cardId === error.cardId) - 1);
    } else this.resetScroll(); this.render();
  }
  private async back() {
    if (this.saving.busy) return;
    if (this.picker) { this.picker = null; this.gearPreview = null; this.render(); return; }
    const generation = this.generation, authGeneration = auth.generation;
    if (this.saving.dirty) { const answer = await confirmModal(this, "Deck có thay đổi chưa lưu. Bỏ các thay đổi này?", { label: "Bỏ thay đổi", danger: true }); if (!answer || !this.isCurrent(authGeneration, generation)) return; }
    session.editingDeck = null; this.scene.start("deck-select");
  }
  private openPicker(picker: Picker) { if (this.saving.busy) return; this.picker = picker; this.gearPage = 0; this.gearPreview = null; this.render(); }
  private renderPicker() {
    const picker = this.picker; if (!picker) return;
    const data = session.data, layer = this.add.container(0, 0).setDepth(300).setName("deck_gear_picker");
    this.root.add(layer); this.controls.setLayer(layer);
    layer.add(this.add.rectangle(640, 360, WIDTH, 720, 0x000000, 0.78).setInteractive());
    layer.add(roundedPanel(this, 640, 360, 1040, 624, 0x101d32, 1, 0x9b865d, 16));
    const close = () => { this.picker = null; this.gearPreview = null; this.render(); };
    this.text(layer, 148, 69, picker.kind === "weapon" ? `Vũ khí · ${data.heroes[picker.heroId]?.name ?? picker.heroId}` : `Nguyệt Bảo · ô ${picker.slot + 1}`, 20, COLORS.gold);
    this.text(layer, 148, 103, "Chọn hình để xem thông tin · Trang bị bằng nút xác nhận", 12, COLORS.dimText);
    this.button(layer, 1108, 80, 48, "×", close, true, "deck_gear_close");
    const owned = picker.kind === "weapon" ? Object.keys(session.profile.weapons).filter((id) => data.weapons[id]) : Object.keys(session.profile.relics).filter((id) => data.relics[id]);
    const free = this.pvpView ? (picker.kind === "weapon" ? data.pvpConfig.freeWeaponIds : data.pvpConfig.freeRelicIds).filter((id) => !owned.includes(id)) : [];
    const ids = [...owned, ...free], pages = Math.max(1, Math.ceil(ids.length / 6)); this.gearPage = Math.min(this.gearPage, pages - 1);
    const currentId = picker.kind === "weapon" ? this.deck.weapons?.[picker.heroId] : this.deck.relicIds?.[picker.slot];
    if (!this.gearPreview) this.gearPreview = currentId ?? ids[this.gearPage * 6] ?? null;
    if (!ids.length) this.text(layer, 150, 150, picker.kind === "weapon" ? "Chưa có vũ khí — quay ở Binh Khí Các" : "Chưa có Nguyệt Bảo — quay ở Nguyệt Bảo Các", 14, COLORS.dimText, 540);
    ids.slice(this.gearPage * 6, this.gearPage * 6 + 6).forEach((id, index) => {
      const category: EquipmentCategory = picker.kind === "weapon" ? "weapons" : "relics", def = data[category][id]!;
      const px = 238 + index % 3 * 182, py = 242 + Math.floor(index / 3) * 184, preview = this.gearPreview === id, equipped = currentId === id;
      const panel = roundedPanel(this, px, py, 168, 168, preview ? 0x27423f : 0x14263b, 1, preview ? 0x94d9bb : RARITY_COLORS[def.rarity], 12);
      layer.add(panel); panel.setName(`deck_gear_${id}`); const hit = this.add.rectangle(0, 0, 168, 168, 0, 0); panel.add(hit);
      addEquipmentArt(this, panel, category, id, 0, -19, 120, 98);
      this.text(panel, 0, 45, ellipsize(this, def.name, 152, 13, 1), 13).setOrigin(0.5);
      this.text(panel, 0, 66, equipped ? "Đang trang bị" : free.includes(id) ? "Miễn phí PvP · cấp 1" : "Đã sở hữu", 11, equipped ? JADE : COLORS.dimText).setOrigin(0.5);
      this.controls.bind(hit, panel, { enabled: !this.saving.busy, activate: () => { this.gearPreview = id; this.render(); }, fill: preview ? 0x27423f : 0x14263b, border: preview ? 0x94d9bb : RARITY_COLORS[def.rarity], radius: 12 });
    });
    this.button(layer, 240, 553, 100, "Trước", () => { this.gearPage--; this.render(); }, this.gearPage > 0, "deck_gear_previous");
    this.text(layer, 420, 553, `${this.gearPage + 1}/${pages}`, 13, COLORS.dimText).setOrigin(0.5);
    this.button(layer, 600, 553, 100, "Sau", () => { this.gearPage++; this.render(); }, this.gearPage < pages - 1, "deck_gear_next");
    const previewId = this.gearPreview; layer.add(roundedPanel(this, 925, 367, 390, 442, 0x0b1729, 1, 0x52637a, 12));
    let canEquip = !!previewId;
    if (previewId) {
      const category: EquipmentCategory = picker.kind === "weapon" ? "weapons" : "relics", def = data[category][previewId]!;
      addEquipmentArt(this, layer, category, previewId, 925, 240, 170, 150);
      this.text(layer, 748, 328, def.name, 18, COLORS.gold, 350);
      if (picker.kind === "weapon") {
        const weapon = data.weapons[previewId]!, refinement = this.pvpView ? 1 : session.profile.weapons[previewId]?.refinement ?? 1;
        const card = weaponCardDef(data, { heroId: picker.heroId, weaponId: previewId, refinement });
        const holder = Object.entries(this.deck.weapons ?? {}).find(([heroId, id]) => id === previewId && heroId !== picker.heroId)?.[0];
        this.text(layer, 748, 363, `R${refinement} · ${card.cost} Nguyệt Lực · ×${card.copies} bản`, 13, JADE);
        this.text(layer, 748, 394, weapon.text, 13, COLORS.text, 350);
        const info = this.text(layer, 748, 477, `ⓘ Lá vũ khí: ${card.name}`, 13, COLORS.gold, 350);
        const extra = [`Nội tại R1: ${weapon.text}`, ...weapon.refinement.slice(0, refinement - 1).map((level, index) => `R${index + 2}: ${level.text}`)];
        this.controls.info(info, () => this.showCard(card, 925, true, extra), () => this.hideTip());
        info.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) this.showCard(card, 925, true, extra, true); });
        if (holder) this.text(layer, 748, 518, `Đang gắn cho ${data.heroes[holder]?.name ?? holder}; trang bị sẽ chuyển vũ khí.`, 12, "#ffd6a2", 350);
      } else {
        const relic = data.relics[previewId]!, resonance = this.pvpView ? 1 : session.profile.relics[previewId]?.resonance ?? 1;
        const used = (this.deck.relicIds ?? []).some((id, index) => id === previewId && index !== picker.slot); canEquip = !used;
        this.text(layer, 748, 363, `Cộng Minh ${resonance}`, 13, JADE);
        this.text(layer, 748, 394, relic.resonance[resonance - 1]?.text ?? "", 13, COLORS.text, 350);
        if (used) this.text(layer, 748, 518, "Đã trang bị ở ô Nguyệt Bảo khác", 12, "#ffa4a4", 350);
      }
    } else this.text(layer, 750, 200, "Chọn một món để xem trước", 15, COLORS.dimText);
    this.button(layer, 925, 627, 350, currentId === previewId && !!previewId ? "Đang trang bị" : "Trang bị", () => { if (previewId) this.equip(picker, previewId); }, canEquip && currentId !== previewId, "deck_gear_equip", { variant: "primary" });
    this.button(layer, 240, 627, 190, "Bỏ trống", () => this.equip(picker, null), true, "deck_gear_clear");
    this.button(layer, 565, 627, 190, "Đóng", close, true, "deck_gear_done");
  }
  private equip(picker: Picker, id: string | null) {
    if (this.saving.busy) return;
    if (picker.kind === "weapon") {
      const weapons = { ...this.deck.weapons };
      if (id) for (const [heroId, equipped] of Object.entries(weapons)) if (equipped === id) weapons[heroId] = null;
      weapons[picker.heroId] = id; this.deck.weapons = weapons;
    } else {
      const relics = [...(this.deck.relicIds ?? [])];
      if (id) { if (relics.some((equipped, slot) => equipped === id && slot !== picker.slot)) return; relics[picker.slot] = id; } else relics.splice(picker.slot, 1);
      this.deck.relicIds = relics.filter((relic) => typeof relic === "string");
    }
    this.picker = null; this.gearPreview = null; this.saving.notice = ""; this.render();
  }
  /** Guard optional artwork by scene/login generation; absent files retain readable rows. */
  private queueArt() {
    if (!session.editingDeck) return;
    const generation = this.generation, authGeneration = auth.generation;
    const candidates: string[][] = this.deck.heroIds.map((id) => [`heroes:${id}`]);
    this.deck.heroIds.forEach((heroId, index) => {
      const first = this.scrolls[index]!.first;
      for (const row of this.catalog(heroId).slice(first, first + VISIBLE_ROWS)) {
        if ("cardId" in row) candidates.push(cardArtCandidates(session.data, session.data.cards[row.cardId], row.cardId));
      }
    });
    if (this.cardPreview) candidates.push(cardArtCandidates(session.data, this.cardPreview.card, this.cardPreview.card.id));
    const jobs: Promise<unknown>[] = [];
    for (const keys of candidates) {
      for (const key of keys) {
        if (this.textures.exists(key)) break;
        if (this.failedArt.has(key)) continue;
        const [category, id] = key.split(":"), url = manifest[category!]?.[id!];
        if (!url) continue;
        if (!this.artJobs.has(key)) {
          this.artJobs.add(key);
          jobs.push(queueTexture(this, key, url).catch(() => { if (this.isCurrent(authGeneration, generation)) this.failedArt.add(key); }));
        }
        // Prefer one available primary image; only its failure unlocks a fallback.
        break;
      }
    }
    if (jobs.length) void Promise.allSettled(jobs).then(() => { if (this.isCurrent(authGeneration, generation)) this.render(true); });
  }
}
