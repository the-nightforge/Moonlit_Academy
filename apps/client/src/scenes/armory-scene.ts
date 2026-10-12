import Phaser from "phaser";
import type { Profile } from "rules";
import manifest from "virtual:assets-manifest";
import { auth } from "../api";
import { errorText, mutate } from "../account";
import { session } from "../session";
import { showCardTooltip, showTextTooltip } from "../ui/card-tooltip";
import { addEquipmentArt, preloadEquipmentArt } from "../ui/equipment-art";
import { equipmentDecks, equipmentDefaults, equipmentEffects, equipmentLevel, equipmentTag, equipmentUpgrade, filterEquipment, initialEquipmentId, type EquipmentFilters, type EquipmentKind } from "../ui/equipment-presentation";
import { HERO_RARITY_LABELS, HERO_ROLE_LABELS, rosterPage } from "../ui/heroes-presentation";
import { roundedPanel } from "../ui/rounded-panel";
import { COLORS, RARITY_COLORS, useDesignCamera, visibleWorld } from "../ui/theme";
import { addButton, addText, isModalOpen, showToast } from "../ui/widgets";

const MUTED = "#abb6ce";
const INFO = { x: 879, y: 246, width: 346, height: 304 };
const GRID = { x: 24, y: 222, width: 144, height: 132, stepX: 156, stepY: 140 };
type DetailTab = "effect" | "levels" | "usage";
type Field = HTMLInputElement | HTMLSelectElement | HTMLButtonElement;
type CollectionState = { selected: string; filters: EquipmentFilters; page: number; preview: number; detailTab: DetailTab; scroll: number };
const initialState = (): CollectionState => ({ selected: "", filters: equipmentDefaults(), page: 0, preview: 1, detailTab: "effect", scroll: 0 });

