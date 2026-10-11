import Phaser from "phaser";
import { validateDeck, weaponCardDef } from "rules";
import type { CardDef, DeckError, Rarity, RelicDef } from "rules";
import manifest from "virtual:assets-manifest";
import { auth } from "../api";
import { errorText, mutate, type ProfileReply } from "../account";
import { session } from "../session";
import { showCardTooltip, showTextTooltip } from "../ui/card-tooltip";
import { cardArtCandidates, ellipsize, roundedArtTexture } from "../ui/combat-card-view";
import { loadCombatSettings } from "../ui/combat-settings";
import { DeckDraftSave } from "../ui/deck-builder-save";import { summarizeDeck } from "../ui/deck-presentation";
import { addEquipmentArt, addRoundedEquipmentArt, preloadEquipmentArt, type EquipmentCategory } from "../ui/equipment-art";
import { HomeControls } from "../ui/home-controls";
import { preloadActionIcons, type ActionIcon } from "../ui/action-icon";
import { roundedPanel } from "../ui/rounded-panel";
import { queueTexture } from "../ui/texture-queue";
import { COLORS, FACTION_LABELS, RARITY_COLORS, RENDER_SCALE, TEXT_BASE, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, confirmModal, isModalOpen, RowScroller, type ButtonOptions } from "../ui/widgets";
import { describeDeckError } from "./deck-select-scene";

const WIDTH = 1280, COLUMN_W = 296, COLUMN_STEP = 308, ROW_H = 52, LIST_Y = 200, VISIBLE_ROWS = 9, SIDEBAR_X = 964;
const JADE = "#94d9bb";
const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "common"];
type Picker = { kind: "weapon"; heroId: string } | { kind: "relic"; slot: number };
type CatalogRow = { branch: string } | { cardId: string };
interface CardPreview { card: CardDef; sourceX: number; unlocked: boolean; extra: string[]; pinned: boolean }

