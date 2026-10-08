import Phaser from "phaser";
import { bondCardsForTeam, claimMission, pendingUnlocks, starterDeck, validateDeck } from "rules";
import type { DeckError, GameData, SavedDeck } from "rules";
import manifest from "virtual:assets-manifest";
import { errorText, logout, mutate } from "../account";
import { api, auth } from "../api";
import { startServerRun } from "../run-session";
import { startStoryTicket } from "../story-session";
import { session } from "../session";
import type { Team } from "../session";
import { coverCrop } from "./gacha/shared";
import { showTextTooltip } from "../ui/card-tooltip";
import { roundedPanel } from "../ui/rounded-panel";
import { COLORS, CURRENCY_LABELS, OWNER_COLORS, TEXT_BASE, useDesignCamera, visibleWorld } from "../ui/theme";
import { addButton, addText, alertModal, confirmModal, isModalOpen, RowScroller, showToast } from "../ui/widgets";
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
const HERO_Y = 428;
const HERO_XS = [596, 830, 1064] as const;

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

const teamKey = (heroIds: readonly string[]) => [...heroIds].sort().join("+");

interface RankInfo {
  tierId: string | null;
  tierName: string;
  rating: number;
}

/**
 * Home screen (`deck-select` key kept for scene routing): a splash-driven hub —
 * mode tiles on the left, the selected deck's hero trio + ranked emblem on the
 * right, deck management behind the "Đổi deck" overlay (`16` §7).
 */