/** Collection presentation; equipment and upgrades stay server-authoritative. */
export class ArmoryScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tab: EquipmentKind = "weapons";
  private states = { weapons: initialState(), relics: initialState() };
  private focused = "";
  private busy = false;
  private generation = 0;
  private accountGeneration = -1;
  private renderedProfile: Profile | null = null;
  private renderedRev = -1;
  private fields: { element: Field; x: number; y: number; width: number; height: number }[] = [];
  private fieldPlacement = "";
  private tooltip: Phaser.GameObjects.Container | null = null;
  private tooltipPinned = false;
  private detailContent!: Phaser.GameObjects.Container;
  private detailHeight = 0;
  private detailMask: Phaser.Display.Masks.GeometryMask | null = null;
  private maskShape: Phaser.GameObjects.Graphics | null = null;
  private scrollThumb: Phaser.GameObjects.Rectangle | null = null;
  private get state() { return this.states[this.tab]; }
  private get selected() { return this.state.selected; }
  private get detailTab() { return this.state.detailTab; }
  constructor() { super("armory"); }

  preload() {
    preloadEquipmentArt(this);
    const selected = { backgrounds: ["home"], heroes: Object.keys(session.data.heroes), cards: Object.keys(manifest.cards ?? {}), ui: ["nav_back", "cur_darkIron", "cur_moonDust", ...Object.keys(manifest.ui ?? {}).filter(id => id.startsWith("card_") || id.startsWith("kw_"))] };
    for (const [category, ids] of Object.entries(selected)) for (const id of ids) {
      const key = `${category}:${id}`, url = manifest[category]?.[id];
      if (url && !this.textures.exists(key)) this.load.image(key, url);
    }
  }
  create() {
    useDesignCamera(this);
    this.generation++; this.busy = false;
    if (this.accountGeneration !== auth.generation) { this.states = { weapons: initialState(), relics: initialState() }; this.tab = "weapons"; this.accountGeneration = auth.generation; }
    for (const kind of ["weapons", "relics"] as const) {
      const s = this.states[kind]; s.selected = initialEquipmentId(session.data, session.profile, kind, s.selected); s.preview = equipmentLevel(session.profile, kind, s.selected) ?? 1;
    }
    this.root = this.add.container(0, 0).setName("equipment-collection");
    this.focused = ""; this.game.canvas.tabIndex = 0;
    this.createFields();
    this.input.on("wheel", this.onWheel, this);
    this.input.keyboard?.on("keydown", this.onKey, this);
    this.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      this.input.off("wheel", this.onWheel, this); this.input.keyboard?.off("keydown", this.onKey, this);
      this.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this); this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this);
      this.fields.forEach(f => f.element.remove()); this.fields = []; this.fieldPlacement = "";
      this.hideTooltip(); this.clearMask();
    });
    this.render();
  }
  /** Observe current account state independently of callbacks from earlier scene generations. */
  private reconcileProfile(): boolean {
    if (this.renderedProfile === session.profile && this.renderedRev === session.rev) return false;
    for (const kind of ["weapons", "relics"] as const) {
      const state = this.states[kind];
      const before = this.renderedProfile ? equipmentLevel(this.renderedProfile, kind, state.selected) : undefined;
      state.selected = initialEquipmentId(session.data, session.profile, kind, state.selected);
      const after = equipmentLevel(session.profile, kind, state.selected);
      if (before !== after) state.preview = after ?? 1;
    }
    this.render(); return true;
  }
  private onUpdate() { this.reconcileProfile(); this.syncFields(); }
  private createFields() {
    const add = (element: Field, label: string, x: number, y: number, width: number, height = 36) => {
      element.setAttribute("aria-label", label); element.dataset.equipmentField = "";
      element.style.cssText = 'position:fixed;box-sizing:border-box;padding:0 10px;background:#192541;color:#f0eadc;border:1px solid #657590;border-radius:6px;font-family:"Segoe UI",sans-serif;z-index:10;outline-color:#c1ddf4;cursor:pointer';
      element.addEventListener("keydown", e => { e.stopPropagation(); if ((e as KeyboardEvent).key === "Escape") element.blur(); });
      document.body.appendChild(element); this.fields.push({ element, x, y, width, height });
    };
    (["weapons", "relics"] as const).forEach((kind, i) => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.kind = kind;
      b.addEventListener("click", () => { if (this.tab === kind) return; this.tab = kind; this.focused = ""; this.render(); });
      add(b, kind === "weapons" ? "Binh Khí" : "Nguyệt Bảo", 24 + i * 312, 80, 300, 42);
    });
    const search = document.createElement("input"); search.type = "search"; search.maxLength = 80; search.placeholder = "Tìm tên có hoặc không dấu…";
    search.addEventListener("input", () => { this.state.filters.query = search.value; this.changeFilter(); }); add(search, "Tìm trang bị", 24, 132, 300);
    const rarity = document.createElement("select"); rarity.add(new Option("Mọi độ hiếm", "all"));
    for (const [value, label] of Object.entries(HERO_RARITY_LABELS)) rarity.add(new Option(label, value));
    rarity.addEventListener("change", () => { this.state.filters.rarity = rarity.value as EquipmentFilters["rarity"]; this.changeFilter(); }); add(rarity, "Độ hiếm", 332, 132, 136);
    const sort = document.createElement("select");
    ([["owned", "Sở hữu trước"], ["rarity", "Độ hiếm"], ["level", "Cấp cao trước"], ["name", "Tên A–Z"]] as const).forEach(([value, label]) => sort.add(new Option(label, value)));
    sort.addEventListener("change", () => { this.state.filters.sort = sort.value as EquipmentFilters["sort"]; this.changeFilter(); }); add(sort, "Sắp xếp", 476, 132, 160);
    ([["all", "Tất cả"], ["owned", "Đã sở hữu"], ["upgrade", "Nâng cấp được"], ["locked", "Chưa sở hữu"]] as const).forEach(([value, label], i) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.ownership = value;
      b.addEventListener("click", () => { this.state.filters.ownership = value; this.changeFilter(); }); add(b, label, 24 + i * 156, 178, 144, 32);
    });
  }
  private changeFilter() { this.state.page = 0; this.focused = ""; this.render(); }
  private resetFilters() { this.state.filters = equipmentDefaults(); this.changeFilter(); }
  private syncFields() {
    for (const { element } of this.fields) {
      element.style.visibility = this.tooltipPinned || isModalOpen() ? "hidden" : "visible";
      if (element instanceof HTMLButtonElement) {
        const kind = element.dataset.kind as EquipmentKind | undefined;
        const active = kind ? kind === this.tab : element.dataset.ownership === this.state.filters.ownership;
        if (kind) {
          const defs = Object.keys(session.data[kind]), count = defs.filter(id => equipmentLevel(session.profile, kind, id) !== undefined).length;
          const label = `${kind === "weapons" ? "Binh Khí" : "Nguyệt Bảo"} · ${count}/${defs.length} sở hữu`;
          if (element.textContent !== label) { element.textContent = label; element.setAttribute("aria-label", label); }
        }
        element.setAttribute("aria-pressed", String(active)); element.style.background = active ? "#344b68" : "#141e34"; element.style.borderColor = active ? "#c1ddf4" : "#52617e";
      } else {
        const value = element instanceof HTMLInputElement ? this.state.filters.query : element.getAttribute("aria-label") === "Độ hiếm" ? this.state.filters.rarity : this.state.filters.sort;
        if (element.value !== value) element.value = value;
      }
    }
    const rect = this.game.canvas.getBoundingClientRect(), camera = this.cameras.main;
    const sx = rect.width / this.game.scale.width, sy = rect.height / this.game.scale.height;
    const placement = [rect.left, rect.top, sx, sy, camera.worldView.x, camera.worldView.y, camera.zoom].join(":");
    if (placement === this.fieldPlacement) return; this.fieldPlacement = placement;
    for (const { element, x, y, width, height } of this.fields) {
      element.style.left = `${rect.left + (camera.x + (x - camera.worldView.x) * camera.zoom) * sx}px`;
      element.style.top = `${rect.top + (camera.y + (y - camera.worldView.y) * camera.zoom) * sy}px`;
      element.style.width = `${width * camera.zoom * sx}px`; element.style.height = `${height * camera.zoom * sy}px`; element.style.fontSize = `${13 * camera.zoom * sx}px`;
    }
  }
  private icon(parent: Phaser.GameObjects.Container, id: string, x: number, y: number, size: number) {
    if (this.textures.exists(`ui:${id}`)) parent.add(this.add.image(x, y, `ui:${id}`).setDisplaySize(size, size));
  }
  private fit(parent: Phaser.GameObjects.Container, x: number, y: number, content: string, width: number, size = 14, color: string = COLORS.text) {
    const text = addText(this, parent, x, y, content, size, color);
    let end = content.length; while (text.width > width && end > 0) text.setText(`${content.slice(0, --end)}…`);
    if (end < content.length) { text.setInteractive(); text.on("pointerover", () => this.note(content, x, y + 20)); text.on("pointerout", () => { if (!this.tooltipPinned) this.hideTooltip(); }); }
    return text;
  }
  private note(content: string, x: number, y: number) {
    if (this.tooltipPinned) return; this.hideTooltip(); this.tooltip = showTextTooltip(this, x, y, [content]);
  }
  private render() {
    this.renderedProfile = session.profile; this.renderedRev = session.rev;
    this.hideTooltip(); this.clearMask(); this.root.removeAll(true); this.scrollThumb = null;
    const view = visibleWorld(this);
    if (this.textures.exists("backgrounds:home")) this.root.add(this.add.image(640, 360, "backgrounds:home").setDisplaySize(view.w, view.h));
    this.root.add(this.add.rectangle(640, 360, view.w, view.h, COLORS.background, 0.82));
    addButton(this, this.root, 82, 40, 116, "Quay lại", () => this.scene.start("deck-select"), true, { height: 40 });
    addText(this, this.root, 164, 18, "Kho đồ", 27); addText(this, this.root, 164, 54, "Binh Khí & Nguyệt Bảo", 12, MUTED);
    (["darkIron", "moonDust"] as const).forEach((id, i) => {
      const x = 1034 + i * 122; this.icon(this.root, `cur_${id}`, x, 40, 28);
      addText(this, this.root, x + 22, 19, id === "darkIron" ? "Huyền Thiết" : "Nguyệt Trần", 11, MUTED);
      addText(this, this.root, x + 22, 38, String(session.profile.currencies[id]), 15);
    });
    const filtered = filterEquipment(session.data, session.profile, this.tab, this.state.filters, session.online);
    const range = rosterPage(filtered.length, this.state.page); this.state.page = range.page;
    filtered.slice(range.start, range.end).forEach((def, index) => this.renderTile(def.id, index));
    if (!filtered.length) {
      addText(this, this.root, 330, 358, "Không tìm thấy trang bị phù hợp", 17).setOrigin(0.5);
      addText(this, this.root, 330, 389, "Thử tên khác hoặc bỏ bộ lọc", 13, MUTED).setOrigin(0.5);
      addButton(this, this.root, 330, 435, 180, "Xóa bộ lọc", () => this.resetFilters(), true, { height: 40 });
    }
    addText(this, this.root, 24, 662, `${filtered.length} ${this.tab === "weapons" ? "Binh Khí" : "Nguyệt Bảo"} · Trang ${range.page + 1}/${range.pages}`, 12, MUTED);
    addButton(this, this.root, 279, 670, 34, "‹", () => { this.state.page--; this.render(); }, range.page > 0, { height: 34 });
    for (let page = 0; page < range.pages; page++) addButton(this, this.root, 319 + page * 40, 670, 34, String(page + 1), () => { this.state.page = page; this.render(); }, this.state.page !== page, { height: 34 });
    addButton(this, this.root, 319 + range.pages * 40, 670, 34, "›", () => { this.state.page++; this.render(); }, range.page + 1 < range.pages, { height: 34 });
    const active = this.state.filters.query !== "" || this.state.filters.rarity !== "all" || this.state.filters.ownership !== "all" || this.state.filters.sort !== "owned";
    addButton(this, this.root, 585, 670, 102, "Xóa lọc", () => this.resetFilters(), active, { height: 34 });
    if (session.data[this.tab][this.selected]) this.renderDetails(filtered.some(d => d.id === this.selected));
    addText(this, this.root, 24, 705, "Phím mũi tên / Enter để chọn · Click hoặc chạm để xem art, lá bài", 11, MUTED);
    this.syncFields();
  }
  private renderTile(id: string, index: number) {
    const def = session.data[this.tab][id]!, level = equipmentLevel(session.profile, this.tab, id), owned = level !== undefined;
    const x = GRID.x + index % 4 * GRID.stepX, y = GRID.y + Math.floor(index / 4) * GRID.stepY;
    const tile = this.add.container(x, y).setName(`equipment-tile:${id}`); this.root.add(tile);
    tile.add(roundedPanel(this, 72, 66, GRID.width, GRID.height, 0x142039, 1, id === this.selected ? 0xc1ddf4 : 0x526580, 7));
    if (id === this.selected) tile.add(this.add.rectangle(72, 66, 142, 130, 0, 0).setStrokeStyle(2, 0xc1ddf4));
    if (id === this.focused) tile.add(this.add.rectangle(72, 66, 140, 128, 0, 0).setStrokeStyle(2, COLORS.goldFill));
    const art = addEquipmentArt(this, tile, this.tab, id, 72, 40, 132, 76);
    if (art) art.setAlpha(owned ? 1 : 0.65); else addText(this, tile, 72, 39, "Chưa có art", 12, MUTED).setOrigin(0.5);
    const rarity = this.add.circle(10, 10, 4, RARITY_COLORS[def.rarity]); tile.add(rarity);
    const name = addText(this, tile, 8, 80, def.name, 13).setWordWrapWidth(128).setLineSpacing(0);
    if (name.height > 32) name.setFontSize(12);
    addText(this, tile, 8, 114, owned ? `${equipmentTag(this.tab)} ${level}/5` : "Chưa sở hữu", 11, MUTED);
    const up = equipmentUpgrade(session.data, session.profile, this.tab, id, session.online, false);
    const badge = !owned ? "Chưa có" : level === 5 ? "Tối đa" : up.enabled ? "↑ Nâng được" : "";
    if (badge) {
      const label = addText(this, tile, 137, 7, badge, 10, level === 5 ? COLORS.gold : owned ? "#bde7d1" : MUTED).setOrigin(1, 0);
      const bounds = label.getBounds(); const bg = this.add.rectangle(137 - bounds.width / 2, 13, bounds.width + 8, 18, 0x14243b, 0.95); tile.add(bg); tile.bringToTop(label);
    }
    const hit = this.add.rectangle(72, 66, 144, 132, 0, 0).setInteractive({ useHandCursor: true }); tile.add(hit);
    hit.on("pointerup", (p: Phaser.Input.Pointer) => { if (p.button === 0) { this.game.canvas.focus(); this.selectItem(id); } });
    hit.on("pointerover", () => { if (!this.tooltipPinned) this.note(`${def.name} · ${HERO_RARITY_LABELS[def.rarity]}`, x, y + 136); });
    hit.on("pointerout", () => { if (!this.tooltipPinned) this.hideTooltip(); });
  }
  private selectItem(id: string) {
    if (!session.data[this.tab][id]) return;
    this.state.selected = id; this.state.preview = equipmentLevel(session.profile, this.tab, id) ?? 1; this.state.scroll = 0; this.focused = id; this.render();
  }
  private renderDetails(inFilter: boolean) {
    const id = this.selected, def = session.data[this.tab][id]!, owned = equipmentLevel(session.profile, this.tab, id), tag = equipmentTag(this.tab);
    this.root.add(roundedPanel(this, 956, 387, 600, 614, 0x101b30, 0.97, 0x425370, 10));
    addText(this, this.root, 675, 100, `${HERO_RARITY_LABELS[def.rarity]} · ${this.tab === "weapons" ? "BINH KHÍ" : "NGUYỆT BẢO"}`, 12, COLORS.gold);
    this.fit(this.root, 675, 124, def.name, 552, 25);
    addText(this, this.root, 675, 162, owned === undefined ? "Chưa sở hữu" : `${tag} ${owned}/5`, 13);
    addText(this, this.root, 879, 162, inFilter ? "Đang xem" : "Nằm ngoài bộ lọc", 12, MUTED);
    ([["effect", "Hiệu ứng"], ["levels", "Các cấp"], ["usage", "Sử dụng"]] as const).forEach(([tab, label], i) => {
      const x = 765 + i * 184;
      addButton(this, this.root, x, 207, 172, label, () => { this.state.detailTab = tab; this.state.scroll = 0; this.render(); }, this.detailTab !== tab, { height: 36 });
      if (this.detailTab === tab) this.root.add(this.add.rectangle(x, 225, 172, 2, 0xc1ddf4));
    });
    this.root.add(roundedPanel(this, 768, 346, 186, 200, 0x0c1628, 1, 0x455570, 8));
    if (!addEquipmentArt(this, this.root, this.tab, id, 768, 346, 178, 196)) addText(this, this.root, 768, 340, "Chưa có art", 14, MUTED).setOrigin(0.5);
    addButton(this, this.root, 768, 471, 186, "Xem art lớn", () => this.showArt(), true, { height: 32 });
    if (this.tab === "weapons") {
      const weapon = session.data.weapons[id]!;
      const hero = weapon.signatureHeroId ? session.data.heroes[weapon.signatureHeroId] : undefined;
      if (hero) {
        const key = `heroes:${hero.id}`;
        if (this.textures.exists(key)) this.root.add(this.add.image(688, 505, key).setDisplaySize(24, 30));
        this.fit(this.root, 706, 497, `Bản mệnh: ${hero.name}`, 154, 11, MUTED);
        addText(this, this.root, 675, 526, "Nội tại mạnh hơn khi Hero bản mệnh mang.", 11, MUTED).setWordWrapWidth(185);
      } else addText(this, this.root, 675, 497, `Vũ khí chung · ${weapon.archetype ? HERO_ROLE_LABELS[weapon.archetype] : ""}`, 12, MUTED).setWordWrapWidth(185);
      addButton(this, this.root, 768, 568, 186, "Xem lá Binh Khí", () => this.showCard(true), true, { height: 30 });
      const cardHit = this.root.list.at(-2) as Phaser.GameObjects.Rectangle;
      cardHit.on("pointerover", () => { if (!this.tooltipPinned) this.showCard(false); });
      cardHit.on("pointerout", () => { if (!this.tooltipPinned) this.hideTooltip(); });
    } else addText(this, this.root, 675, 500, "Mang tối đa 2 Nguyệt Bảo trong mỗi bộ bài; có hiệu lực mọi trận.", 12, MUTED).setWordWrapWidth(185);
    this.renderInfo(); this.renderUpgrade();
  }
  private renderInfo() {
    this.detailContent = this.add.container(INFO.x, INFO.y); this.root.add(this.detailContent);
    this.maskShape = this.make.graphics({ x: 0, y: 0 }); this.maskShape.fillStyle(0xffffff).fillRect(INFO.x, INFO.y, INFO.width, INFO.height);
    if (this.renderer.type === Phaser.WEBGL) {
      this.detailContent.enableFilters(); this.detailContent.filters!.external.addMask(this.maskShape, false, this.cameras.main);
    } else {
      this.detailMask = this.maskShape.createGeometryMask(); this.detailContent.setMask(this.detailMask);
    }
    let y = 0;
    const paragraph = (text: string, size = 14, color: string = COLORS.text) => {
      const line = addText(this, this.detailContent, 0, y, text, size, color).setWordWrapWidth(INFO.width - 18).setLineSpacing(4);
      y += line.height + 14; return line;
    };
    const level = equipmentLevel(session.profile, this.tab, this.selected), shown = this.state.preview, tag = equipmentTag(this.tab);
    if (this.detailTab === "effect") {
      for (let n = 1; n <= 5; n++) addButton(this, this.detailContent, 16 + (n - 1) * 36, 12, 30, String(n), () => { this.state.preview = n; this.state.scroll = 0; this.render(); }, n !== shown, { height: 30 });
      y = 40;
      if (shown !== (level ?? 1)) paragraph(`Đang xem trước ${tag} ${shown} · Cấp sở hữu giữ nguyên`, 12, "#e0bd7d");
      paragraph(level === undefined ? "XEM TRƯỚC · CHƯA SỞ HỮU" : "HIỆU ỨNG Ở CẤP ĐANG XEM", 11, MUTED);
      const effect = equipmentEffects(session.data, this.tab, this.selected, shown);
      paragraph(effect.title, 17, COLORS.gold);
      if (effect.card) paragraph(`${effect.card.cost} Nguyệt Lực · ${effect.card.copies} bản`, 12, MUTED);
      paragraph(effect.text);
      // Prioritize the next actual upgrade over future previews or the full passive history.
      if (level !== undefined && level < 5) {
        paragraph(`NÂNG ${level} → ${level + 1}`, 11, "#c1ddf4");
        const next = this.tab === "weapons" ? session.data.weapons[this.selected]!.refinement[level - 1]!.text : session.data.relics[this.selected]!.resonance[level]!.text;
        paragraph(next, 14, "#c1ddf4");
      }
      if (effect.passive) { paragraph("NỘI TẠI GỐC / CÁC THAY ĐỔI ĐÃ ÁP DỤNG", 11, MUTED); paragraph(effect.passive); }
    } else if (this.detailTab === "levels") {
      paragraph(this.tab === "weapons" ? "Các mốc thay đổi tích lũy" : "Mỗi cấp thay thế toàn bộ cấp trước", 12, MUTED);
      for (let n = 1; n <= 5; n++) {
        paragraph(`${level === n ? "▶" : level !== undefined && level >= n ? "✓" : "○"} ${tag} ${n}`, 15, level === n ? COLORS.gold : MUTED);
        const effect = equipmentEffects(session.data, this.tab, this.selected, n);
        if (this.tab === "relics") paragraph(effect.text);
        else { paragraph(`${effect.card!.cost} Nguyệt Lực · ${effect.card!.copies} bản · ${effect.text}`); paragraph(n === 1 ? session.data.weapons[this.selected]!.text : session.data.weapons[this.selected]!.refinement[n - 2]!.text, 13, MUTED); }
      }
    } else {
      paragraph("BỘ BÀI ĐANG DÙNG", 11, MUTED);
      paragraph("Chọn trang bị trong màn sửa bộ bài. Xem Kho đồ không tự thay cấu hình.", 13, MUTED);
      const decks = equipmentDecks(session.profile.decks, this.tab, this.selected);
      if (!decks.length) paragraph("Chưa được dùng trong bộ bài đã lưu.");
      for (const deck of decks) {
        paragraph(deck.name, 16, COLORS.gold);
        const equipment = this.tab === "weapons" ? Object.entries(deck.weapons ?? {}).filter(([, weapon]) => weapon === this.selected).map(([hero]) => session.data.heroes[hero]?.name ?? hero).join(", ") : "Nguyệt Bảo của đội";
        paragraph(equipment, 12, MUTED);
        addButton(this, this.detailContent, 86, y + 20, 172, "Mở bộ bài", () => { session.editingDeck = structuredClone(deck); this.scene.start("deck-builder"); }, true, { height: 40 }); y += 58;
      }
    }
    this.detailHeight = y; this.state.scroll = Phaser.Math.Clamp(this.state.scroll, 0, Math.max(0, y - INFO.height)); this.detailContent.y -= this.state.scroll;
    this.clipDetailInput();
    if (y > INFO.height) {
      const h = Math.max(24, INFO.height * INFO.height / y);
      this.root.add(this.add.rectangle(1238, INFO.y + INFO.height / 2, 4, INFO.height, 0x34435b));
      this.scrollThumb = this.add.rectangle(1238, INFO.y + h / 2, 6, h, 0xc2d2e8).setInteractive({ useHandCursor: true }); this.root.add(this.scrollThumb); this.input.setDraggable(this.scrollThumb);
      this.scrollThumb.on("drag", (_p: Phaser.Input.Pointer, _x: number, dragY: number) => { const ratio = Phaser.Math.Clamp((dragY - INFO.y - h / 2) / (INFO.height - h), 0, 1); this.scrollDetail(ratio * (this.detailHeight - INFO.height) - this.state.scroll); });
      this.updateScrollThumb();
      addText(this, this.root, INFO.x, 557, "Cuộn để xem thêm", 11, MUTED);
      addButton(this, this.root, 1172, 568, 34, "▲", () => this.scrollDetail(-180), true, { height: 30 });
      addButton(this, this.root, 1218, 568, 34, "▼", () => this.scrollDetail(180), true, { height: 30 });
    }
  }
  private renderUpgrade() {
    const up = equipmentUpgrade(session.data, session.profile, this.tab, this.selected, session.online, this.busy);
    const footer = this.add.container(0, 0).setName("equipment-actions"); this.root.add(footer);
    footer.add(this.add.rectangle(956, 642, 596, 104, 0x14243b));
    this.icon(footer, `cur_${up.materialId}`, 688, 602, 18);
    addText(this, footer, 709, 594, up.cost !== null ? `Nâng ${up.level} → ${up.level! + 1} · ${up.material}` : up.level === 5 ? "Đã đạt cấp tối đa" : `Nguyên liệu nâng: ${up.material}`, 13);
    addText(this, footer, 1235, 594, up.cost === null ? "—" : `${up.have} / ${up.cost}`, 15, up.missing ? "#f1a6a6" : "#bde7d1").setOrigin(1, 0);
    addButton(this, footer, 906, 636, 462, this.busy ? "Đang nâng…" : "Nâng Cấp", () => void this.upgrade(), up.enabled, { height: 42, variant: "primary", disabledReason: up.reason });
    addButton(this, footer, 1196, 636, 90, "Triệu Hồi", () => this.scene.start("gacha"), true, { height: 42, variant: up.level === undefined ? "primary" : "secondary" });
    this.fit(footer, 675, 670, up.reason, 558, 12, up.missing ? "#f1a6a6" : MUTED);
  }
  private async upgrade() {
    if (this.reconcileProfile()) return; // A fresh click must confirm the action after its displayed price changes.
    const id = this.selected, kind = this.tab;
    if (!equipmentUpgrade(session.data, session.profile, kind, id, session.online, this.busy).enabled) return;
    const generation = this.generation, accountGeneration = auth.generation; this.busy = true; this.render();
    try {
      await mutate("POST", `/profile/${kind}/${id}/upgrade`);
      if (this.generation !== generation || auth.generation !== accountGeneration) return;
      this.busy = false;
      if (this.states[kind].selected === id) this.states[kind].preview = equipmentLevel(session.profile, kind, id) ?? 1;
      this.render(); showToast(this, [`Đã nâng ${session.data[kind][id]!.name}`]);
    } catch (error) {
      if (this.generation !== generation || auth.generation !== accountGeneration) return;
      this.busy = false; this.render(); showToast(this, [`${session.data[kind][id]!.name}: ${errorText(error)}`]);
    }
  }
  private clipDetailInput() {
    for (const node of this.detailContent.list) {
      if (!(node instanceof Phaser.GameObjects.Text || node instanceof Phaser.GameObjects.Rectangle) || !node.input) continue;
      const contains = node.input.hitAreaCallback;
      node.input.hitAreaCallback = (hitArea, x, y, object) => {
        if (!contains(hitArea, x, y, object) || this.tooltipPinned || isModalOpen()) return false;
        const world = node.getWorldTransformMatrix().transformPoint(x - node.displayOriginX, y - node.displayOriginY);
        return world.x >= INFO.x && world.x <= INFO.x + INFO.width && world.y >= INFO.y && world.y <= INFO.y + INFO.height;
      };
    }
  }
  private scrollDetail(delta: number) {
    if (this.tooltipPinned || isModalOpen()) return;
    this.hideTooltip(); this.state.scroll = Phaser.Math.Clamp(this.state.scroll + delta, 0, Math.max(0, this.detailHeight - INFO.height)); this.detailContent.y = INFO.y - this.state.scroll; this.updateScrollThumb();
  }
  private updateScrollThumb() { if (this.scrollThumb) this.scrollThumb.y = INFO.y + this.scrollThumb.height / 2 + (INFO.height - this.scrollThumb.height) * this.state.scroll / Math.max(1, this.detailHeight - INFO.height); }
  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) {
    const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y); if (dy && p.x >= INFO.x && p.x <= INFO.x + INFO.width && p.y >= INFO.y && p.y <= INFO.y + INFO.height) this.scrollDetail(dy * 0.65);
  }
  private onKey(event: KeyboardEvent) {
    if (isModalOpen()) return;
    if (this.tooltipPinned) { if (event.key === "Escape") { this.hideTooltip(); this.syncFields(); event.preventDefault(); } return; }
    if (event.key === "Escape") { this.scene.start("deck-select"); return; }
    if (event.key === "PageDown" || event.key === "PageUp") { this.scrollDetail(event.key === "PageDown" ? 240 : -240); event.preventDefault(); return; }
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 } as Record<string, number>)[event.key];
    if (delta !== undefined) {
      const defs = filterEquipment(session.data, session.profile, this.tab, this.state.filters, session.online); if (!defs.length) return;
      const current = Math.max(0, defs.findIndex(d => d.id === (this.focused || this.selected))); const index = Phaser.Math.Clamp(current + delta, 0, defs.length - 1);
      this.focused = defs[index]!.id; this.state.page = Math.floor(index / 12); this.render(); event.preventDefault();
    } else if (event.key === "Enter" && this.focused) { this.selectItem(this.focused); event.preventDefault(); }
  }
  private overlay() {
    this.hideTooltip(); this.tooltipPinned = true;
    const layer = this.add.container(0, 0).setDepth(2000); this.tooltip = layer; this.root.add(layer);
    const view = visibleWorld(this); const veil = this.add.rectangle(640, 360, view.w, view.h, 0x000000, 0.7).setInteractive(); layer.add(veil); veil.on("pointerup", () => { this.hideTooltip(); this.syncFields(); });
    this.syncFields(); return layer;
  }
  private showArt() {
    const layer = this.overlay();
    layer.add(roundedPanel(this, 640, 354, 452, 660, 0x101b30, 1, 0x657590, 10));
    addEquipmentArt(this, layer, this.tab, this.selected, 640, 334, 420, 586);
    const shield = this.add.rectangle(640, 354, 452, 660, 0, 0).setInteractive(); layer.add(shield);
    addButton(this, layer, 640, 656, 168, "Đóng", () => { this.hideTooltip(); this.syncFields(); }, true, { height: 40 });
  }
  private showCard(pinned: boolean) {
    const card = equipmentEffects(session.data, this.tab, this.selected, this.state.preview).card; if (!card) return;
    if (pinned) {
      const layer = this.overlay(); const preview = showCardTooltip(this, 470, 670, session.data, card, [`Xem Tinh Luyện ${this.state.preview}`]); layer.add(preview);
      const bounds = preview.getBounds(); const shield = this.add.rectangle(bounds.centerX, bounds.centerY, bounds.width, bounds.height, 0, 0).setInteractive(); layer.add(shield);
      addButton(this, layer, bounds.right - 24, bounds.top + 22, 34, "×", () => { this.hideTooltip(); this.syncFields(); }, true, { height: 34, fontSize: 20 });
    } else { this.hideTooltip(); this.tooltip = showCardTooltip(this, 470, 670, session.data, card); }
  }
  private hideTooltip() { this.tooltip?.destroy(); this.tooltip = null; this.tooltipPinned = false; }
  private clearMask() { this.detailContent?.filters?.external.clear(); this.detailContent?.clearMask(); this.detailMask?.destroy(); this.detailMask = null; this.maskShape?.destroy(); this.maskShape = null; }
}