export class DeckBuilderScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private picker: Picker | null = null;
  private gearPage = 0;
  private gearPreview: string | null = null;
  private generation = 0;
  private controls!: HomeControls;
  private saving!: DeckDraftSave;
  private scrolls: RowScroller[] = [];
  private errorsScroll!: RowScroller;
  private fields: { name: HTMLInputElement } | null = null;
  private collapsed = new Set<string>();
  private focusedHero: string | null = null;
  private artJobs = new Set<string>();
  private failedArt = new Set<string>();
  private cardPreview: CardPreview | null = null;

  constructor() { super("deck-builder"); }
  preload() {
    preloadEquipmentArt(this); preloadActionIcons(this);
    for (const id of ["home", "background"]) {
      const key = `backgrounds:${id}`, url = manifest.backgrounds?.[id];
      if (url && !this.textures.exists(key)) this.load.image(key, url);
    }
  }
  create() {
    useDesignCamera(this);
    if (!session.editingDeck) { this.scene.start("deck-select"); return; }
    this.generation++;
    const generation = this.generation, authGeneration = auth.generation;
    this.picker = null; this.gearPage = 0; this.gearPreview = null;
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
    this.errorsScroll = new RowScroller(this, { x: SIDEBAR_X + 12, y: 420, width: 256, height: 176 }, () => this.render(), () => !this.picker && !this.saving.busy && !this.cardPreview?.pinned);
    this.root = this.add.container(0, 0).setName("deck_editor");
    this.createBackground();
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
      this.fields?.name.remove(); this.fields = null;
      this.hideTip(true);
    });
    this.render();
  }
  private createBackground() {
    const base = this.add.rectangle(0, 0, 1, 1, 0x07101f).setDepth(-3);
    const key = ["backgrounds:home", "backgrounds:background"].find((key) => this.textures.exists(key));
    const art = key ? this.add.image(0, 0, key).setName("deck_editor_background").setDepth(-2) : null;
    const shade = this.add.rectangle(0, 0, 1, 1, 0x07101f, 0.62).setName("deck_editor_background_shade").setDepth(-1);
    const place = () => {
      const view = visibleWorld(this), cx = view.x + view.w / 2, cy = view.y + view.h / 2;
      base.setPosition(cx, cy).setSize(view.w, view.h);
      shade.setPosition(cx, cy).setSize(view.w, view.h);
      if (art) art.setPosition(cx, cy).setScale(Math.max(view.w / art.width, view.h / art.height));
    };
    place();
    this.scale.on(Phaser.Scale.Events.RESIZE, place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, place));
  }
  private isCurrent(authGeneration: number, generation: number) {
    return auth.generation === authGeneration && this.generation === generation && this.scene.isActive();
  }
  private get deck() { return session.editingDeck!; }
  private get errors() { return validateDeck(session.data, session.profile, this.deck); }
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
    const name = field("vn-deck-name", this.deck.name, "Tên bộ bài (tối đa 24 ký tự)", 24);
    name.addEventListener("input", () => { if (this.saving.busy) return; this.deck.name = name.value; this.render(); });
    this.fields = { name };
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
    place(this.fields.name, 918, 18, 330);
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
  /** Relic hover: every resonance level, current one in gold (armory ▶/★/☆ marks). */
  private showResonanceTip(relic: RelicDef, owned: number | undefined, bounds: Phaser.Geom.Rectangle, width: number) {
    const view = visibleWorld(this);
    const content = this.add.container(0, 0);
    let y = 10;
    const line = (value: string, size: number, color: string) => {
      const node = this.add.text(12, y, value, { ...TEXT_BASE, fontSize: `${size}px`, color, wordWrap: { width: width - 24 } });
      content.add(node); y += node.height + 6;
    };
    line(relic.name, 13, COLORS.gold);
    relic.resonance.forEach((level, index) => {
      const current = owned === index + 1, reached = owned !== undefined && owned > index;
      line(`${current ? "▶" : reached ? "★" : "☆"} Cộng Minh ${index + 1}. ${level.text}`, 11, current ? COLORS.gold : reached ? COLORS.text : COLORS.dimText);
    });
    const height = y + 6;
    const panel = roundedPanel(this, width / 2, height / 2, width, height, 0x0a0e20, 0.96);
    const left = Phaser.Math.Clamp(bounds.centerX - width / 2, view.x + 8, view.x + view.w - width - 8);
    const top = bounds.bottom + 8 + height <= view.y + view.h - 8 ? bounds.bottom + 8 : Math.max(view.y + 8, bounds.top - height - 8);
    return this.add.container(left, top, [panel, content]).setDepth(1500).setName("text_tooltip");
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
  private iconButton(parent: Phaser.GameObjects.Container, x: number, y: number, icon: ActionIcon, label: string, action: () => void, enabled = true, name = "", reason?: string) {
    const control = this.controls.iconButton(parent, x, y, icon, label, enabled);
    control.panel.setName(name); control.hit.setName(name ? `${name}_hit` : "");
    const show = () => {
      if (this.cardPreview?.pinned) return;
      this.hideTip();
      const bounds = control.hit.getBounds(), view = visibleWorld(this), width = 260;
      const left = Phaser.Math.Clamp(bounds.centerX - width / 2, view.x + 8, view.x + view.w - width - 8);
      const tip = showTextTooltip(this, left, bounds.bottom + 8, [enabled ? label : this.saving.busy ? "Đang lưu…" : reason ?? label], width).setDepth(1500);
      const height = tip.getBounds().height;
      if (bounds.bottom + 8 + height > view.y + view.h - 8) tip.y = Math.max(view.y + 8, bounds.top - height - 8);
      this.tooltip = tip;
    };
    this.controls.bind(control.hit, control.panel, { enabled, activate: action, icon: control.icon, fill: control.fill, border: control.border, radius: 9, showTip: icon === "close" ? undefined : show, hideTip: () => this.hideTip() });
    return control;
  }
  private render(preservePreview = false) {
    if (!this.root || !session.editingDeck) return;
    const preview = preservePreview ? this.cardPreview : null;
    this.hideTip(true); this.root.removeAll(true); this.controls.setLayer(this.root);
    const busy = this.saving.busy;
    this.iconButton(this.root, 54, 36, "back", "Trở về", () => void this.back(), !busy, "deck_editor_back");
    this.text(this.root, 94, 22, "Chỉnh sửa bộ bài", 20, COLORS.gold);
    this.deck.heroIds.forEach((heroId, column) => this.renderHero(heroId, column));
    this.renderSidebar();
    this.renderPicker(); this.syncFields();
    if (preview) this.showCard(preview.card, preview.sourceX, preview.unlocked, preview.extra, preview.pinned);
    this.queueArt();
  }
  private catalog(heroId: string): CatalogRow[] {
    const rows: CatalogRow[] = [];
    for (const branch of session.data.heroes[heroId]!.branches) {
      const cards = branch.cardIds;
      if (!cards.length) continue;
      rows.push({ branch: branch.name });
      if (!this.collapsed.has(`${heroId}:${branch.name}`)) cards.forEach((cardId) => rows.push({ cardId }));
    }
    return rows;
  }
  private renderHero(heroId: string, column: number) {
    const data = session.data, hero = data.heroes[heroId]!, x = 32 + column * COLUMN_STEP;
    const panel = roundedPanel(this, x + COLUMN_W / 2, 390, COLUMN_W, 590, 0x0e1a2e, 1, this.focusedHero === heroId ? 0xd3bb83 : 0x445770, 14);
    panel.setName(`deck_hero_${heroId}`); this.root.add(panel);
    const portrait = this.add.container(x + 46, 141).setName(`deck_hero_art_${heroId}`);
    this.root.add(portrait);
    portrait.add(roundedPanel(this, 0, 0, 64, 80, 0x20334b, 1, 0x20334b, 10));
    const art = roundedArtTexture(this, `heroes:${heroId}`, 64, 80, 10);
    if (this.textures.exists(art)) portrait.add(this.add.image(0, 0, art).setScale(1 / RENDER_SCALE));
    else this.text(portrait, 0, 0, "✦", 24, COLORS.dimText).setOrigin(0.5);
    portrait.add(this.add.graphics().lineStyle(1.5, 0x7d90b8, 0.9).strokeRoundedRect(-31, -39, 62, 78, 9));
    this.text(this.root, x + 90, 126, hero.name, 18);
    this.text(this.root, x + 90, 152, FACTION_LABELS[hero.faction], 12, COLORS.dimText);
    const rows = this.catalog(heroId), scroll = this.scrolls[column]!, [start, end] = scroll.range(rows.length, VISIBLE_ROWS);
    if (!rows.length) this.text(this.root, x + 18, 229, "Chưa có lá nào", 13, COLORS.dimText);
    rows.slice(start, end).forEach((row, index) => {
      const y = LIST_Y + index * ROW_H + ROW_H / 2;
      if ("branch" in row) {
        const key = `${heroId}:${row.branch}`, collapsed = this.collapsed.has(key);
        const control = this.button(this.root, x + COLUMN_W / 2, y, COLUMN_W - 20, "", () => { if (collapsed) this.collapsed.delete(key); else this.collapsed.add(key); this.render(); }, !this.saving.busy, `deck_branch_${heroId}_${start + index}`);
        this.text(control.panel, -118, 0, row.branch, 12, COLORS.gold).setOrigin(0, 0.5);
        this.text(control.panel, 118, 0, collapsed ? "◂" : "▾", 12, COLORS.gold).setOrigin(1, 0.5);
      } else this.renderRow(heroId, row.cardId, x, y);
    });
    this.renderWeaponSlot(heroId, x + COLUMN_W - 46, 141);
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
    panel.add(roundedPanel(this, -112, 0, 32, 46, 0x20334b, 1, 0x20334b, 7));
    const artKey = cardArtCandidates(session.data, card, cardId).find((k) => this.textures.exists(k));
    const art = artKey ? roundedArtTexture(this, artKey, 32, 46, 7) : "";
    if (this.textures.exists(art)) panel.add(this.add.image(-112, 0, art).setScale(1 / RENDER_SCALE));
    else this.text(panel, -112, 0, "✦", 20, COLORS.dimText).setOrigin(0.5);
    panel.add(this.add.graphics().lineStyle(1, 0x7d90b8, 0.9).strokeRoundedRect(-127.5, -22.5, 31, 45, 6));
    panel.add(this.add.circle(-74, 0, 10, 0x27374a).setStrokeStyle(1, 0xc9b074));
    this.text(panel, -74, 0, `${card.cost}`, 11, COLORS.gold).setOrigin(0.5);
    this.text(panel, -56, unlocked ? 0 : -9, ellipsize(this, card.name, 128, 14, unlocked ? 2 : 1), 14).setOrigin(0, 0.5);
    if (!unlocked) this.text(panel, -56, 10, "🔒 Mở qua Tu Luyện", 10, COLORS.dimText).setOrigin(0, 0.5);
    const copies = this.text(panel, 98, 0, `×${card.copies}`, 12, COLORS.dimText).setOrigin(1, 0.5).setName(`deck_card_info_${cardId}`);
    this.controls.info(copies, () => this.showCard(card, x, unlocked), () => this.hideTip());
    copies.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) this.showCard(card, x, unlocked, [], true); });
    if (!unlocked) this.text(panel, 118, 0, "🔒", 15, COLORS.gold).setOrigin(0.5);
    else if (!inDeck) this.text(panel, 118, 0, "+", 17, COLORS.gold).setOrigin(0.5);
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
    const level = weaponId ? session.profile.weapons[weaponId]?.refinement : undefined;
    const panel = roundedPanel(this, x, y, 64, 80, 0x14263c, 1, weaponId ? 0x14263c : 0x5a6d88, 10);
    this.root.add(panel); panel.setName(`deck_weapon_${heroId}`);
    const hit = this.add.rectangle(0, 0, 64, 80, 0, 0).setName(`deck_weapon_${heroId}_hit`); panel.add(hit);
    const art = weaponId ? roundedArtTexture(this, `weapons:${weaponId}`, 64, 80, 10) : "";
    if (weaponId && this.textures.exists(art)) {
      panel.add(this.add.image(0, 0, art).setScale(1 / RENDER_SCALE));
      panel.add(this.add.graphics().lineStyle(1.5, 0x7d90b8, 0.9).strokeRoundedRect(-31, -39, 62, 78, 9));
    } else this.text(panel, 0, 0, weaponId ? "⚔" : "+", weaponId ? 24 : 28, COLORS.gold).setOrigin(0.5);
    this.controls.bind(hit, panel, { enabled: !this.saving.busy, activate: () => this.openPicker({ kind: "weapon", heroId }), radius: 10,
      showTip: () => {
        if (this.cardPreview?.pinned) return;
        this.hideTip();
        const bounds = hit.getBounds(), width = 280;
        const lines = weapon
          ? [weapon.name, `Tinh Luyện ${level ?? "?"} · 1 ô bộ bài · ×${weapon.card.copies} bản`, weapon.text]
          : ["Chưa gắn vũ khí", "Vũ khí chiếm 1 ô bộ bài"];
        this.tooltip = showTextTooltip(this, bounds.centerX - width / 2, bounds.bottom + 8, lines, width).setDepth(1500);
      },
      hideTip: () => this.hideTip() });
  }
  private renderSidebar() {
    const data = session.data, summary = summarizeDeck(data, this.deck, { profile: session.profile }), errors = this.errors, x = SIDEBAR_X;
    this.root.add(roundedPanel(this, x + 140, 390, 280, 590, 0x101f34, 1, 0x726449, 14));
    this.text(this.root, x + 16, 110, "Tổng quan", 17, COLORS.gold);
    this.text(this.root, x + 16, 144, `${summary.slots}/${data.metaConfig.deckSize} ô bộ bài`, 21, summary.slots === data.metaConfig.deckSize ? JADE : "#ffa4a4").setName("deck_slots");
    this.text(this.root, x + 16, 175, `${summary.cardCopies} bản trong chồng bài${summary.weaponCopies ? ` · +${summary.weaponCopies} binh khí` : ""}`, 13).setName("deck_copies");
    this.text(this.root, x + 16, 197, `Nguyệt Lực trung bình ${summary.averageCost.toFixed(1)} · gồm vũ khí`, 12, COLORS.dimText);
    for (let slot = 0; slot < Math.min(2, data.metaConfig.maxRelics); slot++) {
      const id = this.deck.relicIds?.[slot], relic = id ? data.relics[id] : undefined;
      const panel = roundedPanel(this, x + 76 + slot * 128, 258, 116, 86, 0x14263c, 1, 0x68778e, 10);
      this.root.add(panel); panel.setName(`deck_relic_${slot}`);
      const hit = this.add.rectangle(0, 0, 116, 86, 0, 0); panel.add(hit);
      if (id) addEquipmentArt(this, panel, "relics", id, 0, -11, 46, 42); else this.text(panel, 0, -12, "+", 24, COLORS.gold).setOrigin(0.5);
      this.text(panel, 0, 17, relic ? ellipsize(this, relic.name, 106, 11, 1) : `Nguyệt Bảo ${slot + 1}`, 11).setOrigin(0.5);
      if (id) this.text(panel, 0, 33, `Cộng Minh ${session.profile.relics[id]?.resonance ?? "?"}`, 10, COLORS.dimText).setOrigin(0.5);
      this.controls.bind(hit, panel, { enabled: !this.saving.busy, activate: () => this.openPicker({ kind: "relic", slot }), radius: 10,
        showTip: () => {
          if (this.cardPreview?.pinned) return;
          this.hideTip();
          const bounds = hit.getBounds(), width = 340;
          this.tooltip = relic
            ? this.showResonanceTip(relic, session.profile.relics[id!]?.resonance ?? 1, bounds, width)
            : showTextTooltip(this, bounds.centerX - width / 2, bounds.bottom + 8, ["Chưa gắn Nguyệt Bảo", "Nguyệt Bảo có hiệu lực mọi trận — tối đa 2 ô mỗi bộ bài"], width).setDepth(1500);
        },
        hideTip: () => this.hideTip() });
    }
    this.text(this.root, x + 16, 316, "Đường cong · số bản", 12, COLORS.dimText);
    const max = Math.max(1, ...summary.curve);
    summary.curve.forEach((count, index) => {
      const bx = x + 26 + index * 28, h = count ? Math.max(3, count / max * 29) : 1;
      this.root.add(this.add.rectangle(bx, 378 - h / 2, 17, h, count ? 0x6dbb9f : 0x35445b));
      this.text(this.root, bx, 374 - h, `${count}`, 9).setOrigin(0.5, 1);
      this.text(this.root, bx, 386, index === 8 ? "8+" : `${index}`, 10, COLORS.dimText).setOrigin(0.5);
    });
    this.text(this.root, x + 16, 403, errors.length ? `${errors.length} mục cần chỉnh` : "Sẵn sàng", 13, errors.length ? "#ffa4a4" : JADE).setName("deck_validation_status");
    const [start, end] = this.errorsScroll.range(errors.length, 4);
    errors.slice(start, end).forEach((error, index) => {
      const control = this.button(this.root, x + 140, 441 + index * 42, 248, "", () => this.focusError(error), !this.saving.busy, `deck_error_${start + index}`);
      this.text(control.panel, -114, 0, ellipsize(this, describeDeckError(data, error), 226, 11, 2), 11, "#ffb1a8", 226).setOrigin(0, 0.5);
    });
    if (errors.length > 4) {
      this.iconButton(this.root, x + 225, 608, "down", "Các lỗi tiếp theo", () => this.errorsScroll.scrollBy(3), !this.saving.busy && end < errors.length, "deck_errors_next", "Đã ở cuối danh sách lỗi");
      this.iconButton(this.root, x + 55, 608, "up", "Các lỗi trước", () => this.errorsScroll.scrollBy(-3), !this.saving.busy && start > 0, "deck_errors_previous", "Đã ở đầu danh sách lỗi");
    } else this.text(this.root, x + 16, 608, errors.length ? "Chọn một lỗi để đến vị trí cần sửa" : "Có thể lưu và dùng đội hình này", 11, COLORS.dimText, 248);
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
    this.focusedHero = heroId ?? null;
    if ("cardId" in error && heroId) {
      this.collapsed.clear(); const index = this.deck.heroIds.indexOf(heroId);
      if (index >= 0) this.scrolls[index]!.first = Math.max(0, this.catalog(heroId).findIndex((row) => "cardId" in row && row.cardId === error.cardId) - 1);
    } else this.resetScroll(); this.render();
  }
  private async back() {
    if (this.saving.busy) return;
    if (this.picker) { this.picker = null; this.gearPreview = null; this.render(); return; }
    const generation = this.generation, authGeneration = auth.generation;
    if (this.saving.dirty) { const answer = await confirmModal(this, "Bộ bài có thay đổi chưa lưu. Bỏ các thay đổi này?", { label: "Bỏ thay đổi", danger: true }); if (!answer || !this.isCurrent(authGeneration, generation)) return; }
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
    this.iconButton(layer, 1108, 80, "close", "Đóng", close, true, "deck_gear_close");
    const category: EquipmentCategory = picker.kind === "weapon" ? "weapons" : "relics";
    const rank = (id: string) => RARITY_ORDER.indexOf(data[category][id]!.rarity);
    const ids = (picker.kind === "weapon" ? Object.keys(session.profile.weapons) : Object.keys(session.profile.relics))
      .filter((id) => data[category][id])
      .sort((a, b) => rank(a) - rank(b) || data[category][a]!.name.localeCompare(data[category][b]!.name, "vi"));
    if (picker.kind === "weapon") ids.sort((a, b) => Number(data.weapons[b]?.signatureHeroId === picker.heroId) - Number(data.weapons[a]?.signatureHeroId === picker.heroId));
    const pages = Math.max(1, Math.ceil(ids.length / 6)); this.gearPage = Math.min(this.gearPage, pages - 1);
    const currentId = picker.kind === "weapon" ? this.deck.weapons?.[picker.heroId] : this.deck.relicIds?.[picker.slot];
    if (!this.gearPreview) this.gearPreview = currentId ?? ids[this.gearPage * 6] ?? null;
    if (!ids.length) this.text(layer, 150, 150, picker.kind === "weapon" ? "Chưa có vũ khí — quay ở Binh Khí Các" : "Chưa có Nguyệt Bảo — quay ở Nguyệt Bảo Các", 14, COLORS.dimText, 540);
    ids.slice(this.gearPage * 6, this.gearPage * 6 + 6).forEach((id, index) => {
      const def = data[category][id]!;
      const px = 238 + index % 3 * 194, py = 260 + Math.floor(index / 3) * 230, preview = this.gearPreview === id, equipped = currentId === id;
      const panel = roundedPanel(this, px, py, 180, 220, preview ? 0x27423f : 0x14263b, 1, preview ? 0x94d9bb : RARITY_COLORS[def.rarity], 12);
      layer.add(panel); panel.setName(`deck_gear_${id}`); const hit = this.add.rectangle(0, 0, 180, 220, 0, 0); panel.add(hit);
      addRoundedEquipmentArt(this, panel, category, id, 0, -28, 156, 140, 10);
      this.text(panel, 0, 52, ellipsize(this, def.name, 160, 13, 1), 13).setOrigin(0.5);
      this.text(panel, 0, 72, equipped ? "Đang trang bị" : "Đã sở hữu", 11, equipped ? JADE : COLORS.dimText).setOrigin(0.5);
      this.controls.bind(hit, panel, { enabled: !this.saving.busy, activate: () => { this.gearPreview = id; this.render(); }, fill: preview ? 0x27423f : 0x14263b, border: preview ? 0x94d9bb : RARITY_COLORS[def.rarity], radius: 12 });
    });
    this.iconButton(layer, 370, 627, "left", "Trước", () => { this.gearPage--; this.render(); }, this.gearPage > 0, "deck_gear_previous", "Đã ở trang đầu");
    this.text(layer, 432, 627, `${this.gearPage + 1}/${pages}`, 13, COLORS.dimText).setOrigin(0.5);
    this.iconButton(layer, 494, 627, "right", "Sau", () => { this.gearPage++; this.render(); }, this.gearPage < pages - 1, "deck_gear_next", "Đã ở trang cuối");
    const previewId = this.gearPreview; layer.add(roundedPanel(this, 925, 367, 390, 442, 0x0b1729, 1, 0x52637a, 12));
    let canEquip = !!previewId;
    if (previewId) {
      const def = data[category][previewId]!;
      addRoundedEquipmentArt(this, layer, category, previewId, 925, 240, 170, 150, 12);
      this.text(layer, 748, 328, def.name, 18, COLORS.gold, 350);
      if (picker.kind === "weapon") {
        const weapon = data.weapons[previewId]!, refinement = session.profile.weapons[previewId]?.refinement ?? 1;
        const card = weaponCardDef(data, { heroId: picker.heroId, weaponId: previewId, refinement });
        const holder = Object.entries(this.deck.weapons ?? {}).find(([heroId, id]) => id === previewId && heroId !== picker.heroId)?.[0];
        this.text(layer, 748, 363, `Tinh Luyện ${refinement} · ${card.cost} Nguyệt Lực · ×${card.copies} bản`, 13, JADE);
        let dy = 388;
        [`Lá: ${weapon.card.text} — Nội tại: ${weapon.text}`, ...weapon.refinement.map((level) => level.text)].forEach((levelText, index) => {
          const current = refinement === index + 1, reached = refinement > index + 1;
          const line = this.text(layer, 748, dy, `${current ? "▶" : reached ? "★" : "☆"} Tinh Luyện ${index + 1}. ${levelText}`, 11, current ? COLORS.gold : reached ? COLORS.text : COLORS.dimText, 350);
          dy += line.height + 4;
        });
        const info = this.text(layer, 748, dy + 6, `ⓘ Lá vũ khí: ${card.name}`, 13, COLORS.gold, 350);
        const extra = [`Nội tại Tinh Luyện 1: ${weapon.text}`, ...weapon.refinement.slice(0, refinement - 1).map((level, index) => `Tinh Luyện ${index + 2}: ${level.text}`)];
        this.controls.info(info, () => this.showCard(card, 925, true, extra), () => this.hideTip());
        info.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) this.showCard(card, 925, true, extra, true); });
        if (holder) this.text(layer, 748, dy + 32, `Đang gắn cho ${data.heroes[holder]?.name ?? holder}; trang bị sẽ chuyển vũ khí.`, 12, "#ffd6a2", 350);
      } else {
        const relic = data.relics[previewId]!, resonance = session.profile.relics[previewId]?.resonance ?? 1;
        const used = (this.deck.relicIds ?? []).some((id, index) => id === previewId && index !== picker.slot); canEquip = !used;
        this.text(layer, 748, 363, `Cộng Minh ${resonance}`, 13, JADE);
        let dy = 390;
        relic.resonance.forEach((level, index) => {
          const current = resonance === index + 1, reached = resonance > index + 1;
          const line = this.text(layer, 748, dy, `${current ? "▶" : reached ? "★" : "☆"} Cộng Minh ${index + 1}. ${level.text}`, 11, current ? COLORS.gold : reached ? COLORS.text : COLORS.dimText, 350);
          dy += line.height + 6;
        });
        if (used) this.text(layer, 748, dy + 4, "Đã trang bị ở ô Nguyệt Bảo khác", 12, "#ffa4a4", 350);
      }
    } else this.text(layer, 750, 200, "Chọn một món để xem trước", 15, COLORS.dimText);
    this.button(layer, 925, 627, 350, currentId === previewId && !!previewId ? "Đang trang bị" : "Trang bị", () => { if (previewId) this.equip(picker, previewId); }, canEquip && currentId !== previewId, "deck_gear_equip", { variant: "primary" });
    this.iconButton(layer, 170, 627, "remove", "Bỏ trống ô trang bị", () => this.equip(picker, null), true, "deck_gear_clear");
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
