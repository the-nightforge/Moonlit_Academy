import Phaser from "phaser";
import manifest from "virtual:assets-manifest";
import { validateDeck, type ArenaStats, type HonorShopItemDef } from "rules";
import { auth, api } from "../api";
import { cacheArenaRank, errorText } from "../account";
import { savedLobbyDeckIndex } from "../home-selection";
import { NetMatch } from "../net/match";
import { NetSocket } from "../net/socket";
import type { ServerMessage } from "../net/protocol";
import { session } from "../session";
import { deckAssetSelection, prepareCombatAssets } from "../ui/combat-assets";
import { loadCombatSettings } from "../ui/combat-settings";
import { API_ERROR_TEXT, COLORS, CURRENCY_LABELS, RENDER_SCALE, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, isModalOpen, RowScroller, showToast, type ButtonOptions } from "../ui/widgets";
import { HomeControls } from "../ui/home-controls";
import { preloadActionIcons, type ActionIcon } from "../ui/action-icon";
import { roundedPanel } from "../ui/rounded-panel";
import { roundedArtTexture, ellipsize } from "../ui/combat-card-view";
import { addEquipmentArt, preloadEquipmentArt } from "../ui/equipment-art";
import { matchesDeckText, summarizeDeck } from "../ui/deck-presentation";
import { showTextTooltip } from "../ui/card-tooltip";
import { arenaActionReason, arenaHeroLines, formatArenaDate, formatQueueTime, rankProgress, RequestIdentity, type ArenaTier } from "../ui/arena-presentation";
import { arenaInput } from "../ui/arena-input";
import { describeDeckError } from "./deck-select-scene";

export interface ArenaMeReply {
  arena: ArenaStats; tier: ArenaTier | null;
  honorToday: { gained: number; cap: number }; honorShop: HonorShopItemDef[]; tiers: ArenaTier[];
}
interface ArenaHistoryEntry { matchId: string; mode: string; opponent: string | null; result: string | null; ratingDelta: number | null; createdAt: number }
interface LeaderboardEntry { rank: number | null; username: string; rating: number; tier: ArenaTier | null; wins: number; losses: number; rankedGames: number }
type Mode = "ranked" | "practice" | "private";
type Panel = "history" | "leaderboard" | "decks" | "validation";
const MODE_LABELS: Record<string, string> = { ranked: "Xếp hạng", private: "Phòng riêng", practice: "Đấu tập" };
const RESULT_LABELS: Record<string, string> = { won: "Thắng", lost: "Thua", draw: "Hòa" };

