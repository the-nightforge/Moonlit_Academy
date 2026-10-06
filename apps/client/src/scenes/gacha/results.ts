import Phaser from "phaser";
import type { PullResult, Rarity } from "rules";
import { session } from "../../session";
import { roundedPanel } from "../../ui/rounded-panel";
import { CURRENCY_LABELS, RARITY_COLORS, visibleWorld } from "../../ui/theme";
import type { GachaScene } from "../gacha-scene";
import { coverCrop, itemName, outcomeText, type ResultCard } from "./shared";

/**
 * The summon result flow: meteor cinematic → sequential card flip → footer.
 * Owns the overlay layer and every reveal tween so `cancel` can stop all of it.
 */
export class GachaResults {
  cards: ResultCard[] = [];
  private layer: Phaser.GameObjects.Container | null = null;
  private footer: Phaser.GameObjects.Container | null = null;
  private cine: Phaser.GameObjects.Container | null = null;
  private revealTweens: Phaser.Tweens.Tween[] = [];
  private revealTimers: ReturnType<typeof setTimeout>[] = [];
  private transientVfx = new Set<Phaser.GameObjects.Container>();

  constructor(private s: GachaScene) {}

  start(results: PullResult[]) {
    const s = this.s;
    this.layer = s.add.container(0, 0).setDepth(600);
    const view = visibleWorld(s);
    this.layer.add(s.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x050c18, 0.94).setInteractive());
    this.layer.add(roundedPanel(s, 640, 360, 1220, 690, 0x0b182b, 0.95, 0x9e8864, 22));
    s.text(this.layer, 640, 48, "DUYÊN TRĂNG ĐÃ ĐẾN", 25, "#f3deb0").setOrigin(0.5);
    s.text(this.layer, 640, 82, session.data.banners[s.bannerId]!.name, 15, "#b7c5d9").setOrigin(0.5);
    this.cards = results.map((result, i) => {
      const single = results.length === 1, width = single ? 330 : 178, height = single ? 495 : 267;
      const root = s.add.container(single ? 640 : 236 + (i % 5) * 202, single ? 360 : 240 + Math.floor(i / 5) * 276).setAlpha(0);
      root.add(roundedPanel(s, 0, 0, width, height, 0x15243e, 1, 0x97845f, 12));
      const image = s.image(root, "gacha:card_back", 0, 0, width - 6, height - 6);
      if (!image) s.image(root, "ui:seal", 0, 0, 92, 92);
      this.layer!.add(root);
      return { root, result, width, height, revealed: false };
    });
    this.footer = s.add.container(0, 0);
    this.layer.add(this.footer);
    this.renderFooter();
    this.playCinematic(results);
  }

  /** "Nguyệt tinh lạc": light streak(s) fall to the altar, tinted by the pull's top rarity. */
  private playCinematic(results: PullResult[]) {
    const s = this.s;
    const rank = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;
    const rarity = (Object.keys(rank) as Rarity[])[results.reduce((m, r) => Math.max(m, rank[r.rarity]), 0)]!;
    const tint = { common: 0xaec4de, rare: 0x7fb4ff, epic: 0xc89cff, legendary: 0xffcf6e }[rarity];
    const layer = s.add.container(0, 0);
    this.cine = layer;
    this.layer!.add(layer);
    const view = visibleWorld(s);
    const dim = s.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x030914, 0);
    layer.add(dim);
    this.animate({ targets: dim, fillAlpha: s.hotPull ? 0.68 : 0.55, duration: 240 });
    const count = results.length === 1 ? 1 : 4;
    const hasMeteor = s.textures.exists("gacha:meteor_head") && s.textures.exists("gacha:meteor_tail");
    const flight = s.reducedMotion ? 60 : rarity === "legendary" ? 780 : rarity === "epic" ? 660 : 540;
    const hotFlight = s.hotPull ? Math.round(flight * 1.35) : flight;
    if (s.hotPull && !s.reducedMotion) {
      const hint = s.text(layer, 640, 620, rarity === "legendary" ? "Nguyệt tinh đang rực sáng…" : "Bảo hiểm đang gần…", 17, "#f3d98c").setOrigin(0.5).setAlpha(0);
      this.animate({ targets: hint, alpha: 1, duration: 300, delay: 300 });
      this.animate({ targets: hint, alpha: 0, duration: 220, delay: count * 130 + hotFlight });
    }
    for (let i = 0; i < count; i++) {
      const main = i === count - 1;
      const delay = s.reducedMotion ? 0 : i * 130;
      const sx = 940 + Math.random() * 380, sy = -20 + Math.random() * 130;
      const ex = 480 + Math.random() * 280, ey = 270 + Math.random() * 100;
      const streak = s.add.container(sx, sy);
      if (hasMeteor) {
        const tail = s.image(streak, "gacha:meteor_tail", -250, 0, 512, 64);
        const head = s.image(streak, "gacha:meteor_head", 0, 0, 96, 96);
        tail?.setFlipX(true).setTint(tint);
        head?.setTint(tint);
      } else {
        streak.add(s.add.circle(0, 0, 30, tint, 0.9));
        streak.add(s.add.circle(0, 0, 60, tint, 0.3));
      }
      streak.setRotation(Phaser.Math.Angle.Between(sx, sy, ex, ey));
      streak.setScale(main ? (rarity === "legendary" ? 1.45 : 1.15) * (s.hotPull ? 1.15 : 1) : 0.65);
      layer.add(streak);
      this.animate({ targets: streak, x: ex, y: ey, duration: hotFlight, delay, ease: "Quad.easeIn",
        onComplete: () => { streak.destroy(); this.impactBurst(ex, ey, tint, layer, main, rarity); } });
    }
    this.later(s.reducedMotion ? 480 : count * 130 + hotFlight + 260, () => {
      this.cine?.destroy();
      this.cine = null;
      this.cards.forEach(card => card.root.setAlpha(1));
      this.revealNext(0);
    });
  }

  private impactBurst(x: number, y: number, tint: number, layer: Phaser.GameObjects.Container, big: boolean, rarity: Rarity) {
    const s = this.s;
    if (s.phase !== "revealing" || !s.alive) return;
    const ring = s.add.circle(x, y, 16, tint, 0).setStrokeStyle(big ? 4 : 2, tint, 0.9);
    layer.add(ring);
    this.animate({ targets: ring, scale: big ? 7 : 3.5, alpha: 0, duration: big ? 460 : 280 });
    for (let i = 0; i < (big ? 10 : 4); i++) {
      const angle = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 60;
      const spark = s.image(layer, "gacha:spark", x, y, 14, 14);
      if (spark) {
        spark.setTint(tint);
        this.animate({ targets: spark, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0, duration: 340 });
      }
    }
    if (!big) return;
    s.audio?.play("impact");
    const flash = s.add.rectangle(640, 360, 1280, 720, 0xfff6dd, 0);
    layer.add(flash);
    this.animate({ targets: flash, fillAlpha: 0.38, duration: 80, yoyo: true });
    if (rarity === "legendary") {
      const halo = s.image(layer, "gacha:halo_legendary", x, y, 460, 460)
        ?? s.image(layer, "ui:moon_full", x, y, 340, 340);
      if (halo) {
        halo.setTint(tint).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
        this.animate({ targets: halo, scale: 1.5, alpha: 0, duration: 620 });
      }
      if (!s.reducedMotion) s.cameras.main.shake(220, 0.007);
    } else if (!s.reducedMotion) {
      s.cameras.main.shake(150, 0.004);
    }
  }

  private revealNext(index: number) {
    const s = this.s;
    const card = this.cards[index];
    if (!card) { this.finish(); return; }
    const beat = s.reducedMotion ? 90 : card.result.rarity === "legendary" ? 420 : card.result.rarity === "epic" ? 280 : 130;
    if (s.reducedMotion) {
      card.root.setAlpha(0.15); this.drawCard(card);
      this.rarityVfx(card);
      this.animate({ targets: card.root, alpha: 1, duration: 90 });
      this.later(beat + 100, () => this.revealNext(index + 1));
    } else {
      this.animate({ targets: card.root, scaleX: 0, duration: 110 });
      // The flip tween is visual only — card content swaps on wall-clock time so
      // the reveal keeps its pace even when frame delta is heavily capped.
      this.later(110, () => {
        this.drawCard(card);
        this.rarityVfx(card);
        this.animate({ targets: card.root, scaleX: 1, duration: 160 });
      });
      this.later(beat + 270, () => this.revealNext(index + 1));
    }
  }

  private drawCard(card: ResultCard) {
    if (card.revealed) return;
    card.revealed = true;
    const s = this.s;
    const { root, result, width: w, height: h } = card, single = this.cards.length === 1;
    const data = session.data, color = RARITY_COLORS[result.rarity];
    root.removeAll(true);
    root.add(roundedPanel(s, 0, 0, w, h, 0x0d1830, 1, color, 12));
    const hero = data.heroes[result.itemId], weapon = data.weapons[result.itemId];
    const equipmentKey = `${weapon ? "weapons" : "relics"}:${result.itemId}`;
    const hasEquipmentArt = !hero && s.textures.exists(equipmentKey);
    const artKey = hero ? `heroes:${result.itemId}` : hasEquipmentArt ? equipmentKey : weapon ? "gacha:weapon_banner" : "gacha:relic_banner";
    const art = s.image(root, artKey, 0, 0, w - 8, h - 8);
    if (art) {
      if (!hero) coverCrop(art, w - 8, h - 8); // square equipment art -> cover-crop to 2:3
    } else s.image(root, hero ? "ui:star" : "ui:gear", 0, -20, 60, 60);
    s.audio?.play(result.rarity === "legendary" ? "legendary" : result.rarity === "epic" ? "epic" : result.rarity === "rare" ? "rare" : "flip");
    const frameKey = `gacha:frame_${result.rarity}`;
    if (s.textures.exists(frameKey)) s.image(root, frameKey, 0, 0, w, h);
    // Rarity shows as a border around the art instead of a floating badge.
    const artBorder = s.add.graphics();
    artBorder.lineStyle(2, color, 0.9);
    artBorder.strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 10);
    root.add(artBorder);
    if (result.epitomizedHit) {
      const tagW = w * 0.52, tagH = 16, tagY = h / 2 - 76;
      const tag = s.add.graphics();
      tag.fillStyle(0xe8c784, 0.92);
      tag.fillRoundedRect(-tagW / 2, tagY, tagW, tagH, 8);
      root.add(tag);
      s.text(root, 0, tagY + tagH / 2, "NGUYỆT ƯỚC", single ? 12 : 9, "#151c30").setOrigin(0.5);
    }
    s.text(root, 0, h / 2 - 52, itemName(data, result.itemId), single ? 22 : 14, "#f7ecd2", w - 16).setOrigin(0.5).setAlign("center").setStroke("#0a1424", 4);
    s.text(root, 0, h / 2 - 24, outcomeText(result), single ? 16 : 11, "#ecd7a4", w - 14).setOrigin(0.5).setAlign("center").setStroke("#0a1424", 3);
    if (!hero && !hasEquipmentArt) s.text(root, 0, -h / 2 + 34, "Minh họa loại trang bị", single ? 12 : 10, "#9babc3").setOrigin(0.5);
  }

  private rarityVfx(card: ResultCard) {
    const s = this.s;
    if (!this.layer || (card.result.rarity !== "epic" && card.result.rarity !== "legendary")) return;
    const color = RARITY_COLORS[card.result.rarity];
    const vfx = s.add.container(card.root.x, card.root.y).setName("gacha_rarity_vfx");
    this.layer.add(vfx);
    this.transientVfx.add(vfx);
    vfx.add(roundedPanel(s, 0, 0, card.width + 10, card.height + 10, color, 0.14, color, 16));
    if (card.result.rarity === "legendary" && s.textures.exists("gacha:halo_legendary")) {
      const halo = s.image(vfx, "gacha:halo_legendary", 0, 0, card.width * 2.1, card.width * 2.1);
      if (halo) {
        halo.setTint(color).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD);
        this.animate({ targets: halo, scale: 1.35, alpha: 0, duration: 650 });
      }
    }
    const finish = () => { this.transientVfx.delete(vfx); vfx.destroy(); };
    if (s.reducedMotion) {
      this.animate({ targets: vfx, alpha: 0, duration: 150, onComplete: finish });
      return;
    }
    // Eight local motes and one short halo: no emitters or screen-wide flash.
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, x = Math.cos(angle) * (card.width / 2 + 4), y = Math.sin(angle) * (card.height / 2 + 4);
      const spark = s.image(vfx, "gacha:spark", x, y, 12, 12);
      if (spark) {
        spark.setTint(color);
        this.animate({ targets: spark, x: x * 1.12, y: y * 1.12, alpha: 0, duration: 280 });
      }
    }
    this.animate({ targets: vfx, scale: 1.035, alpha: 0, duration: 340, onComplete: finish });
  }

  skip() {
    if (this.s.phase !== "revealing") return;
    this.cancel();
    this.cine?.destroy(); this.cine = null;
    this.cards.forEach(card => { card.root.setScale(1).setAlpha(1); this.drawCard(card); });
    this.finish();
  }

  private finish() {
    this.s.phase = "complete";
    this.cancel();
    this.cards.forEach(card => card.root.setScale(1).setAlpha(1));
    this.renderFooter();
  }

  private renderFooter() {
    const s = this.s;
    this.footer?.removeAll(true);
    if (!this.footer) return;
    if (s.phase === "revealing") {
      s.button(this.footer, 1148, 58, 150, "Bỏ qua ≫", () => this.skip(), true);
      return;
    }
    const count = this.cards.length === 1 ? 1 : 10;
    const cost = session.data.economyConfig.pullCost * count;
    const jade = session.profile.currencies.moonJade;
    const afford = jade >= cost;
    s.button(this.footer, 300, 664, 220, "Trở về", () => this.close(), true);
    s.button(this.footer, 640, 664, 250, afford ? `Quay tiếp ×${count} · ${cost}` : `Thiếu ${cost - jade} ${CURRENCY_LABELS.moonJade}`,
      () => { this.close(); s.pull(count); }, afford, true);
    s.button(this.footer, 980, 664, 220, "Lưu ảnh ⤓", () => this.saveSnapshot(), true);
  }

  /** Exports the current frame as a PNG so players can keep/share a lucky pull. */
  private saveSnapshot() {
    this.s.audio?.play("click");
    this.s.game.renderer.snapshot(snap => {
      if (!(snap instanceof HTMLImageElement)) return;
      const link = document.createElement("a");
      link.href = snap.src;
      link.download = `duyen-trang-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      link.click();
    }, "image/png");
  }

  close() {
    if (this.s.phase !== "complete") return;
    this.cancel();
    this.layer?.destroy(); this.layer = null; this.footer = null; this.cards = [];
    this.s.phase = "idle";
    this.s.render();
  }

  cancel() {
    this.revealTweens.forEach(tween => tween.stop()); this.revealTweens = [];
    this.revealTimers.forEach(clearTimeout); this.revealTimers = [];
    this.transientVfx.forEach(vfx => vfx.destroy()); this.transientVfx.clear();
  }

  /** Drops every reference; the scene teardown destroys the layer itself. */
  reset() {
    this.cancel();
    this.cards = [];
    this.layer = null;
    this.footer = null;
    this.cine = null;
  }

  private later(delay: number, action: () => void) {
    // Wall-clock pacing on purpose: both TimerEvents and tween elapsed run on
    // capped scene delta, which crawls far behind real time at low frame rates
    // (a 690ms beat took ~10s under a ~4fps headless run and stalled the reveal).
    const timer = setTimeout(() => {
      if (this.s.alive && this.s.phase === "revealing") action();
    }, delay);
    this.revealTimers.push(timer);
  }

  private animate(config: Phaser.Types.Tweens.TweenBuilderConfig) { this.revealTweens.push(this.s.tweens.add(config)); }
}
