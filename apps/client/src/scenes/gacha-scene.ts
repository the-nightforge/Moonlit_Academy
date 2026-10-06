import Phaser from "phaser";
import type { GameData, PullResult, Rarity } from "rules";
import { featuredEntry, featuredRotationEnd, reservedFeaturedHeroes, weekKey } from "rules";
import manifest from "virtual:assets-manifest";
import { achievementNotices, errorText, mutate, type ProfileReply } from "../account";
import { api } from "../api";
import { session } from "../session";
import { loadCombatSettings } from "../ui/combat-settings";
import { GachaAudio } from "../ui/gacha-audio";
import { roundedPanel } from "../ui/rounded-panel";
import { preloadEquipmentArt } from "../ui/equipment-art";
import { COLORS, CURRENCY_LABELS, RARITY_COLORS, RARITY_LABELS, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, alertModal, confirmModal, isModalOpen, showToast } from "../ui/widgets";

const RARITIES: readonly Rarity[] = ["legendary", "epic", "rare", "common"];
const itemName = (data: GameData, id: string) => data.heroes[id]?.name ?? data.weapons[id]?.name ?? data.relics[id]?.name ?? id;
const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
interface HistoryEntry { bannerId: string; results: PullResult[]; createdAt: number }
interface ResultCard { root: Phaser.GameObjects.Container; result: PullResult; width: number; height: number; revealed: boolean }
type PullReply = ProfileReply & { results: PullResult[]; achievements: string[] };

