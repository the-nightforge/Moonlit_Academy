import Phaser from "phaser";
import { EquipmentControls } from "../ui/equipment-controls";
import type { ButtonOptions } from "../ui/widgets";
import { framedImage } from "../ui/contained-art";
import { displayText } from "../ui/display-text";
import type { GameData } from "rules";
import { pendingUnlocks } from "rules";
import manifest from "virtual:assets-manifest";
import { errorText, mutate } from "../account";
import { session } from "../session";
import { cardIconOf } from "../ui/attack-style";
import { showCardTooltip, showTextTooltip } from "../ui/card-tooltip";
import { cardArtCandidates, drawCardFace, roundedArtTexture } from "../ui/combat-card-view";
import { filterHeroes, heroLevelUpCondition, HERO_RARITY_LABELS, HERO_ROLE_LABELS, initialHeroId, rosterPage, type HeroFilters } from "../ui/heroes-presentation";
import { roundedPanel } from "../ui/rounded-panel";
import { COLORS, CONSTELLATION_TEXT, CURRENCY_LABELS, FACTION_LABELS, RARITY_COLORS, RENDER_SCALE, TEXT_BASE, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, isModalOpen } from "../ui/widgets";

type Hero = GameData["heroes"][string];
type DetailTab = "overview" | "story" | "constellation" | "cards";
type Field = HTMLInputElement | HTMLSelectElement | HTMLButtonElement;
const MAX_CONSTELLATION = CONSTELLATION_TEXT.length;
const GRID = { x: 28, y: 182, width: 548, height: 446, cardWidth: 128, cardHeight: 142, stepX: 140, stepY: 152 };
const DETAIL = { x: 904, y: 334, width: 332, height: 264 };
const MUTED = "#abb6ce";
const defaults = (): HeroFilters => ({ query: "", ownership: "all", faction: "all", sort: "owned" });

/** Collection UI: art previews never change the server-authoritative form. */
export class HeroesScene extends Phaser.Scene {
  private controls!: EquipmentControls;
  private root!: Phaser.GameObjects.Container;
  private heroId = "";
  private focusedHeroId = "";
  private filters = defaults();
  private page = 0;
  private tab: DetailTab = "overview";
  private previewUp = false;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private tooltipPinned = false;
  private tooltipTimer: Phaser.Time.TimerEvent | null = null;
  private busy = false;
  private formError = "";
  private generation = 0;
  private fields: { element: Field; x: number; y: number; width: number; height: number }[] = [];
  private fieldPlacement = "";
  private detailContent!: Phaser.GameObjects.Container;
  private detailArea = DETAIL;
  private detailHeight = 0;
  private detailScroll = 0;
  private detailMask: Phaser.Display.Masks.GeometryMask | null = null;
  private maskShape: Phaser.GameObjects.Graphics | null = null;
  private scrollThumb: Phaser.GameObjects.Rectangle | null = null;
  private scrollArrows: { button: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; direction: number }[] = [];

  constructor() { super("heroes"); }

  preload() {
    const selected = {
      backgrounds: ["home"],
      heroes: Object.keys(session.data.heroes).flatMap(id => [id, `${id}_up`]),
      cards: Object.keys(manifest.cards ?? {}),
      ui: ["lock", "check", "nav_back", "nav_mastery", "nav_banners", "cur_moonJade", "cur_moonStar", "cur_honor", ...Object.keys(manifest.ui ?? {}).filter(id => id.startsWith("card_") || id.startsWith("kw_"))],
    };
    for (const [category, ids] of Object.entries(selected)) for (const id of ids) {
      const key = `${category}:${id}`, url = manifest[category]?.[id];
      if (url && !this.textures.exists(key)) this.load.image(key, url);
    }
  }

  create() {
    useDesignCamera(this);
    this.generation++;
    this.busy = false;
    this.formError = "";
    this.heroId = initialHeroId(Object.values(session.data.heroes), session.profile.heroes, this.heroId);
    this.root = this.add.container(0, 0);
    this.controls = new EquipmentControls(this);
    this.game.canvas.tabIndex = 0;
    this.createFields();
    this.input.on("wheel", this.onWheel, this);
    this.input.keyboard?.on("keydown", this.onKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.on(Phaser.Scenes.Events.UPDATE, this.syncFields, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      this.input.off("wheel", this.onWheel, this);
      this.input.keyboard?.off("keydown", this.onKey, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this);
      this.events.off(Phaser.Scenes.Events.UPDATE, this.syncFields, this);
      this.controls.destroy();
      this.fields.forEach(field => field.element.remove());
      this.fields = [];
      this.fieldPlacement = "";
      this.hideTooltip();
      this.clearMask();
    });
    this.render();
  }

