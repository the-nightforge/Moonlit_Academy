import Phaser from "phaser";
import { bondCardsForTeam, claimMission, masteryLevel, pendingUnlocks, starterDeck, validateDeck } from "rules";
import type { DeckError, GameData, SavedDeck } from "rules";
import manifest from "virtual:assets-manifest";
import { errorText, logout, mutate } from "../account";
import { api, auth } from "../api";
import { homeDecks, resolveHomeDeck } from "../home-selection";
import { StaleRequestError, type RequestGuard } from "../request-context";
import { startServerRun } from "../run-session";
import { prepareCombatAssets } from "../ui/combat-assets";
import { queueTexture } from "../ui/texture-queue";
import { startStoryTicket } from "../story-session";
import { session } from "../session";
import type { Team } from "../session";
import { coverCrop } from "./gacha/shared";
import { showTextTooltip } from "../ui/card-tooltip";
import { roundedPanel } from "../ui/rounded-panel";
import { HomeControls } from "../ui/home-controls";
import { loadCombatSettings } from "../ui/combat-settings";
import { COLORS, CURRENCY_LABELS, FACTION_LABELS, TEXT_BASE, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, alertModal, confirmModal, isModalOpen, RowScroller, showToast, type ButtonOptions } from "../ui/widgets";
import type { ArenaMeReply } from "./arena-scene";

const WIDTH = 1280;
const ROW_H = 36;
/** Team picker grid: 5 columns, 4 rows on screen, the rest scroll. */
const PICK_COLS = 5;
const PICK_ROWS = 4;
const PICK_W = 220;
const PICK_H = 96;
const PICK_STEP_X = 236;
const PICK_STEP_Y = 108;
const PICK_TOP = 110;
/** Hero portraits of the selected deck on the right column. */
const HERO_W = 200;
const HERO_H = 288;
const HERO_Y = 365;
const HERO_XS = [606, 840, 1074] as const;

