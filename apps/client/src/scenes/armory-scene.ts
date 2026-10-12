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
import { COLORS, RARITY_COLORS, RENDER_SCALE, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, isModalOpen, showToast } from "../ui/widgets";

import { framedImage } from "../ui/contained-art";
import { EquipmentControls } from "../ui/equipment-controls";
import { clearEquipmentFilters, equipmentActionLabel, equipmentChange, equipmentCounts, equipmentNavigation, equipmentPassive, equipmentText } from "../ui/equipment-insights";
const MUTED = "#abb6ce";
const INFO = { x: 875, y: 244, width: 350, height: 276 };
const GRID = { x: 24, y: 188, width: 144, height: 144, stepX: 156, stepY: 152 };
type DetailTab = "effect" | "levels" | "usage";
type Field = HTMLInputElement | HTMLSelectElement | HTMLButtonElement;
type CollectionState = { selected: string; filters: EquipmentFilters; page: number; preview: number; detailTab: DetailTab; scroll: number; history: boolean; expanded: number | null };
const initialState = (): CollectionState => ({ selected: "", filters: equipmentDefaults(), page: 0, preview: 1, detailTab: "effect", scroll: 0, history: false, expanded: null });

/** Collection presentation; equipment and upgrades stay server-authoritative. */
export class ArmoryScene extends Phaser.Scene {
  private controls!: EquipmentControls;
  private error = "";
  private root!: Phaser.GameObjects.Container;
  private tab: EquipmentKind = "weapons";
  private states = { weapons: initialState(), relics: initialState() };
  private focused = "";
  private busy = false;
  private pendingUpgrade: { account: number } | null = null;
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
    const selected = { backgrounds: ["home"], heroes: Object.keys(session.data.heroes), cards: Object.keys(manifest.cards ?? {}), ui: Object.keys(manifest.ui ?? {}) };
    for (const [category, ids] of Object.entries(selected)) for (const id of ids) {
      const key = `${category}:${id}`, url = manifest[category]?.[id];
      if (url && !this.textures.exists(key)) this.load.image(key, url);
    }
  }
  create() {
    useDesignCamera(this); this.controls = new EquipmentControls(this); this.error = "";
    this.generation++; this.busy = this.pendingUpgrade?.account === auth.generation;
    if (this.accountGeneration !== auth.generation) { this.states = { weapons: initialState(), relics: initialState() }; this.tab = "weapons"; this.accountGeneration = auth.generation; }
    for (const kind of ["weapons", "relics"] as const) {
      const s = this.states[kind], previous=s.selected;
      const before=this.renderedProfile?equipmentLevel(this.renderedProfile,kind,previous):undefined;
      s.selected = initialEquipmentId(session.data, session.profile, kind, previous);
      const after=equipmentLevel(session.profile,kind,s.selected);
      if(previous!==s.selected||before!==after) s.preview=after??1;
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
      this.controls.destroy(); this.hideTooltip(); this.clearMask();
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
  private onUpdate() { this.reconcileProfile(); this.syncFields(); this.controls.sync(this.tooltipPinned, isModalOpen()); }
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
      add(b, kind === "weapons" ? "Binh Khí" : "Nguyệt Bảo", 24 + i * 312, 64, 300, 34);
    });
    const search = document.createElement("input"); search.type = "search"; search.maxLength = 80; search.placeholder = "⌕  Tìm trang bị…";
    search.addEventListener("input", () => { this.state.filters.query = search.value; this.changeFilter(); }); add(search, "Tìm trang bị", 24, 104, 300);
    const rarity = document.createElement("select"); rarity.add(new Option("Mọi độ hiếm", "all"));
    for (const [value, label] of Object.entries(HERO_RARITY_LABELS)) rarity.add(new Option(label, value));
    rarity.addEventListener("change", () => { this.state.filters.rarity = rarity.value as EquipmentFilters["rarity"]; this.changeFilter(); }); add(rarity, "Độ hiếm", 332, 104, 136);
    const sort = document.createElement("select");
    ([["owned", "Đã có trước"], ["rarity", "Hiếm cao → thấp"], ["level", "Cấp cao → thấp"], ["name", "Tên A–Z"]] as const).forEach(([value, label]) => sort.add(new Option(label, value)));
    sort.addEventListener("change", () => { this.state.filters.sort = sort.value as EquipmentFilters["sort"]; this.changeFilter(); }); add(sort, "Sắp xếp", 476, 104, 160);
    ([["all", "Tất cả"], ["owned", "Đã sở hữu"], ["upgrade", "Nâng cấp được"], ["locked", "Chưa sở hữu"]] as const).forEach(([value, label], i) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.ownership = value;
      b.addEventListener("click", () => { this.state.filters.ownership = value; this.changeFilter(); }); add(b, label, 24 + i * 156, 146, 144, 32);
      const asset=manifest.ui?.[({all:"nav_inventory",owned:"check",upgrade:"bolt",locked:"lock"} as const)[value]];
      if(asset){const icon=document.createElement("img");icon.src=asset;icon.alt="";icon.style.cssText="width:20px;height:20px;object-fit:contain;margin-right:10px";const count=document.createElement("span");b.replaceChildren(icon,count);b.style.display="flex";b.style.alignItems="center";b.style.justifyContent="center";}
    });
  }
  private changeFilter() { this.state.page = 0; this.focused = ""; this.render(); }
  private resetFilters() { this.state.filters = clearEquipmentFilters(this.state.filters); this.changeFilter(); }
  private syncFields() {
    for (const { element } of this.fields) {
      element.style.visibility = this.tooltipPinned || isModalOpen() ? "hidden" : "visible";
      if (element instanceof HTMLButtonElement) {
        const kind = element.dataset.kind as EquipmentKind | undefined;
        const active = kind ? kind === this.tab : element.dataset.ownership === this.state.filters.ownership;
        if (kind) {
          const defs = Object.keys(session.data[kind]), count = defs.filter(id => equipmentLevel(session.profile, kind, id) !== undefined).length;
          const label = `${kind === "weapons" ? "Binh Khí" : "Nguyệt Bảo"} · Đã có ${count}/${defs.length}`;
          if (element.textContent !== label) { element.textContent = label; element.setAttribute("aria-label", label); }
        }
        if (!kind) { const key = element.dataset.ownership as EquipmentFilters["ownership"]; const counts = equipmentCounts(session.data, session.profile, this.tab, this.state.filters, session.online); const label = ({all:"Tất cả",owned:"Đã sở hữu",upgrade:"Nâng cấp được",locked:"Chưa sở hữu"} as const)[key]; const name=label + " (" + counts[key] + ")"; const count=element.querySelector("span");if(count)count.textContent=String(counts[key]);else element.textContent=name;element.setAttribute("aria-label", name); }
        element.style.boxShadow = active ? "inset 0 -2px #f4d35e" : "none";
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
    if (this.textures.exists(`ui:${id}`)) framedImage(this,parent,`ui:${id}`,x,y,size,size,2);
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
    this.hideTooltip(); this.controls.clear(); this.clearMask(); this.root.removeAll(true); this.scrollThumb = null;
    const cam = this.cameras.main; cam.setZoom(Math.min(RENDER_SCALE, cam.width / 1280, cam.height / 720)).centerOn(640, 360); this.fieldPlacement = "";
    const view = visibleWorld(this);
    if (this.textures.exists("backgrounds:home")) {const image=this.add.image(640,360,"backgrounds:home");image.setScale(Math.min(view.w/image.width,view.h/image.height));this.root.add(image);}
    this.root.add(this.add.rectangle(640, 360, view.w, view.h, COLORS.background, 0.82));
    this.control(this.root, 82, 32, 116, "Quay lại", () => this.scene.start("deck-select"), true, { height: 40,icon:"ui:nav_back" });
    addText(this, this.root, 164, 8, "Kho đồ", 27); addText(this, this.root, 164, 42, "Bộ sưu tập trang bị", 12, MUTED);
    (["darkIron", "moonDust"] as const).forEach((id, i) => {
      const x = 1034 + i * 122; this.icon(this.root, `cur_${id}`, x, 40, 28);
      addText(this, this.root, x + 22, 19, id === "darkIron" ? "Huyền Thiết" : "Nguyệt Trần", 11, MUTED);
      this.fit(this.root, x + 22, 38, session.profile.currencies[id].toLocaleString("vi-VN"), 82, 15, id === (this.tab === "weapons" ? "darkIron" : "moonDust") ? COLORS.text : MUTED);
    });
    this.root.add(roundedPanel(this, 330, 411, 628, 466, 0x0c192c, 0.92, 0x293c55, 8));
    const filtered = filterEquipment(session.data, session.profile, this.tab, this.state.filters, session.online);
    const range = rosterPage(filtered.length, this.state.page); this.state.page = range.page;
    filtered.slice(range.start, range.end).forEach((def, index) => this.renderTile(def.id, index));
    if (!filtered.length) {
      addText(this, this.root, 330, 358, "Không tìm thấy trang bị phù hợp", 17).setOrigin(0.5);
      addText(this, this.root, 330, 389, this.state.filters.ownership === "upgrade" && !session.online ? "Đang mất kết nối" : "Thử tên khác hoặc bỏ bộ lọc", 13, MUTED).setOrigin(0.5);
      this.control(this.root, 330, 435, 180, "Xóa bộ lọc", () => this.resetFilters(), true, { height: 40,icon:"ui:action_reset" });
    }
    addText(this, this.root, 24, 648, `Hiển thị ${filtered.length}/${Object.keys(session.data[this.tab]).length} · Trang ${range.page + 1}/${range.pages}`, 12, MUTED);
    this.control(this.root, 280, 671, 40, "‹", () => { this.state.page--; this.render(); }, range.page > 0, { height: 40, name:"Trang trước",icon:"ui:nav_back" });
    for (let page=0;page<range.pages;page++) this.control(this.root, 324+page*44, 671, 40, String(page+1), () => {this.state.page=page;this.render();}, true, {selected:this.state.page===page,height:40,name:`Trang ${page+1}`});
    this.control(this.root,324+range.pages*44,671,40,"›",()=>{this.state.page++;this.render();},this.state.page+1<range.pages,{height:40,name:"Trang sau",icon:"ui:nav_back",rotation:Math.PI});
    const active = this.state.filters.query !== "" || this.state.filters.rarity !== "all" || this.state.filters.ownership !== "all";
    this.control(this.root,574,671,120,"Xóa bộ lọc",()=>this.resetFilters(),active,{height:40,icon:"ui:action_reset"});
    if(session.data[this.tab][this.selected]) this.renderDetails(filtered.findIndex(d=>d.id===this.selected));
    this.controls.announce(`${filtered.length} kết quả. ${session.data[this.tab][this.selected]?.name ?? ""}. ${this.error}`);
    this.syncFields();this.controls.sync(false,isModalOpen());
  }
  private control(parent: Phaser.GameObjects.Container,x:number,y:number,width:number,label:string,action:()=>void,enabled=true, options:{height?:number;selected?:boolean;primary?:boolean;name?:string;role?:"tab";id?:string;pinned?:boolean;clip?:typeof INFO;transparent?:boolean;icon?:string;rotation?:number;iconLabel?:string}={}) {
    return this.controls.button(parent,x,y,width,label,action,{...options,enabled});
  }

  private renderTile(id: string,index: number) {
    const def=session.data[this.tab][id]!,level=equipmentLevel(session.profile,this.tab,id),owned=level!==undefined;
    const x=GRID.x+index%4*GRID.stepX,y=GRID.y+Math.floor(index/4)*GRID.stepY;
    const tile=this.add.container(x,y).setName(`equipment-tile:${id}`);this.root.add(tile);
    tile.add(roundedPanel(this,72,72,144,144,0x15263c,1,id===this.selected?COLORS.goldFill:0x40536d,8));
    const art=addEquipmentArt(this,tile,this.tab,id,72,56,132,76);if(art)art.setAlpha(owned?1:.4);
    tile.add(this.add.rectangle(72,98,140,3,RARITY_COLORS[def.rarity]));
    const short=({common:"Phổ thông",rare:"Hiếm",epic:"Sử thi",legendary:"Truyền thuyết"} as const)[def.rarity];
    addText(this,tile,8,2,short,10,MUTED);
    const name=addText(this,tile,8,103,def.name,13).setWordWrapWidth(128).setLineSpacing(0);
    if(name.height>30){name.setVisible(false);this.fit(tile,8,103,def.name,128,13).setWordWrapWidth(128);} // Full name remains in the panel/semantic name.
    addText(this,tile,8,129,owned?`${equipmentTag(this.tab)} ${level}/5`:"Chưa có",11,MUTED);
    const up=equipmentUpgrade(session.data,session.profile,this.tab,id,session.online,this.busy);
    const used=equipmentDecks(session.profile.decks,this.tab,id).length;
    if(level===5||up.enabled||used) {const key=level===5?"star":up.enabled?"bolt":"nav_inventory";this.icon(tile,key,136,136,14);}
    if(id===this.selected){tile.add(this.add.rectangle(72,72,142,142,0,0).setStrokeStyle(2,COLORS.goldFill));addText(this,tile,137,2,"✓",14,COLORS.gold).setOrigin(1,0);}
    tile.add(this.add.rectangle(72,72,150,150,0,0).setStrokeStyle(2,0xc1ddf4));
    const focusRing=tile.list.at(-1) as Phaser.GameObjects.Rectangle; focusRing.setVisible(id===this.focused);
    this.controls.button(tile,72,72,144,"",()=>this.selectItem(id),{height:144,id:"tile:"+id,name:def.name+", "+HERO_RARITY_LABELS[def.rarity]+", "+(owned?equipmentTag(this.tab)+" "+level:"chưa sở hữu"),transparent:true,onFocus:()=>{this.focused=id;focusRing.setVisible(true);},onBlur:()=>focusRing.setVisible(false)});
  }
  private selectItem(id: string) {
    if(!session.data[this.tab][id]) return;
    this.state.selected=id;this.state.preview=equipmentLevel(session.profile,this.tab,id)??1;this.state.scroll=0;this.state.expanded=null;this.error="";this.focused=id;this.render();
  }
  private renderDetails(index: number) {
    const id=this.selected,def=session.data[this.tab][id]!,owned=equipmentLevel(session.profile,this.tab,id),tag=equipmentTag(this.tab);
    this.root.add(roundedPanel(this,956,389,600,622,0x101b30,.98,0x425370,10));
    const rarityColor="#"+RARITY_COLORS[def.rarity].toString(16).padStart(6,"0");
    addText(this,this.root,675,92,`${HERO_RARITY_LABELS[def.rarity]} · ${this.tab==="weapons"?"BINH KHÍ":"NGUYỆT BẢO"}`,12,rarityColor);
    this.fit(this.root,675,116,def.name,552,25);
    addText(this,this.root,675,155,owned===undefined?"Chưa sở hữu":`Đã có · ${tag} ${owned}/5`,13);
    if(index<0) this.control(this.root,1056,164,356,"Món nằm ngoài bộ lọc · Xóa bộ lọc",()=>this.resetFilters(),true,{height:30,icon:"ui:action_reset",iconLabel:"Ngoài bộ lọc"});
    else if(Math.floor(index/12)!==this.state.page) this.control(this.root,1078,164,312,`Đang xem trang ${Math.floor(index/12)+1} · Đến món`,()=>{this.state.page=Math.floor(index/12);this.render();},true,{height:30,icon:"ui:nav_inventory",iconLabel:`Món ở trang ${Math.floor(index/12)+1}`});
    const used=equipmentDecks(session.profile.decks,this.tab,id);
    ([["effect","Hiệu ứng"],["levels","Các cấp"],["usage",`Bộ bài (${used.length})`]] as const).forEach(([tab,label],i)=>this.control(this.root,765+i*184,207,172,label,()=>{this.state.detailTab=tab;this.state.scroll=0;this.render();},true,{role:"tab",selected:this.detailTab===tab,height:38,id:`detail:${tab}`,icon:tab==="effect"?"ui:intent_special":tab==="levels"?"ui:star":"ui:nav_inventory",iconLabel:tab==="usage"?String(used.length):undefined}));
    this.root.add(roundedPanel(this,768,346,186,212,0x0c1628,1,0x455570,8));
    if(!addEquipmentArt(this,this.root,this.tab,id,768,346,178,208))addText(this,this.root,768,340,"Chưa có hình trang bị",14,MUTED).setOrigin(.5);
    const artHit=this.control(this.root,768,346,186,"",()=>this.showArt(),true,{height:212,name:"Xem toàn bộ hình trang bị",id:"art:image",transparent:true});artHit.setFillStyle(0,0);
    this.control(this.root,768,476,186,"Phóng to hình trang bị",()=>this.showArt(),true,{height:36,icon:"ui:action_more"});
    if(this.tab==="weapons"){
      const weapon=session.data.weapons[id]!,hero=weapon.signatureHeroId?session.data.heroes[weapon.signatureHeroId]:undefined;
      if(hero){if(this.textures.exists(`heroes:${hero.id}`))framedImage(this,this.root,`heroes:${hero.id}`,691,518,32,38);this.fit(this.root,714,508,`Bản mệnh: ${hero.name}`,145,12,MUTED);}
      else addText(this,this.root,675,507,`Vũ khí chung · ${weapon.archetype?HERO_ROLE_LABELS[weapon.archetype]:""}`,12,MUTED).setWordWrapWidth(185);
      this.control(this.root,768,545,186,"Xem lá Binh Khí",()=>this.showCard(true),true,{height:36,icon:"ui:nav_banners"});
    }else addText(this,this.root,675,507,"Nguyệt Bảo cho cả đội · tối đa 2 món/bộ bài.",13,MUTED).setWordWrapWidth(185);
    this.renderInfo();this.renderUpgrade();
  }
  private renderInfo() {
    this.detailContent=this.add.container(INFO.x,INFO.y).setName("equipment-info");this.root.add(this.detailContent);
    this.maskShape=this.make.graphics({x:0,y:0});this.maskShape.fillStyle(0xffffff).fillRect(INFO.x,INFO.y,INFO.width,INFO.height);
    if(this.renderer.type===Phaser.WEBGL){this.detailContent.enableFilters();this.detailContent.filters!.external.addMask(this.maskShape,false,this.cameras.main);}
    else {this.detailMask=this.maskShape.createGeometryMask();this.detailContent.setMask(this.detailMask);}
    let y=0;
    const paragraph=(text:string,size=14,color:string=COLORS.text)=>{const line=addText(this,this.detailContent,0,y,equipmentText(text),size,color).setWordWrapWidth(INFO.width-18).setLineSpacing(4);y+=line.height+12;return line;};
    const button=(label:string,action:()=>void,width=224,selected=false,name=label,icon?:string)=>{this.control(this.detailContent,width/2,y+20,width,label,action,true,{height:40,selected,name,clip:INFO,icon});y+=50;};
    const level=equipmentLevel(session.profile,this.tab,this.selected),shown=this.state.preview,tag=equipmentTag(this.tab);
    const passive=(n:number)=>{
      const current=equipmentPassive(session.data,this.selected,n);
      paragraph("NỘI TẠI",11,MUTED);
      if(current){current.normal.forEach(line=>paragraph(line));if(current.signature.length){const hero=session.data.heroes[session.data.weapons[this.selected]!.signatureHeroId??""];paragraph(`Khi ${hero?.name??"Hero bản mệnh"} mang`,12,"#e0bd7d");current.signature.forEach(line=>paragraph(line));}}
      else paragraph(equipmentEffects(session.data,this.tab,this.selected,n).passive);
    };
    if(this.detailTab==="effect"){
      paragraph(`${level===undefined?"Xem trước":"Đang xem"} ${tag} ${shown}${level===shown?" · Đã có":""}`,12,shown!==level?"#e0bd7d":MUTED);
      for(let n=1;n<=5;n++) this.control(this.detailContent,22+(n-1)*48,y+20,42,String(n),()=>{this.state.preview=n;this.state.scroll=0;this.render();},true,{selected:n===shown,height:40,name:`Xem ${tag} ${n}`,id:`preview:${n}`,clip:INFO});
      y+=50;if(level!==undefined&&shown!==level)button("Về cấp đang có",()=>{this.state.preview=level;this.state.scroll=0;this.render();},44,false,"Về cấp đang có","ui:action_reset");
      const effect=equipmentEffects(session.data,this.tab,this.selected,shown);
      paragraph(effect.card?"LÁ BINH KHÍ":"HIỆU ỨNG CỦA ĐỘI",11,MUTED);paragraph(effect.title,17,COLORS.gold);
      if(effect.card)paragraph(`${effect.card.cost} Nguyệt Lực · ${effect.card.copies} lá trong bộ bài`,12,"#c1ddf4");
      paragraph(effect.text);
      if(this.tab==="weapons"){
        passive(shown);
        button(this.state.history?"Ẩn lịch sử nội tại":"Xem lịch sử nội tại",()=>{this.state.history=!this.state.history;this.render();},44,this.state.history,undefined,"ui:action_more");
        if(this.state.history){paragraph("Nội tại gốc / thay đổi đã áp dụng",12,MUTED);paragraph(effect.passive,13,MUTED);}
      }
      if(effect.card?.keywords?.length){paragraph("TỪ KHÓA",11,MUTED);for(const key of effect.card.keywords){const kw=session.data.keywords[key];if(kw)paragraph(`${kw.name}: ${kw.text}`,13,MUTED);}}
    } else if(this.detailTab==="levels"){
      paragraph(this.tab==="weapons"?"Các mốc thay đổi tích lũy":"Mỗi cấp thay thế toàn bộ cấp trước",12,MUTED);
      for(let n=1;n<=5;n++){
        const selected=this.state.expanded===n;
        button(`${level===n?"▶":level!==undefined&&level>=n?"✓":"○"} ${tag} ${n}`,()=>{this.state.expanded=selected?null:n;this.render();},300,level===n,`Chi tiết ${tag} ${n}`);
        const effect=equipmentEffects(session.data,this.tab,this.selected,n);
        paragraph(n===1?effect.text:equipmentChange(session.data,this.tab,this.selected,n-1).join(" · "),13,level===n?COLORS.text:MUTED);
        if(selected){if(effect.card)paragraph(`${effect.card.cost} Nguyệt Lực · ${effect.card.copies} lá trong bộ bài`,12);paragraph(effect.text);if(this.tab==="weapons")passive(n);}
      }
    }else{
      paragraph("BỘ BÀI ĐANG DÙNG",11,MUTED);
      const decks=equipmentDecks(session.profile.decks,this.tab,this.selected);
      if(!decks.length)paragraph("Chưa được dùng trong bộ bài đã lưu.");
      for(const deck of decks){
        paragraph(deck.name,16,COLORS.gold);
        const heroIds=this.tab==="weapons"?Object.entries(deck.weapons??{}).filter(([,weapon])=>weapon===this.selected).map(([hero])=>hero):deck.heroIds;
        heroIds.forEach((hero,i)=>{if(this.textures.exists(`heroes:${hero}`))framedImage(this,this.detailContent,`heroes:${hero}`,16+i*36,y+18,28,34);});y+=42;
        paragraph(this.tab==="weapons"?heroIds.map(hero=>session.data.heroes[hero]?.name??hero).join(", "):"Nguyệt Bảo của đội",12,MUTED);
        button("Mở bộ bài",()=>{session.editingDeck=structuredClone(deck);this.scene.start("deck-builder",{back:"armory",equipment:{kind:this.tab,id:this.selected}});},44,false,`Mở bộ bài ${deck.name}`,"ui:action_edit");
      }
    }
    this.detailHeight=y;this.state.scroll=Phaser.Math.Clamp(this.state.scroll,0,Math.max(0,y-INFO.height));this.detailContent.y-=this.state.scroll;this.clipDetailInput();
    if(y>INFO.height){
      const h=Math.max(28,INFO.height*INFO.height/y);
      this.root.add(this.add.rectangle(1238,INFO.y+INFO.height/2,4,INFO.height,0x34435b));
      this.scrollThumb=this.add.rectangle(1238,INFO.y+h/2,22,h,0xc2d2e8,.65).setStrokeStyle(1,0x526580).setInteractive({useHandCursor:true});this.root.add(this.scrollThumb);this.input.setDraggable(this.scrollThumb);
      this.scrollThumb.on("drag",(_p:Phaser.Input.Pointer,_x:number,dragY:number)=>{const ratio=Phaser.Math.Clamp((dragY-INFO.y-h/2)/(INFO.height-h),0,1);this.scrollDetail(ratio*(this.detailHeight-INFO.height)-this.state.scroll);});this.updateScrollThumb();
      this.control(this.root,1172,542,42,"▲",()=>this.scrollDetail(-180),true,{height:40,name:"Cuộn lên",icon:"ui:nav_back",rotation:Math.PI/2});
      this.control(this.root,1218,542,42,"▼",()=>this.scrollDetail(180),true,{height:40,name:"Cuộn xuống",icon:"ui:nav_back",rotation:-Math.PI/2});
    }
  }
  private renderUpgrade() {
    const up=equipmentUpgrade(session.data,session.profile,this.tab,this.selected,session.online,this.busy);
    const footer=this.add.container(0,0).setName("equipment-actions");this.root.add(footer);
    footer.add(this.add.rectangle(956,633,596,134,0x17283e));
    addText(this,footer,675,572,up.level!==undefined&&up.level<5?`${equipmentTag(this.tab)} ${up.level} → ${up.level+1}`:up.level===5?"Đã đạt cấp tối đa":"Xem trước · Chưa sở hữu",11,"#c1ddf4");
    const changes=up.level===undefined||up.level===5?[]:equipmentChange(session.data,this.tab,this.selected,up.level);
    this.fit(footer,675,590,changes.join(" · ")|| (up.level===5?"Hiệu ứng ở cấp tối đa":"Sở hữu trang bị để mở nâng cấp"),558,14,COLORS.text);
    this.icon(footer,`cur_${up.materialId}`,686,624,18);
    addText(this,footer,702,617,up.cost===null?up.material:`Cần ${up.cost.toLocaleString("vi-VN")} ${up.material}`,13);
    this.fit(footer,1235,617,up.cost===null?`Có ${up.have.toLocaleString("vi-VN")}`:up.missing?`Đang có ${up.have.toLocaleString("vi-VN")} · Thiếu ${up.missing.toLocaleString("vi-VN")}`:`Đang có ${up.have.toLocaleString("vi-VN")} · Sau nâng còn ${(up.have-up.cost).toLocaleString("vi-VN")}`,282,12,up.missing?"#f1a6a6":"#bde7d1").setOrigin(1,0);
    this.control(footer,906,659,462,equipmentActionLabel(session.data,session.profile,this.tab,this.selected,session.online,this.busy),()=>void this.upgrade(),up.enabled,{height:42,primary:up.level!==undefined,icon:up.level===undefined?"ui:lock":up.level===5?"ui:star":!session.online?"ui:muted":up.missing?"ui:lock":"ui:bolt",iconLabel:up.enabled?"Nâng cấp":undefined});
    this.control(footer,1196,659,90,"Triệu Hồi",()=>this.scene.start("gacha"),!this.busy,{height:42,primary:up.level===undefined,icon:"ui:nav_banners"});
    this.fit(footer,675,686,this.error||(!up.enabled?up.reason:""),558,12,this.error||up.missing?"#f1a6a6":MUTED);
  }
  private async upgrade() {
    if (this.reconcileProfile()) return; // A fresh click must confirm the action after its displayed price changes.
    const id = this.selected, kind = this.tab;
    if (!equipmentUpgrade(session.data, session.profile, kind, id, session.online, this.busy).enabled) return;
    const before=equipmentLevel(session.profile,kind,id); this.error="";
    const generation = this.generation, accountGeneration = auth.generation;
    const pending={account:accountGeneration};this.pendingUpgrade=pending; this.busy = true; this.render();
    try {
      await mutate("POST", `/profile/${kind}/${id}/upgrade`);
      if (this.generation !== generation || auth.generation !== accountGeneration) return;
      this.busy = false;
      if (this.states[kind].selected === id) this.states[kind].preview = equipmentLevel(session.profile, kind, id) ?? 1;
      this.render(); showToast(this, [`${session.data[kind][id]!.name} · ${equipmentTag(kind)} ${before} → ${equipmentLevel(session.profile,kind,id)}`]);
    } catch (error) {
      if (this.generation !== generation || auth.generation !== accountGeneration) return;
      this.busy = false; this.error=errorText(error); this.render(); showToast(this, [`${session.data[kind][id]!.name}: ${errorText(error)}`]);
    } finally {
      if(this.pendingUpgrade===pending){
        this.pendingUpgrade=null;
        if(pending.account===auth.generation&&this.scene.isActive()){this.busy=false;this.render();}
      }
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
    this.hideTooltip(); this.state.scroll = Phaser.Math.Clamp(this.state.scroll + delta, 0, Math.max(0, this.detailHeight - INFO.height)); this.detailContent.y = INFO.y - this.state.scroll; this.updateScrollThumb(); this.controls.sync(this.tooltipPinned,isModalOpen());
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
      const current = Math.max(0, defs.findIndex(d => d.id === (this.focused || this.selected))); const index = equipmentNavigation(current,event.key,defs.length);
      const next=defs[index]!.id;this.focused = next; this.state.page = Math.floor(index / 12); this.render(); this.controls.focus(`tile:${next}`); event.preventDefault();
    } else if (event.key === "Enter" && this.focused) { this.selectItem(this.focused); event.preventDefault(); }
  }
  private overlay() {
    this.hideTooltip(); this.tooltipPinned = true;
    const layer = this.add.container(0, 0).setDepth(2000); this.tooltip = layer; this.root.add(layer);
    const view = visibleWorld(this); const veil = this.add.rectangle(640, 360, view.w, view.h, 0x000000, 0.7).setInteractive(); layer.add(veil); veil.on("pointerup", () => { this.hideTooltip(); this.syncFields(); });
    this.syncFields(); this.controls.sync(true,isModalOpen()); return layer;
  }
  private showArt() {
    const layer=this.overlay(),view=visibleWorld(this),height=Math.min(650,view.h-32),width=Math.min(452,view.w-32),cx=view.x+view.w/2,cy=view.y+view.h/2;
    layer.add(roundedPanel(this,cx,cy,width,height,0x101b30,1,0x657590,10));
    const shield=this.add.rectangle(cx,cy,width,height,0,0).setInteractive();layer.add(shield);
    this.fit(layer,cx-width/2+16,cy-height/2+14,session.data[this.tab][this.selected]!.name,width-80,18);
    addEquipmentArt(this,layer,this.tab,this.selected,cx,cy+8,width-32,height-100);
    this.control(layer,cx+width/2-28,cy-height/2+27,44,"×",()=>{this.hideTooltip();this.syncFields();},true,{height:44,pinned:true,name:"Đóng hình trang bị",id:"popup:art-close",icon:"ui:action_close"});
    this.controls.sync(true,isModalOpen());
  }
  private showCard(pinned:boolean) {
    const effect=equipmentEffects(session.data,this.tab,this.selected,this.state.preview),card=effect.card;if(!card)return;
    const hero=session.data.heroes[session.data.weapons[this.selected]?.signatureHeroId??""];
    const extra=[`Xem Tinh Luyện ${this.state.preview}`,...(hero?[`Bản mệnh: ${hero.name}`]:[])];
    if(pinned){
      const layer=this.overlay();const preview=showCardTooltip(this,470,670,session.data,{...card,text:equipmentText(card.text)},extra);layer.add(preview);
      const bounds=(preview.list[0] as Phaser.GameObjects.Container).getBounds();const shield=this.add.rectangle(bounds.centerX,bounds.centerY,bounds.width,bounds.height,0,0).setInteractive();layer.add(shield);
      this.control(layer,bounds.right-25,bounds.top+25,44,"×",()=>{this.hideTooltip();this.syncFields();},true,{height:44,pinned:true,name:"Đóng lá bài",id:"popup:card-close",icon:"ui:action_close"});this.controls.sync(true,isModalOpen());
    }else{this.hideTooltip();this.tooltip=showCardTooltip(this,470,670,session.data,card,extra);}
  }
  private hideTooltip(){this.tooltip?.destroy();this.tooltip=null;this.tooltipPinned=false;this.controls?.removePinned();this.controls?.sync(false,isModalOpen());}
  private clearMask() { this.detailContent?.filters?.external.clear(); this.detailContent?.clearMask(); this.detailMask?.destroy(); this.detailMask = null; this.maskShape?.destroy(); this.maskShape = null; }
}
