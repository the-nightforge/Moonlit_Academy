import Phaser from "phaser";
import type { GameData, PullResult, Rarity } from "rules";
import { featuredEntry, featuredRotationEnd, reservedFeaturedHeroes } from "rules";
import manifest from "virtual:assets-manifest";
import { achievementNotices, errorText, mutate, type ProfileReply } from "../account";
import { api } from "../api";
import { session } from "../session";
import { loadCombatSettings } from "../ui/combat-settings";
import { roundedPanel } from "../ui/rounded-panel";
import { COLORS, CURRENCY_LABELS, RARITY_COLORS, RARITY_LABELS, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, alertModal, isModalOpen, showToast } from "../ui/widgets";

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
  private spotlightHeroId = "";
  private phase: "idle" | "pending" | "revealing" | "complete" = "idle";
  private alive = false;
  private generation = 0;
  private historyRequest = 0;
  private reducedMotion = false;
  private revealTweens: Phaser.Tweens.Tween[] = [];
  private cards: ResultCard[] = [];
  private seal: Phaser.GameObjects.Container | null = null;
  private transientVfx = new Set<Phaser.GameObjects.Container>();
  private ambient: Phaser.GameObjects.Container | null = null;
  private artTween: Phaser.Tweens.Tween | null = null;
  private enteredOnce = false;

  private get busy() { return this.phase !== "idle"; }

  constructor() { super("gacha"); }

  preload() {
    const heroes = new Set(Object.values(session.data.banners)
      .filter(banner => banner.kind === "hero")
      .flatMap(banner => [...Object.values(banner.pool).flat(), ...(banner.featured?.rotation ?? []).map(entry => entry.heroId)]));
    const selected = {
      gacha: ["altar", "card_back", "weapon_banner", "relic_banner", "spark"],
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
    this.reducedMotion = loadCombatSettings(localStorage, window.matchMedia("(prefers-reduced-motion: reduce)").matches).reducedMotion
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.root = this.add.container(0, 0);
    this.enteredOnce = false;
    this.ambient = this.add.container(0, 0).setDepth(-1);
    if (this.textures.exists("gacha:spark")) {
      for (let i = 0; i < 9; i++) {
        const size = 14 + Math.random() * 22;
        const spark = this.add.image(360 + Math.random() * 560, 120 + Math.random() * 460, "gacha:spark");
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
    const spotlightPool = (session.data.banners[this.bannerId]?.pool.legendary ?? []).filter(id => session.data.heroes[id]);
    this.spotlightHeroId = spotlightPool[Math.floor(Math.random() * spotlightPool.length)] ?? "";
    const onEsc = () => { if (!isModalOpen()) this.back(); };
    this.input.keyboard?.on("keydown-ESC", onEsc);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.generation++;
      this.historyRequest++;
      this.cancelReveal();
      this.closeModal();
      this.input.keyboard?.off("keydown-ESC", onEsc);
      this.tweens.killAll();
      this.cards = [];
      this.results = null;
      this.resultFooter = null;
      this.seal = null;
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
    const altar = this.image(this.root, "gacha:altar", view.x + view.w / 2, view.y + view.h / 2, view.w, view.h);
    if (altar) altar.setScale(Math.max(view.w / altar.width, view.h / altar.height)).setAlpha(0.86);
    this.root.add(this.add.rectangle(640, 43, view.w, 86, 0x091425, 0.96));
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
    const leftCol = this.add.container(0, 0), centerCol = this.add.container(0, 0), rightCol = this.add.container(0, 0);
    this.root.add([leftCol, centerCol, rightCol]);
    const KIND_ACCENT = { hero: 0xe8c784, weapon: 0x7f9cc4, relic: 0xb08ee0 } as const;

    leftCol.add(roundedPanel(this, 170, 390, 284, 560, 0x0b192e, 0.91, 0x69748a, 16));
    this.text(leftCol, 52, 132, "CHỌN DUYÊN TRIỆU HỒI", 13, "#bfad85");
    Object.values(data.banners).forEach((entry, index) => {
      const y = 186 + index * 89, selected = entry.id === this.bannerId;
      const panel = roundedPanel(this, 170, y, 244, 72, selected ? 0x34405a : 0x14243a, 0.96, selected ? 0xe8c784 : 0x53627d, 12);
      const hit = this.add.rectangle(0, 0, 244, 72, 0, 0);
      panel.add(hit);
      if (enabled && !selected) hit.setInteractive({ useHandCursor: true }).on("pointerup", () => {
        if (this.busy || this.modal) return;
        this.bannerId = entry.id; this.render();
      });
      panel.add(this.add.rectangle(-119, 0, 4, 56, KIND_ACCENT[entry.kind], 0.85));
      const weekHeroId = entry.featured ? featuredEntry(entry, Date.now())?.heroId : undefined;
      const textX = weekHeroId ? -60 : -105;
      if (weekHeroId) this.image(panel, `heroes:${weekHeroId}`, -88, 0, 34, 50);
      this.text(panel, textX, -13, entry.name, weekHeroId ? 16 : 18, selected ? "#f4dfb2" : COLORS.text);
      this.text(panel, textX, 14, entry.featured ? "Tướng Legendary xoay tua tuần" : entry.kind === "hero" ? "Anh hùng trong thư viện" : entry.kind === "weapon" ? "Trang bị · Binh khí" : "Trang bị · Nguyệt bảo", 12, "#aab9d0");
      if (entry.featured) this.text(panel, 112, -23, "★", 13, "#e8c784").setOrigin(1, 0);
      leftCol.add(panel);
    });
    leftCol.add(this.add.rectangle(170, 504, 236, 1, 0x69748a, 0.45));
    this.button(leftCol, 170, 540, 244, "Nhật ký quay", () => void this.showHistory(0), enabled);
    this.button(leftCol, 170, 606, 244, "Cửa hàng Nguyệt Tinh", () => { if (!this.busy && !this.modal) this.scene.start("shop"); }, enabled);

    rightCol.add(roundedPanel(this, 1105, 326, 284, 432, 0x0a192e, 0.93, 0x69748a, 16));
    this.text(rightCol, 990, 143, "LỜI HẸN DƯỚI TRĂNG", 13, "#bfad85");
    this.text(rightCol, 990, 178, banner.pityGroup ? "Bảo hiểm chung banner Hero" : "Bảo hiểm riêng banner", 18, "#f3dfb1");
    const progress = (y: number, rarity: "epic" | "legendary", since: number, limit: number, softStart?: number) => {
      this.text(rightCol, 990, y, RARITY_LABELS[rarity], 17, rarity === "epic" ? "#d4b6f7" : "#f3d98c");
      this.text(rightCol, 1217, y, `${since} / ${limit}`, 15, "#c3cfdf").setOrigin(1, 0);
      rightCol.add(roundedPanel(this, 1105, y + 38, 230, 8, 0x25334c, 1, 0x25334c, 4));
      const soft = softStart !== undefined && since >= softStart;
      const w = 230 * Math.min(1, since / limit);
      if (w > 0) {
        const fill = this.add.rectangle(990 + w / 2, y + 38, w, 6, soft ? 0xffd977 : RARITY_COLORS[rarity]);
        rightCol.add(fill);
        if (soft && !this.reducedMotion) this.tweens.add({ targets: fill, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      if (softStart !== undefined) {
        rightCol.add(this.add.rectangle(990 + 230 * Math.min(1, softStart / limit), y + 38, 2, 12, 0xf3d98c, 0.7));
      }
      this.text(rightCol, 990, y + 56, soft ? `Soft pity đang mở · còn ${Math.max(1, limit - since)}` : `Còn ${Math.max(1, limit - since)} lượt tới bảo hiểm`, 14, soft ? "#f3d98c" : "#aebed3");
    };
    progress(226, "epic", pity.sinceEpic, gacha.epicPity);
    progress(342, "legendary", pity.sinceLegendary, gacha.legendaryPity, gacha.legendarySoftPityStart);
    const rotationEnd = featuredRotationEnd(banner, Date.now());
    if (rotationEnd !== undefined) {
      const left = rotationEnd - Date.now(), days = Math.floor(left / 86_400_000), hours = Math.floor(left / 3_600_000) % 24, minutes = Math.floor(left / 60_000) % 60;
      this.text(rightCol, 990, 426, `Đổi tướng sau ${days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`}`, 13, "#adbed4");
      const nextHero = featuredEntry(banner, Date.now() + 7 * 24 * 60 * 60 * 1000)?.heroId;
      if (nextHero) this.text(rightCol, 990, 448, `Tuần sau: ${itemName(data, nextHero)}`, 13, "#8fa2bd");
    }
    this.button(rightCol, 1105, 505, 244, "Tỉ lệ & vật phẩm", () => this.showDetails(), enabled);

    const heroId = featured?.heroId ?? (banner.kind === "hero" ? this.spotlightHeroId : undefined) ?? banner.pool.legendary.find(id => data.heroes[id]) ?? banner.pool.epic.find(id => data.heroes[id]);
    const artKey = banner.kind === "hero" ? `heroes:${heroId}` : `gacha:${banner.kind}_banner`;
    centerCol.add(this.add.circle(640, 300, 215, 0xe8d9ae, 0.09));
    centerCol.add(this.add.circle(640, 300, 185, 0xf4e2b0, 0.07));
    const art = this.image(centerCol, artKey, 640, 325, 495, 430);
    if (art) {
      centerCol.add(roundedPanel(this, 640, 325, art.displayWidth + 14, art.displayHeight + 14, 0x0b172a, 0, 0x9a8965, 10));
      if (!this.reducedMotion) {
        this.artTween = this.tweens.add({ targets: art, scaleX: art.scaleX * 1.012, scaleY: art.scaleY * 1.012, duration: 3600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    } else { centerCol.add(this.add.circle(640, 295, 106, 0xded7b4, 0.15).setStrokeStyle(2, 0xc0aa78)); this.image(centerCol, "ui:moon_full", 640, 300, 160, 160); }
    centerCol.add(roundedPanel(this, 640, 549, 558, 82, 0x0b172a, 0.94, 0x9a8965, 14));
    this.text(centerCol, 640, 523, featured ? "TƯỚNG TUẦN NÀY" : banner.kind === "hero" ? "ANH HÙNG TRONG BANNER" : "MINH HỌA LOẠI TRANG BỊ", 12, "#bda77e").setOrigin(0.5);
    this.text(centerCol, 640, 547, banner.kind === "hero" && heroId ? itemName(data, heroId) : banner.name, 25, "#f5e2ba").setOrigin(0.5);
    this.text(centerCol, 640, 575, featured ? `Legendary: ${percent(banner.featured!.rateUp)} trúng tướng tuần · tuần sau đổi tướng` : banner.kind === "hero" ? "Xem toàn bộ anh hùng trong Tỉ lệ & vật phẩm" : "Vật phẩm nhận được theo danh sách trong banner", 13, "#adbed4").setOrigin(0.5);
    centerCol.add(roundedPanel(this, 640, 646, 640, 86, 0x0c182b, 0.97, 0x6b6c77, 16));
    const jade = profile.currencies.moonJade;
    for (const [count, x] of [[1, 490], [10, 790]] as const) {
      const need = pullCost * count, afford = jade >= need;
      this.button(centerCol, x, 637, 260, afford ? `Quay ${count}   ·   ${need}` : `Thiếu ${need - jade} ${CURRENCY_LABELS.moonJade}`, () => this.pull(count), enabled && afford, count === 10);
      if (afford) this.image(centerCol, "ui:cur_moonJade", x + 101, 637, 24, 24);
    }
    if (enabled && jade >= pullCost * 10) {
      const ring = roundedPanel(this, 790, 637, 268, 50, 0xe8c784, 0, 0xf3d98c, 12);
      centerCol.add(ring);
      if (this.reducedMotion) ring.setAlpha(0.45);
      else this.tweens.add({ targets: ring, alpha: 0.3, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.text(centerCol, 640, 675, this.phase === "pending" ? "Đang kết nối · xin chờ hồi âm…" : `${CURRENCY_LABELS.moonJade} · Mỗi lượt ${pullCost} · Tỉ lệ công khai trong Tỉ lệ & vật phẩm`, 13, "#b4c3d7").setOrigin(0.5);

    if (!this.enteredOnce) {
      this.enteredOnce = true;
      if (!this.reducedMotion) {
        [leftCol, centerCol, rightCol].forEach((col, i) => {
          col.setAlpha(0);
          col.y = 16;
          this.tweens.add({ targets: col, alpha: 1, y: 0, duration: 380, delay: 100 + i * 130, ease: "Sine.easeOut" });
        });
      }
    }
  }

  private back() {
    if (this.modal) { this.closeModal(); this.render(); return; }
    if (this.phase === "revealing") { this.skipReveal(); return; }
    if (this.phase === "complete") { this.closeResults(); return; }
    if (this.busy) return;
    this.scene.start("deck-select");
  }

  private pull(count: 1 | 10) {
    if (this.busy || this.modal || !this.alive || session.profile.currencies.moonJade < session.data.economyConfig.pullCost * count) return;
    this.phase = "pending";
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
    this.results.add(this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x050c18, 0.97).setInteractive());
    this.results.add(roundedPanel(this, 640, 360, 1192, 672, 0x0b182b, 0.97, 0x9e8864, 22));
    this.text(this.results, 640, 60, "DUYÊN TRĂNG ĐÃ ĐẾN", 25, "#f3deb0").setOrigin(0.5);
    this.text(this.results, 640, 94, session.data.banners[this.bannerId]!.name, 15, "#b7c5d9").setOrigin(0.5);
    this.cards = results.map((result, i) => {
      const single = results.length === 1, width = single ? 330 : 207, height = single ? 472 : 234;
      const root = this.add.container(single ? 640 : 190 + (i % 5) * 225, single ? 370 : 247 + Math.floor(i / 5) * 249).setAlpha(0);
      root.add(roundedPanel(this, 0, 0, width, height, 0x15243e, 1, 0x97845f, 12));
      const image = this.image(root, "gacha:card_back", 0, 0, width - 10, height - 10);
      if (!image) this.image(root, "ui:seal", 0, 0, 92, 92);
      this.results!.add(root);
      return { root, result, width, height, revealed: false };
    });
    this.resultFooter = this.add.container(0, 0); this.results.add(this.resultFooter);
    this.renderResultFooter();
    this.seal = this.add.container(640, 348);
    const glow = this.add.circle(0, 0, 140, 0xdfc184, 0.09).setStrokeStyle(2, 0xcdb678, 0.55);
    this.seal.add(glow);
    this.image(this.seal, "ui:seal", 0, 0, 166, 166);
    this.text(this.seal, 0, 185, "Tụ nguyệt quang · mở nguyệt ấn", 17, "#e6d3a9").setOrigin(0.5);
    this.results.add(this.seal);
    if (!this.reducedMotion) {
      this.animate({ targets:glow, scale:1.18, alpha:0.65, duration:460, yoyo:true });
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6, x = Math.cos(angle)*210, y = Math.sin(angle)*160;
        const spark = this.image(this.seal, "gacha:spark", x, y, 16, 16);
        if (spark) this.animate({ targets:spark, x:x*0.25, y:y*0.25, alpha:0, duration:580, delay:i*15 });
      }
    } else this.animate({ targets:this.seal, alpha:0.55, duration:250, yoyo:true });
    this.later(this.reducedMotion ? 300 : 850, () => {
      this.seal?.destroy(); this.seal = null;
      this.cards.forEach(card => card.root.setAlpha(1));
      this.revealNext(0);
    });
  }

  private revealNext(index: number) {
    const card = this.cards[index];
    if (!card) { this.finishReveal(); return; }
    const beat = this.reducedMotion ? 90 : card.result.rarity === "legendary" ? 440 : card.result.rarity === "epic" ? 300 : 170;
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
    root.add(roundedPanel(this, 0, 0, w, h, 0x15253c, 1, color, 12));
    root.add(this.add.rectangle(0, -h/2 + 17, w - 16, 24, color, 0.22));
    this.text(root, 0, -h/2 + 17, RARITY_LABELS[result.rarity], single ? 18 : 14, `#${color.toString(16).padStart(6,"0")}`).setOrigin(0.5);
    const hero = data.heroes[result.itemId], weapon = data.weapons[result.itemId];
    const artKey = hero ? `heroes:${result.itemId}` : weapon ? "gacha:weapon_banner" : "gacha:relic_banner";
    const artH = single ? 294 : hero ? 118 : 102, artY = -h/2 + 40 + artH/2;
    const art = this.image(root, artKey, 0, artY, w - 20, artH);
    if (!art) this.image(root, hero ? "ui:star" : "ui:gear", 0, artY, 60, 60);
    const nameY = single ? 126 : 44;
    this.text(root, 0, nameY, itemName(data,result.itemId), single ? 24 : 16, "#f3e5c7", w - 24).setOrigin(0.5,0).setAlign("center");
    this.text(root, 0, single ? 192 : 84, this.outcomeText(result), single ? 17 : 12, "#dbc28d", w - 20).setOrigin(0.5,0).setAlign("center");
    if (!hero) this.text(root, 0, single ? 110 : 30, "Minh họa loại trang bị", single ? 12 : 10, "#9babc3").setOrigin(0.5);
  }

  private rarityVfx(card: ResultCard) {
    if (!this.results || (card.result.rarity !== "epic" && card.result.rarity !== "legendary")) return;
    const color = RARITY_COLORS[card.result.rarity];
    const vfx = this.add.container(card.root.x,card.root.y).setName("gacha_rarity_vfx");
    this.results.add(vfx);
    this.transientVfx.add(vfx);
    vfx.add(roundedPanel(this,0,0,card.width+10,card.height+10,color,0.14,color,16));
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
    this.seal?.destroy(); this.seal = null;
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
    this.button(this.resultFooter, 640, 650, 258, this.phase === "revealing" ? "Bỏ qua hiệu ứng" : "Tiếp tục", () => this.phase === "revealing" ? this.skipReveal() : this.closeResults(), true, true);
  }

  private closeResults() {
    if (this.phase !== "complete") return;
    this.cancelReveal(); this.results?.destroy(); this.results = null; this.resultFooter = null; this.cards = [];
    this.phase = "idle"; this.render();
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
  private openList(title: string, lines: { text: string; color?: string }[], footer?: (layer: Phaser.GameObjects.Container) => void) {
    this.closeModal();
    const layer = this.add.container(0,0).setDepth(500); this.modal = layer;
    const view = visibleWorld(this);
    layer.add(this.add.rectangle(view.x+view.w/2,view.y+view.h/2,view.w,view.h,0x030914,0.8).setInteractive());
    layer.add(roundedPanel(this,640,360,1030,650,0x0f1e34,0.99,0xbba172,20));
    this.text(layer,640,70,title,24,"#f3dfb5").setOrigin(0.5);
    this.text(layer,640,105,"Cuộn để xem toàn bộ · Esc để đóng",13,"#a8bbd2").setOrigin(0.5);
    const content = this.add.container(0,0); layer.add(content);
    const rows: Phaser.GameObjects.Text[] = [];
    let y = 143;
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
      rows.forEach(row => row.setVisible(row.y - offset >= 137 && row.y - offset + row.height <= 577));
    };
    const scroll = (delta: number) => {
      offset = Phaser.Math.Clamp(offset + delta,0,Math.max(0,y-577));
      updateRows();
    };
    updateRows();
    const wheel = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const p = this.cameras.main.getWorldPoint(pointer.x,pointer.y);
      if (p.x >= 166 && p.x <= 1114 && p.y >= 137 && p.y <= 577) scroll(Math.sign(dy)*90);
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
      ...(g.newPlayerEpicHero && banner.kind === "hero" ? [{ text:"Bảo vệ người mới: Epic ưu tiên Hero chưa sở hữu." }] : []),
      ...(featured && banner.featured ? [
        { text:`Legendary trúng: ${percent(banner.featured.rateUp)} ${itemName(data,featured.heroId)} (tướng tuần) · ${percent(1-banner.featured.rateUp)} một tướng Legendary khác.`, color:"#f3d98c" },
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
        const featuredTag = featured && rarity === "legendary" && id === featured.heroId ? " ★" : "";
        const owned = banner.kind === "hero" ? (profile.heroes[id] ? `Tinh Hồn ${profile.heroes[id]!.constellation}` : "chưa có")
          : banner.kind === "weapon" ? (profile.weapons[id] ? `Tinh Luyện ${profile.weapons[id]!.refinement}` : "chưa có")
          : (profile.relics[id] ? `Cộng Minh ${profile.relics[id]!.resonance}` : "chưa có");
        lines.push({text:`${itemName(data,id)}${featuredTag}   ·   ${owned}`});
      }
    }
    this.openList(`${banner.name} · Tỉ lệ & vật phẩm`,lines);
  }

  private async showHistory(page: number) {
    if (this.busy || !this.alive) return;
    this.openList(`Nhật ký quay — trang ${page+1}`,[{text:"Đang tải nhật ký…"}],layer=>this.button(layer,640,636,220,"Đóng",()=>{this.closeModal();this.render();}));
    const request = ++this.historyRequest, generation = this.generation;
    try {
      const { entries } = await api<{ entries:HistoryEntry[] }>("GET",`/gacha/history?page=${page}`);
      if (!this.alive || generation !== this.generation || request !== this.historyRequest || !this.modal) return;
      const lines = entries.map(entry=>({text:`${new Date(entry.createdAt).toLocaleString("vi-VN")} · ${session.data.banners[entry.bannerId]?.name ?? entry.bannerId}\n${entry.results.map(result=>`${itemName(session.data,result.itemId)} (${RARITY_LABELS[result.rarity]}) · ${this.outcomeText(result).replace("\n"," · ")}`).join("; ")}`}));
      this.openList(`Nhật ký quay — trang ${page+1}`,lines.length ? lines : [{text:"Chưa có lượt quay nào"}],layer=>{
        this.button(layer,430,636,170,"◂ Mới hơn",()=>void this.showHistory(page-1),page>0);
        this.button(layer,640,636,170,"Đóng",()=>{this.closeModal();this.render();});
        this.button(layer,850,636,170,"Cũ hơn ▸",()=>void this.showHistory(page+1),entries.length===20);
      });
    } catch (error) {
      if (!this.alive || generation !== this.generation || request !== this.historyRequest || !this.modal) return;
      this.closeModal(); this.render(); void alertModal(this,errorText(error));
    }
  }
}