export function describeDeckError(data: GameData, error: DeckError): string {
  switch (error.code) {
    case "badHeroes":
      return "Deck phải có 3 Hero khác nhau";
    case "unownedHero":
      return `Chưa sở hữu Hero: ${data.heroes[error.heroId]?.name ?? error.heroId}`;
    case "wrongSize":
      return `Deck cần đúng ${data.metaConfig.deckSize} lá (đang ${error.size})`;
    case "duplicateCard":
      return `Trùng lá: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    case "foreignCard":
      return `Lá không thuộc đội: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    case "tooFewForHero":
      return `${data.heroes[error.heroId]?.name ?? error.heroId} cần ít nhất ${data.metaConfig.minCardsPerHero} lá (đang ${error.count})`;
    case "lockedCard":
      return `Lá chưa mở: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    case "weaponSlot":
      return `Vũ khí gắn cho Hero ngoài đội: ${data.heroes[error.heroId]?.name ?? error.heroId}`;
    case "unownedWeapon":
      return `Chưa sở hữu vũ khí: ${data.weapons[error.weaponId]?.name ?? error.weaponId}`;
    case "weaponTwice":
      return `Một vũ khí gắn cho 2 Hero: ${data.weapons[error.weaponId]?.name ?? error.weaponId}`;
    case "unownedRelic":
      return `Chưa sở hữu Nguyệt Bảo: ${data.relics[error.relicId]?.name ?? error.relicId}`;
    case "duplicateRelic":
      return `Trùng Nguyệt Bảo: ${data.relics[error.relicId]?.name ?? error.relicId}`;
    case "tooManyRelics":
      return `Tối đa ${data.metaConfig.maxRelics} Nguyệt Bảo (đang ${error.count})`;
    default: {
      const exhaustive: never = error;
      return String(exhaustive);
    }
  }
}

interface RankInfo {
  tierId: string | null;
  tierName: string;
  rating: number;
}

/**
 * Home screen (`deck-select` key kept for scene routing): a splash-driven hub —
 * mode tiles and Arena rank on the left, the selected deck's hero trio on the
 * right, labeled quick navigation below and deck management in an overlay.
 */
export class DeckSelectScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private pickingTeam = false;
  private picked: string[] = [];
  private teamScroll!: RowScroller;
  /** A server request is in flight (run/story ticket). */
  private busy = false;
  /** Bumped on every create() and shutdown — a captured value going stale means this run of the scene is dead. */
  private generation = 0;
  private deckOverlay: Phaser.GameObjects.Container | null = null;
  private overlayPanel: Phaser.GameObjects.Container | null = null;
  private overlayScroll = 0;
  /** Wheel scroll scoped to the overlay's list region; `overlayScroll` mirrors `first` for specs. */
  private overlayScroller!: RowScroller;
  /** `null` while `/arena/me` is in flight or the player is offline. */
  private rank: RankInfo | null = null;
  /** `/arena/me` failed on this run of the scene — shows the retry state (`home-ui-redesign` §4). */
  private rankFailed = false;
  private navTooltip: Phaser.GameObjects.Container | null = null;
  private controls!: HomeControls;
  private reducedMotion = false;
  private busyStage = "Đang tải tài nguyên…";

  constructor() {
    super("deck-select");
  }

  preload() {
    const selected: Record<string, string[]> = {
      backgrounds: ["home", "background"],
      heroes: session.heroIds.flatMap((id) => [id, `${id}_up`]),
      ui: [
        "mode_arena", "mode_run", "mode_coop", "mode_story",
        "rank_dong_sinh", "rank_tu_tai", "rank_cu_nhan", "rank_tien_si", "rank_trang_nguyen",
        "cur_moonJade", "cur_moonStar", "cur_honor",
        "moon_full", "star", "gear", "check", "bolt", "seal", "nav_back",
        "epitomized_moon", "nav_banners", "nav_shop", "intent_buff",
        "nav_heroes", "nav_inventory", "nav_mastery", "nav_logout", "lock",
        // Interim mode glyphs until the ui:mode_* set ships (`docs/home-assets.md`).
        "node_combat", "moon_waxingCrescent", "nav_exchange", "nav_history",
      ],
    };
    for (const [category, ids] of Object.entries(selected)) {
      for (const id of ids) {
        const url = manifest[category]?.[id];
        const key = `${category}:${id}`;
        if (url && !this.textures.exists(key)) this.load.image(key, url);
      }
    }
  }

  /** `newDeck`: open straight on the team picker (Đấu Trường / Liên Thủ with no saved deck). */
  create(data?: { newDeck?: boolean }) {
    useDesignCamera(this);
    this.reducedMotion = loadCombatSettings(localStorage, window.matchMedia("(prefers-reduced-motion: reduce)").matches).reducedMotion;
    this.controls = new HomeControls(this, this.reducedMotion, isModalOpen);
    this.generation++;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      this.hideTip();
    });
    this.busy = false;
    this.rank = null;
    this.rankFailed = false;
    this.deckOverlay = null;
    this.overlayScroll = 0;
    this.pickingTeam = data?.newDeck === true && session.online;
    this.picked = this.pickingTeam ? [...session.heroIds] : [];
    const view = visibleWorld(this);
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    const gridW = (PICK_COLS - 1) * PICK_STEP_X + PICK_W;
    this.teamScroll = new RowScroller(
      this,
      { x: (WIDTH - gridW) / 2, y: PICK_TOP, width: gridW, height: PICK_ROWS * PICK_STEP_Y },
      () => {
        if (this.pickingTeam) this.render();
      },
    );
    // Wheel over the overlay's list region scrolls it; dead while the overlay is
    // closed (`renderDeckList` needs `overlayPanel`). One instance per scene run —
    // ten open/close cycles still leave a single wheel handler.
    this.overlayScroller = new RowScroller(
      this,
      { x: cx - 460, y: cy - 183, width: 920, height: 392 },
      () => {
        this.overlayScroll = this.overlayScroller.first;
        if (this.overlayPanel) this.renderDeckList(this.overlayPanel);
      },
    );

    // Splash backdrop: generated home art (or the library combat backdrop) with
    // a calm-left gradient so the mode tiles stay readable (`docs/home-assets.md`).
    this.add.rectangle(cx, cy, view.w, view.h, 0x07101f).setDepth(-3);
    const bgKey = ["backgrounds:home", "backgrounds:background"].find((key) => this.textures.exists(key));
    if (bgKey) {
      const art = this.add.image(cx, cy, bgKey).setDepth(-3);
      art.setScale(Math.max(view.w / art.width, view.h / art.height));
      const scrim = this.add.graphics().setDepth(-2);
      scrim.fillGradientStyle(0x050c18, 0x050c18, 0x050c18, 0x050c18, 0.88, 0.25, 0.88, 0.25);
      scrim.fillRect(view.x, view.y, view.w * 0.55, view.h);
      scrim.fillGradientStyle(0x050c18, 0x050c18, 0x050c18, 0x050c18, 0, 0, 0.55, 0.55);
      scrim.fillRect(view.x, view.y + view.h * 0.62, view.w, view.h * 0.38);
    }
    this.root = this.add.container(0, 0);
    this.render();
    if (!this.reducedMotion) {
      this.root.setAlpha(0);
      this.tweens.add({ targets: this.root, alpha: 1, duration: 220, ease: "Sine.easeOut" });
    }
    this.queueHeroArt();
    if (session.online) this.fetchRank();
    showToast(this, session.notices.splice(0), 610);
  }

  /** True while this run of the scene is still the live one (re-entering Home kills older callbacks). */
  private isCurrent(generation: number): boolean {
    return this.generation === generation && this.scene.isActive();
  }

  private requestGuard(): RequestGuard {
    const generation = this.generation;
    return { isCurrent: () => this.isCurrent(generation) };
  }

  /**
   * Asset gate before a ticket POST (`home-ui-redesign` Task 3): the §7
   * manifest must be in the TextureManager first. A stale run of this scene
   * goes silent; failures unlock the controls so a click retries.
   */
  private async withCombatAssets(generation: number, next: () => void): Promise<void> {
    this.busyStage = "Đang tải tài nguyên…";
    this.render();
    const { failed } = await prepareCombatAssets(this).catch(() => ({ loaded: 0, failed: ["loader"] }));
    if (!this.isCurrent(generation)) return;
    if (failed.length > 0) {
      this.busy = false;
      this.render();
      void alertModal(this, `Lỗi tải hình trận (${failed.length} tệp) — nhấn lại để thử lại`);
      return;
    }
    this.busyStage = "Đang tạo lượt chơi…";
    this.render();
    next();
  }

  /** `/arena/me` for the emblem row; a stale response writes nothing (`home-ui-redesign` Task 2). */
  private fetchRank() {
    const generation = this.generation;
    api<ArenaMeReply>("GET", "/arena/me").then(
      (me) => {
        if (!this.isCurrent(generation)) return;
        this.rank = { tierId: me.tier?.id ?? null, tierName: me.tier?.name ?? "—", rating: me.arena.rating };
        this.rankFailed = false;
        this.render();
      },
      () => {
        if (!this.isCurrent(generation)) return;
        this.rankFailed = true;
        this.render();
      },
    );
  }

  /** Starter row for every team seen in saved decks + the current team, then all saved decks. */
  private decks(): SavedDeck[] {
    return homeDecks(session.data, session.profile, session.heroIds);
  }

  private selectedDeck(): SavedDeck {
    return resolveHomeDeck(session.data, session.profile, session.heroIds, session.selectedDeckId);
  }

  private heroNames(heroIds: readonly string[]): string {
    return heroIds.map((id) => session.data.heroes[id]?.name ?? id).join(" · ");
  }

  /** Portrait art for the deck splash — the awakened variant once the alt form is chosen. */
  private heroArtKey(heroId: string): string {
    const owned = session.profile.heroes[heroId];
    const upKey = `heroes:${heroId}_up`;
    if (owned?.levelUpForm === "alt" && owned.constellation >= 5 && this.textures.exists(upKey)) return upKey;
    return `heroes:${heroId}`;
  }

  /** Portrait files not yet in the texture cache stream in, then re-render once. */
  private queueHeroArt() {
    const generation = this.generation;
    const jobs: Promise<unknown>[] = [];
    for (const heroId of this.pickingTeam ? Object.keys(session.profile.heroes) : this.selectedDeck().heroIds) {
      for (const stem of [heroId, `${heroId}_up`]) {
        const url = manifest.heroes?.[stem];
        if (!url || this.textures.exists(`heroes:${stem}`)) continue;
        jobs.push(queueTexture(this, `heroes:${stem}`, url));
      }
    }
    // One repaint once every miss settles — cached keys need no redraw at all.
    void Promise.allSettled(jobs).then((results) => {
      if (this.isCurrent(generation) && results.some((result) => result.status === "fulfilled")) this.render();
    });
  }

  private hideTip() {
    this.navTooltip?.destroy();
    this.navTooltip = null;
  }

  private text(parent: Phaser.GameObjects.Container, x: number, y: number, message: string, size = 14, color: string = COLORS.text) {
    return addText(this, parent, x, y, message, size, color);
  }

  private tipAt(source: Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle }, lines: string[], width = 320, above = false) {
    this.hideTip();
    const bounds = source.getBounds();
    const view = visibleWorld(this);
    const tip = showTextTooltip(this, bounds.centerX - width / 2, bounds.bottom + 10, lines, width, 13).setDepth(1500);
    const height = tip.getBounds().height;
    if (above || bounds.bottom + height + 10 > view.y + view.h - 8) tip.y = Math.max(view.y + 8, bounds.top - height - 10);
    this.navTooltip = tip;
  }

  private button(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, action: () => void, enabled = true, options: ButtonOptions = {}) {
    const control = this.controls.button(parent, x, y, width, label, enabled, options);
    this.controls.bind(control.hit, control.panel, {
      enabled, activate: action, fill: control.fill, border: control.border, radius: 9,
      showTip: !enabled && options.disabledReason ? () => this.tipAt(control.hit, [options.disabledReason!], 320, true) : undefined,
      hideTip: () => this.hideTip(),
    });
  }

  /** 40px navigation icon with a hover tooltip and an optional alert dot. */
  private navIcon(x: number, y: number, icon: string, tip: string, action: () => void, enabled: boolean, dot = false, flipX = false) {
    const panel = roundedPanel(this, x, y, 40, 40, enabled ? 0x16253e : 0x152033, 0.95, enabled ? 0xc8ad73 : 0x44536a, 10);
    const key = `ui:${icon}`;
    if (this.textures.exists(key)) {
      const image = this.add.image(0, 0, key);
      image.setDisplaySize(24, 24);
      if (flipX) image.setFlipX(true);
      panel.add(image);
    } else {
      this.text(panel, 0, 0, "◂", 18, enabled ? COLORS.text : COLORS.dimText).setOrigin(0.5);
    }
    const hit = this.add.rectangle(0, 0, 40, 40, 0, 0);
    panel.add(hit);
    this.controls.bind(hit, panel, { enabled, activate: action, showTip: () => this.tipAt(hit, [enabled ? tip : this.busyStage]), hideTip: () => this.hideTip(), fill: 0x16253e, border: 0xc8ad73, radius: 10 });
    if (dot) panel.add(this.add.circle(13, -13, 5, COLORS.goldFill).setStrokeStyle(1.5, 0x0b1426));
    this.root.add(panel);
  }

  /** A currency chip: icon + value, name on hover. Returns nothing — slots are fixed. */
  private currencyChip(x: number, icon: string, label: string, value: number) {
    const key = `ui:${icon}`;
    const panel = roundedPanel(this, x + 40, 36, 112, 36, 0x0b1729, 0.94, 0x536279, 10);
    if (this.textures.exists(key)) panel.add(this.add.image(-38, 0, key).setDisplaySize(24, 24));
    const number = new Intl.NumberFormat("vi-VN", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
    this.text(panel, -20, 0, number, 15, COLORS.text).setOrigin(0, 0.5);
    const zone = this.add.rectangle(0, 0, 112, 36, 0, 0);
    panel.add(zone);
    this.root.add(panel);
    const show = () => this.tipAt(zone, [label, new Intl.NumberFormat("vi-VN").format(value)]);
    this.controls.bind(zone, panel, { enabled: true, activate: show, showTip: show, hideTip: () => this.hideTip(), fill: 0x0b1729, border: 0x536279, radius: 10 });
  }

  private renderHeader() {
    const online = session.online;
    this.text(this.root, 44, 30, auth.username ?? "Vọng Nguyệt Thư Viện", 17, COLORS.gold).setOrigin(0, 0.5);
    if (auth.username) this.text(this.root, 44, 52, "Vọng Nguyệt Thư Viện", 13, COLORS.dimText).setOrigin(0, 0.5);
    if (online) {
      const currencies = session.profile.currencies;
      this.currencyChip(820, "cur_moonJade", CURRENCY_LABELS.moonJade, currencies.moonJade);
      this.currencyChip(950, "cur_moonStar", CURRENCY_LABELS.moonStar, currencies.moonStar);
      this.currencyChip(1080, "cur_honor", CURRENCY_LABELS.honor, currencies.honor ?? 0);
    }
    if (online) {
      this.navIcon(1240, 36, this.textures.exists("ui:nav_logout") ? "nav_logout" : "nav_back", "Đăng xuất", () => {
        void logout().then(() => this.scene.start("login"));
      }, !this.busy);
    } else {
      this.button(this.root, 1180, 36, 160, "Đăng nhập", () => this.scene.start("login"));
    }
  }

  /** Labeled quick routes stay visible without needing a hover tooltip. */
  private renderFooter() {
    const online = session.online;
    const enabled = online && !this.busy;
    const tray = roundedPanel(this, 640, 658, 1192, 88, 0x081321, 0.94, 0x46556c, 18);
    this.root.add(tray);
    const data = session.data;
    const canUnlock = Object.keys(data.heroes).some((id) => pendingUnlocks(data, session.profile, id) > 0);
    // A dry run of the server's claim tells whether a reward is waiting (`14` §7).
    const canClaim = Object.keys(data.missions).some((id) => claimMission(data, session.profile, id, Date.now()).ok);
    const nav: [string, string, () => void, boolean][] = [
      ["epitomized_moon", "Triệu Hồi", () => this.scene.start("gacha"), false],
      ["nav_heroes", "Hero", () => this.scene.start("heroes"), false],
      ["nav_inventory", "Kho Đồ", () => this.scene.start("armory"), false],
      ["nav_history", "Nhiệm Vụ", () => this.scene.start("missions"), canClaim],
      ["nav_mastery", "Tu Luyện", () => this.scene.start("mastery"), canUnlock],
    ];
    nav.forEach(([icon, label, go, dot], index) => {
      const panel = roundedPanel(this, 236 + index * 202, 658, 184, 64, 0x15243b, enabled ? 0.95 : 0.6, 0x726449, 12);
      const key = `ui:${icon}`;
      let image: Phaser.GameObjects.Image | undefined;
      if (this.textures.exists(key)) { image = this.add.image(-61, 0, key).setDisplaySize(32, 32); panel.add(image); }
      else this.text(panel, -61, 0, "◇", 25, COLORS.gold).setOrigin(0.5);
      this.text(panel, -35, 0, label, 15, enabled ? COLORS.text : COLORS.dimText).setOrigin(0, 0.5);
      const hit = this.add.rectangle(0, 0, 184, 64, 0, 0);
      panel.add(hit);
      const reason = online ? this.busyStage : "Cần đăng nhập và kết nối server";
      this.controls.bind(hit, panel, { enabled, activate: go, icon: image, showTip: !enabled || dot ? () => this.tipAt(hit, [enabled ? label === "Nhiệm Vụ" ? "Có thưởng để nhận" : "Có lá mới để mở khóa" : reason], 280) : undefined, hideTip: () => this.hideTip() });
      if (dot) {
        const badge = this.add.circle(78, -20, 5, COLORS.goldFill).setStrokeStyle(1.5, 0x0b1426);
        panel.add(badge);
        if (!this.reducedMotion) this.tweens.add({ targets: badge, alpha: 0.55, duration: 1400, yoyo: true, repeat: -1 });
        badge.once(Phaser.GameObjects.Events.DESTROY, () => this.tweens.killTweensOf(badge));
      }
      this.root.add(panel);
    });
  }

  /** Primary and compact mode tiles share route and disabled-state handling. */
  private modeTile(layout: { x: number; y: number; width: number; height: number; compact?: boolean; arena?: boolean }, icon: string, fallback: string, name: string, sub: string, action: () => void, enabled: boolean, disabledReason?: string) {
    const { x: cx, y, width, height, compact = false, arena = false } = layout;
    const panel = roundedPanel(this, cx, y, width, height, enabled ? 0x101c36 : 0x10182a, 0.94, enabled ? (arena ? 0xb79b60 : 0x63779b) : 0x37445c, 16);
    const iconX = compact ? 0 : -width / 2 + 44;
    const iconY = compact ? -30 : arena ? -42 : 0;
    const key = [`ui:${icon}`, `ui:${fallback}`].find((k) => this.textures.exists(k));
    let image: Phaser.GameObjects.Image | undefined;
    if (key) {
      image = this.add.image(iconX, iconY, key);
      image.setDisplaySize(compact ? 38 : 48, compact ? 38 : 48);
      panel.add(image);
    } else {
      this.text(panel, iconX, iconY, "▣", 26, enabled ? COLORS.gold : COLORS.dimText).setOrigin(0.5);
    }
    const textX = compact ? 0 : -width / 2 + 82;
    this.text(panel, textX, compact ? 8 : iconY - 12, name, compact ? 18 : 22, enabled ? COLORS.gold : COLORS.dimText).setOrigin(compact ? 0.5 : 0, 0.5);
    panel.add(
      this.add.text(textX, compact ? 31 : iconY + 16, sub, { ...TEXT_BASE, fontSize: "13px", color: "#aab4ca", align: compact ? "center" : "left", wordWrap: { width: compact ? width - 20 : width - 100 }, maxLines: 2 }).setOrigin(compact ? 0.5 : 0, 0.5),
    );
    const hit = this.add.rectangle(0, 0, width, height, 0, 0);
    panel.add(hit);
    this.controls.bind(hit, panel, { enabled, activate: action, icon: image, fill: 0x101c36, border: arena ? 0xb79b60 : 0x63779b, radius: 16,
      showTip: disabledReason ? () => this.tipAt(hit, [disabledReason]) : arena && this.rank ? () => this.tipAt(hit, [`${this.rank!.tierName} · ${this.rank!.rating} điểm`, this.rankProgress()]) : undefined, hideTip: () => this.hideTip() });
    if (arena) this.renderArenaRank(panel, hit);
    this.root.add(panel);
  }

  private rankProgress(): string {
    const rank = this.rank;
    if (!rank) return "";
    const next = [...(session.data.pvpConfig.tiers ?? [])].sort((a, b) => a.minRating - b.minRating).find((tier) => tier.minRating > rank.rating);
    return next ? `Còn ${next.minRating - rank.rating} điểm đến ${next.name}` : "Đã đạt bậc cao nhất";
  }

  /** Rank belongs to the Arena route; retry is above its parent hit area. */
  private renderArenaRank(panel: Phaser.GameObjects.Container, source: Phaser.GameObjects.Rectangle) {
    const rank = this.rank;
    panel.add(this.add.rectangle(0, -1, 340, 1, 0xb79b60, 0.3));
    const emblemKey = rank?.tierId && this.textures.exists(`ui:rank_${rank.tierId}`) ? `ui:rank_${rank.tierId}` : this.textures.exists("ui:seal") ? "ui:seal" : "";
    if (emblemKey && rank !== null) {
      const glow = this.add.circle(-145, 33, 35, 0, 0).setStrokeStyle(2, 0xd3bb83, 0.6).setAlpha(0);
      panel.add(glow);
      const emblem = this.add.image(-145, 33, emblemKey);
      emblem.setDisplaySize(64, 64);
      panel.add(emblem);
      const light = (alpha: number) => {
        this.tweens.killTweensOf(glow);
        if (this.reducedMotion) glow.setAlpha(alpha);
        else this.tweens.add({ targets: glow, alpha, duration: 140 });
      };
      source.on("pointerover", () => light(0.65)).on("pointerout", () => light(0));
      glow.once(Phaser.GameObjects.Events.DESTROY, () => this.tweens.killTweensOf(glow));
    }
    if (this.rankFailed) {
      this.text(panel, -158, 22, "Không tải được xếp hạng", 12, "#ff8080").setOrigin(0, 0.5);
      this.button(panel, 125, 48, 96, "Thử lại", () => {
        this.rankFailed = false;
        this.fetchRank();
        this.render();
      }, session.online && !this.busy);
    } else {
      this.text(panel, rank ? -92 : -158, 24, rank === null ? session.online ? "Đang tải xếp hạng…" : "Đăng nhập để xem xếp hạng" : `${rank.tierName} · ${rank.rating} điểm`, rank ? 15 : 13, rank ? COLORS.gold : COLORS.dimText).setOrigin(0, 0.5);
      if (rank) this.text(panel, -92, 47, this.rankProgress(), 13, "#aab4ca").setOrigin(0, 0.5);
    }
  }

  /** Selected-deck identity and explicit actions above the hero trio. */
  private renderTeam(deck: SavedDeck) {
    this.text(this.root, 506, 104, "Đội hình xuất trận", 19, COLORS.text).setOrigin(0, 0.5).setStroke("#07101f", 2);
    const starter = deck.id.startsWith("starter:");
    const name = this.fitColumn(this.root, 506, 151, deck.name, 405, 23, COLORS.gold);
    if (name.truncated) {
      this.controls.info(name.label, () => this.tipAt(name.label, [deck.name], 440), () => this.hideTip());
    }
    this.button(this.root, 996, 160, 130, "Đổi deck ▾", () => this.openDeckOverlay(), !this.busy, { variant: "primary" });
    this.button(this.root, 1150, 160, 144, starter ? "Sao chép & sửa" : "Chỉnh sửa", () => this.openDeckEditor(deck, starter), session.online && !this.busy, {
      disabledReason: session.online ? this.busyStage : "Cần đăng nhập và kết nối server",
    });
    const errors = validateDeck(session.data, session.profile, deck);
    const avg = deck.cardIds.reduce((sum, id) => sum + (session.data.cards[id]?.cost ?? 0), 0) / Math.max(1, deck.cardIds.length);
    const statusPanel = roundedPanel(this, 708.5, 194, 405, 28, 0x0a1727, 0.9, 0x47596a, 9);
    this.root.add(statusPanel);
    const status = this.text(statusPanel, -190.5, 0, errors.length ? "⚠ Cần chỉnh sửa" : `✓ Sẵn sàng · ${deck.cardIds.length} lá · Nguyệt Lực TB ${avg.toFixed(1).replace(".", ",")}`, 13, errors.length ? "#ff9f9f" : "#aad9c4").setOrigin(0, 0.5);
    if (errors.length) {
      const show = () => this.tipAt(status, errors.map((error) => describeDeckError(session.data, error)), 400);
      this.controls.info(status, show, () => this.hideTip());
    }
    deck.heroIds.forEach((heroId, index) => {
      const x = HERO_XS[index]!;
      const hero = session.data.heroes[heroId];
      const card = roundedPanel(this, x, HERO_Y, HERO_W, HERO_H, 0x101c36, 0.9, 0x7d90b8, 14);
      const artKey = this.heroArtKey(heroId);
      if (this.textures.exists(artKey)) {
        const art = this.add.image(0, -18, artKey);
        coverCrop(art, HERO_W - 10, HERO_H - 62);
        card.add(art);
      } else {
        this.text(card, 0, -18, "❖", 40, COLORS.dimText).setOrigin(0.5);
      }
      const namePlate = this.add.rectangle(0, HERO_H / 2 - 32, HERO_W - 10, 56, 0x0a1426, 0.88);
      card.add(namePlate);
      this.text(card, 0, HERO_H / 2 - 44, hero?.name ?? heroId, 17, COLORS.text).setOrigin(0.5);
      this.text(card, 0, HERO_H / 2 - 20, hero ? FACTION_LABELS[hero.faction] : "", 13, "#aab4ca").setOrigin(0.5);
      const hit = this.add.rectangle(0, 0, HERO_W, HERO_H, 0, 0);
      card.add(hit);
      const progress = session.profile.heroes[heroId];
      const levelUp = progress?.levelUpForm === "alt" && progress.constellation >= 5 ? hero?.altLevelUp : hero?.levelUp;
      this.controls.bind(hit, card, { enabled: session.online && !this.busy, activate: () => this.openDeckEditor(deck, starter), fill: 0x101c36, border: 0x7d90b8, radius: 14,
        showTip: () => this.tipAt(hit, [hero?.name ?? heroId,
          hero ? `${FACTION_LABELS[hero.faction]} · HP tối đa ${hero.maxHp}` : "",
          `Tu Luyện ${masteryLevel(session.data, progress?.xp ?? 0)} · Tinh Hồn ${progress?.constellation ?? 0}/6`,
          levelUp ? `Thăng cấp: ${levelUp.name}\n${levelUp.description}` : "",
          !session.online ? "Cần đăng nhập và kết nối server" : this.busy ? this.busyStage : starter ? "Sao chép & sửa đội hình này" : "Chỉnh sửa đội hình này"], 330), hideTip: () => this.hideTip() });
      this.root.add(card);
    });

    if (errors.length > 0) this.root.add(this.add.text(840, 546, `⚠ ${describeDeckError(session.data, errors[0]!)}`, {
      ...TEXT_BASE, fontSize: "13px", color: "#ff8080", align: "center", wordWrap: { width: 680 }, maxLines: 3, stroke: "#07101f", strokeThickness: 2,
    }).setOrigin(0.5, 0));
  }

  /** Starter decks cannot be edited — the portrait opens the deck-builder on a copy. */
  private openDeckEditor(deck: SavedDeck, starter = deck.id.startsWith("starter:")) {
    const target = starter ? { ...deck, id: "", name: `${deck.name} (bản sao)`.slice(0, 24) } : deck;
    this.edit(target);
  }

  /** The deck library — the old deck strip as an overlay: pick, edit, copy, delete, create. */
  private openDeckOverlay() {
    this.closeDeckOverlay();
    const view = visibleWorld(this);
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    const layer = this.add.container(0, 0).setDepth(900);
    const scrim = this.add.rectangle(cx, cy, view.w, view.h, 0x03070f, 0.74).setInteractive();
    scrim.on("pointerup", () => this.closeDeckOverlay());
    layer.add(scrim);
    const panel = roundedPanel(this, cx, cy + 10, 980, 580, 0x0b1526, 0.98, 0x7d90b8, 16);
    // Swallow clicks on the panel so they don't reach the scrim's close handler.
    panel.add(this.add.rectangle(0, 0, 980, 580, 0, 0).setInteractive());
    const content = this.add.container(0, 0);
    panel.add(content);
    layer.add(panel);
    this.deckOverlay = layer;
    this.overlayPanel = content;
    this.controls.setLayer(layer);
    const onEsc = () => {
      if (!isModalOpen()) this.closeDeckOverlay();
    };
    this.input.keyboard?.on("keydown-ESC", onEsc);
    layer.once(Phaser.GameObjects.Events.DESTROY, () => this.input.keyboard?.off("keydown-ESC", onEsc));
    this.renderDeckList(content);
  }

  private closeDeckOverlay() {
    this.hideTip();
    this.deckOverlay?.destroy();
    this.deckOverlay = null;
    this.overlayPanel = null;
    if (this.root) this.controls.setLayer(this.root);
  }

  /** Slim ▲/▼ strip over the list — 920×24, thinner than `addButton`'s default row. */
  private deckScrollArrow(
    panel: Phaser.GameObjects.Container,
    y: number,
    label: "▲" | "▼",
    onClick: () => void,
  ): void {
    const bar = this.add.rectangle(0, y, 920, 24, COLORS.button, 0.8).setStrokeStyle(1, COLORS.panelBorder);
    bar.setInteractive({ useHandCursor: true });
    bar.on("pointerover", () => bar.setFillStyle(0x3a5090, 1));
    bar.on("pointerout", () => bar.setFillStyle(COLORS.button, 0.8));
    bar.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    panel.add(bar);
    addText(this, panel, 0, y, label, 11, COLORS.text).setOrigin(0.5);
  }

  /**
   * One text cell clipped to `maxWidth`: if the full string doesn't fit, it is
   * shortened with an ellipsis and reports `truncated` so the caller can offer
   * the full text in a hover tooltip.
   */
  private fitColumn(
    panel: Phaser.GameObjects.Container,
    x: number,
    y: number,
    full: string,
    maxWidth: number,
    size: number,
    color: string,
  ): { truncated: boolean; label: Phaser.GameObjects.Text } {
    const label = addText(this, panel, x, y, full, size, color).setOrigin(0, 0.5);
    if (label.width <= maxWidth) return { truncated: false, label };
    let lo = 0;
    let hi = full.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      label.setText(`${full.slice(0, mid)}…`);
      if (label.width <= maxWidth) lo = mid + 1;
      else hi = mid;
    }
    label.setText(`${full.slice(0, Math.max(0, lo - 1))}…`);
    return { truncated: true, label };
  }

  private renderDeckList(panel: Phaser.GameObjects.Container) {
    this.hideTip();
    panel.removeAll(true);
    const data = session.data;
    const online = session.online;
    this.text(panel, 0, -266, "Deck của bạn", 20, COLORS.gold).setOrigin(0.5);
    this.text(panel, 0, -240, "Chọn đội hình xuất trận", 13, "#aab4ca").setOrigin(0.5);

    const decks = this.decks();
    const selectedId = this.selectedDeck().id;
    const VISIBLE = 11;
    const [first, end] = this.overlayScroller.range(decks.length, VISIBLE);
    this.overlayScroll = first;
    this.text(panel, 446, -240, `${first + 1}–${end} / ${decks.length}`, 12, COLORS.dimText).setOrigin(1, 0.5);

    decks.slice(first, end).forEach((deck, index) => {
      const y = -177 + index * ROW_H;
      const errors = validateDeck(data, session.profile, deck);
      const avg = deck.cardIds.reduce((sum, id) => sum + (data.cards[id]?.cost ?? 0), 0) / Math.max(1, deck.cardIds.length);
      const isSelected = deck.id === selectedId;
      const rowPanel = roundedPanel(this, 0, y, 920, 32, isSelected ? 0x2a3a70 : 0x141b33, 1, isSelected ? COLORS.goldFill : COLORS.panelBorder, 6);
      const row = this.add.rectangle(0, 0, 920, 32, 0, 0);
      rowPanel.add(row);
      const select = () => {
        session.selectedDeckId = deck.id;
        this.renderDeckList(panel);
        this.render();
        this.queueHeroArt();
      };
      panel.add(rowPanel);
      if (isSelected) this.text(rowPanel, -456, 0, "✓", 12, COLORS.gold).setOrigin(0.5);
      const desc = `${deck.name}  ·  ${this.heroNames(deck.heroIds)}  ·  Nguyệt Lực TB ${avg.toFixed(1)}`;
      const status = errors.length === 0 ? "✓" : `⚠ ${describeDeckError(data, errors[0]!)}`;
      const descFit = this.fitColumn(rowPanel, -438, 0, desc, 592, 14, COLORS.text);
      const statusFit = this.fitColumn(rowPanel, 170, 0, status, 276, 13, errors.length === 0 ? "#aad9c4" : "#ff8080");
      this.controls.bind(row, rowPanel, { enabled: true, activate: select, fill: isSelected ? 0x2a3a70 : 0x141b33, border: isSelected ? COLORS.goldFill : COLORS.panelBorder, radius: 6,
        showTip: descFit.truncated || statusFit.truncated ? () => this.tipAt(row, [desc, status], 520) : undefined, hideTip: () => this.hideTip() });
    });
    if (first > 0) this.deckScrollArrow(panel, -214, "▲", () => this.overlayScroller.scrollBy(-1));
    if (end < decks.length) this.deckScrollArrow(panel, 220, "▼", () => this.overlayScroller.scrollBy(1));

    const deck = this.selectedDeck();
    const starter = deck.id.startsWith("starter:");
    const starterReason = online ? "Bộ cơ bản không sửa hay xóa được — hãy Sao chép" : "Cần đăng nhập và kết nối server";
    const y = 260;
    this.button(panel, -330, y, 140, "Sửa", () => this.edit(deck), !starter && online, { disabledReason: starterReason });
    this.button(panel, -170, y, 140, "Sao chép", () => this.edit({ ...deck, id: "", name: `${deck.name} (bản sao)`.slice(0, 24) }), online, {
      disabledReason: "Cần đăng nhập và kết nối server",
    });
    this.button(panel, -10, y, 140, "Xóa", () => {
      void confirmModal(this, `Xóa deck "${deck.name}"? Không hoàn tác được.`, { label: "Xóa deck", danger: true }).then((ok) => {
        if (!ok) return;
        const generation = this.generation;
        mutate("DELETE", `/profile/decks/${deck.id}`).then(
          () => {
            if (!this.isCurrent(generation)) return;
            session.selectedDeckId = this.selectedDeck().id;
            if (this.overlayPanel) this.renderDeckList(this.overlayPanel);
            this.render();
          },
          (error: unknown) => {
            if (!this.isCurrent(generation)) return;
            void alertModal(this, errorText(error));
          },
        );
      });
    }, !starter && online, { variant: "danger", disabledReason: starterReason });
    this.button(panel, 150, y, 140, "Deck mới", () => {
      this.closeDeckOverlay();
      this.pickingTeam = true;
      this.teamScroll.first = 0;
      this.picked = [...session.heroIds];
      this.render();
      this.queueHeroArt();
    }, online, { disabledReason: "Cần đăng nhập và kết nối server" });
    this.button(panel, 330, y, 180, "Chọn deck này ▸", () => this.closeDeckOverlay(), true, { variant: "primary" });
  }

  private render() {
    this.hideTip();
    this.root.removeAll(true);
    this.controls.setLayer(this.deckOverlay ?? this.root);
    if (this.pickingTeam) {
      this.renderPickTeam();
      return;
    }
    const data = session.data;
    // Story mode: entered from an open stage's before-dialogue; Hủy leaves (`18` §4.4).
    const storyStage = session.pendingStageId !== null ? data.storyStages[session.pendingStageId] : undefined;
    if (session.pendingStageId !== null && storyStage === undefined) session.pendingStageId = null;
    const storyMode = storyStage !== undefined;
    const deck = this.selectedDeck();
    const online = session.online;

    this.renderHeader();

    if (storyMode && storyStage) {
      const panel = roundedPanel(this, 234, 280, 360, 320, 0x101c36, 0.94, 0x7d90b8, 14);
      this.text(panel, 0, -130, "Cốt Truyện", 15, COLORS.dimText).setOrigin(0.5);
      this.text(panel, 0, -102, storyStage.name, 21, COLORS.gold).setOrigin(0.5);
      panel.add(
        this.add.text(0, -62, "Chọn deck vào màn — kết quả trận được server kiểm chứng", {
          ...TEXT_BASE, fontSize: "12px", color: COLORS.dimText, align: "center", wordWrap: { width: 320 },
        }).setOrigin(0.5, 0),
      );
      this.root.add(panel);
      const errors = validateDeck(data, session.profile, deck);
      const enter = () => {
        if (this.busy) return;
        this.busy = true;
        this.render();
        const generation = this.generation;
        void this.withCombatAssets(generation, () =>
          startStoryTicket(session.pendingStageId!, { id: deck.id, heroIds: [...deck.heroIds] as Team }, { guard: this.requestGuard() }).then(
            () => this.scene.start("combat"),
            (error: unknown) => {
              if (error instanceof StaleRequestError || !this.isCurrent(generation)) return;
              this.busy = false;
              this.render();
              void alertModal(this, errorText(error));
            },
          ),
        );
      };
      this.button(this.root, 234, 320, 240, "Vào trận", enter, errors.length === 0 && online && !this.busy, {
        variant: "primary",
        disabledReason: errors.length ? describeDeckError(data, errors[0]!) : "Cốt Truyện cần đăng nhập — server ghi nhận kết quả",
      });
      this.button(this.root, 234, 368, 240, "Hủy", () => {
        session.pendingStageId = null;
        this.scene.start("story");
      }, !this.busy);
      if (this.busy) this.text(this.root, 234, 412, this.busyStage, 13, COLORS.gold).setOrigin(0.5);
    } else {
      const run = () => {
        if (this.busy) return;
        this.busy = true;
        this.render();
        const generation = this.generation;
        void this.withCombatAssets(generation, () =>
          startServerRun({ id: deck.id, heroIds: [...deck.heroIds] as Team }, { guard: this.requestGuard() }).then(
            () => this.scene.start("run"),
            (error: unknown) => {
              if (error instanceof StaleRequestError || !this.isCurrent(generation)) return;
              this.busy = false;
              this.render();
              void alertModal(this, errorText(error));
            },
          ),
        );
      };
      const errors = validateDeck(data, session.profile, deck);
      const needOnline = "Cần đăng nhập và kết nối server";
      const locked = this.busy;
      const busyReason = locked ? this.busyStage : undefined;
      this.modeTile({ x: 234, y: 190, width: 380, height: 156, arena: true }, "mode_arena", "node_combat", "Đấu Trường", "Xếp hạng · Đấu tập · Phòng riêng", () => this.scene.start("arena"), online && !locked, online ? busyReason : needOnline);
      this.modeTile({ x: 234, y: 338, width: 380, height: 112 }, "mode_run", "moon_waxingCrescent", "Tầm Nguyệt", "Vượt ải · Thu thập Nguyệt Bảo", run, online && errors.length === 0 && !locked, online ? (busyReason ?? (errors.length ? describeDeckError(data, errors[0]!) : undefined)) : needOnline);
      this.modeTile({ x: 136, y: 465, width: 184, height: 114, compact: true }, "mode_coop", "nav_exchange", "Liên Thủ", "Phối hợp 2 người", () => this.scene.start("coop-lobby"), online && !locked, online ? busyReason : needOnline);
      this.modeTile({ x: 332, y: 465, width: 184, height: 114, compact: true }, "mode_story", "nav_history", "Cốt Truyện", "Khám phá chương truyện", () => this.scene.start("story"), online && !locked, online ? busyReason : needOnline);
      if (this.busy) this.text(this.root, 234, 554, this.busyStage, 13, COLORS.gold).setOrigin(0.5);
      else if (!online) {
        this.text(this.root, 234, 554, "Offline — mọi chế độ cần kết nối server", 12, "#ff8080").setOrigin(0.5);
      }
    }

    this.renderTeam(deck);
    this.renderFooter();
  }

  /** Compact team picker, only used to seed a brand-new deck's heroIds. */
  private renderPickTeam() {
    const data = session.data;
    addText(this, this.root, WIDTH / 2, 40, "Deck mới — chọn 3 Hero", 24, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 74, `Đã chọn ${this.picked.length}/3 · Thứ tự chọn là vị trí trong đội`, 14, COLORS.text).setOrigin(0.5);
    // Owned heroes first: they are the only ones the player can pick.
    const heroes = Object.values(data.heroes).sort(
      (a, b) => Number(session.profile.heroes[b.id] !== undefined) - Number(session.profile.heroes[a.id] !== undefined),
    );
    const rows = Math.ceil(heroes.length / PICK_COLS);
    const [firstRow, endRow] = this.teamScroll.range(rows, PICK_ROWS);
    const startX = WIDTH / 2 - ((PICK_COLS - 1) * PICK_STEP_X) / 2;
    heroes.slice(firstRow * PICK_COLS, endRow * PICK_COLS).forEach((hero, index) => {
      const x = startX + (index % PICK_COLS) * PICK_STEP_X;
      const y = PICK_TOP + PICK_H / 2 + Math.floor(index / PICK_COLS) * PICK_STEP_Y;
      const slot = this.picked.indexOf(hero.id);
      const owned = session.profile.heroes[hero.id] !== undefined;
      const panel = roundedPanel(this, x, y, PICK_W, PICK_H, COLORS.panelHero, owned ? 1 : 0.92, slot >= 0 ? COLORS.goldFill : COLORS.panelBorder, 10);
      const artKey = this.heroArtKey(hero.id);
      if (this.textures.exists(artKey)) {
        const art = this.add.image(-69, 0, artKey);
        coverCrop(art, 62, 76);
        panel.add(art);
      } else if (this.textures.exists("ui:nav_heroes")) panel.add(this.add.image(-69, 0, "ui:nav_heroes").setDisplaySize(48, 48).setAlpha(owned ? 1 : 0.45));
      const hit = this.add.rectangle(0, 0, PICK_W, PICK_H, 0, 0);
      panel.add(hit);
      const select = () => {
        if (this.picked.includes(hero.id)) this.picked = this.picked.filter((id) => id !== hero.id);
        else if (this.picked.length < 3) this.picked.push(hero.id);
        this.render();
      };
      this.controls.bind(hit, panel, { enabled: owned, activate: select, fill: COLORS.panelHero, border: slot >= 0 ? COLORS.goldFill : COLORS.panelBorder, radius: 10,
        showTip: !owned ? () => this.tipAt(hit, ["Chưa sở hữu Hero này"]) : undefined, hideTip: () => this.hideTip() });
      this.root.add(panel);
      if (slot >= 0) {
        panel.add(this.add.circle(-90, -31, 10, 0x162139).setStrokeStyle(1, COLORS.goldFill));
        this.text(panel, -90, -31, `${slot + 1}`, 13, COLORS.gold).setOrigin(0.5);
      }
      this.text(panel, -27, -27, hero.name, 15, owned ? COLORS.text : "#b7bfd0").setOrigin(0, 0.5);
      this.text(panel, -27, -4, owned ? FACTION_LABELS[hero.faction] : "Chưa sở hữu", 12, "#aab4ca").setOrigin(0, 0.5);
      panel.add(
        this.add
          .text(-27, 12, hero.branches.map((b) => b.name).join(" / "), { ...TEXT_BASE, fontSize: "12px", color: "#aab4ca", wordWrap: { width: 130 }, maxLines: 2 }),
      );
    });
    this.teamScroll.addArrows(this.root);
    const bonds = bondCardsForTeam(data, this.picked);
    const bondText = bonds.length === 0 ? "Lá Song Hành: — không có —" : `Lá Song Hành: ${bonds.map((c) => c.name).join(" · ")}`;
    const bond = this.fitColumn(this.root, 80, 590, bondText, 1120, 13, bonds.length > 0 ? COLORS.gold : COLORS.dimText);
    if (bond.truncated) {
      this.controls.info(bond.label, () => this.tipAt(bond.label, [bondText], 520), () => this.hideTip());
    }
    const ready = this.picked.length === 3;
    this.button(this.root, WIDTH / 2 - 110, 640, 200, ready ? "Tạo deck" : `Chọn thêm ${3 - this.picked.length} Hero`, () => {
      if (!ready) return;
      const heroIds = [...this.picked] as Team;
      session.editingDeck = { id: "", name: "Deck mới", heroIds, cardIds: starterDeck(session.data, heroIds) };
      this.scene.start("deck-builder");
    }, ready, { variant: "primary" });
    this.button(this.root, WIDTH / 2 + 110, 640, 200, "Hủy", () => {
      this.pickingTeam = false;
      this.render();
    });
  }

  private edit(deck: SavedDeck) {
    session.editingDeck = {
      ...deck,
      cardIds: [...deck.cardIds],
      heroIds: [...deck.heroIds] as SavedDeck["heroIds"],
      weapons: { ...deck.weapons },
      relicIds: [...(deck.relicIds ?? [])],
    };
    this.scene.start("deck-builder");
  }
}
