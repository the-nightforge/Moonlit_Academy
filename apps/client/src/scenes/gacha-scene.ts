import Phaser from "phaser";
import type { Rarity } from "rules";
import { featuredEntry, featuredRotationEnd, weekKey } from "rules";
import manifest from "virtual:assets-manifest";
import { achievementNotices, errorText, mutate } from "../account";
import { session } from "../session";
import { loadCombatSettings } from "../ui/combat-settings";
import { GachaAudio } from "../ui/gacha-audio";
import { roundedPanel } from "../ui/rounded-panel";
import { preloadEquipmentArt } from "../ui/equipment-art";
import { COLORS, CURRENCY_LABELS, RARITY_COLORS, RARITY_LABELS, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, alertModal, isModalOpen, showToast } from "../ui/widgets";
import { GachaDrawer } from "./gacha/drawer";
import { GachaModals } from "./gacha/modals";
import { GachaResults } from "./gacha/results";
import { itemName, percent, splashKey, type PullReply } from "./gacha/shared";

/**
 * Moon altar presentation. Profile changes remain authoritative server replies.
 * Layout/lifecycle live here; the drawer, reveal flow and profile modals are the
 * helper modules under `./gacha/` (they share this scene's public state).
 */
export class GachaScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private ambient: Phaser.GameObjects.Container | null = null;
  private artTween: Phaser.Tweens.Tween | null = null;
  private enteredOnce = false;
  private countdownText: Phaser.GameObjects.Text | null = null;

  // Shared state — gacha/ helpers and e2e specs read these.
  bannerId = "";
  phase: "idle" | "pending" | "revealing" | "complete" = "idle";
  alive = false;
  generation = 0;
  reducedMotion = false;
  hotPull = false;
  audio: GachaAudio | null = null;

  private drawerFx = new GachaDrawer(this);
  private modals = new GachaModals(this);
  private resultsFx = new GachaResults(this);

  get busy() { return this.phase !== "idle" || this.modals.converting; }
  // e2e/debug handles keep the old field names.
  get drawer() { return this.drawerFx.layer; }
  get drawerPanel() { return this.drawerFx.panel; }
  get modal() { return this.modals.modal; }
  get cards() { return this.resultsFx.cards; }

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
      ui: ["cur_moonJade", "cur_moonStar", "cur_honor", "seal", "moon_full", "star", "gear", "epitomized_moon"],
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
    this.resultsFx.reset();
    this.modals.reset();
    const settings = loadCombatSettings(localStorage, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    this.reducedMotion = settings.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.audio?.dispose();
    this.audio = new GachaAudio(settings);
    this.hotPull = false;
    const unlock = () => void this.audio?.unlock();
    this.input.on("pointerdown", unlock);
    this.root = this.add.container(0, 0);
    this.enteredOnce = false;
    this.ambient = this.add.container(0, 0).setDepth(-1);
    const ambientTexture = this.textures.exists("gacha:dust_mote") ? "gacha:dust_mote" : "gacha:spark";
    if (this.textures.exists(ambientTexture)) {
      const bounds = visibleWorld(this);
      for (let i = 0; i < 12; i++) {
        const size = 14 + Math.random() * 22;
        const spark = this.add.image(bounds.x + 60 + Math.random() * (bounds.w - 120), 110 + Math.random() * 420, ambientTexture);
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
      if (this.busy || this.modals.modal || this.drawer || !this.alive) return;
      const ids = Object.keys(session.data.banners);
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const index = Math.max(0, ids.indexOf(this.bannerId));
      this.bannerId = ids[(index + step + ids.length) % ids.length]!;
      this.render();
    };
    this.input.keyboard?.on("keydown-ESC", onEsc);
    this.input.keyboard?.on("keydown", onArrows);
    this.time.addEvent({ delay: 30_000, loop: true, callback: () => { if (this.alive && !this.modals.modal) this.updateCountdown(); } });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.generation++;
      this.resultsFx.reset();
      this.modals.close();
      this.drawerFx.close(true);
      this.countdownText = null;
      this.audio?.dispose();
      this.audio = null;
      this.input.off("pointerdown", unlock);
      this.input.keyboard?.off("keydown-ESC", onEsc);
      this.input.keyboard?.off("keydown", onArrows);
      this.tweens.killAll();
    });
    this.render();
  }

  text(parent: Phaser.GameObjects.Container, x: number, y: number, message: string, size = 16, color: string = COLORS.text, width?: number) {
    const text = addText(this, parent, x, y, message, size, color);
    if (width) text.setWordWrapWidth(width);
    return text;
  }

  image(parent: Phaser.GameObjects.Container, key: string, x: number, y: number, width: number, height: number) {
    if (!this.textures.exists(key)) return null;
    const image = this.add.image(x, y, key);
    image.setScale(Math.min(width / image.width, height / image.height));
    parent.add(image);
    return image;
  }

  button(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, action: () => void, enabled = true, primary = false) {
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

  render() {
    if (!this.alive) return;
    this.artTween?.stop();
    this.artTween = null;
    this.root.removeAll(true);
    const data = session.data, profile = session.profile, banner = data.banners[this.bannerId]!;
    const { gacha, pullCost } = data.economyConfig;
    const featured = featuredEntry(banner, Date.now());
    const pity = profile.pity[banner.pityGroup ?? this.bannerId] ?? { sinceEpic: 0, sinceLegendary: 0 };
    const enabled = !this.busy && !this.modals.modal;
    const view = visibleWorld(this);
    this.root.add(this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x071222));
    const splash = this.image(this.root, splashKey(this, banner, featured), view.x + view.w / 2, view.y + view.h / 2, view.w, view.h);
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

    this.button(this.root, 140, 124, 176, "≡ Đổi duyên", () => this.drawerFx.toggle(), enabled);
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
      pityHit.on("pointerup", () => this.modals.details());
      pityHit.on("pointerover", () => pityPanel.setAlpha(0.85));
      pityHit.on("pointerout", () => pityPanel.setAlpha(1));
    }
    if (epitomized) {
      const pathColor = path && path.points >= epitomized.maxPoints - 1 ? "#f3d98c" : "#aebed3";
      this.image(this.root, "ui:epitomized_moon", 987, 371, 20, 20);
      this.text(this.root, 1002, 364, "NGUYỆT ƯỚC", 12, "#bfad85");
      this.text(this.root, 978, 384, path ? `${itemName(data, path.targetId)} · ${path.points}/${epitomized.maxPoints}` : "Chưa khóa mục tiêu — chạm để chọn", 13, path ? pathColor : "#8fa2bd", 216);
      this.text(this.root, 1210, 378, "›", 18, "#8fa2bd").setOrigin(1, 0);
      const pathHit = this.add.rectangle(1092, 384, 264, 44, 0, 0);
      this.root.add(pathHit);
      if (enabled) {
        pathHit.setInteractive({ useHandCursor: true });
        pathHit.on("pointerup", () => this.modals.pathPicker());
      }
    }

    this.root.add(this.add.rectangle(640, 677, view.w, 86, 0x091425, 0.95));
    this.root.add(this.add.rectangle(640, 634, view.w, 1, 0x69748a, 0.4));
    this.button(this.root, 124, 674, 190, "Tỉ lệ & vật phẩm", () => this.modals.details(), enabled);
    this.button(this.root, 328, 674, 190, "Nhật ký quay", () => void this.modals.history(0), enabled);
    this.button(this.root, 532, 674, 190, "Cửa hàng Nguyệt Tinh", () => { if (!this.busy && !this.modals.modal) this.scene.start("shop"); }, enabled);
    const jade = profile.currencies.moonJade;
    const jadeItem = data.economyConfig.moonStarShop.find(item => item.item.type === "moonJade");
    const jadeBought = jadeItem && profile.shop.weekKey === weekKey(data, Date.now()) ? (profile.shop.bought[jadeItem.id] ?? 0) : 0;
    const canConvert = jadeItem !== undefined && jadeBought < jadeItem.limitPerWeek && profile.currencies.moonStar >= jadeItem.price;
    if (this.phase !== "pending" && jade < pullCost * 10 && canConvert) {
      this.button(this.root, 722, 674, 190, "⇄ Đổi Tinh lấy Ngọc", () => void this.modals.convert(), enabled);
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
    if (this.modals.modal) { this.modals.close(); this.render(); return; }
    if (this.drawerFx.layer) { this.drawerFx.close(); return; }
    if (this.phase === "revealing") { this.resultsFx.skip(); return; }
    if (this.phase === "complete") { this.resultsFx.close(); return; }
    if (this.busy) return;
    this.scene.start("deck-select");
  }

  private pull(count: 1 | 10) {
    if (this.busy || this.modals.modal || !this.alive || session.profile.currencies.moonJade < session.data.economyConfig.pullCost * count) return;
    this.phase = "pending";
    const banner = session.data.banners[this.bannerId];
    const gacha = session.data.economyConfig.gacha;
    this.hotPull = (session.profile.pity[banner?.pityGroup ?? this.bannerId]?.sinceLegendary ?? 0) >= gacha.legendaryPity - 10;
    this.audio?.play("cast");
    const generation = this.generation;
    this.modals.historyRequest++;
    this.render();
    void mutate<PullReply>("POST", `/gacha/${this.bannerId}/pull`, { count }).then(reply => {
      if (!this.alive || generation !== this.generation) return;
      this.phase = "revealing";
      this.render();
      this.resultsFx.start(reply.results);
      showToast(this, achievementNotices(reply.achievements), 94);
    }, (error: unknown) => {
      if (!this.alive || generation !== this.generation) return;
      this.phase = "idle";
      this.render();
      void alertModal(this, errorText(error));
    });
  }
}