/** Owns API/realtime state. Every match send resolves a saved deck ID. */
export class ArenaScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private controls!: HomeControls;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private deckIndex = 0;
  private roomCode: string | null = null;
  private roomPlayers: { username: string; ready: boolean }[] = [];
  private selfUsername: string | null = null;
  private me: ArenaMeReply | null = null;
  private queued = false;
  private waitingSeconds = 0;
  private mode: Mode = "ranked";
  private pending = false;
  private error = "";
  private notice = "";
  private profileError = "";
  private panel: Panel | null = null;
  private panelOpener: string | null = null;
  private panelError = "";
  private history: ArenaHistoryEntry[] | null = null;
  private leaderboard: { entries: LeaderboardEntry[]; me: LeaderboardEntry | null } | null = null;
  private assetState: "idle" | "loading" | "ready" | "error" = "idle";
  private assetFailed = 0;
  private generation = 0;
  private accountGeneration = 0;
  private reducedMotion = false;
  private profileRequests = new RequestIdentity();
  private panelRequests = new RequestIdentity();
  private modalScroller!: RowScroller;
  private search: ReturnType<typeof arenaInput> | null = null;
  private roomInput: ReturnType<typeof arenaInput> | null = null;
  private deckQuery = "";
  private roomValue = "";
  private tipPinned = false;
  private queueTimer: Phaser.GameObjects.Text | null = null;
  private queueBody: Phaser.GameObjects.Container | null = null;
  private historyFilter = "all";
  private roomError = "";
  private copyNotice = "";

  constructor() { super("arena"); }
  preload() {
    preloadActionIcons(this); preloadEquipmentArt(this);
    const selectedIndex = savedLobbyDeckIndex(session.profile.decks, session.selectedDeckId);
    const heroIds = selectedIndex < 0 ? [] : session.profile.decks[selectedIndex]?.heroIds ?? [];
    const selected = { backgrounds: ["home", "background"], heroes: heroIds, ui: ["mode_arena", "mode_practice", "mode_private", "nav_heroes", "nav_leaderboard", "nav_history", "nav_shop", "cur_moonJade", "cur_moonStar", "cur_honor", "rank_dong_sinh", "rank_tu_tai", "rank_cu_nhan", "rank_tien_si", "rank_trang_nguyen", "check", "lock"] };
    for (const [category, ids] of Object.entries(selected)) for (const id of ids) {
      const key = `${category}:${id}`, url = manifest[category]?.[id];
      if (url && !this.textures.exists(key)) this.load.image(key, url);
    }
  }
  create() {
    useDesignCamera(this);
    this.generation++; this.accountGeneration = auth.generation;
    this.assetState = "idle"; this.assetFailed = 0;
    this.deckIndex = savedLobbyDeckIndex(this.decks(), session.selectedDeckId);
    this.roomCode = session.roomCode; this.roomPlayers = []; this.selfUsername = auth.username;
    this.me = null; this.queued = false; this.pending = false; this.waitingSeconds = 0;
    this.mode = this.roomCode ? "private" : "ranked";
    this.panel = null; this.panelOpener = null; this.history = null; this.leaderboard = null;
    this.error = ""; this.notice = ""; this.profileError = ""; this.panelError = "";
    this.deckQuery = ""; this.roomValue = ""; this.historyFilter = "all"; this.roomError = ""; this.copyNotice = "";
    this.reducedMotion = loadCombatSettings(localStorage, window.matchMedia("(prefers-reduced-motion: reduce)").matches).reducedMotion;
    this.controls = new HomeControls(this, this.reducedMotion, isModalOpen);
    this.modalScroller = new RowScroller(this, { x: 148, y: 210, width: 984, height: 360 }, () => this.render(), () => !!this.panel);
    this.root = this.add.container(0, 0).setName("arena_lobby");
    this.createBackground();
    const generation = this.generation;
    session.net ??= new NetSocket();
    const net = session.net;
    net.onMessage = message => { if (this.isCurrent(generation)) this.onMessage(message); };
    net.onStatus = connected => {
      if (!this.isCurrent(generation)) return;
      if (!connected) { this.queued = false; this.pending = false; this.roomCode = null; this.roomPlayers = []; session.roomCode = null; }
      this.render();
    };
    net.onRecovery = snapshot => {
      if (session.net !== net || snapshot === null || auth.generation !== this.accountGeneration) return;
      if (session.match?.matchId !== snapshot.matchId) session.match = new NetMatch(net, snapshot);
      session.registry?.retain(session.match!);
      (this.game.scene.getScenes(true)[0] ?? this).scene.start("combat");
    };
    net.connect();
    const onEsc = () => { if (this.tipPinned) this.hideTip(true); else if (!isModalOpen()) this.back(); };
    const dismissTip = () => { if (this.tipPinned) this.hideTip(true); };
    this.input.on("pointerdown", dismissTip);
    this.input.keyboard?.on("keydown-ESC", onEsc);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++; this.panelRequests.next(); this.profileRequests.next();
      this.input.keyboard?.off("keydown-ESC", onEsc); this.input.off("pointerdown", dismissTip);
      this.search?.destroy(); this.search = null; this.roomInput?.destroy(); this.roomInput = null; this.hideTip(true);
      net.onMessage = () => {}; net.onStatus = () => {};
      if (this.queued) net.send({ type: "queue.leave" });
    });
    this.render();
    if (!this.reducedMotion) { this.root.setAlpha(0); this.tweens.add({ targets: this.root, alpha: 1, duration: 200 }); }
    showToast(this, session.notices.splice(0));
    this.refreshArena(); this.prepareAssets();
  }
  private isCurrent(generation: number) { return this.generation === generation && auth.generation === this.accountGeneration && this.scene.isActive(); }
  private createBackground() {
    const artKey = ["backgrounds:home", "backgrounds:background"].find(key => this.textures.exists(key));
    const art = artKey ? this.add.image(640, 360, artKey).setName("arena_background").setDepth(-2) : null;
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x07101f, 0.68).setDepth(-1).setName("arena_background_shade");
    const place = () => {
      const view = visibleWorld(this), x = view.x + view.w / 2, y = view.y + view.h / 2;
      shade.setPosition(x, y).setSize(view.w, view.h);
      if (art) art.setPosition(x, y).setScale(Math.max(view.w / art.width, view.h / art.height));
      if (this.panel) this.render();
    };
    place(); this.scale.on("resize", place);
    this.events.once("shutdown", () => this.scale.off("resize", place));
  }
  private prepareAssets() {
    if (this.assetState === "loading" || this.assetState === "ready") return;
    this.assetState = "loading"; this.render();
    const generation = this.generation;
    prepareCombatAssets(this, { selection: deckAssetSelection(this.selectedDeck() ?? { heroIds: session.heroIds }), isCurrent: () => this.isCurrent(generation) }).then(({ failed }) => {
      if (!this.isCurrent(generation)) return;
      this.assetFailed = failed.length; this.assetState = failed.length ? "error" : "ready"; this.render();
    });
  }
  private refreshArena() {
    const generation = this.generation, request = this.profileRequests.next(); this.profileError = "";
    api<ArenaMeReply>("GET", "/arena/me").then(me => {
      if (!this.isCurrent(generation) || !this.profileRequests.current(request)) return;
      this.me = me; cacheArenaRank(me); this.render();
    }, error => {
      if (!this.isCurrent(generation) || !this.profileRequests.current(request)) return;
      this.profileError = `Lỗi hồ sơ: ${errorText(error)}`; this.render();
    });
  }
  private decks() { return session.profile.decks; }
  private selectedDeck() { return this.deckIndex < 0 ? null : this.decks()[Math.min(this.deckIndex, this.decks().length - 1)] ?? null; }
  private pvpErrors(deckId: string) {
    const deck = this.decks().find(deck => deck.id === deckId);
    return deck ? validateDeck(session.data, session.profile, deck, { mode: "pvp" }) : [{ code: "badHeroes" } as const];
  }
  private actionReason() {
    const deck = this.selectedDeck();
    return arenaActionReason({ connected: !!session.net?.connected, savedDeck: !!deck, validDeck: !!deck && !this.pvpErrors(deck.id).length,
      assets: this.assetState, queued: this.queued, room: !!this.roomCode, pending: this.pending });
  }
  private onMessage(message: ServerMessage) {
    switch (message.type) {
      case "welcome": this.selfUsername = message.account.username; break;
      case "queue.status":
        if (!this.queued) return; // reject status already in flight after cancellation
        this.pending = false; this.waitingSeconds = message.waitingSeconds;
        if (!this.queueTimer?.scene) this.render();
        else this.queueTimer.setText(formatQueueTime(this.waitingSeconds));
        break;
      case "room.created": case "room.updated": {
        if (!this.roomCode && !(this.pending && this.mode === "private")) return;
        if (this.roomCode && this.roomCode !== message.code) return;
        const arrived = this.roomPlayers.length > 0 && message.players.length > this.roomPlayers.length;
        this.pending = false; this.queued = false; this.roomCode = message.code; this.roomPlayers = message.players;
        this.mode = "private"; session.roomCode = message.code; this.render();
        if (arrived && !this.reducedMotion) {
          const content = this.root.getByName("arena_mode_content") as Phaser.GameObjects.Container;
          const slot = content.getByName("arena_room_player_1") as Phaser.GameObjects.Container;
          if (slot) { slot.setAlpha(0.55); this.tweens.add({ targets: slot, alpha: 1, duration: 220 }); slot.once("destroy", () => this.tweens.killTweensOf(slot)); }
        }
        break;
      }
      case "room.closed":
        if (this.roomCode !== message.code) return;
        this.pending = false; this.roomCode = null; this.roomPlayers = []; session.roomCode = null; this.notice = "Phòng đã đóng."; this.render(); break;
      case "match.start":
        this.queued = false; this.pending = false; session.roomCode = null;
        session.match = new NetMatch(session.net!, message); session.registry?.retain(session.match); this.scene.start("combat"); break;
      case "error":
        if (message.error !== "already in queue") this.queued = false;
        if (this.pending && this.mode === "private" && !this.roomCode) this.roomError = API_ERROR_TEXT[message.error] ?? message.error;
        else this.error = `Lỗi: ${API_ERROR_TEXT[message.error] ?? message.error}`;
        this.pending = false; this.render(); break;
      default: if ("matchId" in message) session.match?.handle(message);
    }
  }
  private leaveQueue(redraw = true) {
    if (!this.queued) return;
    this.queued = false; this.pending = false; session.net?.send({ type: "queue.leave" });
    if (redraw) this.render();
  }
  private leaveRoom() {
    if (!this.roomCode) return;
    session.net?.send({ type: "room.leave" }); this.roomCode = null; this.roomPlayers = []; session.roomCode = null; this.pending = false; this.render();
  }
  private changeMode(mode: Mode) {
    if (this.pending && !this.queued) return;
    if (this.roomCode && mode !== "private") this.leaveRoom();
    if (mode !== this.mode) this.leaveQueue(false);
    this.mode = mode; this.notice = ""; this.roomError = ""; this.copyNotice = ""; this.render();
    if (!this.reducedMotion) {
      const content = this.root.getByName("arena_mode_content");
      if (content) { (content as Phaser.GameObjects.Container).setAlpha(0.65); this.tweens.add({ targets: content, alpha: 1, duration: 140 }); }
    }
  }
  private start(type: "queue.join" | "practice.start" | "room.create" | "room.join") {
    if (this.actionReason()) return;
    if (type === "room.join" && !/^[A-Z0-9]{6}$/.test(this.roomValue)) { this.roomError = "Mã phòng cần 6 ký tự A–Z hoặc 0–9."; this.render(); return; }
    const deckId = this.selectedDeck()!.id;
    this.error = ""; this.notice = ""; this.roomError = ""; this.pending = true;
    if (type === "queue.join") { this.queued = true; this.waitingSeconds = 0; session.net!.send({ type, mode: "ranked", deckId }); }
    else if (type === "room.join") session.net!.send({ type, code: this.roomValue, deckId });
    else session.net!.send({ type, mode: "pvp", deckId });
    this.render();
  }
  private hideTip(force = false) { if (this.tipPinned && !force) return; this.tooltip?.destroy(); this.tooltip = null; this.tipPinned = false; }
  private tip(hit: Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle }, lines: string[]) {
    if (this.tipPinned) return;
    this.hideTip(); const b = hit.getBounds();
    this.tooltip = showTextTooltip(this, b.centerX - 180, b.bottom + 8, lines, 360, 14).setDepth(1500);
  }
  private info(source: Phaser.GameObjects.Text, name: string, lines: string[]) {
    source.setName(name); this.controls.info(source, () => this.tip(source, lines), () => this.hideTip());
  }
  private inspect(panel: Phaser.GameObjects.Container, name: string, lines: string[], fill = 0x15243a, border = 0x65748e) {
    const hit = this.add.rectangle(0, 0, panel.width, panel.height, 0, 0).setName(name); panel.add(hit);
    this.controls.bind(hit, panel, { enabled: true, fill, border, radius: 12,
      activate: () => { this.hideTip(true); this.tip(hit, lines); this.tipPinned = true; },
      showTip: () => this.tip(hit, lines), hideTip: () => this.hideTip() });
  }
  private text(parent: Phaser.GameObjects.Container, x: number, y: number, value: string, size = 14, color: string = COLORS.text, width?: number) {
    const text = addText(this, parent, x, y, value, size, color); if (width) text.setWordWrapWidth(width); return text;
  }
  private fit(parent: Phaser.GameObjects.Container, x: number, y: number, value: string, width: number, size = 14, color: string = COLORS.text) {
    const short = ellipsize(this, value, width, size, 1), text = this.text(parent, x, y, short, size, color);
    if (short !== value) this.info(text, `arena_info_${parent.name}_${x}_${y}`, [value]); return text;
  }
  private button(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, name: string, action: () => void, enabled = true, options: ButtonOptions = {}, icon?: string, onFocus?: () => void) {
    const c = this.controls.button(parent, x, y, width, label, enabled, options);
    c.hit.setName(name).setData("actionLabel", label); c.panel.setName(`${name}_panel`).setData("actionLabel", label);
    if (icon) { this.art(c.panel, icon, -width / 2 + 26, 0, 28); (c.panel.list[3] as Phaser.GameObjects.Text).setX(12); }
    this.controls.bind(c.hit, c.panel, { enabled, activate: action, fill: c.fill, border: c.border, radius: 9,
      hoverFill: options.strong && enabled ? 0xddc28c : undefined,
      onFocus, showTip: enabled ? undefined : () => this.tip(c.hit, [options.disabledReason ?? label]), hideTip: () => this.hideTip() }); return c;
  }
  private iconButton(parent: Phaser.GameObjects.Container, x: number, y: number, icon: ActionIcon, label: string, name: string, action: () => void, enabled = true, reason = "") {
    const c = this.controls.iconButton(parent, x, y, icon, label, enabled);
    c.hit.setName(name).setSize(44, 44); this.controls.bind(c.hit, c.panel, { enabled, activate: action, icon: c.icon, fill: c.fill, border: c.border, radius: 9,
      showTip: () => this.tip(c.hit, [enabled ? label : reason]), hideTip: () => this.hideTip() });
  }
  private art(parent: Phaser.GameObjects.Container, key: string, x: number, y: number, size: number) {
    if (!this.textures.exists(key)) return null;
    const image = this.add.image(x, y, key); image.setScale(Math.min(size / image.width, size / image.height)); parent.add(image); return image;
  }
  private render() {
    if (!this.root) return;
    const nativeFocus = () => document.activeElement === this.search?.input ? "arena_deck_search" : document.activeElement === this.roomInput?.input ? "arena_room_code" : null;
    const focusedName = nativeFocus() ?? this.controls.focusedName;
    this.hideTip(true); this.queueTimer = null; this.queueBody = null; this.root.removeAll(true); this.controls.setLayer(this.root);
    this.iconButton(this.root, 62, 42, "back", "Về trang chủ", "arena_back", () => this.back());
    this.text(this.root, 100, 42, "Đấu Trường", 26, COLORS.gold).setOrigin(0, 0.5);
    for (const [index, key] of (["moonJade", "moonStar", "honor"] as const).entries()) {
      const value = session.profile.currencies[key] ?? 0;
      const chip = roundedPanel(this, 874 + index * 142, 42, 130, 40, 0x0b1729, 0.94, 0x536279, 10);
      this.root.add(chip); this.art(chip, `ui:cur_${key}`, -44, 0, 28);
      this.text(chip, -20, 0, new Intl.NumberFormat("vi-VN", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value), 15).setOrigin(0, 0.5);
      this.inspect(chip, `arena_currency_${key}`, [`${key === "honor" ? "Số dư Vinh Dự" : CURRENCY_LABELS[key]}: ${value.toLocaleString("vi-VN")}`], 0x0b1729, 0x536279);
    }
    this.root.add(roundedPanel(this, 172, 350, 264, 500, 0x0c192a, 0.96, 0x3e506a, 16));
    this.root.add(roundedPanel(this, 592, 350, 528, 500, 0x0c192a, 0.96, 0x73849e, 16));
    this.root.add(roundedPanel(this, 1060, 350, 360, 500, 0x0c192a, 0.96, 0x3e506a, 16));
    this.renderStats(); this.renderDeck(); this.renderModes();
    this.button(this.root, 260, 656, 210, "Lịch sử", "arena_history", () => this.openPanel("history"), true, {}, "ui:nav_history");
    this.button(this.root, 580, 656, 250, "Bảng xếp hạng", "arena_leaderboard", () => this.openPanel("leaderboard"), true, {}, "ui:nav_leaderboard");
    this.button(this.root, 936, 656, 280, "Cửa hàng Vinh Dự", "arena_honor_shop", () => this.scene.start("shop", { tab: "honor", back: "arena" }), !this.pending || this.queued, { disabledReason: "Đang gửi yêu cầu…" }, "ui:nav_shop");
    this.text(this.root, 640, 698, session.net?.connected ? "Đã kết nối" : "Mất kết nối — đang kết nối lại…", 12, session.net?.connected ? COLORS.dimText : "#ffb0b0").setOrigin(0.5);
    if (this.panel) this.renderPanel(); this.syncInputs(); this.controls.restoreFocus(nativeFocus() ?? focusedName);
  }
  private renderStats() {
    const arena = this.me?.arena ?? session.profile.arena, tier = this.me?.tier;
    this.text(this.root, 172, 128, "XẾP HẠNG", 14, COLORS.dimText).setOrigin(0.5);
    this.art(this.root, `ui:rank_${tier?.id ?? session.rank?.tierId ?? "dong_sinh"}`, 172, 210, 116);
    this.text(this.root, 172, 284, tier?.name ?? session.rank?.tierName ?? "Đang tải hạng…", 21, COLORS.gold).setOrigin(0.5);
    this.text(this.root, 172, 318, `${arena.rating} điểm`, 19).setOrigin(0.5);
    const progress = rankProgress(arena.rating, this.me?.tiers ?? []);
    if (this.profileError) {
      this.text(this.root, 172, 339, "Dữ liệu gần nhất", 12, COLORS.dimText).setOrigin(0.5);
      this.fit(this.root, 62, 356, this.profileError, 220, 13, "#ffb0b0");
    }
    else {
      const label = this.text(this.root, 172, 346, this.me?.tiers?.length ? progress.next ? `Tiến tới ${progress.next.name}` : "Hạng cao nhất" : "Đang tải ngưỡng hạng…", 14, COLORS.dimText).setOrigin(0.5);
      this.info(label, "arena_rank_goal", ["Thanh tiến độ tính từ ngưỡng hạng hiện tại tới hạng kế tiếp.", "Mỗi trận xếp hạng cập nhật điểm và thành tích."]);
    }
    if (progress.next && this.me?.tiers?.length && !this.profileError) {
      this.progressBar(this.root, 62, 372, 220, progress.fraction, 0xc8ad73);
      this.text(this.root, 172, 393, `Còn ${progress.remaining} điểm · Mốc ${progress.next.minRating.toLocaleString("vi-VN")}`, 13, COLORS.dimText).setOrigin(0.5);
    }
    this.root.add(this.add.rectangle(172, 410, 220, 1, 0x34445d));
    [arena.wins, arena.losses, arena.draws].forEach((value, i) => {
      this.text(this.root, 95 + i * 77, 434, String(value), 23, ["#94d9bb", "#e5a9a8", COLORS.text][i]).setOrigin(0.5);
      this.text(this.root, 95 + i * 77, 461, ["Thắng", "Thua", "Hòa"][i]!, 13, COLORS.dimText).setOrigin(0.5);
    });
    const today = this.me?.honorToday;
    this.art(this.root, "ui:cur_honor", 82, 507, 32);
    this.text(this.root, 110, 488, "Vinh Dự hôm nay", 13, COLORS.dimText);
    this.text(this.root, 110, 509, today ? `${today.gained} / ${today.cap}` : "Đang tải…", 17);
    if (today) {
      this.progressBar(this.root, 62, 539, 220, today.cap ? today.gained / today.cap : 1, 0x6fae99, 5);
      this.text(this.root, 62, 549, today.gained >= today.cap ? "Đã đạt giới hạn hôm nay" : `Còn có thể nhận ${today.cap - today.gained} hôm nay`, 13, COLORS.dimText, 220);
    }
    this.text(this.root, 62, 575, `${arena.rankedGames} trận xếp hạng`, 12, COLORS.dimText, 220);
    if (this.profileError) {
      this.button(this.root, 172, 392, 170, "Tải lại hồ sơ", "arena_profile_retry", () => { this.refreshArena(); this.render(); });
    }
  }
  private progressBar(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, fraction: number, color: number, height = 8) {
    const g = this.add.graphics().fillStyle(0x28354c).fillRoundedRect(x, y - height / 2, width, height, height / 2);
    const fill = width * Phaser.Math.Clamp(fraction, 0, 1);
    if (fill > 0) g.fillStyle(color).fillRoundedRect(x, y - height / 2, fill, height, Math.min(height / 2, fill / 2));
    parent.add(g);
  }
  private editDeck() {
    const deck = this.selectedDeck(); if (!deck || this.queued || this.pending || this.roomCode) return;
    session.editingDeck = structuredClone(deck); this.scene.start("deck-builder", { back: "arena" });
  }
  private renderDeck() {
    const deck = this.selectedDeck(), locked = this.queued || this.pending || !!this.roomCode;
    this.text(this.root, 352, 124, "BỘ BÀI XUẤT TRẬN", 14, COLORS.dimText);
    this.button(this.root, 704, 132, 168, "Đổi bộ bài", "arena_deck_change", () => this.openPanel("decks"), !locked, { disabledReason: "Rời hàng chờ hoặc phòng để đổi bộ bài" });
    this.iconButton(this.root, 818, 132, "edit", "Chỉnh sửa bộ bài", "arena_deck_edit", () => this.editDeck(), !!deck && !locked, "Chọn bộ bài và rời hàng chờ hoặc phòng để chỉnh sửa");
    if (!deck) {
      this.art(this.root, "ui:action_new", 592, 320, 100);
      this.text(this.root, 592, 420, this.decks().length ? "Chọn bộ bài đã lưu để xuất trận" : "Cần một bộ bài đã lưu để vào trận.", 17, COLORS.text, 450).setOrigin(0.5);
      this.button(this.root, 592, 478, 250, this.decks().length ? "Chọn bộ bài" : "Tạo bộ bài", "arena_deck_empty", () => this.decks().length ? this.openPanel("decks") : this.scene.start("deck-select", { newDeck: true }), true, { variant: "primary", strong: true, height: 52, fontSize: 16 }); return;
    }
    const name = this.text(this.root, 352, 166, ellipsize(this, deck.name, 476, 20, 2), 20, COLORS.text, 476);
    this.info(name, "arena_deck_name", [deck.name, locked ? this.roomCode ? "Rời phòng để đổi bộ bài" : "Đang tìm trận — bộ bài đã khóa" : "Bộ bài đã lưu chuẩn bị xuất trận"]);
    deck.heroIds.slice(0, 3).forEach((id, i) => {
      const x = 429 + i * 163, hero = session.data.heroes[id];
      const panel = roundedPanel(this, x, 340, 146, 238, 0x15243a, 1, 0x65748e, 12); this.root.add(panel);
      const artKey = roundedArtTexture(this, `heroes:${id}`, 146, 192, 12);
      if (this.textures.exists(artKey)) panel.add(this.add.image(0, -22, artKey).setScale(1 / RENDER_SCALE));
      else this.text(panel, 0, -26, "Chưa có hình Hero", 12, COLORS.dimText).setOrigin(0.5);
      this.text(panel, -63, 90, ellipsize(this, hero?.name ?? id, 126, 14, 1), 14);
      this.inspect(panel, `arena_hero_${id}`, arenaHeroLines(session.data, id, session.profile));
      const weapon = deck.weapons?.[id];
      const gear = roundedPanel(this, x, 484, 146, 44, 0x102037, 1, 0x34445d, 9); this.root.add(gear);
      const def = weapon ? session.data.weapons[weapon] : undefined;
      if (weapon) addEquipmentArt(this, gear, "weapons", weapon, -52, 0, 32, 38);
      else this.art(gear, "ui:action_new", -52, 0, 20)?.setAlpha(0.45);
      this.text(gear, -30, 0, ellipsize(this, def?.name ?? "Chưa trang bị", 96, 13, 1), 13, COLORS.dimText).setOrigin(0, 0.5);
      const refinement = weapon ? session.profile.weapons[weapon]?.refinement : undefined;
      this.inspect(gear, `arena_weapon_${id}`, def ? [def.name, refinement ? `Tinh Luyện ${refinement}` : session.data.pvpConfig.freeWeaponIds.includes(weapon!) ? "Vũ khí dùng thử · Tinh Luyện 1" : "Chưa sở hữu", def.text, ...def.refinement.slice(0, Math.max(0, (refinement ?? 1) - 1)).map((level, index) => `Tinh Luyện ${index + 2}: ${level.text}`), `Thêm ${def.card.copies} lá; không chiếm ô bộ bài`] : ["Chưa trang bị", `Vũ khí của ${hero?.name ?? id}`, "Chỉnh sửa bộ bài để chọn vũ khí"], 0x102037, 0x34445d);
    });
    const summary = summarizeDeck(session.data, deck, { profile: session.profile, mode: "pvp" });
    const counts = this.text(this.root, 352, 519, `${summary.slots} ô bộ bài · ${summary.copies} bản`, 14, COLORS.dimText);
    this.info(counts, "arena_deck_summary", ["Ô bộ bài đếm các mục bài được chọn, không phải số bản.", `${summary.cardCopies} bản bài + ${summary.weaponCopies} bản vũ khí trong chồng bài.`, "Vũ khí không chiếm ô bộ bài."]);
    this.text(this.root, 647, 526, "Nguyệt Bảo", 13, COLORS.dimText);
    for (let i = 0; i < 2; i++) {
      const id = deck.relicIds?.[i], def = id ? session.data.relics[id] : undefined;
      const slot = roundedPanel(this, 768 + i * 48, 530, 44, 44, 0x102037, 1, 0x34445d, 9); this.root.add(slot);
      if (id) addEquipmentArt(this, slot, "relics", id, 0, 0, 36, 38);
      else this.art(slot, "ui:action_new", 0, 0, 20)?.setAlpha(0.45);
      const resonance = id ? session.profile.relics[id]?.resonance : undefined;
      this.inspect(slot, `arena_relic_${i}`, def ? [def.name, resonance ? `Cộng Minh ${resonance}` : session.data.pvpConfig.freeRelicIds.includes(id!) ? "Nguyệt Bảo dùng thử · Cộng Minh 1" : "Chưa sở hữu", def.resonance[(resonance ?? 1) - 1]?.text ?? ""] : [`Nguyệt Bảo ${i + 1} · Chưa trang bị`, "Chỉnh sửa bộ bài để chọn Nguyệt Bảo"], 0x102037, 0x34445d);
    }
    const errors = this.pvpErrors(deck.id);
    this.root.add(roundedPanel(this, 449, 571, 194, 30, errors.length ? 0x39252e : 0x18382f, 1, errors.length ? 0x805562 : 0x477664, 9));
    this.art(this.root, errors.length ? "ui:lock" : "ui:check", 370, 571, 20);
    const validation = this.text(this.root, 387, 571, errors.length ? "Cần sửa bộ bài" : "Hợp lệ", 14, errors.length ? "#ffb0b0" : "#94d9bb").setOrigin(0, 0.5);
    this.info(validation, "arena_deck_validity", errors.length ? errors.map(error => describeDeckError(session.data, error)) : ["Hợp lệ theo luật Đấu Trường", "Giữ nguyên Tinh Hồn, Tinh Luyện và Cộng Minh đang sở hữu.", "Hero và trang bị dùng thử ở cấp cơ bản."]);
    this.text(this.root, 352, 595, "Giữ nguyên Tinh Hồn và sức mạnh trang bị", 12, COLORS.dimText);
    if (errors.length) this.button(this.root, 730, 571, 200, "Xem lỗi", "arena_deck_validation", () => this.openPanel("validation"));
  }
  private renderModes() {
    const choices = this.add.container(0, 0); this.root.add(choices);
    const modes: Mode[] = ["ranked", "practice", "private"];
    modes.forEach((mode, i) => {
      const c = this.button(choices, 1060, 136 + i * 50, 312, MODE_LABELS[mode]!, `arena_mode_${mode}`, () => this.changeMode(mode), !this.pending || this.queued, { variant: this.mode === mode ? "primary" : "secondary", fontSize: 15, disabledReason: "Đang gửi yêu cầu…" }, `ui:mode_${mode === "ranked" ? "arena" : mode}`);
      c.hit.setData("selected", this.mode === mode);
      if (this.mode === mode) this.art(c.panel, "ui:check", 138, 0, 16);
    });
    const content = this.add.container(0, 0).setName("arena_mode_content"); this.root.add(content);
    const reason = this.actionReason();
    const description = this.mode === "ranked" ? "Ghép đối thủ có sức mạnh tương đương\nNhận điểm xếp hạng và Vinh Dự" : this.mode === "practice" ? "Luyện với máy\nKhông đổi điểm · Không nhận Vinh Dự" : "Đấu với bạn bè bằng mã phòng\nKhông đổi điểm xếp hạng";
    this.text(content, 904, 277, description, 14, COLORS.dimText, 308);
    if (this.roomCode) {
      this.text(content, 918, 326, "MÃ PHÒNG", 13, COLORS.dimText);
      const codeText = this.text(content, 918, 347, this.roomCode, 28, COLORS.gold).setFontFamily("monospace");
      this.info(codeText, "arena_room_code_info", [this.roomCode, "Gửi mã này cho đối thủ. Trận tự bắt đầu khi đủ hai người."]);
      this.iconButton(content, 1196, 362, "copy", "Sao chép mã phòng", "arena_room_copy", () => {
        const code = this.roomCode, generation = this.generation; if (!code) return;
        void navigator.clipboard.writeText(code).then(() => {
          if (this.isCurrent(generation) && this.roomCode === code) { this.copyNotice = "Đã sao chép mã phòng"; this.render(); }
        }, () => { if (this.isCurrent(generation) && this.roomCode === code) { this.copyNotice = "Không sao chép được — thử lại"; this.render(); } });
      });
      if (this.copyNotice) this.fit(content, 918, 381, this.copyNotice, 290, 13, this.copyNotice.startsWith("Không") ? "#ffb0b0" : "#94d9bb");
      const players = [...this.roomPlayers].sort((a, b) => Number(b.username === this.selfUsername) - Number(a.username === this.selfUsername));
      for (let i = 0; i < 2; i++) {
        const slot = roundedPanel(this, 1060, 422 + i * 56, 300, 48, 0x102037, 1, 0x34445d, 9).setName(`arena_room_player_${i}`); content.add(slot);
        this.text(slot, -138, -18, i === 0 ? "BẠN" : "ĐỐI THỦ", 11, COLORS.dimText);
        this.fit(slot, -138, -2, players[i]?.username ?? (i === 0 ? this.selfUsername ?? "Bạn" : "Đang chờ đối thủ…"), 276, 14, players[i] ? COLORS.text : COLORS.dimText);
      }
      this.text(content, 1060, 516, `${this.roomPlayers.length || 1}/2 người · Tự vào trận khi đủ người`, 13, COLORS.dimText).setOrigin(0.5);
      this.button(content, 1060, 556, 300, "Rời phòng", "arena_room_leave", () => this.leaveRoom());
    } else if (this.queued) {
      this.queueBody = content;
      const halo = this.add.graphics().setName("arena_queue_halo"); content.add(halo);
      halo.fillStyle(0x609cda, 0.08).fillCircle(1060, 366, 40).lineStyle(1, 0x609cda, 0.3).strokeCircle(1060, 366, 40);
      if (!this.reducedMotion) {
        this.tweens.add({ targets: halo, alpha: 0.4, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        halo.once("destroy", () => this.tweens.killTweensOf(halo));
      }
      const icon = this.art(content, "ui:mode_arena", 1060, 366, 62);
      if (icon && !this.reducedMotion) {
        this.tweens.add({ targets: icon, alpha: 0.65, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        icon.once("destroy", () => this.tweens.killTweensOf(icon));
      }
      this.text(content, 1060, 411, "Đang tìm đối thủ", 15, COLORS.dimText).setOrigin(0.5);
      this.queueTimer = this.text(content, 1060, 441, formatQueueTime(this.waitingSeconds), 23, COLORS.gold).setOrigin(0.5).setName("arena_queue_timer").setFontFamily("monospace");
      this.button(content, 1060, 481, 300, "Hủy tìm trận", "arena_queue_cancel", () => this.leaveQueue());
    } else if (this.mode === "private") {
      this.button(content, 1060, 357, 300, this.pending ? "Đang gửi yêu cầu…" : "Tạo phòng riêng", "arena_room_create", () => this.start("room.create"), !reason, { disabledReason: reason, variant: this.roomValue ? "secondary" : "primary", strong: !this.roomValue, height: 44, fontSize: 16 });
      this.text(content, 1060, 396, "hoặc", 13, COLORS.dimText).setOrigin(0.5);
      this.text(content, 918, 415, "Tham gia bằng mã phòng", 13, COLORS.dimText);
      const focusField = () => this.roomInput?.input.focus();
      this.button(content, 1060, 456, 300, "Mã phòng", "arena_room_code", focusField, !this.pending, {}, undefined, focusField);
      this.button(content, 1060, 506, 300, this.pending ? "Đang vào phòng…" : "Vào phòng", "arena_room_join", () => this.start("room.join"), !reason && /^[A-Z0-9]{6}$/.test(this.roomValue), { disabledReason: reason || "Mã phòng cần 6 ký tự", variant: "primary", strong: true, height: 44, fontSize: 16 });
      if (this.roomError) this.fit(content, 918, 535, this.roomError, 284, 13, "#ffb0b0").setName("arena_room_error");
    } else {
      this.art(content, `ui:mode_${this.mode === "ranked" ? "arena" : "practice"}`, 1060, 377, 96);
      this.button(content, 1060, 478, 300, this.pending ? "Đang vào trận…" : this.mode === "ranked" ? "Tìm trận xếp hạng" : "Bắt đầu đấu tập", this.mode === "ranked" ? "arena_ranked_start" : "arena_practice_start", () => this.start(this.mode === "ranked" ? "queue.join" : "practice.start"), !reason, { disabledReason: reason, variant: "primary", strong: true, height: 52, fontSize: 16 });
    }
    if (this.assetState === "error") {
      this.text(content, 904, 559, `Lỗi tải hình (${this.assetFailed} tệp)`, 12, "#ffb0b0");
      this.button(content, 1173, 565, 110, "Thử lại", "arena_assets_retry", () => { this.assetState = "idle"; this.prepareAssets(); });
    } else if (reason && !this.queued && !this.roomCode && !this.roomError) this.text(content, 904, 536, reason, 13, session.net?.connected ? COLORS.dimText : "#ffb0b0", 308);
    if (this.error || this.notice) {
      const message = this.error || this.notice;
      const text = this.fit(content, 904, 580, message, 308, 13, this.error ? "#ffb0b0" : "#94d9bb");
      text.setData("arenaError", !!this.error);
    }
  }
  private closePanel() {
    const opener = this.panelOpener;
    this.panelRequests.next(); this.panel = null; this.panelError = ""; this.panelOpener = null; this.render();
    this.roomInput?.input.blur(); this.controls.restoreFocus(opener);
  }
  private openPanel(panel: Panel) {
    if ((panel === "decks" || panel === "validation") && (this.queued || this.pending || this.roomCode)) return;
    if (this.panel === null) this.panelOpener = ({ history: "arena_history", leaderboard: "arena_leaderboard", decks: "arena_deck_change", validation: "arena_deck_validation" } as const)[panel];
    this.panel = panel; this.panelError = ""; this.modalScroller.first = 0;
    if (panel === "history") this.historyFilter = "all";
    const request = this.panelRequests.next(), generation = this.generation;
    if (panel === "history" || panel === "leaderboard") {
      if (panel === "history") this.history = null; else this.leaderboard = null;
      api<{ entries: ArenaHistoryEntry[] } | { entries: LeaderboardEntry[]; me: LeaderboardEntry | null }>("GET", `/arena/${panel}`).then(reply => {
        if (!this.isCurrent(generation) || !this.panelRequests.current(request) || this.panel !== panel) return;
        if (panel === "history") this.history = (reply as { entries: ArenaHistoryEntry[] }).entries;
        else this.leaderboard = reply as { entries: LeaderboardEntry[]; me: LeaderboardEntry | null };
        this.render();
      }, error => {
        if (!this.isCurrent(generation) || !this.panelRequests.current(request) || this.panel !== panel) return;
        this.panelError = errorText(error); this.render();
      });
    }
    this.render();
  }
  private back() {
    if (this.panel) { this.closePanel(); return; }
    if (this.pending && !this.queued) return;
    if (this.mode === "private" && !this.roomCode) { this.mode = "ranked"; this.render(); this.controls.restoreFocus("arena_mode_private"); return; }
    this.scene.start("deck-select");
  }
  private renderPanel() {
    const layer = this.add.container(0, 0).setDepth(900).setName("arena_modal"); this.root.add(layer); this.controls.setLayer(layer);
    const view = visibleWorld(this);
    layer.add(this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x03070f, 0.82).setInteractive());
    layer.add(roundedPanel(this, 640, 360, 1040, 592, 0x101d32, 1, 0x7d90b8, 16));
    const title = this.panel === "decks" ? "Chọn bộ bài đã lưu" : this.panel === "history" ? "Lịch sử trận" : this.panel === "validation" ? "Lỗi bộ bài Đấu Trường" : "Bảng xếp hạng";
    this.text(layer, 148, 95, title, 23, COLORS.gold);
    this.iconButton(layer, 1118, 104, "close", "Đóng", "arena_modal_close", () => this.closePanel());
    if (this.panelError) {
      this.art(layer, this.panel === "history" ? "ui:nav_history" : "ui:nav_leaderboard", 640, 265, 64);
      const message = this.text(layer, 640, 329, ellipsize(this, this.panelError, 800, 16, 2), 16, "#ffb0b0", 800).setOrigin(0.5);
      this.info(message, "arena_modal_error", [this.panelError]);
      this.button(layer, 640, 390, 220, "Thử lại", "arena_modal_retry", () => this.openPanel(this.panel!)); return;
    }
    if (this.panel === "decks") {
      const focusField = () => this.search?.input.focus();
      this.text(layer, 156, 128, "Tìm bộ bài", 12, COLORS.dimText);
      this.button(layer, 604, 167, 896, "Tìm tên bộ bài hoặc Hero", "arena_deck_search", focusField, true, {}, undefined, focusField);
      this.iconButton(layer, 1100, 167, "close", "Xóa tìm kiếm", "arena_search_clear", () => {
        this.deckQuery = ""; this.modalScroller.first = 0; if (this.search) this.search.input.value = ""; this.render(); this.search?.input.focus();
      }, !!this.deckQuery);
      this.renderDeckSelector(layer); return;
    }
    if (this.panel === "validation") {
      const deck = this.selectedDeck(), errors = deck ? this.pvpErrors(deck.id).map(error => describeDeckError(session.data, error)) : [];
      const [first, last] = this.modalScroller.range(errors.length, 4);
      errors.slice(first, last).forEach((error, i) => {
        const row = this.text(layer, 160, 218 + i * 76, ellipsize(this, error, 940, 15, 3), 15, "#ffb0b0", 940);
        this.info(row, `arena_validation_${first + i}`, [error]);
      });
      this.button(layer, 640, 547, 270, "Chỉnh sửa bộ bài", "arena_validation_edit", () => this.editDeck(), !this.queued && !this.pending && !this.roomCode, { variant: "primary", strong: true, fontSize: 16 });
      this.scrollControls(layer, errors.length, 4); return;
    }
    const loading = this.panel === "history" ? this.history === null : this.leaderboard === null;
    if (loading) {
      this.text(layer, 160, 164, "Đang tải…", 15, COLORS.dimText);
      for (let i = 0; i < 4; i++) {
        layer.add(roundedPanel(this, 640, 236 + i * 48, 964, 40, 0x14253b, 1, 0x283b55, 8));
        layer.add(this.add.rectangle(350, 236 + i * 48, 320, 8, 0x29384e));
        layer.add(this.add.rectangle(948, 236 + i * 48, 220, 8, 0x29384e));
      }
      return;
    }
    if (this.panel === "history") this.renderHistory(layer); else this.renderLeaderboard(layer);
  }
  private scrollControls(layer: Phaser.GameObjects.Container, total: number, visible: number) {
    if (!total) return;
    this.iconButton(layer, 183, 607, "left", "Trang trước", "arena_scroll_prev", () => this.modalScroller.scrollBy(-visible), this.modalScroller.first > 0, "Đang ở đầu danh sách");
    this.text(layer, 640, 607, total ? `${this.modalScroller.first + 1}–${Math.min(total, this.modalScroller.first + visible)} / ${total}` : "0 mục", 13, COLORS.dimText).setOrigin(0.5);
    this.iconButton(layer, 1097, 607, "right", "Trang sau", "arena_scroll_next", () => this.modalScroller.scrollBy(visible), this.modalScroller.first + visible < total, "Đang ở cuối danh sách");
  }
  private renderDeckSelector(layer: Phaser.GameObjects.Container) {
    const decks = this.decks().filter(deck => matchesDeckText(this.deckQuery, deck.name, ...deck.heroIds.map(id => session.data.heroes[id]?.name ?? id)));
    const [first, last] = this.modalScroller.range(decks.length, 6);
    decks.slice(first, last).forEach((deck, i) => {
      const y = 238 + i * 60, selected = deck.id === this.selectedDeck()?.id;
      const c = this.button(layer, 640, y, 964, "", `arena_deck_${deck.id}`, () => {
        if (this.queued || this.pending || this.roomCode) return;
        const index = this.decks().findIndex(current => current.id === deck.id); if (index < 0) return;
        this.deckIndex = index; session.selectedDeckId = deck.id; this.closePanel();
      }, true, { variant: selected ? "primary" : "secondary", height: 56 });
      c.hit.setData("actionLabel", deck.name);
      deck.heroIds.slice(0, 3).forEach((id, j) => {
        const art = roundedArtTexture(this, `heroes:${id}`, 32, 40, 6);
        if (this.textures.exists(art)) c.panel.add(this.add.image(-450 + j * 38, 0, art).setScale(1 / RENDER_SCALE));
        else this.art(c.panel, "ui:nav_heroes", -450 + j * 38, 0, 28);
      });
      this.fit(c.panel, -346, -20, deck.name, 554, 16);
      this.fit(c.panel, -346, 5, deck.heroIds.map(id => session.data.heroes[id]?.name ?? id).join(" · "), 554, 13, COLORS.dimText);
      if (selected) { this.art(c.panel, "ui:check", 376, -12, 16); this.text(c.panel, 468, -12, "Đang dùng", 13, COLORS.gold).setOrigin(1, 0.5); }
      this.text(c.panel, 468, selected ? 12 : 0, this.pvpErrors(deck.id).length ? "Cần sửa" : "Hợp lệ", 13, this.pvpErrors(deck.id).length ? "#ffb0b0" : "#94d9bb").setOrigin(1, 0.5);
    });
    if (!decks.length) this.emptyPanel(layer, "ui:nav_heroes", "Không có bộ bài phù hợp", "Thử tìm tên khác hoặc xóa tìm kiếm");
    this.scrollControls(layer, decks.length, 6);
  }
  private renderHistory(layer: Phaser.GameObjects.Container) {
    const entries = this.history!.map(entry => entry.mode === "ranked_bot" ? { ...entry, mode: "ranked" } : entry)
      .filter(entry => this.historyFilter === "all" || entry.mode === this.historyFilter);
    this.text(layer, 148, 131, "Lọc trong các trận gần đây đã tải", 12, COLORS.dimText);
    ["all", "ranked", "practice", "private"].forEach((mode, i) => {
      this.button(layer, 271 + i * 246, 168, 230, mode === "all" ? "Tất cả" : MODE_LABELS[mode]!, `arena_history_filter_${mode}`, () => {
        this.historyFilter = mode; this.modalScroller.first = 0; this.render();
      }, true, { variant: this.historyFilter === mode ? "primary" : "secondary", height: 30, fontSize: 13 });
    });
    [[160, "Kết quả"], [295, "Đối thủ"], [615, "Chế độ"], [856, "Điểm"], [903, "Thời gian"]].forEach(([x, label]) => this.text(layer, x as number, 195, label as string, 13, COLORS.dimText));
    const [first, last] = this.modalScroller.range(entries.length, 8);
    entries.slice(first, last).forEach((entry, i) => {
      const y = 232 + i * 42;
      layer.add(roundedPanel(this, 640, y + 9, 970, 38, i % 2 ? 0x14253b : 0x102037, 1, 0x283b55, 7));
      layer.add(roundedPanel(this, 207, y + 9, 90, 26, entry.result === "won" ? 0x18382f : entry.result === "lost" ? 0x39252e : 0x28354c, 1, 0x34445d, 7));
      this.text(layer, 207, y + 9, RESULT_LABELS[entry.result ?? ""] ?? "—", 14, entry.result === "won" ? "#94d9bb" : entry.result === "lost" ? "#ffb0b0" : COLORS.text).setOrigin(0.5);
      this.fit(layer, 295, y, entry.opponent ?? (entry.mode === "practice" ? "Vọng Nguyệt (máy)" : "Đối thủ"), 290);
      this.art(layer, `ui:mode_${entry.mode === "ranked" ? "arena" : entry.mode}`, 625, y + 9, 22);
      this.fit(layer, 644, y, MODE_LABELS[entry.mode] ?? entry.mode, 125, 14);
      this.text(layer, 885, y, entry.ratingDelta === null ? "—" : `${entry.ratingDelta >= 0 ? "+" : ""}${entry.ratingDelta}`, 14, entry.ratingDelta === null ? COLORS.dimText : entry.ratingDelta >= 0 ? "#94d9bb" : "#ffb0b0").setOrigin(1, 0);
      const date = this.text(layer, 903, y, formatArenaDate(entry.createdAt), 13);
      this.info(date, `arena_history_date_${entry.matchId}`, [new Date(entry.createdAt).toLocaleString("vi-VN")]);
    });
    if (!entries.length) this.emptyPanel(layer, "ui:nav_history", "Chưa có trận nào", "Các trận đã chơi sẽ hiển thị tại đây");
    this.scrollControls(layer, entries.length, 8);
  }
  private renderLeaderboard(layer: Phaser.GameObjects.Container) {
    const board = this.leaderboard!;
    [[160, "Vị trí"], [250, "Người chơi"], [655, "Hạng"], [850, "Điểm"], [965, "Thắng / Thua"]].forEach(([x, label]) => this.text(layer, x as number, 164, label as string, 14, COLORS.dimText));
    const [first, last] = this.modalScroller.range(board.entries.length, 7);
    board.entries.slice(first, last).forEach((entry, i) => {
      const y = 218 + i * 42;
      const own = entry.username === board.me?.username;
      layer.add(roundedPanel(this, 640, y + 9, 970, 38, own ? 0x1a343b : entry.rank === 1 ? 0x302c25 : entry.rank === 2 ? 0x282f38 : entry.rank === 3 ? 0x30282a : 0x102037, 1, own ? 0x6fae99 : 0x283b55, 7));
      this.text(layer, 160, y, `#${entry.rank ?? "—"}`, 14, entry.rank === 1 ? COLORS.gold : entry.rank === 2 ? "#bfcddb" : entry.rank === 3 ? "#d7a18a" : COLORS.text);
      this.fit(layer, 250, y, entry.username, 355);
      this.art(layer, `ui:rank_${entry.tier?.id}`, 639, y + 7, 28);
      this.fit(layer, 662, y, entry.tier?.name ?? "—", 170, 13);
      this.text(layer, 900, y, String(entry.rating), 14).setOrigin(1, 0);
      this.text(layer, 1100, y, `${entry.wins} / ${entry.losses}`, 14).setOrigin(1, 0);
    });
    if (!board.entries.length) this.emptyPanel(layer, "ui:nav_leaderboard", "Chưa ai đủ 5 trận xếp hạng", "Hoàn thành 5 trận để xuất hiện trên bảng");
    if (board.me) {
      const me = board.me; layer.add(roundedPanel(this, 640, 554, 964, 44, 0x263d46, 1, 0x94d9bb, 8));
      if (me.rank === null) {
        this.text(layer, 170, 545, `Bạn: ${me.rating} điểm · ${Math.min(5, me.rankedGames)}/5 trận · Cần ${Math.max(0, 5 - me.rankedGames)} trận nữa`, 14, "#94d9bb");
        this.progressBar(layer, 956, 554, 146, me.rankedGames / 5, 0x94d9bb, 5);
      } else {
        this.text(layer, 160, 546, `#${me.rank}`, 14, "#94d9bb");
        this.fit(layer, 250, 546, `Bạn · ${me.username}`, 355, 14, "#94d9bb");
        this.art(layer, `ui:rank_${me.tier?.id}`, 639, 554, 28);
        this.fit(layer, 662, 546, me.tier?.name ?? "—", 170, 13);
        this.text(layer, 900, 546, String(me.rating), 14).setOrigin(1, 0);
        this.text(layer, 1100, 546, `${me.wins} / ${me.losses}`, 14).setOrigin(1, 0);
      }
    }
    this.scrollControls(layer, board.entries.length, 7);
  }
  private emptyPanel(layer: Phaser.GameObjects.Container, icon: string, title: string, subtitle: string) {
    this.art(layer, icon, 640, 322, 64);
    this.text(layer, 640, 381, title, 17).setOrigin(0.5);
    this.text(layer, 640, 412, subtitle, 14, COLORS.dimText).setOrigin(0.5);
  }
  private syncInputs() {
    if (this.panel !== "decks") { this.search?.destroy(); this.search = null; }
    else if (!this.search) {
      this.search = arenaInput(this, "vn-arena-search", "Tìm tên bộ bài hoặc Hero", { x: 156, y: 148, w: 896, h: 38 }, value => { this.deckQuery = value; this.modalScroller.first = 0; this.render(); }, event => {
        if (event.key === "Escape") { event.preventDefault(); this.closePanel(); }
        if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); this.search?.input.blur(); this.controls.stepFocus("arena_deck_search", event.key === "Tab" && event.shiftKey); }
      }); this.search.input.value = this.deckQuery;
      this.search.input.addEventListener("focus", () => this.controls.restoreFocus("arena_deck_search"));
      this.controls.restoreFocus("arena_deck_search");
    }
    const showRoom = this.mode === "private" && !this.roomCode && !this.panel;
    if (!showRoom) { this.roomInput?.destroy(); this.roomInput = null; }
    else if (!this.roomInput) {
      this.roomInput = arenaInput(this, "vn-arena-room-code", "Mã phòng 6 ký tự", { x: 910, y: 436, w: 300, h: 40 }, value => { this.roomValue = value; this.roomError = ""; this.render(); }, event => {
        if (event.key === "Escape") { event.preventDefault(); this.back(); }
        if (event.key === "Enter") { event.preventDefault(); this.start("room.join"); }
        if (event.key === "Tab") { event.preventDefault(); this.roomInput?.input.blur(); this.controls.stepFocus("arena_room_code", event.shiftKey); }
      }, true); this.roomInput.input.value = this.roomValue;
      this.roomInput.input.addEventListener("focus", () => this.controls.restoreFocus("arena_room_code"));
      this.controls.restoreFocus("arena_room_code");
    }
    if (this.roomInput) this.roomInput.input.disabled = this.pending;
  }
}