/** Moon altar presentation. Profile changes remain authoritative server replies. */
export class GachaScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private results: Phaser.GameObjects.Container | null = null;
  private resultFooter: Phaser.GameObjects.Container | null = null;
  private modal: Phaser.GameObjects.Container | null = null;
  private modalCleanup: (() => void) | null = null;
  private bannerId = "";
  private phase: "idle" | "pending" | "revealing" | "complete" = "idle";
  private alive = false;
  private generation = 0;
  private historyRequest = 0;
  private reducedMotion = false;
  private revealTweens: Phaser.Tweens.Tween[] = [];
  private cards: ResultCard[] = [];
  private cine: Phaser.GameObjects.Container | null = null;
  private transientVfx = new Set<Phaser.GameObjects.Container>();
  private ambient: Phaser.GameObjects.Container | null = null;
  private artTween: Phaser.Tweens.Tween | null = null;
  private enteredOnce = false;
  private drawer: Phaser.GameObjects.Container | null = null;
  private drawerPanel: Phaser.GameObjects.Container | null = null;
  private countdownText: Phaser.GameObjects.Text | null = null;
  private audio: GachaAudio | null = null;
  private converting = false;
  private hotPull = false;

  private get busy() { return this.phase !== "idle" || this.converting; }

  constructor() { super("gacha"); }

  preload() {
    preloadEquipmentArt(this);
    const heroes = new Set(Object.values(session.data.banners)
      .filter(banner => banner.kind === "hero")
      .flatMap(banner => [...Object.values(banner.pool).flat(), ...(banner.featured?.rotation ?? []).map(entry => entry.heroId)]));
    const rotationSplashes = Object.values(session.data.banners)
      .flatMap(banner => (banner.featured?.rotation ?? []).map(entry => `${banner.id}_${entry.heroId}`));
    const selected = {
      gacha: ["altar", "card_back", "weapon_banner", "relic_banner", "spark",
        ...Object.keys(session.data.banners), ...rotationSplashes,
        "meteor_head", "meteor_tail", "frame_rare", "frame_epic", "frame_legendary", "halo_legendary", "dust_mote"],
      heroes: [...heroes],
      ui: ["cur_moonJade", "cur_moonStar", "cur_honor", "seal", "moon_full", "star", "gear"],
    };
    for (const [category, ids] of Object.entries(selected)) {
      for (const id of ids) {
        const url = manifest[category]?.[id];
        const key = `${category}:${id}`;
        if (url && !this.textures.exists(key)) this.load.image(key, url);
      }
    }
  }

  create() {
    useDesignCamera(this);
    this.alive = true;
    this.generation++;
    this.phase = "idle";
    this.results = null;
    this.modal = null;
    this.cards = [];
    const settings = loadCombatSettings(localStorage, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    this.reducedMotion = settings.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.audio?.dispose();
    this.audio = new GachaAudio(settings);
    this.converting = false;
    this.hotPull = false;
    const unlock = () => void this.audio?.unlock();
    this.input.on("pointerdown", unlock);
    this.root = this.add.container(0, 0);
    this.enteredOnce = false;
    this.ambient = this.add.container(0, 0).setDepth(-1);
    if (this.textures.exists("gacha:spark")) {
      const bounds = visibleWorld(this);
      for (let i = 0; i < 12; i++) {
        const size = 14 + Math.random() * 22;
        const spark = this.add.image(bounds.x + 60 + Math.random() * (bounds.w - 120), 110 + Math.random() * 420, "gacha:spark");
        spark.setDisplaySize(size, size).setAlpha(0.25);
        this.ambient.add(spark);
        if (!this.reducedMotion) {
          this.tweens.add({
            targets: spark, y: spark.y - (20 + Math.random() * 50), alpha: 0.05 + Math.random() * 0.35,
            duration: 2800 + Math.random() * 3200, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 2400,
          });
        }
      }
    }
    this.bannerId = Object.keys(session.data.banners)[0]!;
    const onEsc = () => { if (!isModalOpen()) this.back(); };
    const onArrows = (event: KeyboardEvent) => {
      if (this.busy || this.modal || this.drawer || !this.alive) return;
      const ids = Object.keys(session.data.banners);
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const index = Math.max(0, ids.indexOf(this.bannerId));
      this.bannerId = ids[(index + step + ids.length) % ids.length]!;
      this.render();
    };
    this.input.keyboard?.on("keydown-ESC", onEsc);
    this.input.keyboard?.on("keydown", onArrows);
    this.time.addEvent({ delay: 30_000, loop: true, callback: () => { if (this.alive && !this.modal) this.updateCountdown(); } });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.generation++;
      this.historyRequest++;
      this.cancelReveal();
      this.closeModal();
      this.drawer?.destroy();
      this.drawer = null;
      this.drawerPanel = null;
      this.countdownText = null;
      this.audio?.dispose();
      this.audio = null;
      this.input.off("pointerdown", unlock);
      this.input.keyboard?.off("keydown-ESC", onEsc);
      this.input.keyboard?.off("keydown", onArrows);
      this.tweens.killAll();
      this.cards = [];
      this.results = null;
      this.resultFooter = null;
      this.cine = null;
    });
    this.render();
  }

  private text(parent: Phaser.GameObjects.Container, x: number, y: number, message: string, size = 16, color: string = COLORS.text, width?: number) {
    const text = addText(this, parent, x, y, message, size, color);
    if (width) text.setWordWrapWidth(width);
    return text;
  }

  private image(parent: Phaser.GameObjects.Container, key: string, x: number, y: number, width: number, height: number) {
    if (!this.textures.exists(key)) return null;
    const image = this.add.image(x, y, key);
    image.setScale(Math.min(width / image.width, height / image.height));
    parent.add(image);
    return image;
  }

  private button(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, action: () => void, enabled = true, primary = false) {
    const panel = roundedPanel(this, x, y, width, 42, enabled ? (primary ? 0xb89754 : 0x16253e) : 0x152033, 0.98, enabled ? 0xc8ad73 : 0x44536a, 10);
    const hit = this.add.rectangle(0, 0, width, 42, 0, 0);
    panel.add(hit);
    if (enabled) {
      hit.setInteractive({ useHandCursor: true });
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) action(); });
      hit.on("pointerover", () => panel.setAlpha(0.8));
      hit.on("pointerout", () => panel.setAlpha(1));
    }
    this.text(panel, 0, 0, label, 16, primary && enabled ? "#151c30" : enabled ? COLORS.text : COLORS.dimText).setOrigin(0.5);
    parent.add(panel);
  }

  private render() {
    if (!this.alive) return;
    this.artTween?.stop();
    this.artTween = null;
    this.root.removeAll(true);
    const data = session.data, profile = session.profile, banner = data.banners[this.bannerId]!;
    const { gacha, pullCost } = data.economyConfig;
    const featured = featuredEntry(banner, Date.now());
    const pity = profile.pity[banner.pityGroup ?? this.bannerId] ?? { sinceEpic: 0, sinceLegendary: 0 };
    const enabled = !this.busy && !this.modal;
    const view = visibleWorld(this);
    this.root.add(this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x071222));
    const splash = this.image(this.root, this.splashKey(banner, featured), view.x + view.w / 2, view.y + view.h / 2, view.w, view.h);
    if (splash) {
      splash.setScale(Math.max(view.w / splash.width, view.h / splash.height));
      if (!this.reducedMotion) {
        this.artTween = this.tweens.add({ targets: splash, scaleX: splash.scaleX * 1.02, scaleY: splash.scaleY * 1.02, duration: 9000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
    const scrim = this.add.graphics();
    scrim.fillGradientStyle(0x050c18, 0x050c18, 0x050c18, 0x050c18, 0, 0, 0.9, 0.9);
    scrim.fillRect(0, 360, view.w, view.h - 360);
    this.root.add(scrim);

    this.root.add(this.add.rectangle(640, 43, view.w, 86, 0x091425, 0.92));
    this.button(this.root, 92, 42, 142, "◂ Quay lại", () => this.back(), enabled);
    this.text(this.root, 204, 23, "TRIỆU HỒI", 25, "#f3dfb1");
    this.text(this.root, 205, 54, "Dưới ánh trăng, duyên mới khởi sinh", 13, "#afbfd4");
    let currencyX = 750;
    for (const key of ["moonJade", "moonStar", "honor"] as const) {
      this.image(this.root, `ui:cur_${key}`, currencyX, 41, 28, 28);
      this.text(this.root, currencyX + 22, 22, CURRENCY_LABELS[key], 12, "#b6c3d6");
      this.text(this.root, currencyX + 22, 41, String(profile.currencies[key] ?? 0), 20, "#f3dfb1");
      currencyX += 168;
    }

    this.button(this.root, 140, 124, 176, "≡ Đổi duyên", () => this.toggleDrawer(), enabled);
    this.text(this.root, 52, 448, banner.name, 30, "#f3dfb1").setStroke("#0a1424", 6);
    const epitomized = banner.epitomized;
    const path = epitomized ? profile.epitomized[this.bannerId] : undefined;
    const headline = featured
      ? `★ ${itemName(data, featured.heroId)} — tướng tuần · ${percent(banner.featured!.rateUp)} Legendary`
      : banner.kind === "hero" ? `${banner.pool.legendary.length} tướng Legendary thường trực`
      : `${banner.pool.legendary.length} món Legendary trong banner`;
    this.text(this.root, 52, 488, headline, 16, "#f0d9a8").setStroke("#0a1424", 5);
    this.text(this.root, 52, 512, featured ? "Trượt rate-up: rơi đều vào 3 tướng Legendary cơ bản"
      : epitomized ? (path ? `Nguyệt Ước: ${itemName(data, path.targetId)} — ${path.points}/${epitomized.maxPoints} điểm` : "Khóa mục tiêu Legendary trong panel Nguyệt Ước")
      : "Xem danh sách vật phẩm trong Tỉ lệ & vật phẩm", 13, "#aebed4").setStroke("#0a1424", 4);

    const pityPanel = roundedPanel(this, 1092, 278, 264, 252, 0x0b192e, 0.8, 0x69748a, 14);
    this.root.add(pityPanel);
    this.text(this.root, 978, 170, "LỜI HẸN DƯỚI TRĂNG", 12, "#bfad85");
    this.text(this.root, 978, 192, banner.pityGroup ? "Bảo hiểm chung banner Hero" : "Bảo hiểm riêng banner", 14, "#f3dfb1");
    const progress = (y: number, rarity: "epic" | "legendary", since: number, limit: number, softStart?: number) => {
      this.text(this.root, 978, y, RARITY_LABELS[rarity], 14, rarity === "epic" ? "#d4b6f7" : "#f3d98c");
      this.text(this.root, 1210, y, `${since} / ${limit}`, 13, "#c3cfdf").setOrigin(1, 0);
      this.root.add(roundedPanel(this, 1092, y + 26, 216, 7, 0x25334c, 1, 0x25334c, 4));
      const soft = softStart !== undefined && since >= softStart;
      const w = 216 * Math.min(1, since / limit);
      if (w > 0) {
        const fill = this.add.graphics();
        fill.fillStyle(soft ? 0xffd977 : RARITY_COLORS[rarity], 1);
        fill.fillRoundedRect(984, y + 23, w, 6, Math.min(3, w / 2));
        this.root.add(fill);
        if (soft && !this.reducedMotion) this.tweens.add({ targets: fill, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      if (softStart !== undefined) {
        this.root.add(this.add.rectangle(984 + 216 * Math.min(1, softStart / limit), y + 26, 2, 11, 0xf3d98c, 0.7));
      }
      this.text(this.root, 978, y + 38, soft ? `Soft pity mở · còn ${Math.max(1, limit - since)}` : `Còn ${Math.max(1, limit - since)} lượt tới bảo hiểm`, 12, soft ? "#f3d98c" : "#aebed3");
    };
    progress(224, "epic", pity.sinceEpic, gacha.epicPity);
    progress(306, "legendary", pity.sinceLegendary, gacha.legendaryPity, gacha.legendarySoftPityStart);
    this.countdownText = this.text(this.root, 978, 364, "", 12, "#adbed4");
    this.updateCountdown();
    const nextHero = featured ? featuredEntry(banner, Date.now() + 7 * 24 * 60 * 60 * 1000)?.heroId : undefined;
    if (nextHero) this.text(this.root, 978, 386, `Tuần sau: ${itemName(data, nextHero)}`, 12, "#8fa2bd");
    this.text(this.root, 1210, 170, "›", 18, "#8fa2bd").setOrigin(1, 0);
    // On Epitomized Path banners the bottom zone belongs to the path picker, so
    // the details hit-rect stops above it.
    const pityHit = this.add.rectangle(1092, epitomized ? 256 : 278, 264, epitomized ? 208 : 252, 0, 0);
    this.root.add(pityHit);
    if (enabled) {
      pityHit.setInteractive({ useHandCursor: true });
      pityHit.on("pointerup", () => this.showDetails());
      pityHit.on("pointerover", () => pityPanel.setAlpha(0.85));
      pityHit.on("pointerout", () => pityPanel.setAlpha(1));
    }
    if (epitomized) {
      const pathColor = path && path.points >= epitomized.maxPoints - 1 ? "#f3d98c" : "#aebed3";
      this.text(this.root, 978, 364, "NGUYỆT ƯỚC", 12, "#bfad85");
      this.text(this.root, 978, 384, path ? `${itemName(data, path.targetId)} · ${path.points}/${epitomized.maxPoints}` : "Chưa khóa mục tiêu — chạm để chọn", 13, path ? pathColor : "#8fa2bd", 216);
      this.text(this.root, 1210, 378, "›", 18, "#8fa2bd").setOrigin(1, 0);
      const pathHit = this.add.rectangle(1092, 384, 264, 44, 0, 0);
      this.root.add(pathHit);
      if (enabled) {
        pathHit.setInteractive({ useHandCursor: true });
        pathHit.on("pointerup", () => this.showPathPicker());
      }
    }

    this.root.add(this.add.rectangle(640, 677, view.w, 86, 0x091425, 0.95));
    this.root.add(this.add.rectangle(640, 634, view.w, 1, 0x69748a, 0.4));
    this.button(this.root, 124, 674, 190, "Tỉ lệ & vật phẩm", () => this.showDetails(), enabled);
    this.button(this.root, 328, 674, 190, "Nhật ký quay", () => void this.showHistory(0), enabled);
    this.button(this.root, 532, 674, 190, "Cửa hàng Nguyệt Tinh", () => { if (!this.busy && !this.modal) this.scene.start("shop"); }, enabled);
    const jade = profile.currencies.moonJade;
    const jadeItem = data.economyConfig.moonStarShop.find(item => item.item.type === "moonJade");
    const jadeBought = jadeItem && profile.shop.weekKey === weekKey(data, Date.now()) ? (profile.shop.bought[jadeItem.id] ?? 0) : 0;
    const canConvert = jadeItem !== undefined && jadeBought < jadeItem.limitPerWeek && profile.currencies.moonStar >= jadeItem.price;
    if (this.phase !== "pending" && jade < pullCost * 10 && canConvert) {
      this.button(this.root, 722, 674, 190, "⇄ Đổi Tinh lấy Ngọc", () => void this.showConvert(), enabled);
    } else {
      this.text(this.root, 722, 685, this.phase === "pending" ? "Đang kết nối · xin chờ hồi âm…" : `${pullCost} Ngọc / lượt · ↑↓ đổi duyên`, 12, "#b4c3d7").setOrigin(0.5);
    }
    for (const [count, x] of [[1, 928], [10, 1150]] as const) {
      const need = pullCost * count, afford = jade >= need;
      this.button(this.root, x, 674, 208, afford ? `Quay ×${count} · ${need}` : `Thiếu ${need - jade} ${CURRENCY_LABELS.moonJade}`, () => this.pull(count), enabled && afford, count === 10);
      if (afford) this.image(this.root, "ui:cur_moonJade", x - 80, 674, 20, 20);
    }
    if (enabled && jade >= pullCost * 10) {
      const ring = roundedPanel(this, 1150, 674, 216, 50, 0xe8c784, 0, 0xf3d98c, 12);
      this.root.add(ring);
      if (this.reducedMotion) ring.setAlpha(0.45);
      else this.tweens.add({ targets: ring, alpha: 0.3, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }

    if (!this.enteredOnce) {
      this.enteredOnce = true;
      if (!this.reducedMotion) {
        this.root.setAlpha(0);
        this.tweens.add({ targets: this.root, alpha: 1, duration: 420, ease: "Sine.easeOut" });
      }
    }
  }

  /** Banner splash texture: featured banners get a per-hero splash, others use their own id art. */
  private splashKey(banner: GameData["banners"][string], featured: ReturnType<typeof featuredEntry>): string {
    const candidates = [
      featured ? `gacha:${banner.id}_${featured.heroId}` : "",
      `gacha:${banner.id}`,
      "gacha:altar",
      `gacha:${banner.kind}_banner`,
    ];
    return candidates.find(key => key !== "" && this.textures.exists(key)) ?? "";
  }

  /** Scale to cover w×h then crop the overflow so the image stays centered. */
  private coverCrop(image: Phaser.GameObjects.Image, width: number, height: number) {
    const scale = Math.max(width / image.width, height / image.height);
    image.setScale(scale);
    image.setCrop((image.width - width / scale) / 2, (image.height - height / scale) / 2, width / scale, height / scale);
  }

  private toggleDrawer() {
    if (this.busy || this.modal) return;
    if (this.drawer) { this.closeDrawer(); return; }
    const view = visibleWorld(this), data = session.data;
    const layer = this.add.container(0, 0).setDepth(480);
    const panel = this.add.container(0, 0);
    const scrim = this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x030914, 0.62);
    scrim.setInteractive().on("pointerup", () => this.closeDrawer());
    layer.add([scrim, panel]);
    this.drawer = layer;
    this.drawerPanel = panel;
    panel.add(roundedPanel(this, 202, 360, 404, 700, 0x0b182b, 0.98, 0x9a8965, 18));
    this.text(panel, 36, 34, "CHỌN DUYÊN TRIỆU HỒI", 14, "#bfad85");
    this.text(panel, 36, 58, "Duyên đổi theo tuần — ↑↓ chuyển nhanh", 12, "#8fa2bd");
    Object.values(data.banners).forEach((entry, index) => {
      const y = 134 + index * 134, selected = entry.id === this.bannerId;
      const card = roundedPanel(this, 202, y, 356, 116, selected ? 0x2c3a55 : 0x14243a, 0.95, selected ? 0xe8c784 : 0x53627d, 12);
      const thumb = this.image(card, this.splashKey(entry, featuredEntry(entry, Date.now())), -102, 0, 128, 88);
      if (thumb) this.coverCrop(thumb, 128, 88);
      this.text(card, -30, -28, entry.name, 17, selected ? "#f4dfb2" : COLORS.text);
      const entryFeatured = featuredEntry(entry, Date.now());
      const caption = entryFeatured ? `Tuần này: ${itemName(data, entryFeatured.heroId)}` : entry.kind === "hero" ? "Anh hùng thường trực" : entry.kind === "weapon" ? "Trang bị · binh khí" : "Trang bị · nguyệt bảo";
      this.text(card, -30, -2, caption, 12, "#aab9d0");
      const end = featuredRotationEnd(entry, Date.now());
      const status = selected ? "● ĐANG MỞ" : end !== undefined ? `Đổi sau ${Math.max(0, Math.floor((end - Date.now()) / 86_400_000))}d` : "";
      this.text(card, -30, 24, status, 12, selected ? "#e8c784" : "#8fa2bd");
      const hit = this.add.rectangle(0, 0, 356, 116, 0, 0);
      card.add(hit);
      if (!selected) {
        hit.setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => { this.bannerId = entry.id; this.closeDrawer(); this.render(); });
        hit.on("pointerover", () => card.setAlpha(0.85));
        hit.on("pointerout", () => card.setAlpha(1));
      }
      panel.add(card);
    });
    panel.add(this.add.rectangle(202, 618, 356, 1, 0x53627d, 0.6));
    this.text(panel, 36, 630, "TÚI ĐỒ", 12, "#bfad85");
    // Kho Hero / Kho đồ are the existing inventory screens (spec P6d: reuse, no
    // duplicate inventory scene).
    const bag = (label: string, x: number, scene: string) => {
      const btn = roundedPanel(this, x, 664, 168, 36, 0x16253e, 0.98, 0xc8ad73, 10);
      const hit = this.add.rectangle(0, 0, 168, 36, 0, 0);
      btn.add(hit);
      hit.setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.scene.start(scene));
      hit.on("pointerover", () => btn.setAlpha(0.85));
      hit.on("pointerout", () => btn.setAlpha(1));
      this.text(btn, 0, 0, label, 13, COLORS.text).setOrigin(0.5);
      panel.add(btn);
    };
    bag("Kho Hero", 112, "heroes");
    bag("Kho đồ", 292, "armory");
    if (!this.reducedMotion) {
      panel.x = -440;
      panel.setAlpha(0.6);
      this.tweens.add({ targets: panel, x: 0, alpha: 1, duration: 260, ease: "Cubic.easeOut" });
    }
  }

  private closeDrawer() {
    const layer = this.drawer, panel = this.drawerPanel;
    if (!layer) return;
    this.drawer = null;
    this.drawerPanel = null;
    if (this.reducedMotion || !panel) { layer.destroy(); return; }
    this.tweens.add({ targets: panel, x: -440, alpha: 0, duration: 180, ease: "Cubic.easeIn" });
    this.tweens.add({ targets: layer, alpha: 0, delay: 140, duration: 80, onComplete: () => layer.destroy() });
  }

  private updateCountdown() {
    if (!this.countdownText) return;
    const banner = session.data.banners[this.bannerId];
    const end = banner ? featuredRotationEnd(banner, Date.now()) : undefined;
    if (end === undefined) { this.countdownText.setText(""); return; }
    const left = Math.max(0, end - Date.now());
    const days = Math.floor(left / 86_400_000), hours = Math.floor(left / 3_600_000) % 24, minutes = Math.floor(left / 60_000) % 60;
    const label = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    this.countdownText.setText(`Đổi tướng sau ${label}`);
    this.countdownText.setColor(left < 24 * 3_600_000 ? "#f3d98c" : "#adbed4");
  }

  private back() {
    if (this.modal) { this.closeModal(); this.render(); return; }
    if (this.drawer) { this.closeDrawer(); return; }
    if (this.phase === "revealing") { this.skipReveal(); return; }
    if (this.phase === "complete") { this.closeResults(); return; }
    if (this.busy) return;
    this.scene.start("deck-select");
  }

  private pull(count: 1 | 10) {
    if (this.busy || this.modal || !this.alive || session.profile.currencies.moonJade < session.data.economyConfig.pullCost * count) return;
    this.phase = "pending";
    const banner = session.data.banners[this.bannerId];
    const gacha = session.data.economyConfig.gacha;
    this.hotPull = (session.profile.pity[banner?.pityGroup ?? this.bannerId]?.sinceLegendary ?? 0) >= gacha.legendaryPity - 10;
    this.audio?.play("cast");
    const generation = this.generation;
    this.historyRequest++;
    this.render();
    void mutate<PullReply>("POST", `/gacha/${this.bannerId}/pull`, { count }).then(reply => {
      if (!this.alive || generation !== this.generation) return;
      this.phase = "revealing";
      this.render();
      this.reveal(reply.results);
      showToast(this, achievementNotices(reply.achievements), 94);
    }, (error: unknown) => {
      if (!this.alive || generation !== this.generation) return;
      this.phase = "idle";
      this.render();
      void alertModal(this, errorText(error));
    });
  }

  private later(delay: number, action: () => void) {
    // Use the same elapsed-time clock as the visual tweens. TimerEvents use
    // capped scene delta, which can leave the seal waiting at low frame rates.
    this.animate({targets:{progress:0},progress:1,duration:delay,onComplete:() => {
      if (this.alive && this.phase === "revealing") action();
    }});
  }

  private animate(config: Phaser.Types.Tweens.TweenBuilderConfig) { this.revealTweens.push(this.tweens.add(config)); }

  private cancelReveal() {
    this.revealTweens.forEach(tween => tween.stop()); this.revealTweens = [];
    this.transientVfx.forEach(vfx => vfx.destroy()); this.transientVfx.clear();
  }

  private reveal(results: PullResult[]) {
    this.results = this.add.container(0, 0).setDepth(600);
    const view = visibleWorld(this);
    this.results.add(this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x050c18, 0.94).setInteractive());
    this.results.add(roundedPanel(this, 640, 360, 1220, 690, 0x0b182b, 0.95, 0x9e8864, 22));
    this.text(this.results, 640, 48, "DUYÊN TRĂNG ĐÃ ĐẾN", 25, "#f3deb0").setOrigin(0.5);
    this.text(this.results, 640, 82, session.data.banners[this.bannerId]!.name, 15, "#b7c5d9").setOrigin(0.5);
    this.cards = results.map((result, i) => {
      const single = results.length === 1, width = single ? 330 : 178, height = single ? 495 : 267;
      const root = this.add.container(single ? 640 : 236 + (i % 5) * 202, single ? 360 : 240 + Math.floor(i / 5) * 276).setAlpha(0);
      root.add(roundedPanel(this, 0, 0, width, height, 0x15243e, 1, 0x97845f, 12));
      const image = this.image(root, "gacha:card_back", 0, 0, width - 6, height - 6);
      if (!image) this.image(root, "ui:seal", 0, 0, 92, 92);
      this.results!.add(root);
      return { root, result, width, height, revealed: false };
    });
    this.resultFooter = this.add.container(0, 0); this.results.add(this.resultFooter);
    this.renderResultFooter();
    this.playCinematic(results);
  }

  /** "Nguyệt tinh lạc": light streak(s) fall to the altar, tinted by the pull's top rarity. */
  private playCinematic(results: PullResult[]) {
    const rank = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;
    const rarity = (Object.keys(rank) as Rarity[])[results.reduce((m, r) => Math.max(m, rank[r.rarity]), 0)]!;
    const tint = { common: 0xaec4de, rare: 0x7fb4ff, epic: 0xc89cff, legendary: 0xffcf6e }[rarity];
    const layer = this.add.container(0, 0);
    this.cine = layer;
    this.results!.add(layer);
    const view = visibleWorld(this);
    const dim = this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x030914, 0);
    layer.add(dim);
    this.animate({ targets: dim, fillAlpha: this.hotPull ? 0.68 : 0.55, duration: 240 });
    const count = results.length === 1 ? 1 : 4;
    const hasMeteor = this.textures.exists("gacha:meteor_head") && this.textures.exists("gacha:meteor_tail");
    const flight = this.reducedMotion ? 60 : rarity === "legendary" ? 780 : rarity === "epic" ? 660 : 540;
    const hotFlight = this.hotPull ? Math.round(flight * 1.35) : flight;
    if (this.hotPull && !this.reducedMotion) {
      const hint = this.text(layer, 640, 620, rarity === "legendary" ? "Nguyệt tinh đang rực sáng…" : "Bảo hiểm đang gần…", 17, "#f3d98c").setOrigin(0.5).setAlpha(0);
      this.animate({ targets: hint, alpha: 1, duration: 300, delay: 300 });
      this.animate({ targets: hint, alpha: 0, duration: 220, delay: count * 130 + hotFlight });
    }
    for (let i = 0; i < count; i++) {
      const main = i === count - 1;
      const delay = this.reducedMotion ? 0 : i * 130;
      const sx = 940 + Math.random() * 380, sy = -20 + Math.random() * 130;
      const ex = 480 + Math.random() * 280, ey = 270 + Math.random() * 100;
      const streak = this.add.container(sx, sy);
      if (hasMeteor) {
        const tail = this.image(streak, "gacha:meteor_tail", -250, 0, 512, 64);
        const head = this.image(streak, "gacha:meteor_head", 0, 0, 96, 96);
        tail?.setFlipX(true).setTint(tint);
        head?.setTint(tint);
      } else {
        streak.add(this.add.circle(0, 0, 30, tint, 0.9));
        streak.add(this.add.circle(0, 0, 60, tint, 0.3));
      }
      streak.setRotation(Phaser.Math.Angle.Between(sx, sy, ex, ey));
      streak.setScale(main ? (rarity === "legendary" ? 1.45 : 1.15) * (this.hotPull ? 1.15 : 1) : 0.65);
      layer.add(streak);
      this.animate({ targets: streak, x: ex, y: ey, duration: hotFlight, delay, ease: "Quad.easeIn",
        onComplete: () => { streak.destroy(); this.impactBurst(ex, ey, tint, layer, main, rarity); } });
    }
    this.later(this.reducedMotion ? 480 : count * 130 + hotFlight + 260, () => {
      this.cine?.destroy();
      this.cine = null;
      this.cards.forEach(card => card.root.setAlpha(1));
      this.revealNext(0);
    });
  }

  private impactBurst(x: number, y: number, tint: number, layer: Phaser.GameObjects.Container, big: boolean, rarity: Rarity) {
    if (this.phase !== "revealing" || !this.alive) return;
    const ring = this.add.circle(x, y, 16, tint, 0).setStrokeStyle(big ? 4 : 2, tint, 0.9);
    layer.add(ring);
    this.animate({ targets: ring, scale: big ? 7 : 3.5, alpha: 0, duration: big ? 460 : 280 });
    for (let i = 0; i < (big ? 10 : 4); i++) {
      const angle = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 60;
      const spark = this.image(layer, "gacha:spark", x, y, 14, 14);
      if (spark) {
        spark.setTint(tint);
        this.animate({ targets: spark, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0, duration: 340 });
      }
    }
    if (!big) return;
    this.audio?.play("impact");
    const flash = this.add.rectangle(640, 360, 1280, 720, 0xfff6dd, 0);
    layer.add(flash);
    this.animate({ targets: flash, fillAlpha: 0.38, duration: 80, yoyo: true });
    if (rarity === "legendary") {
      const halo = this.image(layer, "gacha:halo_legendary", x, y, 460, 460)
        ?? this.image(layer, "ui:moon_full", x, y, 340, 340);
      if (halo) {
        halo.setTint(tint).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
        this.animate({ targets: halo, scale: 1.5, alpha: 0, duration: 620 });
      }
      if (!this.reducedMotion) this.cameras.main.shake(220, 0.007);
    } else if (!this.reducedMotion) {
      this.cameras.main.shake(150, 0.004);
    }
  }

  private revealNext(index: number) {
    const card = this.cards[index];
    if (!card) { this.finishReveal(); return; }
    const beat = this.reducedMotion ? 90 : card.result.rarity === "legendary" ? 420 : card.result.rarity === "epic" ? 280 : 130;
    if (this.reducedMotion) {
      card.root.setAlpha(0.15); this.drawCard(card);
      this.rarityVfx(card);
      this.animate({ targets:card.root, alpha:1, duration:90 });
      this.later(beat + 100, () => this.revealNext(index + 1));
    } else {
      this.animate({ targets:card.root, scaleX:0, duration:110, onComplete:() => {
        if (this.phase !== "revealing" || !this.alive) return;
        this.drawCard(card);
        this.rarityVfx(card);
        this.animate({ targets:card.root, scaleX:1, duration:160 });
      } });
      this.later(beat + 270, () => this.revealNext(index + 1));
    }
  }

  private drawCard(card: ResultCard) {
    if (card.revealed) return;
    card.revealed = true;
    const { root, result, width:w, height:h } = card, single = this.cards.length === 1;
    const data = session.data, color = RARITY_COLORS[result.rarity];
    root.removeAll(true);
    root.add(roundedPanel(this, 0, 0, w, h, 0x0d1830, 1, color, 12));
    const hero = data.heroes[result.itemId], weapon = data.weapons[result.itemId];
    const equipmentKey = `${weapon ? "weapons" : "relics"}:${result.itemId}`;
    const hasEquipmentArt = !hero && this.textures.exists(equipmentKey);
    const artKey = hero ? `heroes:${result.itemId}` : hasEquipmentArt ? equipmentKey : weapon ? "gacha:weapon_banner" : "gacha:relic_banner";
    const art = this.image(root, artKey, 0, 0, w - 8, h - 8);
    if (art) {
      if (!hero) this.coverCrop(art, w - 8, h - 8); // square equipment art -> cover-crop to 2:3
    } else this.image(root, hero ? "ui:star" : "ui:gear", 0, -20, 60, 60);
    this.audio?.play(result.rarity === "legendary" ? "legendary" : result.rarity === "epic" ? "epic" : result.rarity === "rare" ? "rare" : "flip");
    const frameKey = `gacha:frame_${result.rarity}`;
    if (this.textures.exists(frameKey)) this.image(root, frameKey, 0, 0, w, h);
    const ribbon = this.add.graphics();
    ribbon.fillStyle(color, 0.85);
    ribbon.fillRoundedRect(-w * 0.31, -h / 2 + 6, w * 0.62, 20, 9);
    root.add(ribbon);
    this.text(root, 0, -h / 2 + 9, RARITY_LABELS[result.rarity], single ? 15 : 11, "#fff8e8").setOrigin(0.5);
    if (result.epitomizedHit) {
      const tag = this.add.graphics();
      tag.fillStyle(0xe8c784, 0.92);
      tag.fillRoundedRect(-w * 0.28, h / 2 - 78, w * 0.56, 20, 9);
      root.add(tag);
      this.text(root, 0, h / 2 - 75, "NGUYỆT ƯỚC", single ? 13 : 10, "#151c30").setOrigin(0.5);
    }
    this.text(root, 0, h / 2 - 52, itemName(data, result.itemId), single ? 22 : 14, "#f7ecd2", w - 16).setOrigin(0.5).setAlign("center").setStroke("#0a1424", 4);
    this.text(root, 0, h / 2 - 24, this.outcomeText(result), single ? 16 : 11, "#ecd7a4", w - 14).setOrigin(0.5).setAlign("center").setStroke("#0a1424", 3);
    if (!hero && !hasEquipmentArt) this.text(root, 0, -h / 2 + 34, "Minh họa loại trang bị", single ? 12 : 10, "#9babc3").setOrigin(0.5);
  }

  private rarityVfx(card: ResultCard) {
    if (!this.results || (card.result.rarity !== "epic" && card.result.rarity !== "legendary")) return;
    const color = RARITY_COLORS[card.result.rarity];
    const vfx = this.add.container(card.root.x,card.root.y).setName("gacha_rarity_vfx");
    this.results.add(vfx);
    this.transientVfx.add(vfx);
    vfx.add(roundedPanel(this,0,0,card.width+10,card.height+10,color,0.14,color,16));
    if (card.result.rarity === "legendary" && this.textures.exists("gacha:halo_legendary")) {
      const halo = this.image(vfx, "gacha:halo_legendary", 0, 0, card.width * 2.1, card.width * 2.1);
      if (halo) {
        halo.setTint(color).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD);
        this.animate({ targets: halo, scale: 1.35, alpha: 0, duration: 650 });
      }
    }
    const finish = () => { this.transientVfx.delete(vfx); vfx.destroy(); };
    if (this.reducedMotion) {
      this.animate({ targets:vfx,alpha:0,duration:150,onComplete:finish });
      return;
    }
    // Eight local motes and one short halo: no emitters or screen-wide flash.
    for (let i=0;i<8;i++) {
      const angle=i*Math.PI/4,x=Math.cos(angle)*(card.width/2+4),y=Math.sin(angle)*(card.height/2+4);
      const spark=this.image(vfx,"gacha:spark",x,y,12,12);
      if (spark) {
        spark.setTint(color);
        this.animate({targets:spark,x:x*1.12,y:y*1.12,alpha:0,duration:280});
      }
    }
    this.animate({targets:vfx,scale:1.035,alpha:0,duration:340,onComplete:finish});
  }

  private skipReveal() {
    if (this.phase !== "revealing") return;
    this.cancelReveal();
    this.cine?.destroy(); this.cine = null;
    this.cards.forEach(card => { card.root.setScale(1).setAlpha(1); this.drawCard(card); });
    this.finishReveal();
  }

  private finishReveal() {
    this.phase = "complete";
    this.cancelReveal();
    this.cards.forEach(card => card.root.setScale(1).setAlpha(1));
    this.renderResultFooter();
  }

  private renderResultFooter() {
    this.resultFooter?.removeAll(true);
    if (!this.resultFooter) return;
    if (this.phase === "revealing") {
      this.button(this.resultFooter, 1148, 58, 150, "Bỏ qua ≫", () => this.skipReveal(), true);
      return;
    }
    const counts: Record<Rarity, number> = { legendary: 0, epic: 0, rare: 0, common: 0 };
    let moonStar = 0, moonDust = 0, darkIron = 0;
    for (const card of this.cards) {
      counts[card.result.rarity]++;
      moonStar += card.result.moonStar ?? 0;
      moonDust += card.result.moonDust ?? 0;
      darkIron += card.result.darkIron ?? 0;
    }
    const parts = RARITIES.filter(r => counts[r] > 0).map(r => `${counts[r]} ${RARITY_LABELS[r]}`).join(" · ");
    const gains = [
      moonStar ? `+${moonStar} ${CURRENCY_LABELS.moonStar}` : "",
      moonDust ? `+${moonDust} ${CURRENCY_LABELS.moonDust}` : "",
      darkIron ? `+${darkIron} ${CURRENCY_LABELS.darkIron}` : "",
    ].filter(Boolean).join("   ");
    this.text(this.resultFooter, 640, 652, gains ? `${parts}   —   ${gains}` : parts, 15, "#d8c9a0").setOrigin(0.5);
    this.button(this.resultFooter, 640, 692, 258, "Tiếp tục", () => this.closeResults(), true, true);
    this.button(this.resultFooter, 1050, 692, 170, "Lưu ảnh ⤓", () => this.saveSnapshot(), true);
  }

  /** Exports the current frame as a PNG so players can keep/share a lucky pull. */
  private saveSnapshot() {
    this.audio?.play("click");
    this.game.renderer.snapshot(snap => {
      if (!(snap instanceof HTMLImageElement)) return;
      const link = document.createElement("a");
      link.href = snap.src;
      link.download = `duyen-trang-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      link.click();
    }, "image/png");
  }

  /** Convert moonStar into moonJade through the weekly shop item when the pull cost is short. */
  private async showConvert() {
    const item = session.data.economyConfig.moonStarShop.find(entry => entry.item.type === "moonJade");
    if (!item || this.busy || !this.alive) return;
    const shop = session.profile.shop;
    const bought = shop.weekKey === weekKey(session.data, Date.now()) ? (shop.bought[item.id] ?? 0) : 0;
    const left = item.limitPerWeek - bought;
    const gain = item.item.type === "moonJade" ? item.item.amount : 0;
    const ok = await confirmModal(this, `Đổi ${item.price} ${CURRENCY_LABELS.moonStar} lấy ${gain} ${CURRENCY_LABELS.moonJade}?\nTuần này còn ${Math.max(0, left)}/${item.limitPerWeek} lần đổi.`, { label: "Đổi" });
    if (!ok || this.busy || !this.alive) return;
    this.converting = true;
    this.render();
    mutate<ProfileReply & { achievements?: string[] }>("POST", `/shop/${item.id}/buy`).then(
      reply => {
        this.converting = false;
        if (!this.alive) return;
        this.render();
        showToast(this, [`Đã đổi +${gain} ${CURRENCY_LABELS.moonJade}`, ...achievementNotices(reply.achievements)]);
      },
      (error: unknown) => {
        this.converting = false;
        if (!this.alive) return;
        void alertModal(this, errorText(error));
        this.render();
      },
    );
  }

  private closeResults() {
    if (this.phase !== "complete") return;
    this.cancelReveal(); this.results?.destroy(); this.results = null; this.resultFooter = null; this.cards = [];
    this.phase = "idle"; this.render();
  }

  /** Epitomized Path picker (spec P6): lock one legendary weapon as the target. */
  private showPathPicker() {
    const data = session.data, banner = data.banners[this.bannerId];
    if (!banner?.epitomized || this.busy || !this.alive) return;
    this.closeModal();
    const layer = this.add.container(0, 0).setDepth(500); this.modal = layer;
    const view = visibleWorld(this);
    layer.add(this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x030914, 0.8).setInteractive());
    layer.add(roundedPanel(this, 640, 360, 760, 620, 0x0f1e34, 0.99, 0xbba172, 20));
    this.text(layer, 640, 76, "NGUYỆT ƯỚC", 24, "#f3dfb5").setOrigin(0.5);
    this.text(layer, 640, 108, `Trượt ${banner.epitomized.maxPoints} lần → Legendary kế chắc chắn là mục tiêu. Đổi/hủy mục tiêu mất điểm.`, 13, "#a8bbd2").setOrigin(0.5);
    const path = session.profile.epitomized[this.bannerId];
    this.text(layer, 640, 136, path ? `Đang khóa: ${itemName(data, path.targetId)} — ${path.points}/${banner.epitomized.maxPoints} điểm` : "Chưa khóa mục tiêu nào", 14, path ? "#f3d98c" : "#8fa2bd").setOrigin(0.5);
    const rows = this.add.container(0, 0); layer.add(rows);
    banner.pool.legendary.forEach((id, index) => {
      const y = 196 + index * 62, locked = path?.targetId === id;
      const row = roundedPanel(this, 640, y, 680, 52, locked ? 0x2c3a55 : 0x14243a, 0.95, locked ? 0xe8c784 : 0x53627d, 10);
      rows.add(row);
      const thumb = this.image(row, `weapons:${id}`, -298, 0, 40, 40);
      if (!thumb) this.image(row, "ui:gear", -298, 0, 40, 40);
      this.text(row, -266, -10, itemName(data, id), 15, locked ? "#f4dfb2" : COLORS.text);
      this.text(row, -266, 12, session.profile.weapons[id] ? `Tinh Luyện ${session.profile.weapons[id]!.refinement}` : "Chưa sở hữu", 11, "#8fa2bd");
      if (locked) this.text(row, 300, 0, "● MỤC TIÊU", 12, "#e8c784").setOrigin(1, 0.5);
      const hit = this.add.rectangle(0, 0, 680, 52, 0, 0);
      row.add(hit);
      if (!locked) {
        hit.setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => void this.selectPathTarget(id));
        hit.on("pointerover", () => row.setAlpha(0.85));
        hit.on("pointerout", () => row.setAlpha(1));
      }
    });
    this.button(layer, 512, 622, 170, "Đóng", () => { this.closeModal(); this.render(); });
    this.button(layer, 768, 622, 170, "Hủy Nguyệt Ước", () => void this.selectPathTarget(null), path !== undefined);
  }

  private async selectPathTarget(targetId: string | null) {
    if (this.busy || !this.alive) return;
    this.converting = true;
    try {
      await mutate<ProfileReply>("POST", `/gacha/${this.bannerId}/path`, { targetId });
      if (!this.alive) return;
      this.converting = false;
      this.showPathPicker();
      showToast(this, [targetId === null ? "Đã hủy Nguyệt Ước" : `Đã khóa mục tiêu: ${itemName(session.data, targetId)}`], 94);
    } catch (error) {
      this.converting = false;
      if (!this.alive) return;
      this.closeModal();
      void alertModal(this, errorText(error));
    }
    if (this.alive) this.render();
  }

  private outcomeText(result: PullResult): string {
    switch (result.outcome) {
      case "newHero": case "newWeapon": case "newRelic": return "MỚI!";
      case "constellation": return `Tinh Hồn ${result.constellation}`;
      case "moonStar": return `+${result.moonStar} ${CURRENCY_LABELS.moonStar}`;
      case "refinement": return `Tinh Luyện ${result.refinement}`;
      case "resonance": return `Cộng Minh ${result.resonance}`;
      case "maxed": return `+${result.moonStar} ${CURRENCY_LABELS.moonStar}\n+1 ${result.darkIron ? "Huyền Thiết" : "Nguyệt Trần"}`;
      default: { const exhaustive: never = result.outcome; return String(exhaustive); }
    }
  }

  private closeModal() {
    this.historyRequest++;
    this.modalCleanup?.(); this.modalCleanup = null;
    this.modal?.destroy(); this.modal = null;
  }

  /** Whole visible text rows keep the scroll list clear of modal controls in WebGL. */
  private openList(title: string, lines: { text: string; color?: string }[], footer?: (layer: Phaser.GameObjects.Container) => void, header?: (layer: Phaser.GameObjects.Container) => void) {
    this.closeModal();
    const layer = this.add.container(0,0).setDepth(500); this.modal = layer;
    const view = visibleWorld(this);
    layer.add(this.add.rectangle(view.x+view.w/2,view.y+view.h/2,view.w,view.h,0x030914,0.8).setInteractive());
    layer.add(roundedPanel(this,640,360,1030,650,0x0f1e34,0.99,0xbba172,20));
    this.text(layer,640,70,title,24,"#f3dfb5").setOrigin(0.5);
    this.text(layer,640,105,"Cuộn để xem toàn bộ · Esc để đóng",13,"#a8bbd2").setOrigin(0.5);
    header?.(layer);
    const top = header ? 168 : 137;
    const content = this.add.container(0,0); layer.add(content);
    const rows: Phaser.GameObjects.Text[] = [];
    let y = top + 6;
    lines.forEach(line => {
      const measure = this.text(content,178,y,line.text,16,line.color ?? "#d8e0e9",918);
      const wrapped = measure.getWrappedText();
      measure.destroy();
      for (const value of wrapped) {
        const row = this.text(content,178,y,value,16,line.color ?? "#d8e0e9");
        rows.push(row);
        y += row.height + 5;
      }
      y += 13;
    });
    let offset = 0;
    const updateRows = () => {
      content.setY(-offset);
      rows.forEach(row => row.setVisible(row.y - offset >= top && row.y - offset + row.height <= 577));
    };
    const scroll = (delta: number) => {
      offset = Phaser.Math.Clamp(offset + delta,0,Math.max(0,y-577));
      updateRows();
    };
    updateRows();
    const wheel = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const p = this.cameras.main.getWorldPoint(pointer.x,pointer.y);
      if (p.x >= 166 && p.x <= 1114 && p.y >= top && p.y <= 577) scroll(Math.sign(dy)*90);
    };
    this.input.on("wheel",wheel);
    this.modalCleanup = () => { this.input.off("wheel",wheel); };
    this.button(layer,1125,199,42,"▲",()=>scroll(-180));
    this.button(layer,1125,527,42,"▼",()=>scroll(180));
    if (footer) footer(layer);
    else this.button(layer,640,636,220,"Đóng",()=>{this.closeModal();this.render();});
    this.render();
  }

  private showDetails() {
    if (this.busy || this.modal) return;
    const data = session.data, banner = data.banners[this.bannerId]!, profile = session.profile, g = data.economyConfig.gacha;
    const featured = featuredEntry(banner, Date.now());
    const lines: { text:string; color?:string }[] = [
      { text:`Legendary ${percent(g.rates.legendary)} · Epic ${percent(g.rates.epic)} · còn lại Rare/Common`,color:"#eed4a1" },
      { text:`Bảo hiểm Epic: chắc chắn trong ${g.epicPity} lượt. Legendary chắc chắn ở lượt ${g.legendaryPity}.` },
      { text:`Legendary: từ lượt ${g.legendarySoftPityStart + 1}, tỉ lệ tăng ${percent(g.legendarySoftPityStep)} mỗi lượt.` },
      ...(banner.pityGroup ? [{ text:`Bảo hiểm chung giữa các banner Hero (${banner.pityGroup}).` }] : []),
      ...(banner.epitomized ? [{
        text: `Nguyệt Ước: khóa 1 Legendary làm mục tiêu — trượt ${banner.epitomized.maxPoints} lần thì Legendary kế chắc chắn trúng mục tiêu. Đổi/hủy mục tiêu mất điểm.`,
        color: "#f3d98c",
      }] : []),
      ...(g.newPlayerEpicHero && banner.kind === "hero" ? [{ text:"Bảo vệ người mới: Epic ưu tiên Hero chưa sở hữu." }] : []),
      ...(featured && banner.featured ? [
        { text: banner.pool.legendary.length === 0
            ? `Legendary luôn trúng ${itemName(data,featured.heroId)} (tướng tuần).`
            : `Legendary trúng: ${percent(banner.featured.rateUp)} ${itemName(data,featured.heroId)} (tướng tuần) · ${percent(1-banner.featured.rateUp)} một tướng Legendary khác.`, color:"#f3d98c" },
        ...(featured.name ? [{ text:`Tuần này: ${featured.name}` }] : []),
      ] : []),
    ];
    // This week's rotating heroes are reserved to their featured banner's rate-up:
    // filtered out of every other legendary draw, including this banner's fallback.
    const reserved = new Set(reservedFeaturedHeroes(data, Date.now()));
    const hidden = banner.pool.legendary.filter((id) => reserved.has(id) && id !== featured?.heroId);
    for (const id of hidden) {
      lines.push({ text:`${itemName(data,id)} hiện không nằm trong banner này — chỉ trên banner luân chuyển tuần này.`, color:"#8fa2bd" });
    }
    const pool: Record<Rarity, string[]> = featured && banner.featured
      ? { legendary: [featured.heroId, ...banner.pool.legendary.filter((id) => !reserved.has(id))], epic: featured.pool.epic, rare: featured.pool.rare, common: featured.pool.common }
      : { ...banner.pool, legendary: banner.pool.legendary.filter((id) => !reserved.has(id)) };
    for (const rarity of RARITIES) {
      if (!pool[rarity].length) continue;
      lines.push({text:RARITY_LABELS[rarity],color:`#${RARITY_COLORS[rarity].toString(16).padStart(6,"0")}`});
      for (const id of pool[rarity]) {
        const featuredTag = (featured && rarity === "legendary" && id === featured.heroId ? " ★" : "")
          + (rarity === "legendary" && profile.epitomized[this.bannerId]?.targetId === id ? " ☾" : "");
        const owned = banner.kind === "hero" ? (profile.heroes[id] ? `Tinh Hồn ${profile.heroes[id]!.constellation}` : "chưa có")
          : banner.kind === "weapon" ? (profile.weapons[id] ? `Tinh Luyện ${profile.weapons[id]!.refinement}` : "chưa có")
          : (profile.relics[id] ? `Cộng Minh ${profile.relics[id]!.resonance}` : "chưa có");
        lines.push({text:`${itemName(data,id)}${featuredTag}   ·   ${owned}`});
      }
    }
    this.openList(`${banner.name} · Tỉ lệ & vật phẩm`,lines);
  }

  private chip(parent: Phaser.GameObjects.Container, x: number, y: number, label: string, active: boolean, action: () => void) {
    const panel = roundedPanel(this, x, y, 130, 30, active ? 0x3a4d70 : 0x14243a, 0.95, active ? 0xe8c784 : 0x53627d, 15);
    parent.add(panel);
    this.text(panel, 0, 0, label, 13, active ? "#f4dfb2" : "#aab9d0").setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, 130, 30, 0, 0);
    panel.add(hit);
    if (!active) {
      hit.setInteractive({ useHandCursor: true });
      hit.on("pointerup", action);
      hit.on("pointerover", () => panel.setAlpha(0.8));
      hit.on("pointerout", () => panel.setAlpha(1));
    }
  }

  private bannerTabLabel(banner: GameData["banners"][string]) {
    return banner.featured ? "Xoay tua" : banner.kind === "hero" ? "Tướng" : banner.kind === "weapon" ? "Binh khí" : "Bảo vật";
  }

  private async showHistory(page: number, bannerFilter?: string) {
    if (this.busy || !this.alive) return;
    const banners = Object.values(session.data.banners);
    const tabs = (layer: Phaser.GameObjects.Container) => {
      const defs: (string | undefined)[] = [undefined, ...banners.map(b => b.id)];
      defs.forEach((id, index) => {
        const label = id === undefined ? "Tất cả" : this.bannerTabLabel(banners[index - 1]!);
        this.chip(layer, 640 + (index - (defs.length - 1) / 2) * 140, 138, label, id === bannerFilter, () => void this.showHistory(0, id));
      });
    };
    this.openList(`Nhật ký quay — trang ${page+1}`,[{text:"Đang tải nhật ký…"}],layer=>this.button(layer,640,636,220,"Đóng",()=>{this.closeModal();this.render();}),tabs);
    const request = ++this.historyRequest, generation = this.generation;
    try {
      const filter = bannerFilter ? `&banner=${bannerFilter}` : "";
      const { entries } = await api<{ entries:HistoryEntry[] }>("GET",`/gacha/history?page=${page}${filter}`);
      if (!this.alive || generation !== this.generation || request !== this.historyRequest || !this.modal) return;
      const lines = entries.map(entry=>({text:`${new Date(entry.createdAt).toLocaleString("vi-VN")} · ${session.data.banners[entry.bannerId]?.name ?? entry.bannerId}\n${entry.results.map(result=>`${itemName(session.data,result.itemId)} (${RARITY_LABELS[result.rarity]}) · ${this.outcomeText(result).replace("\n"," · ")}`).join("; ")}`}));
      this.openList(`Nhật ký quay — trang ${page+1}`,lines.length ? lines : [{text:"Chưa có lượt quay nào"}],layer=>{
        this.button(layer,430,636,170,"◂ Mới hơn",()=>void this.showHistory(page-1,bannerFilter),page>0);
        this.button(layer,640,636,170,"Đóng",()=>{this.closeModal();this.render();});
        this.button(layer,850,636,170,"Cũ hơn ▸",()=>void this.showHistory(page+1,bannerFilter),entries.length===20);
      },tabs);
    } catch (error) {
      if (!this.alive || generation !== this.generation || request !== this.historyRequest || !this.modal) return;
      this.closeModal(); this.render(); void alertModal(this,errorText(error));
    }
  }
}