export class DeckSelectScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private selected = "";
  private pickingTeam = false;
  private picked: string[] = [];
  private teamScroll!: RowScroller;
  /** A server request is in flight (run/story ticket). */
  private busy = false;
  private deckOverlay: Phaser.GameObjects.Container | null = null;
  private overlayPanel: Phaser.GameObjects.Container | null = null;
  private overlayScroll = 0;
  /** `null` while `/arena/me` is in flight or the player is offline. */
  private rank: RankInfo | null = null;
  private navTooltip: Phaser.GameObjects.Container | null = null;

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
    this.busy = false;
    this.rank = null;
    this.deckOverlay = null;
    this.overlayScroll = 0;
    this.selected = `starter:${teamKey(session.heroIds)}`;
    this.pickingTeam = data?.newDeck === true && session.online;
    this.picked = this.pickingTeam ? [...session.heroIds] : [];
    const gridW = (PICK_COLS - 1) * PICK_STEP_X + PICK_W;
    this.teamScroll = new RowScroller(
      this,
      { x: (WIDTH - gridW) / 2, y: PICK_TOP, width: gridW, height: PICK_ROWS * PICK_STEP_Y },
      () => {
        if (this.pickingTeam) this.render();
      },
    );

    // Splash backdrop: generated home art (or the library combat backdrop) with
    // a calm-left gradient so the mode tiles stay readable (`docs/home-assets.md`).
    const view = visibleWorld(this);
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
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
    this.queueHeroArt();
    if (session.online) {
      api<ArenaMeReply>("GET", "/arena/me").then(
        (me) => {
          this.rank = { tierId: me.tier?.id ?? null, tierName: me.tier?.name ?? "—", rating: me.arena.rating };
          if (this.scene.isActive()) this.render();
        },
        () => {
          this.rank = { tierId: null, tierName: "—", rating: 0 };
          if (this.scene.isActive()) this.render();
        },
      );
    }
    showToast(this, session.notices.splice(0), 610);
  }

  /** Starter row for every team seen in saved decks + the current team, then all saved decks. */
  private decks(): SavedDeck[] {
    const starters = new Map<string, SavedDeck>();
    const addStarter = (heroIds: readonly string[]) => {
      const key = teamKey(heroIds);
      if (starters.has(key)) return;
      starters.set(key, {
        id: `starter:${key}`,
        name: "Bộ cơ bản",
        heroIds: [...heroIds] as SavedDeck["heroIds"],
        cardIds: starterDeck(session.data, heroIds as Team),
      });
    };
    addStarter(session.heroIds);
    for (const deck of session.profile.decks) addStarter(deck.heroIds);
    return [...starters.values(), ...session.profile.decks];
  }

  private selectedDeck(): SavedDeck {
    const decks = this.decks();
    return decks.find((entry) => entry.id === this.selected) ?? decks[0]!;
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

  /** Portrait files not yet in the texture cache stream in, then re-render. */
  private queueHeroArt() {
    let queued = false;
    for (const heroId of this.selectedDeck().heroIds) {
      for (const stem of [heroId, `${heroId}_up`]) {
        const url = manifest.heroes?.[stem];
        const key = `heroes:${stem}`;
        if (url && !this.textures.exists(key)) {
          this.load.image(key, url);
          queued = true;
        }
      }
    }
    if (queued) {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (this.scene.isActive()) this.render();
      });
      this.load.start();
    }
  }

  private hideTip() {
    this.navTooltip?.destroy();
    this.navTooltip = null;
  }

  private text(parent: Phaser.GameObjects.Container, x: number, y: number, message: string, size = 14, color: string = COLORS.text) {
    return addText(this, parent, x, y, message, size, color);
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
    if (enabled) {
      hit.setInteractive({ useHandCursor: true });
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        this.hideTip();
        if (pointer.button === 0) action();
      });
      hit.on("pointerover", () => {
        panel.setAlpha(0.8);
        this.hideTip();
        this.navTooltip = showTextTooltip(this, x + 26, y + 18, [tip]);
      });
      hit.on("pointerout", () => {
        panel.setAlpha(1);
        this.hideTip();
      });
    }
    if (dot) panel.add(this.add.circle(13, -13, 5, COLORS.goldFill).setStrokeStyle(1.5, 0x0b1426));
    this.root.add(panel);
  }

  /** A currency chip: icon + value, name on hover. Returns nothing — slots are fixed. */
  private currencyChip(x: number, icon: string, label: string, value: number) {
    const key = `ui:${icon}`;
    const hasIcon = this.textures.exists(key);
    if (hasIcon) {
      const image = this.add.image(x, 36, key);
      image.setDisplaySize(20, 20);
      this.root.add(image);
    }
    this.text(this.root, x + (hasIcon ? 15 : 0), 36, `${value}`, 14, COLORS.gold).setOrigin(0, 0.5);
    const zone = this.add.rectangle(x - 12, 36, 100, 30, 0, 0).setOrigin(0, 0.5);
    zone.setInteractive();
    zone.on("pointerover", () => {
      this.hideTip();
      this.navTooltip = showTextTooltip(this, x - 8, 54, [label]);
    });
    zone.on("pointerout", () => this.hideTip());
    this.root.add(zone);
  }

  private renderHeader() {
    const online = session.online;
    this.text(this.root, 44, 30, auth.username ?? "Vọng Nguyệt Thư Viện", 17, COLORS.gold).setOrigin(0, 0.5);
    if (auth.username) this.text(this.root, 44, 52, "Vọng Nguyệt Thư Viện", 11, COLORS.dimText).setOrigin(0, 0.5);
    if (online) {
      const currencies = session.profile.currencies;
      this.currencyChip(300, "cur_moonJade", CURRENCY_LABELS.moonJade, currencies.moonJade);
      this.currencyChip(430, "cur_moonStar", CURRENCY_LABELS.moonStar, currencies.moonStar);
      this.currencyChip(560, "cur_honor", CURRENCY_LABELS.honor, currencies.honor ?? 0);
    }
    const data = session.data;
    const canUnlock = Object.keys(data.heroes).some((id) => pendingUnlocks(data, session.profile, id) > 0);
    // A dry run of the server's claim tells whether a reward is waiting (`14` §7).
    const canClaim = Object.keys(data.missions).some((id) => claimMission(data, session.profile, id, Date.now()).ok);
    const nav: [string, string, () => void, boolean][] = [
      ["moon_full", "Triệu Hồi", () => this.scene.start("gacha"), false],
      ["star", "Kho Hero", () => this.scene.start("heroes"), false],
      ["gear", "Kho đồ", () => this.scene.start("armory"), false],
      ["check", "Nhiệm vụ", () => this.scene.start("missions"), canClaim],
      ["bolt", "Tu Luyện", () => this.scene.start("mastery"), canUnlock],
    ];
    nav.forEach(([icon, tip, go, dot], index) => {
      this.navIcon(1000 + index * 48, 36, icon, tip, go, online, dot);
    });
    if (online) {
      this.navIcon(1240, 36, "nav_back", "Đăng xuất", () => {
        void logout().then(() => this.scene.start("login"));
      }, true, false, true);
    } else {
      addButton(this, this.root, 1180, 36, 160, "Đăng nhập", () => this.scene.start("login"));
    }
  }

  /** Mode tile: 360×80 rounded card with the mode icon, name and one-line pitch. */
  private modeTile(y: number, icon: string, fallback: string, name: string, sub: string, action: () => void, enabled: boolean, disabledReason?: string) {
    const cx = 234;
    const panel = roundedPanel(this, cx, y, 360, 80, enabled ? 0x101c36 : 0x10182a, 0.94, enabled ? 0x7d90b8 : 0x37445c, 14);
    const key = [`ui:${icon}`, `ui:${fallback}`].find((k) => this.textures.exists(k));
    if (key) {
      const image = this.add.image(-148, 0, key);
      image.setDisplaySize(52, 52);
      panel.add(image);
    } else {
      this.text(panel, -148, 0, "▣", 26, enabled ? COLORS.gold : COLORS.dimText).setOrigin(0.5);
    }
    this.text(panel, -112, -14, name, 19, enabled ? COLORS.gold : COLORS.dimText).setOrigin(0, 0.5);
    panel.add(
      this.add.text(-112, 10, sub, { ...TEXT_BASE, fontSize: "12px", color: COLORS.dimText, wordWrap: { width: 268 }, maxLines: 2 }).setOrigin(0, 0.5),
    );
    const hit = this.add.rectangle(0, 0, 360, 80, 0, 0);
    panel.add(hit);
    hit.setInteractive({ useHandCursor: enabled });
    if (enabled) {
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        this.hideTip();
        if (pointer.button === 0) action();
      });
      hit.on("pointerover", () => {
        this.hideTip();
        panel.setAlpha(0.85);
      });
      hit.on("pointerout", () => {
        panel.setAlpha(1);
        this.hideTip();
      });
    } else if (disabledReason) {
      hit.on("pointerover", () => {
        this.hideTip();
        this.navTooltip = showTextTooltip(this, cx - 120, y + 46, [disabledReason], 300);
      });
      hit.on("pointerout", () => this.hideTip());
    }
    this.root.add(panel);
  }

  /** Rank emblem + the selected deck's hero trio — clicking a hero edits the deck. */
  private renderTeam(deck: SavedDeck) {
    const online = session.online;
    const rank = this.rank;
    const emblemKey = rank?.tierId && this.textures.exists(`ui:rank_${rank.tierId}`) ? `ui:rank_${rank.tierId}` : this.textures.exists("ui:seal") ? "ui:seal" : "";
    if (emblemKey) {
      const emblem = this.add.image(830, 148, emblemKey);
      emblem.setDisplaySize(76, 76);
      this.root.add(emblem);
    }
    this.text(this.root, 830, 202, rank === null ? "—" : `${rank.tierName} · ${rank.rating} điểm`, 16, COLORS.gold).setOrigin(0.5);

    const errors = validateDeck(session.data, session.profile, deck);
    const starter = deck.id.startsWith("starter:");
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
      this.text(card, 0, HERO_H / 2 - 44, hero?.name ?? heroId, 15, COLORS.gold).setOrigin(0.5);
      this.text(card, 0, HERO_H / 2 - 22, hero ? `HP ${hero.maxHp}` : "", 11, COLORS.dimText).setOrigin(0.5);
      const hit = this.add.rectangle(0, 0, HERO_W, HERO_H, 0, 0);
      card.add(hit);
      hit.setInteractive({ useHandCursor: true });
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        this.hideTip();
        if (pointer.button !== 0) return;
        this.openDeckEditor(deck, starter);
      });
      hit.on("pointerover", () => {
        card.setAlpha(0.88);
        this.hideTip();
        this.navTooltip = showTextTooltip(this, x - 80, HERO_Y + HERO_H / 2 + 10, [starter ? "Bộ cơ bản — chạm để sao chép & sửa" : "Chạm để sửa deck"], 220);
      });
      hit.on("pointerout", () => {
        card.setAlpha(1);
        this.hideTip();
      });
      this.root.add(card);
    });

    const statusText = errors.length === 0 ? "✓ Deck hợp lệ" : `⚠ ${describeDeckError(session.data, errors[0]!)}`;
    this.text(this.root, 830, 604, statusText, 12, errors.length === 0 ? COLORS.gold : "#ff8080").setOrigin(0.5);
    addButton(this, this.root, 830, 648, 240, "Đổi deck ▾", () => this.openDeckOverlay());
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
  }

  private renderDeckList(panel: Phaser.GameObjects.Container) {
    panel.removeAll(true);
    const data = session.data;
    const online = session.online;
    this.text(panel, 0, -266, "Deck của bạn", 20, COLORS.gold).setOrigin(0.5);
    this.text(panel, 0, -240, "Chọn deck xuất trận — Hero của deck hiện ở màn chính", 12, COLORS.dimText).setOrigin(0.5);

    const decks = this.decks();
    const VISIBLE = 11;
    const maxScroll = Math.max(0, decks.length - VISIBLE);
    this.overlayScroll = Phaser.Math.Clamp(this.overlayScroll, 0, maxScroll);
    decks.slice(this.overlayScroll, this.overlayScroll + VISIBLE).forEach((deck, index) => {
      const y = -206 + index * ROW_H;
      const errors = validateDeck(data, session.profile, deck);
      const avg = deck.cardIds.reduce((sum, id) => sum + (data.cards[id]?.cost ?? 0), 0) / Math.max(1, deck.cardIds.length);
      const isSelected = deck.id === this.selected;
      const row = this.add.rectangle(0, y, 920, 32, isSelected ? 0x2a3a70 : 0x141b33);
      row.setStrokeStyle(1, isSelected ? COLORS.goldFill : COLORS.panelBorder);
      row.setInteractive({ useHandCursor: true });
      row.on("pointerup", () => {
        this.selected = deck.id;
        this.renderDeckList(panel);
        this.render();
        this.queueHeroArt();
      });
      panel.add(row);
      const status = errors.length === 0 ? "✓" : `⚠ ${describeDeckError(data, errors[0]!)}`;
      this.text(panel, -446, y, `${deck.name}  ·  ${this.heroNames(deck.heroIds)}  ·  cost TB ${avg.toFixed(1)}`, 13).setOrigin(0, 0.5);
      this.text(panel, 446, y, status, 12, errors.length === 0 ? COLORS.gold : "#ff8080").setOrigin(1, 0.5);
    });
    if (this.overlayScroll > 0) {
      addButton(this, panel, 0, -206 - 18, 920, "▲", () => {
        this.overlayScroll -= 1;
        this.renderDeckList(panel);
      });
    }
    if (this.overlayScroll < maxScroll) {
      addButton(this, panel, 0, -206 + VISIBLE * ROW_H + 18, 920, "▼", () => {
        this.overlayScroll += 1;
        this.renderDeckList(panel);
      });
    }

    const deck = this.selectedDeck();
    const starter = deck.id.startsWith("starter:");
    const starterReason = online ? "Bộ cơ bản không sửa hay xóa được — hãy Sao chép" : "Cần đăng nhập và kết nối server";
    const y = 250;
    addButton(this, panel, -330, y, 140, "Sửa", () => this.edit(deck), !starter && online, { disabledReason: starterReason });
    addButton(this, panel, -170, y, 140, "Sao chép", () => this.edit({ ...deck, id: "", name: `${deck.name} (bản sao)`.slice(0, 24) }), online, {
      disabledReason: "Cần đăng nhập và kết nối server",
    });
    addButton(this, panel, -10, y, 140, "Xóa", () => {
      void confirmModal(this, `Xóa deck "${deck.name}"? Không hoàn tác được.`, { label: "Xóa deck", danger: true }).then((ok) => {
        if (!ok) return;
        mutate("DELETE", `/profile/decks/${deck.id}`).then(
          () => {
            this.selected = `starter:${teamKey(session.heroIds)}`;
            if (this.overlayPanel) this.renderDeckList(this.overlayPanel);
            this.render();
          },
          (error: unknown) => {
            void alertModal(this, errorText(error));
          },
        );
      });
    }, !starter && online, { variant: "danger", disabledReason: starterReason });
    addButton(this, panel, 150, y, 140, "Deck mới", () => {
      this.closeDeckOverlay();
      this.pickingTeam = true;
      this.teamScroll.first = 0;
      this.picked = [...session.heroIds];
      this.render();
    }, online, { disabledReason: "Cần đăng nhập và kết nối server" });
    addButton(this, panel, 330, y, 180, "Chọn deck này ▸", () => this.closeDeckOverlay(), true, { variant: "primary" });
  }

  private render() {
    this.hideTip();
    this.root.removeAll(true);
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
        startStoryTicket(session.pendingStageId!, { id: deck.id, heroIds: [...deck.heroIds] as Team }).then(
          () => this.scene.start("combat"),
          (error: unknown) => {
            this.busy = false;
            void alertModal(this, errorText(error));
          },
        );
      };
      addButton(this, this.root, 234, 320, 240, "Vào trận", enter, errors.length === 0 && online, {
        variant: "primary",
        disabledReason: errors.length ? describeDeckError(data, errors[0]!) : "Cốt Truyện cần đăng nhập — server ghi nhận kết quả",
      });
      addButton(this, this.root, 234, 368, 240, "Hủy", () => {
        session.pendingStageId = null;
        this.scene.start("story");
      });
    } else {
      const run = () => {
        if (this.busy) return;
        this.busy = true;
        startServerRun({ id: deck.id, heroIds: [...deck.heroIds] as Team }).then(
          () => this.scene.start("run"),
          (error: unknown) => {
            this.busy = false;
            void alertModal(this, errorText(error));
          },
        );
      };
      const errors = validateDeck(data, session.profile, deck);
      const needOnline = "Cần đăng nhập và kết nối server";
      this.modeTile(120, "mode_arena", "node_combat", "Đấu Trường", "Xếp hạng · Đấu Tập · Phòng riêng", () => this.scene.start("arena"), online, needOnline);
      this.modeTile(214, "mode_run", "moon_waxingCrescent", "Tầm Nguyệt", "Hành trình roguelike — leo tầng, nhặt Nguyệt Bảo", run, online && errors.length === 0, online ? (errors.length ? describeDeckError(data, errors[0]!) : undefined) : needOnline);
      this.modeTile(308, "mode_coop", "nav_exchange", "Liên Thủ", "Co-op 2 người — kích Hợp Kích cùng đồng đội", () => this.scene.start("coop-lobby"), online, needOnline);
      this.modeTile(402, "mode_story", "nav_history", "Cốt Truyện", "Hành trình theo chương — Arc 1–2", () => this.scene.start("story"), online, needOnline);
      if (!online) {
        this.text(this.root, 234, 470, "Offline — mọi chế độ cần kết nối server", 12, "#ff8080").setOrigin(0.5);
      }
    }

    this.renderTeam(deck);
  }

  /** Compact team picker, only used to seed a brand-new deck's heroIds. */
  private renderPickTeam() {
    const data = session.data;
    addText(this, this.root, WIDTH / 2, 40, "Deck mới — chọn 3 Hero", 24, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 74, "Thứ tự chọn là vị trí trong đội", 13, COLORS.dimText).setOrigin(0.5);
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
      const panel = this.add.rectangle(x, y, PICK_W, PICK_H, COLORS.panelHero).setAlpha(owned ? 1 : 0.45);
      panel.setStrokeStyle(slot >= 0 ? 3 : 1, slot >= 0 ? COLORS.goldFill : (OWNER_COLORS[hero.id] ?? COLORS.panelBorder));
      panel.setInteractive({ useHandCursor: owned });
      panel.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0 || !owned) return;
        if (this.picked.includes(hero.id)) this.picked = this.picked.filter((id) => id !== hero.id);
        else if (this.picked.length < 3) this.picked.push(hero.id);
        this.render();
      });
      this.root.add(panel);
      if (slot >= 0) addText(this, this.root, x + PICK_W / 2 - 14, y - PICK_H / 2 + 14, `${slot + 1}`, 16, COLORS.gold).setOrigin(0.5);
      addText(this, this.root, x, y - 28, hero.name, 17).setOrigin(0.5);
      addText(this, this.root, x, y - 6, owned ? `HP ${hero.maxHp}` : "Chưa sở hữu", 12, COLORS.dimText).setOrigin(0.5);
      this.root.add(
        this.add
          .text(x, y + 8, hero.branches.map((b) => b.name).join(" / "), { ...TEXT_BASE, fontSize: "11px", color: COLORS.dimText, align: "center", wordWrap: { width: PICK_W - 20 }, maxLines: 2 })
          .setOrigin(0.5, 0),
      );
    });
    this.teamScroll.addArrows(this.root);
    const bonds = bondCardsForTeam(data, this.picked);
    addText(
      this, this.root, WIDTH / 2, 590,
      bonds.length === 0 ? "Lá Song Hành: — không có —" : `Lá Song Hành: ${bonds.map((c) => c.name).join(" · ")}`,
      13, bonds.length > 0 ? COLORS.gold : COLORS.dimText,
    ).setOrigin(0.5);
    const ready = this.picked.length === 3;
    addButton(this, this.root, WIDTH / 2 - 110, 640, 200, ready ? "Tạo deck" : `Chọn thêm ${3 - this.picked.length} Hero`, () => {
      if (!ready) return;
      const heroIds = [...this.picked] as Team;
      session.editingDeck = { id: "", name: "Deck mới", heroIds, cardIds: starterDeck(session.data, heroIds) };
      this.scene.start("deck-builder");
    }, ready, { variant: "primary" });
    addButton(this, this.root, WIDTH / 2 + 110, 640, 200, "Hủy", () => {
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