  private createFields() {
    const add = (element: Field, label: string, x: number, y: number, width: number, height = 36) => {
      element.setAttribute("aria-label", label);
      element.setAttribute("data-hero-roster-field", "");
      element.style.cssText = 'position:fixed;box-sizing:border-box;padding:0 10px;background:#192541;color:#f0eadc;border:1px solid #657590;border-radius:6px;font-family:"Segoe UI",sans-serif;z-index:10;outline-color:#b7dcff;cursor:pointer';
      element.addEventListener("keydown", event => {
        event.stopPropagation();
        if ((event as KeyboardEvent).key === "Escape") element.blur();
      });
      document.body.appendChild(element);
      this.fields.push({ element, x, y, width, height });
    };
    const search = document.createElement("input");
    search.type = "search"; search.maxLength = 80;
    search.placeholder = "Tìm tên có hoặc không dấu…"; search.value = this.filters.query;
    search.addEventListener("input", () => { this.filters.query = search.value; this.changeFilter(); });
    add(search, "Tìm tên Hero", 28, 94, 268);
    const faction = document.createElement("select");
    faction.add(new Option("Tất cả phe", "all"));
    Object.entries(FACTION_LABELS).forEach(([value, label]) => faction.add(new Option(label, value)));
    faction.value = this.filters.faction;
    faction.addEventListener("change", () => { this.filters.faction = faction.value as HeroFilters["faction"]; this.changeFilter(); });
    add(faction, "Phe", 308, 94, 268);
    ([["all", "Tất cả"], ["owned", "Đã sở hữu"], ["locked", "Chưa sở hữu"]] as const).forEach(([value, label], index) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = label;
      button.dataset.ownership = value;
      button.addEventListener("click", () => { this.filters.ownership = value; this.changeFilter(); });
      add(button, label, 28 + index * 122, 142, 116, 32);
    });
    const sort = document.createElement("select");
    ([["owned", "Sở hữu trước"], ["rarity", "Độ hiếm"], ["constellation", "Tinh Hồn"], ["name", "Tên A–Z"]] as const).forEach(([value, label]) => sort.add(new Option(label, value)));
    sort.value = this.filters.sort;
    sort.addEventListener("change", () => { this.filters.sort = sort.value as HeroFilters["sort"]; this.changeFilter(); });
    add(sort, "Xếp theo", 400, 142, 176, 32);
  }

  private changeFilter() { this.page = 0; this.focusedHeroId = ""; this.render(); }
  private resetFilters() {
    this.filters = defaults();
    this.fields[0]!.element.value = ""; this.fields[1]!.element.value = "all"; this.fields[5]!.element.value = "owned";
    this.changeFilter();
  }
  private syncFields() {
    const hidden = isModalOpen() || this.tooltipPinned;
    this.controls?.sync(this.tooltipPinned, isModalOpen());
    for (const { element } of this.fields) {
      element.style.visibility = hidden ? "hidden" : "visible";
      if (element instanceof HTMLButtonElement) {
        const active = element.dataset.ownership === this.filters.ownership;
        element.setAttribute("aria-pressed", String(active));
        element.style.background = active ? "#344b68" : "#141e34";
        element.style.borderColor = active ? "#c1ddf4" : "#52617e";
      }
    }
    const rect = this.game.canvas.getBoundingClientRect(), camera = this.cameras.main;
    const sx = rect.width / this.game.scale.width, sy = rect.height / this.game.scale.height;
    const placement = [rect.left, rect.top, sx, sy, camera.worldView.x, camera.worldView.y, camera.zoom].join(":");
    if (this.fieldPlacement === placement) return;
    this.fieldPlacement = placement;
    for (const { element, x, y, width, height } of this.fields) {
      element.style.left = `${rect.left + (camera.x + (x - camera.worldView.x) * camera.zoom) * sx}px`;
      element.style.top = `${rect.top + (camera.y + (y - camera.worldView.y) * camera.zoom) * sy}px`;
      element.style.width = `${width * camera.zoom * sx}px`; element.style.height = `${height * camera.zoom * sy}px`;
      element.style.fontSize = `${13 * camera.zoom * sx}px`;
    }
  }

  private accessibleButton(parent: Phaser.GameObjects.Container, x:number, y:number, width:number, label:string, action:()=>void, enabled=true, options:ButtonOptions={}) {
    const names: Record<string,string> = { "‹":"Trang Hero trước", "›":"Trang Hero sau", "×":"Đóng chi tiết lá bài" };
    return this.controls.button(parent,x,y,width,label,action,{ enabled, height:options.height, primary:options.variant==="primary", name:names[label]??label, id:`hero-action:${x}:${y}:${label.replace(/^✓ /, "")}`, pinned:this.tooltipPinned, clip:parent===this.detailContent?this.detailArea:undefined });
  }

  private icon(parent: Phaser.GameObjects.Container, key: string, x: number, y: number, size: number) {
    if (this.textures.exists(`ui:${key}`)) framedImage(this,parent,`ui:${key}`,x,y,size,size,2);
  }
  private render() {
    this.controls.clear();
    this.hideTooltip(); this.clearMask(); this.root.removeAll(true); this.scrollThumb = null; this.scrollArrows = [];
    const view = visibleWorld(this);
    if (this.textures.exists("backgrounds:home")) {const image=this.add.image(640,360,"backgrounds:home");image.setScale(Math.min(view.w/image.width,view.h/image.height));this.root.add(image);}
    this.root.add(this.add.rectangle(640, 360, view.w, view.h, COLORS.background, 0.8));
    this.accessibleButton(this.root, 90, 30, 140, "Quay lại", () => this.scene.start("deck-select"), true, { height: 40 });
    this.icon(this.root, "nav_back", 40, 30, 22);
    addText(this, this.root, 640, 30, "Kho Hero", 27, COLORS.text).setOrigin(0.5);
    ([["moonJade", session.profile.currencies.moonJade], ["moonStar", session.profile.currencies.moonStar], ["honor", session.profile.currencies.honor ?? 0]] as const).forEach(([id, value], index) => {
      this.icon(this.root, `cur_${id}`, 970 + index * 100, 29, 24);
      const label = addText(this, this.root, 990 + index * 100, 29, String(value), 14, COLORS.text).setOrigin(0, 0.5).setInteractive();
      label.on("pointerover", () => { this.tooltip = showTextTooltip(this, 958 + index * 100, 48, [CURRENCY_LABELS[id]], 160); });
      label.on("pointerout", () => { if (!this.tooltipPinned) this.hideTooltip(); });
    });
    const heroes = Object.values(session.data.heroes), filtered = filterHeroes(heroes, session.profile.heroes, this.filters);
    addText(this, this.root, 28, 62, `BỘ SƯU TẬP  ·  Đã sở hữu ${heroes.filter(h => session.profile.heroes[h.id] !== undefined).length} / ${heroes.length}`, 14, MUTED);
    addText(this, this.root, 28, 78, "Tìm Hero", 12, MUTED); addText(this, this.root, 308, 78, "Phe", 12, MUTED);
    const range = rosterPage(filtered.length, this.page); this.page = range.page;
    filtered.slice(range.start, range.end).forEach((hero, index) => this.renderTile(hero, index));
    if (!filtered.length) {
      addText(this, this.root, 302, 328, "Không tìm thấy Hero phù hợp", 17, COLORS.text).setOrigin(0.5);
      addText(this, this.root, 302, 356, "Thử tên khác hoặc bỏ điều kiện lọc", 13, MUTED).setOrigin(0.5);
      this.accessibleButton(this.root, 302, 402, 180, "Xóa bộ lọc", () => this.resetFilters(), true, { height: 40 });
    }
    addText(this, this.root, 28, 648, `${filtered.length} Hero`, 14, MUTED);
    this.accessibleButton(this.root, 200, 666, 40, "‹", () => { this.page--; this.render(); }, range.page > 0, { height: 40 });
    for (let page = 0; page < range.pages; page++) {
      const x = 248 + page * 44, active = this.page === page;
      const button = this.add.rectangle(x, 666, 36, 40, active ? 0x344b68 : 0x17243b).setRounded(8).setStrokeStyle(1, active ? 0xc1ddf4 : 0x657590); this.root.add(button);
      addText(this, this.root, x, 666, String(page + 1), 14, active ? COLORS.text : MUTED).setOrigin(0.5);
      if (!active) { button.setInteractive({ useHandCursor: true }); button.on("pointerup", () => { this.page = page; this.render(); }); }
    }
    this.accessibleButton(this.root, 248 + range.pages * 44, 666, 40, "›", () => { this.page++; this.render(); }, range.page + 1 < range.pages, { height: 40 });
    const active = this.filters.query !== "" || this.filters.faction !== "all" || this.filters.ownership !== "all";
    if (active) {
      this.accessibleButton(this.root, 508, 666, 136, "Xóa lọc", () => this.resetFilters(), true, { height: 40 });
      const summary = [this.filters.query ? `Tên: ${this.filters.query}` : "", this.filters.ownership === "owned" ? "Đã sở hữu" : this.filters.ownership === "locked" ? "Chưa sở hữu" : "", this.filters.faction !== "all" ? FACTION_LABELS[this.filters.faction] : ""].filter(Boolean).join(" · ");
      this.fit(this.root, 28, 701, `Đang lọc: ${summary}`, 548, 12, MUTED);
    } else addText(this, this.root, 28, 701, "Badge có số: lượt mở lá · Phím mũi tên / Enter để chọn", 12, MUTED);
    if (session.data.heroes[this.heroId]) { this.renderPortrait(); this.renderDetail(filtered.some(h => h.id === this.heroId)); }
    this.syncFields();
  }

  private art(parent: Phaser.GameObjects.Container, key: string, x: number, y: number, width: number, height: number, band: number, owned = true) {
    const baked = roundedArtTexture(this, key, width, height, 6, band, { x: 0.5, y: height < 200 ? 0.28 : 0.5 });
    if (this.textures.exists(baked)) {parent.add(this.add.image(x, y, baked).setScale(1 / RENDER_SCALE).setAlpha(owned ? 1 : 0.72));}
    else {
      parent.add(roundedPanel(this, x, y, width, height, COLORS.panelHero));
      if(height<100)addText(this,parent,x,y,"Chưa có ảnh",11,MUTED).setOrigin(.5);
      else {addText(this, parent, x, y - 26, "❖", 28, MUTED).setOrigin(0.5);addText(this, parent, x, y, "Chưa tải được ảnh", 12, MUTED).setOrigin(0.5);}
    }
  }
  private fit(parent: Phaser.GameObjects.Container, x: number, y: number, content: string, width: number, size = 14, color: string = COLORS.text) {
    const text = addText(this, parent, x, y, content, size, color);
    let end = content.length;
    while (text.width > width && end > 0) text.setText(`${content.slice(0, --end)}…`);
    if (end < content.length) {
      text.setInteractive();
      text.on("pointerover", () => {
        if (this.tooltipPinned) return;
        this.hideTooltip(); const bounds = text.getBounds();
        this.tooltip = showTextTooltip(this, bounds.left, bounds.bottom + 8, [content], 330);
      });
      text.on("pointerout", () => { if (!this.tooltipPinned) this.hideTooltip(); });
    }
    return text;
  }
  private selectHero(id: string) {
    if (isModalOpen() || this.tooltipPinned) return;
    if (id !== this.heroId) { this.heroId = id; this.previewUp = false; this.detailScroll = 0; this.formError = ""; }
    this.focusedHeroId = id; this.render(); this.game.canvas.focus();
  }
  private renderTile(hero: Hero, index: number) {
    const x = GRID.x + index % 4 * GRID.stepX + 64, y = GRID.y + Math.floor(index / 4) * GRID.stepY + 71;
    const owned = session.profile.heroes[hero.id], pending = owned ? pendingUnlocks(session.data, session.profile, hero.id) : 0;
    const tile = this.add.container(x, y).setName(`hero-tile:${hero.id}`); this.root.add(tile);
    this.art(tile, `heroes:${hero.id}`, 0, -16, 128, 54, 0, owned !== undefined);
    tile.add(this.add.rectangle(0, 41, 128, 60, 0x101b30, 0.95));
    const border = owned?.constellation === MAX_CONSTELLATION ? COLORS.goldFill : COLORS.panelBorder;
    tile.add(this.add.graphics().lineStyle(owned?.constellation === MAX_CONSTELLATION ? 3 : 1, border).strokeRoundedRect(-64, -71, 128, 142, 6));
    if (hero.id === this.heroId || hero.id === this.focusedHeroId) tile.add(this.add.graphics().lineStyle(2, hero.id === this.heroId ? 0xe0edff : 0x80bedf).strokeRoundedRect(-67, -74, 134, 148, 8));
    tile.add(this.add.rectangle(-5, -57, 106, 22, 0x0b1526, 0.92));
    addText(this, tile, -55, -65, HERO_RARITY_LABELS[hero.rarity], 12, `#${RARITY_COLORS[hero.rarity].toString(16).padStart(6, "0")}`);
    const name = this.add.text(-54, 14, hero.name, { ...TEXT_BASE, fontSize: "14px", color: COLORS.text, wordWrap: { width: 110 }, lineSpacing: 0 }); tile.add(name);
    if (!owned) { this.icon(tile, "lock", -48, 58, 16); addText(this, tile, -35, 50, "Chưa sở hữu", 12, MUTED); }
    else addText(this, tile, -54, 50, `Tinh Hồn ${owned.constellation}/6`, 12, owned.constellation === 6 ? COLORS.gold : MUTED);
    const hit = this.add.rectangle(0, 0, 128, 142, 0, 0).setRounded(6).setStrokeStyle(1,COLORS.panelBorder).setInteractive({ useHandCursor: true }); tile.add(hit);
    hit.on("pointerover", () => hit.setFillStyle(0xffffff, 0.055)); hit.on("pointerout", () => hit.setFillStyle(0, 0));
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) this.selectHero(hero.id); });
    if (pending) {
      const badge = this.add.rectangle(47, -57, 24, 24, 0xb8912c).setRounded(6).setStrokeStyle(1,COLORS.goldFill).setInteractive({ useHandCursor: true }); tile.add(badge);
      addText(this, tile, 47, -57, String(pending), 13, "#141024").setOrigin(0.5);
      badge.on("pointerover", () => { if (!this.tooltipPinned) this.tooltip = showTextTooltip(this, x - 55, y - 10, [`Có ${pending} lượt mở lá`], 200); });
      badge.on("pointerout", () => { if (!this.tooltipPinned) this.hideTooltip(); });
      badge.on("pointerup", () => this.selectHero(hero.id));
    }
  }

  private renderPortrait() {
    const hero = session.data.heroes[this.heroId]!, owned = session.profile.heroes[hero.id];
    this.art(this.root, `heroes:${hero.id}${this.previewUp ? "_up" : ""}`, 731, 406, 270, 444, 80);
    this.root.add(this.add.rectangle(731, 593, 270, 70, 0x101b30, 0.93));
    addText(this, this.root, 612, 565, "HÌNH NHÂN VẬT", 12, MUTED);
    this.accessibleButton(this.root, 659, 606, 110, this.previewUp ? "Thường" : "✓ Thường", () => { this.previewUp = false; this.render(); }, true, { height: 32 });
    this.accessibleButton(this.root, 795, 606, 126, this.previewUp ? "✓ Thăng cấp" : "Thăng cấp", () => { this.previewUp = true; this.render(); }, true, { height: 32 });
    const note = this.previewUp && owned?.levelUpForm === "alt" && owned.constellation >= 5 ? "Ảnh thăng cấp cơ bản · Dạng thứ hai chưa có ảnh riêng" : "Xem ảnh không thay đổi dạng đang dùng";
    this.root.add(this.add.text(608, 648, note, { ...TEXT_BASE, fontSize: "12px", color: MUTED, wordWrap: { width: 248 } }).setName("art-preview-note"));
  }

  private renderDetail(inList: boolean) {
    const hero = session.data.heroes[this.heroId]!, owned = session.profile.heroes[hero.id], level = owned?.constellation ?? 0;
    const form = owned?.levelUpForm === "alt" && level >= 5 ? hero.altLevelUp : hero.levelUp;
    this.root.add(roundedPanel(this, 1070, 391, 380, 486, 0x101b30, 0.97, 0x3a4a65, 10));
    addText(this, this.root, 904, 160, `${FACTION_LABELS[hero.faction]}  ·  ${HERO_ROLE_LABELS[hero.archetype]}`, 13, MUTED);
    this.fit(this.root, 904, 184, hero.name, 332, 28, COLORS.text);
    addText(this, this.root, 904, 223, `${HERO_RARITY_LABELS[hero.rarity]}  ·  Máu ${hero.maxHp}`, 14, MUTED);
    addText(this, this.root, 904, 247, owned ? `Đã sở hữu  ·  Tinh Hồn ${level}/6` : "Chưa sở hữu — nhận qua Triệu Hồi", 13, owned ? COLORS.text : MUTED);
    for (let i = 0; i < MAX_CONSTELLATION; i++) {
      const pip = this.add.circle(912 + i * 23, 284, 7, level > i ? COLORS.goldFill : 0x29394e).setStrokeStyle(1, level > i ? COLORS.goldFill : 0x7b8ba4).setInteractive({ useHandCursor: true }); this.root.add(pip);
      pip.on("pointerover", () => { if (!this.tooltipPinned) this.tooltip = showTextTooltip(this, 894, 300, [`Tinh Hồn ${i + 1}: ${CONSTELLATION_TEXT[i]}`], 330); });
      pip.on("pointerout", () => { if (!this.tooltipPinned) this.hideTooltip(); });
      pip.on("pointerup", () => { if (isModalOpen() || this.tooltipPinned) return; this.tab = "constellation"; this.detailScroll = 0; this.render(); });
    }
    this.fit(this.root, 1052, 276, inList ? `Dạng: ${form.name}` : "Ngoài bộ lọc", 184, 12, MUTED);
    this.root.add(this.add.rectangle(1070, 310, 332, 1, 0x475671));
    ([["overview", "Tổng quan"], ["story", "Cốt truyện"], ["constellation", "Tinh Hồn"], ["cards", "Lá chủ lực"]] as const).forEach(([tab, label], index) => {
      const x = 944 + index * 82;
      this.controls.button(this.root,x,311,78,label,() => { this.tab=tab;this.detailScroll=0;this.render(); }, {height:34,role:"tab",selected:this.tab===tab,id:`hero-tab:${tab}`,name:`Chi tiết Hero: ${label}`});
    });
    this.detailArea = { ...DETAIL };
    this.detailContent = this.add.container(DETAIL.x, DETAIL.y); this.root.add(this.detailContent);
    this.maskShape = this.add.graphics().fillStyle(0xffffff).fillRect(DETAIL.x, DETAIL.y, DETAIL.width, DETAIL.height).setVisible(false);
    if (this.renderer.type === Phaser.WEBGL) { this.detailContent.enableFilters(); this.detailContent.filters!.external.addMask(this.maskShape, false, this.cameras.main); }
    else { this.detailMask = this.maskShape.createGeometryMask(); this.detailContent.setMask(this.detailMask); }
    let y = 0;
    const paragraph = (text: string, size = 14, color: string = COLORS.text) => {
      const label = this.add.text(0, y, displayText(text), { ...TEXT_BASE, fontSize: `${size}px`, color, wordWrap: { width: DETAIL.width - 12 }, lineSpacing: 4 }); this.detailContent.add(label); y += label.height + 12;
    };
    if (this.tab === "overview") {
      paragraph(owned ? "ĐIỀU KIỆN THĂNG CẤP" : "XEM TRƯỚC · TIẾN TRÌNH CƠ BẢN", 12, MUTED);
      paragraph(heroLevelUpCondition(hero, level), 15);
      paragraph(`Thăng cấp — ${form.name}`, 16, COLORS.gold); paragraph(form.description);
      if (level < MAX_CONSTELLATION) { paragraph(`MỐC TIẾP THEO · TINH HỒN ${level + 1}`, 12, MUTED); paragraph(CONSTELLATION_TEXT[level]!, 14); }
      else paragraph("Đã đạt đủ 6 mốc Tinh Hồn", 14, COLORS.gold);
      paragraph(`Nhánh lá: ${hero.branches.map(b => b.name).join(" · ")}`, 13, MUTED);
    } else if (this.tab === "story") {
      paragraph("TIỂU SỬ", 12, MUTED);
      paragraph(hero.bio, 15);
      paragraph(`${FACTION_LABELS[hero.faction]} · ${hero.branches.map(b => b.name).join(" · ")}`, 13, MUTED);
    } else if (this.tab === "constellation") {
      paragraph("CHỌN DẠNG THĂNG CẤP", 12, MUTED);
      const current = owned?.levelUpForm === "alt" && level >= 5 ? "alt" : "base";
      this.accessibleButton(this.detailContent, 77, y + 22, 154, `${current === "base" ? "✓ " : ""}${hero.levelUp.name}`, () => this.chooseForm("base"), !!owned && session.online && !this.busy, { height: 44, fontSize: 14 });
      this.accessibleButton(this.detailContent, 247, y + 22, 154, `${current === "alt" ? "✓ " : ""}${hero.altLevelUp.name}`, () => this.chooseForm("alt"), !!owned && level >= 5 && session.online && !this.busy, { height: 44, fontSize: 14 });
      y += 56;
      const message = this.busy ? "Đang lưu dạng thăng cấp…" : this.formError || (!owned ? "Cần sở hữu Hero để chọn dạng" : level < 5 ? "Dạng thứ hai cần Tinh Hồn 5" : !session.online ? "Cần kết nối server để đổi dạng" : `Dạng đang dùng: ${form.name}`);
      paragraph(message, 13, this.formError ? "#ffb7b7" : MUTED);
      paragraph(`${hero.altLevelUp.name} · ${hero.altLevelUp.description}`, 14);
      paragraph("CÁC MỐC TINH HỒN", 12, MUTED);
      CONSTELLATION_TEXT.forEach((text, index) => paragraph(`${level > index ? "✓" : "○"} ${index + 1}. ${text}`, 14, level > index ? COLORS.gold : MUTED));
      if (owned?.bonusUnlocks) paragraph(`Lượt mở lá thêm: ${owned.bonusUnlocks}`, 14, COLORS.gold);
    } else {
      paragraph("Chạm vào lá để xem đầy đủ", 12, MUTED);
      [hero.signature.cardId, hero.signature.plusCardId].forEach((id, index) => {
        const card = session.data.cards[id]!, active = index === 0 ? level < 4 : level >= 4;
        const x = index * 170;
        this.detailContent.add(this.add.rectangle(x + 77, y + 97, 154, 194, active ? 0x263d40 : 0x1c2b43).setRounded(8).setStrokeStyle(1, active ? 0xaccbc2 : 0x52617e));
        const face = drawCardFace(this, { title: card.name, body: card.text, cost: card.cost, costBase: card.cost, emblem: cardIconOf(card), keywordIds: card.keywords ?? [], artKeys: cardArtCandidates(session.data, card, id), border: COLORS.panelBorder }, "compact");
        face.setScale(0.56).setPosition(x + 77, y + 63); this.detailContent.add(face);
        const title = this.add.text(x + 8, y + 117, card.name, { ...TEXT_BASE, fontSize: "13px", color: COLORS.text, wordWrap: { width: 140 }, lineSpacing: 1 }); this.detailContent.add(title);
        addText(this, this.detailContent, x + 8, y + 161, active ? "✓ Đang dùng" : "Tinh Hồn 4", 12, active ? "#bde7d1" : MUTED);
        const hit = this.add.rectangle(x + 77, y + 97, 154, 194, 0, 0).setName(`hero-card:${id}`).setRounded(8).setStrokeStyle(1,COLORS.panelBorder).setInteractive({ useHandCursor: true }); this.detailContent.add(hit);
        hit.on("pointerover", () => {
          if (this.tooltipPinned) return; this.hideTooltip();
          this.tooltipTimer = this.time.delayedCall(300, () => { this.tooltipTimer = null; if (this.inDetail(this.input.activePointer)) this.showCard(id, false); });
        });
        hit.on("pointerout", () => { if (!this.tooltipPinned) this.hideTooltip(); });
        hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0 && this.inDetail(pointer)) this.showCard(id, true); });
        this.controls.button(this.detailContent,x+77,y+97,154,"",()=>this.showCard(id,true),{height:194,transparent:true,id:`hero-card:${id}`,name:`Xem đầy đủ lá ${card.name}`,clip:this.detailArea});
      });
      y += 206; paragraph("Bản + thay lá chủ lực từ Tinh Hồn 4.", 13, MUTED);
    }
    this.detailHeight = y; this.detailScroll = Phaser.Math.Clamp(this.detailScroll, 0, Math.max(0, y - DETAIL.height)); this.detailContent.y -= this.detailScroll;
    this.clipDetailInput();
    if (y > DETAIL.height) {
      const trackHeight = DETAIL.height, thumbHeight = Math.max(28, trackHeight * DETAIL.height / y);
      this.root.add(this.add.rectangle(1245, DETAIL.y + trackHeight / 2, 4, trackHeight, 0x34435b));
      this.scrollThumb = this.add.rectangle(1245, DETAIL.y + thumbHeight / 2, 6, thumbHeight, 0xc2d2e8).setRounded(3).setStrokeStyle(1,0x526580).setInteractive({ useHandCursor: true }); this.root.add(this.scrollThumb);
      this.input.setDraggable(this.scrollThumb);
      this.scrollThumb.on("drag", (_pointer: Phaser.Input.Pointer, _x: number, dragY: number) => {
        const ratio = Phaser.Math.Clamp((dragY - DETAIL.y - thumbHeight / 2) / (trackHeight - thumbHeight), 0, 1);
        this.scrollDetail(ratio * (this.detailHeight - DETAIL.height) - this.detailScroll);
      });
      ([-1, 1] as const).forEach((direction, index) => {
        const x = 1141 + index * 72;
        const button = this.add.rectangle(x, 617, 46, 28, COLORS.button).setRounded(8).setStrokeStyle(1, COLORS.panelBorder).setInteractive({ useHandCursor: true }); this.root.add(button);
        const label = addText(this, this.root, x, 617, direction < 0 ? "▲" : "▼", 13).setOrigin(0.5);
        button.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) this.scrollDetail(direction * 120); });
        this.scrollArrows.push({ button, label, direction });
      });
      this.updateScrollThumb();
      addText(this, this.root, 904, 608, "Cuộn để xem thêm", 12, MUTED);
    }
    const actions = this.add.container(0, 0).setName("hero-actions"); this.root.add(actions);
    const pending = owned ? pendingUnlocks(session.data, session.profile, hero.id) : 0;
    this.accessibleButton(actions, 989, 666, 202, pending ? `Tu Luyện · ${pending} lượt` : "Tu Luyện", () => this.scene.start("mastery", { heroId: this.heroId }), !!owned, { variant: "primary", height: 44, fontSize: 15 });
    this.accessibleButton(actions, 1181, 666, 142, "Triệu Hồi", () => this.scene.start("gacha"), true, { variant: owned ? "secondary" : "primary", height: 44, fontSize: 15 });
    if (!owned) addText(this, this.root, 888, 698, "Cần sở hữu Hero để Tu Luyện", 12, MUTED);
    else if (!inList) addText(this, this.root, 888, 698, "Hero đang xem nằm ngoài bộ lọc", 12, MUTED);
  }

  private async chooseForm(next: "base" | "alt") {
    const heroId = this.heroId, owned = session.profile.heroes[heroId];
    if (this.busy || !owned || !session.online || (next === "alt" && owned.constellation < 5)) return;
    const current = owned.levelUpForm === "alt" && owned.constellation >= 5 ? "alt" : "base"; if (current === next) return;
    const generation = this.generation; this.busy = true; this.formError = ""; this.render();
    try { await mutate("PUT", `/profile/heroes/${heroId}/level-up-form`, { form: next }); if (this.generation !== generation) return; this.busy = false; this.render(); }
    catch (error) {
      if (this.generation !== generation) return;
      this.busy = false;
      if (this.heroId === heroId) this.formError = errorText(error);
      this.render();
    }
  }
  private inDetail(pointer: Phaser.Input.Pointer) {
    const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y), area = this.detailArea;
    return !isModalOpen() && !this.tooltipPinned && p.x >= area.x && p.x <= area.x + area.width && p.y >= area.y && p.y <= area.y + area.height;
  }
  private clipDetailInput() {
    for (const node of this.detailContent.list) {
      if (!(node instanceof Phaser.GameObjects.Text || node instanceof Phaser.GameObjects.Rectangle) || !node.input) continue;
      const contains = node.input.hitAreaCallback;
      node.input.hitAreaCallback = (hitArea, x, y, object) => {
        if (!contains(hitArea, x, y, object)) return false;
        const world = node.getWorldTransformMatrix().transformPoint(x - node.displayOriginX, y - node.displayOriginY), area = this.detailArea;
        return world.x >= area.x && world.x <= area.x + area.width && world.y >= area.y && world.y <= area.y + area.height;
      };
    }
  }
  private scrollDetail(delta: number) {
    if (isModalOpen() || this.tooltipPinned) return;
    this.hideTooltip(); this.detailScroll = Phaser.Math.Clamp(this.detailScroll + delta, 0, Math.max(0, this.detailHeight - this.detailArea.height));
    this.detailContent.y = this.detailArea.y - this.detailScroll; this.updateScrollThumb(); this.controls.sync(this.tooltipPinned,isModalOpen());
  }
  private updateScrollThumb() {
    if (this.scrollThumb) this.scrollThumb.y = DETAIL.y + this.scrollThumb.height / 2 + (DETAIL.height - this.scrollThumb.height) * this.detailScroll / Math.max(1, this.detailHeight - DETAIL.height);
    for (const { button, label, direction } of this.scrollArrows) {
      const enabled = direction < 0 ? this.detailScroll > 0 : this.detailScroll < this.detailHeight - this.detailArea.height;
      if (button.input) button.input.enabled = enabled;
      button.setFillStyle(enabled ? COLORS.button : 0x17243b); label.setColor(enabled ? COLORS.text : "#6e7d95");
    }
  }
  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) { if (dy && this.inDetail(pointer)) this.scrollDetail(dy * 0.65); }
  private onKey(event: KeyboardEvent) {
    if (isModalOpen()) return;
    if (this.tooltipPinned) { if (event.key === "Escape") { this.hideTooltip(); event.preventDefault(); } return; }
    if (event.key === "Escape") { this.scene.start("deck-select"); return; }
    const control = (document.activeElement as HTMLElement | null)?.dataset.equipmentControl;
    if (event.key === "PageDown" || event.key === "PageUp") { this.scrollDetail(event.key === "PageDown" ? 180 : -180); event.preventDefault(); return; }
    if (control && event.key.startsWith("Arrow")) {
      if (control.startsWith("hero-tab:")) {
        const tabs:DetailTab[]=["overview","story","constellation","cards"], step=event.key==="ArrowLeft"||event.key==="ArrowUp"?-1:1;
        this.tab=tabs[(tabs.indexOf(this.tab)+step+tabs.length)%tabs.length]!;this.detailScroll=0;this.render();this.controls.focus(`hero-tab:${this.tab}`);
      } else this.scrollDetail(event.key==="ArrowUp"||event.key==="ArrowLeft"?-80:80);
      event.preventDefault();return;
    }
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 } as Record<string, number>)[event.key];
    if (delta !== undefined) {
      const heroes = filterHeroes(Object.values(session.data.heroes), session.profile.heroes, this.filters); if (!heroes.length) return;
      const current = Math.max(0, heroes.findIndex(h => h.id === (this.focusedHeroId || this.heroId)));
      const index = Phaser.Math.Clamp(current + delta, 0, heroes.length - 1); this.focusedHeroId = heroes[index]!.id; this.page = Math.floor(index / 12); this.render(); event.preventDefault();
    } else if (event.key === "Enter" && this.focusedHeroId) this.selectHero(this.focusedHeroId);
  }
  private showCard(id: string, pinned: boolean) {
    this.hideTooltip();
    if (pinned) {
      this.tooltipPinned = true;
      const layer = this.add.container(0, 0).setDepth(200); this.root.add(layer); this.tooltip = layer;
      const view = visibleWorld(this);
      const veil = this.add.rectangle(640, 360, view.w, view.h, 0x000000, 0.5).setInteractive(); layer.add(veil);
      veil.on("pointerup", () => this.hideTooltip());
      const card = showCardTooltip(this, 582, 628, session.data, id); layer.add(card);
      const bounds = (card.list[0] as Phaser.GameObjects.Container).getBounds();
      const shield = this.add.rectangle(bounds.centerX, bounds.centerY, bounds.width, bounds.height, 0, 0).setInteractive(); layer.add(shield);
      this.accessibleButton(layer, bounds.right - 23, bounds.top + 22, 34, "×", () => this.hideTooltip(), true, { height: 34, fontSize: 20 });
    } else { this.tooltip = showCardTooltip(this, 582, 628, session.data, id); this.root.add(this.tooltip); }
    this.syncFields();
  }
  private hideTooltip() {
    this.tooltipTimer?.remove(false); this.tooltipTimer = null;
    this.tooltip?.destroy(); this.tooltip = null; this.tooltipPinned = false; this.controls?.removePinned();
  }
  private clearMask() { this.detailContent?.clearMask(); this.detailMask?.destroy(); this.detailMask = null; this.maskShape?.destroy(); this.maskShape = null; }
}
