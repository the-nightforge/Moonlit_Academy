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
import { prepareCombatAssets } from "../ui/combat-assets";
import { loadCombatSettings } from "../ui/combat-settings";
import { API_ERROR_TEXT, COLORS, RENDER_SCALE, useDesignCamera, visibleWorld } from "../ui/theme";
import { addText, isModalOpen, RowScroller, showToast, type ButtonOptions } from "../ui/widgets";
import { HomeControls } from "../ui/home-controls";
import { preloadActionIcons, type ActionIcon } from "../ui/action-icon";
import { roundedPanel } from "../ui/rounded-panel";
import { roundedArtTexture, ellipsize } from "../ui/combat-card-view";
import { addEquipmentArt, preloadEquipmentArt } from "../ui/equipment-art";
import { matchesDeckText, summarizeDeck } from "../ui/deck-presentation";
import { showTextTooltip } from "../ui/card-tooltip";
import { arenaActionReason, formatQueueTime, rankProgress, RequestIdentity, type ArenaTier } from "../ui/arena-presentation";
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

  constructor() { super("arena"); }
  preload() {
    preloadActionIcons(this); preloadEquipmentArt(this);
    const selectedIndex = savedLobbyDeckIndex(session.profile.decks, session.selectedDeckId);
    const heroIds = selectedIndex < 0 ? [] : session.profile.decks[selectedIndex]?.heroIds ?? [];
    const selected = { backgrounds: ["home", "background"], heroes: heroIds, ui: ["mode_arena", "mode_practice", "mode_private", "nav_leaderboard", "nav_history", "nav_shop", "cur_moonJade", "cur_moonStar", "cur_honor", "rank_dong_sinh", "rank_tu_tai", "rank_cu_nhan", "rank_tien_si", "rank_trang_nguyen", "check", "lock"] };
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
    this.roomCode = session.roomCode; this.roomPlayers = [];
    this.me = null; this.queued = false; this.pending = false; this.waitingSeconds = 0;
    this.mode = this.roomCode ? "private" : "ranked";
    this.panel = null; this.panelOpener = null; this.history = null; this.leaderboard = null;
    this.error = ""; this.notice = ""; this.profileError = ""; this.panelError = "";
    this.deckQuery = ""; this.roomValue = "";
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
    const onEsc = () => { if (!isModalOpen()) this.back(); };
    this.input.keyboard?.on("keydown-ESC", onEsc);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++; this.panelRequests.next(); this.profileRequests.next();
      this.input.keyboard?.off("keydown-ESC", onEsc);
      this.search?.destroy(); this.search = null; this.roomInput?.destroy(); this.roomInput = null; this.hideTip();
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
    prepareCombatAssets(this).then(({ failed }) => {
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
      case "queue.status":
        if (!this.queued) return; // reject status already in flight after cancellation
        this.pending = false; this.waitingSeconds = message.waitingSeconds; this.render(); break;
      case "room.created": case "room.updated":
        if (!this.roomCode && !(this.pending && this.mode === "private")) return;
        if (this.roomCode && this.roomCode !== message.code) return;
        this.pending = false; this.queued = false; this.roomCode = message.code; this.roomPlayers = message.players;
        this.mode = "private"; session.roomCode = message.code; this.render(); break;
      case "room.closed":
        if (this.roomCode !== message.code) return;
        this.pending = false; this.roomCode = null; this.roomPlayers = []; session.roomCode = null; this.notice = "Phòng đã đóng."; this.render(); break;
      case "match.start":
        this.queued = false; this.pending = false; session.roomCode = null;
        session.match = new NetMatch(session.net!, message); session.registry?.retain(session.match); this.scene.start("combat"); break;
      case "error":
        if (message.error !== "already in queue") this.queued = false;
        this.pending = false; this.error = `Lỗi: ${API_ERROR_TEXT[message.error] ?? message.error}`; this.render(); break;
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
    this.mode = mode; this.notice = ""; this.render();
    if (!this.reducedMotion) {
      const content = this.root.getByName("arena_mode_content");
      if (content) { (content as Phaser.GameObjects.Container).setAlpha(0.65); this.tweens.add({ targets: content, alpha: 1, duration: 140 }); }
    }
  }
  private start(type: "queue.join" | "practice.start" | "room.create" | "room.join") {
    if (this.actionReason()) return;
    if (type === "room.join" && !/^[A-Z0-9]{6}$/.test(this.roomValue)) { this.error = "Mã phòng cần 6 ký tự A–Z hoặc 0–9."; this.render(); return; }
    const deckId = this.selectedDeck()!.id;
    this.error = ""; this.notice = ""; this.pending = true;
    if (type === "queue.join") { this.queued = true; this.waitingSeconds = 0; session.net!.send({ type, mode: "ranked", deckId }); }
    else if (type === "room.join") session.net!.send({ type, code: this.roomValue, deckId });
    else session.net!.send({ type, mode: "pvp", deckId });
    this.render();
  }
  private hideTip() { this.tooltip?.destroy(); this.tooltip = null; }
  private tip(hit: Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle }, lines: string[]) {
    this.hideTip(); const b = hit.getBounds();
    this.tooltip = showTextTooltip(this, b.centerX - 160, b.bottom + 8, lines, 320, 13).setDepth(1500);
  }
  private text(parent: Phaser.GameObjects.Container, x: number, y: number, value: string, size = 14, color: string = COLORS.text, width?: number) {
    const text = addText(this, parent, x, y, value, size, color); if (width) text.setWordWrapWidth(width); return text;
  }
  private fit(parent: Phaser.GameObjects.Container, x: number, y: number, value: string, width: number, size = 14, color: string = COLORS.text) {
    const short = ellipsize(this, value, width, size, 1), text = this.text(parent, x, y, short, size, color);
    if (short !== value) this.controls.info(text, () => this.tip(text, [value]), () => this.hideTip()); return text;
  }
  private button(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, name: string, action: () => void, enabled = true, options: ButtonOptions = {}, icon?: string, onFocus?: () => void) {
    const c = this.controls.button(parent, x, y, width, label, enabled, options);
    c.hit.setName(name).setData("actionLabel", label); c.panel.setData("actionLabel", label);
    if (icon) { this.art(c.panel, icon, -width / 2 + 26, 0, 28); (c.panel.list[3] as Phaser.GameObjects.Text).setX(12); }
    this.controls.bind(c.hit, c.panel, { enabled, activate: action, fill: c.fill, border: c.border, radius: 9,
      onFocus, showTip: onFocus && enabled ? undefined : () => this.tip(c.hit, [enabled ? label : options.disabledReason ?? label]), hideTip: () => this.hideTip() }); return c;
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
    this.hideTip(); this.root.removeAll(true); this.controls.setLayer(this.root);
    this.iconButton(this.root, 62, 42, "back", "Về trang chủ", "arena_back", () => this.back());
    this.text(this.root, 100, 42, "Đấu Trường", 26, COLORS.gold).setOrigin(0, 0.5);
    for (const [index, [key, value]] of Object.entries(session.profile.currencies).filter(([key]) => ["moonJade", "moonStar", "honor"].includes(key)).entries()) {
      const chip = roundedPanel(this, 874 + index * 142, 42, 130, 40, 0x0b1729, 0.94, 0x536279, 10);
      this.root.add(chip); this.art(chip, `ui:cur_${key}`, -44, 0, 28);
      this.text(chip, -20, 0, new Intl.NumberFormat("vi-VN", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value), 15).setOrigin(0, 0.5);
    }
    this.root.add(roundedPanel(this, 172, 350, 264, 500, 0x0c192a, 0.96, 0x5a6b85, 16));
    this.root.add(roundedPanel(this, 592, 350, 528, 500, 0x0c192a, 0.96, 0x5a6b85, 16));
    this.root.add(roundedPanel(this, 1060, 350, 360, 500, 0x0c192a, 0.96, 0x5a6b85, 16));
    this.renderStats(); this.renderDeck(); this.renderModes();
    this.button(this.root, 260, 656, 210, "Lịch sử", "arena_history", () => this.openPanel("history"), true, {}, "ui:nav_history");
    this.button(this.root, 580, 656, 250, "Bảng xếp hạng", "arena_leaderboard", () => this.openPanel("leaderboard"), true, {}, "ui:nav_leaderboard");
    this.button(this.root, 936, 656, 280, "Cửa hàng Vinh Dự", "arena_honor_shop", () => this.scene.start("shop", { tab: "honor", back: "arena" }), !this.pending, {}, "ui:nav_shop");
    this.text(this.root, 640, 698, session.net?.connected ? "Đã kết nối" : "Mất kết nối — đang kết nối lại…", 12, session.net?.connected ? COLORS.dimText : "#ffb0b0").setOrigin(0.5);
    this.iconButton(this.root, 1214, 656, "more", "Ngắt kết nối", "arena_disconnect", () => { session.net?.close(); session.net = null; this.scene.start("deck-select"); });
    if (this.panel) this.renderPanel(); this.syncInputs(); this.controls.restoreFocus(nativeFocus() ?? focusedName);
  }
  private renderStats() {
    const arena = this.me?.arena ?? session.profile.arena, tier = this.me?.tier;
    this.text(this.root, 172, 128, "XẾP HẠNG", 14, COLORS.dimText).setOrigin(0.5);
    this.art(this.root, `ui:rank_${tier?.id ?? session.rank?.tierId ?? "dong_sinh"}`, 172, 210, 116);
    this.text(this.root, 172, 284, tier?.name ?? session.rank?.tierName ?? "Đang tải hạng…", 21, COLORS.gold).setOrigin(0.5);
    this.text(this.root, 172, 318, `${arena.rating} điểm`, 19).setOrigin(0.5);
    const progress = rankProgress(arena.rating, this.me?.tiers ?? []);
    if (this.profileError) this.fit(this.root, 62, 352, this.profileError, 210, 12, "#ffb0b0");
    else {
      const label = this.text(this.root, 62, 352, this.me?.tiers?.length ? progress.next ? `Còn ${progress.remaining} điểm đến ${progress.next.name}` : "Hạng cao nhất" : "Đang tải ngưỡng hạng…", 13, COLORS.dimText, 220);
      this.controls.info(label, () => this.tip(label, ["Xếp hạng dùng deck đã lưu và luật PvP.", "Điểm thay đổi sau trận xếp hạng; đấu tập và phòng riêng không đổi điểm."]), () => this.hideTip());
    }
    if (progress.next && this.me?.tiers?.length && !this.profileError) {
      this.root.add(this.add.rectangle(172, 399, 220, 8, 0x28354c));
      this.root.add(this.add.rectangle(62, 399, 220 * progress.fraction, 8, 0xc8ad73).setOrigin(0, 0.5));
    }
    [arena.wins, arena.losses, arena.draws].forEach((value, i) => {
      this.text(this.root, 95 + i * 77, 438, String(value), 23).setOrigin(0.5);
      this.text(this.root, 95 + i * 77, 466, ["Thắng", "Thua", "Hòa"][i]!, 13, COLORS.dimText).setOrigin(0.5);
    });
    const today = this.me?.honorToday;
    this.art(this.root, "ui:cur_honor", 82, 518, 32);
    this.text(this.root, 110, 504, "Vinh Dự hôm nay", 13, COLORS.dimText);
    this.text(this.root, 110, 526, today ? `${today.gained} / ${today.cap}` : "Đang tải…", 17);
    this.text(this.root, 62, 564, today && today.gained >= today.cap ? "Đã đạt giới hạn hôm nay" : `${arena.rankedGames} trận xếp hạng`, 12, COLORS.dimText, 220);
    if (this.profileError) {
      this.button(this.root, 172, 392, 170, "Tải lại hồ sơ", "arena_profile_retry", () => { this.refreshArena(); this.render(); });
    }
  }
  private renderDeck() {
    const deck = this.selectedDeck(), locked = this.queued || this.pending || !!this.roomCode;
    this.text(this.root, 352, 124, "BỘ BÀI XUẤT TRẬN", 14, COLORS.dimText);
    this.button(this.root, 704, 132, 168, "Đổi deck", "arena_deck_change", () => this.openPanel("decks"), !locked, { disabledReason: "Rời hàng chờ hoặc phòng để đổi deck" });
    this.iconButton(this.root, 818, 132, "edit", "Chỉnh sửa deck", "arena_deck_edit", () => {
      const current = this.selectedDeck(); if (!current || locked) return;
      session.editingDeck = structuredClone(current); this.scene.start("deck-builder", { back: "arena" });
    }, !!deck && !locked, "Chọn deck và rời hàng chờ hoặc phòng để chỉnh sửa");
    if (!deck) {
      this.art(this.root, "ui:mode_arena", 592, 320, 140);
      this.text(this.root, 592, 420, this.decks().length ? "Chọn bộ bài đã lưu để xuất trận" : "Cần một bộ bài đã lưu để vào trận.", 17, COLORS.text, 450).setOrigin(0.5);
      this.button(this.root, 592, 478, 250, this.decks().length ? "Chọn deck" : "Tạo deck", "arena_deck_empty", () => this.decks().length ? this.openPanel("decks") : this.scene.start("deck-select", { newDeck: true })); return;
    }
    const name = this.text(this.root, 352, 166, ellipsize(this, deck.name, 476, 20, 2), 20, COLORS.text, 476);
    this.controls.info(name, () => this.tip(name, [deck.name]), () => this.hideTip());
    deck.heroIds.slice(0, 3).forEach((id, i) => {
      const x = 429 + i * 163, hero = session.data.heroes[id];
      this.root.add(roundedPanel(this, x, 340, 146, 238, 0x15243a, 1, 0x65748e, 12));
      const artKey = roundedArtTexture(this, `heroes:${id}`, 146, 192, 12);
      if (this.textures.exists(artKey)) this.root.add(this.add.image(x, 318, artKey).setScale(1 / RENDER_SCALE));
      else this.text(this.root, x, 314, "Chưa có hình Hero", 12, COLORS.dimText).setOrigin(0.5);
      this.fit(this.root, x - 63, 430, hero?.name ?? id, 126, 13);
      const weapon = deck.weapons?.[id];
      if (weapon) addEquipmentArt(this, this.root, "weapons", weapon, x - 51, 485, 34, 34);
      this.fit(this.root, x - 26, 479, weapon ? session.data.weapons[weapon]?.name ?? weapon : "Chưa có vũ khí", 99, 11, COLORS.dimText);
    });
    const summary = summarizeDeck(session.data, deck, { mode: "pvp" });
    this.text(this.root, 352, 512, `${summary.slots} ô deck · ${summary.copies} lá trong chồng bài`, 14, COLORS.dimText);
    (deck.relicIds ?? []).slice(0, 2).forEach((id, i) => { if (id) addEquipmentArt(this, this.root, "relics", id, 789 + i * 34, 519, 28, 28); });
    const errors = this.pvpErrors(deck.id);
    this.art(this.root, errors.length ? "ui:lock" : "ui:check", 365, 550, 24);
    const validation = this.text(this.root, 385, 539, errors.length ? "Cần chỉnh sửa" : "Hợp lệ PvP", 15, errors.length ? "#ffb0b0" : "#94d9bb");
    this.controls.info(validation, () => this.tip(validation, errors.length ? errors.map(error => describeDeckError(session.data, error)) : ["Hợp lệ theo luật PvP", "Vũ khí dùng Tinh Luyện 1 trong PvP"]), () => this.hideTip());
    if (errors.length) this.button(this.root, 730, 553, 200, "Xem lỗi deck", "arena_deck_validation", () => this.openPanel("validation"));
  }
  private renderModes() {
    const content = this.add.container(0, 0).setName("arena_mode_content"); this.root.add(content);
    const modes: Mode[] = ["ranked", "practice", "private"];
    modes.forEach((mode, i) => {
      const c = this.button(content, 1060, 136 + i * 50, 312, MODE_LABELS[mode]!, `arena_mode_${mode}`, () => this.changeMode(mode), !this.pending || this.queued, { variant: this.mode === mode ? "primary" : "secondary", disabledReason: "Đang gửi yêu cầu…" }, `ui:mode_${mode === "ranked" ? "arena" : mode}`);
      c.hit.setData("selected", this.mode === mode);
    });
    const reason = this.actionReason();
    const description = this.mode === "ranked" ? "Đấu với người chơi, thay đổi điểm xếp hạng" : this.mode === "practice" ? "Luyện với máy, không đổi điểm và không nhận Vinh Dự" : "Đấu cùng bạn bè bằng mã phòng, không đổi điểm xếp hạng";
    this.text(content, 904, 277, description, 15, COLORS.dimText, 308);
    if (this.roomCode) {
      this.text(content, 918, 349, this.roomCode, 28, COLORS.gold);
      this.iconButton(content, 1196, 367, "copy", "Sao chép mã phòng", "arena_room_copy", () => {
        const code = this.roomCode, generation = this.generation; if (!code) return;
        void navigator.clipboard.writeText(code).then(() => {
          if (this.isCurrent(generation) && this.roomCode === code) { this.notice = "Đã sao chép mã phòng"; this.render(); }
        }, () => { if (this.isCurrent(generation) && this.roomCode === code) { this.error = "Không sao chép được — chọn và sao chép mã phòng."; this.render(); } });
      });
      for (let i = 0; i < 2; i++) this.fit(content, 918, 409 + i * 30, this.roomPlayers[i]?.username ?? (i === 0 ? "Bạn" : "Đang chờ đối thủ…"), 276, 15, this.roomPlayers[i] ? COLORS.text : COLORS.dimText);
      this.text(content, 918, 472, `${this.roomPlayers.length || 1}/2 người · tự vào trận khi đủ người`, 12, COLORS.dimText);
      this.button(content, 1060, 518, 300, "Rời phòng", "arena_room_leave", () => this.leaveRoom());
    } else if (this.queued) {
      const icon = this.art(content, "ui:mode_arena", 1060, 366, 62);
      if (icon && !this.reducedMotion) {
        this.tweens.add({ targets: icon, alpha: 0.65, duration: 1100, yoyo: true, repeat: -1 });
        icon.once("destroy", () => this.tweens.killTweensOf(icon));
      }
      this.text(content, 1060, 426, `Đang tìm đối thủ · ${formatQueueTime(this.waitingSeconds)}`, 16, COLORS.gold).setOrigin(0.5);
      this.button(content, 1060, 481, 300, "Hủy tìm trận", "arena_queue_cancel", () => this.leaveQueue());
      if (this.waitingSeconds >= 90) {
        this.button(content, 1060, 531, 300, "Chuyển sang Đấu tập", "arena_queue_practice", () => this.changeMode("practice"));
        this.text(content, 1060, 557, "Sẽ hủy tìm trận xếp hạng", 12, COLORS.dimText).setOrigin(0.5);
      }
    } else if (this.mode === "private") {
      this.button(content, 1060, 365, 300, "Tạo phòng riêng", "arena_room_create", () => this.start("room.create"), !reason, { disabledReason: reason, variant: "primary" });
      this.text(content, 918, 405, "Hoặc nhập mã bạn bè gửi", 13, COLORS.dimText);
      const focusField = () => this.roomInput?.input.focus();
      this.button(content, 1060, 456, 300, "Mã phòng", "arena_room_code", focusField, !this.pending, {}, undefined, focusField);
      this.button(content, 1060, 499, 300, "Vào phòng", "arena_room_join", () => this.start("room.join"), !reason && /^[A-Z0-9]{6}$/.test(this.roomValue), { disabledReason: reason || "Mã phòng cần 6 ký tự" });
    } else {
      this.art(content, `ui:mode_${this.mode === "ranked" ? "arena" : "practice"}`, 1060, 377, 96);
      this.button(content, 1060, 478, 300, this.mode === "ranked" ? "Tìm trận xếp hạng" : "Bắt đầu đấu tập", this.mode === "ranked" ? "arena_ranked_start" : "arena_practice_start", () => this.start(this.mode === "ranked" ? "queue.join" : "practice.start"), !reason, { disabledReason: reason, variant: "primary" });
    }
    if (this.assetState === "error") {
      this.text(content, 904, 559, `Lỗi tải hình (${this.assetFailed} tệp)`, 12, "#ffb0b0");
      this.button(content, 1173, 565, 110, "Thử lại", "arena_assets_retry", () => { this.assetState = "idle"; this.prepareAssets(); });
    } else if (reason && !this.queued && !this.roomCode) this.text(content, 904, 530, reason, 12, COLORS.dimText, 308);
    if (this.error || this.notice) {
      const message = this.error || this.notice;
      const text = this.fit(content, 904, 577, message, 308, 12, this.error ? "#ffb0b0" : "#94d9bb");
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
    const title = this.panel === "decks" ? "Chọn bộ bài đã lưu" : this.panel === "history" ? "Lịch sử trận" : this.panel === "validation" ? "Lỗi deck PvP" : "Bảng xếp hạng";
    this.text(layer, 148, 95, title, 23, COLORS.gold);
    this.iconButton(layer, 1118, 104, "close", "Đóng", "arena_modal_close", () => this.closePanel());
    if (this.panelError) {
      this.text(layer, 640, 315, this.panelError, 17, "#ffb0b0", 800).setOrigin(0.5);
      this.button(layer, 640, 390, 220, "Thử lại", "arena_modal_retry", () => this.openPanel(this.panel!)); return;
    }
    if (this.panel === "decks") {
      const focusField = () => this.search?.input.focus();
      this.button(layer, 631, 167, 950, "Tìm tên bộ bài hoặc Hero", "arena_deck_search", focusField, true, {}, undefined, focusField);
      this.renderDeckSelector(layer); return;
    }
    if (this.panel === "validation") {
      const deck = this.selectedDeck(), errors = deck ? this.pvpErrors(deck.id).map(error => describeDeckError(session.data, error)) : [];
      const [first, last] = this.modalScroller.range(errors.length, 8);
      errors.slice(first, last).forEach((error, i) => this.text(layer, 160, 218 + i * 42, error, 15, "#ffb0b0", 960));
      this.scrollControls(layer, errors.length, 8); return;
    }
    const loading = this.panel === "history" ? this.history === null : this.leaderboard === null;
    if (loading) { this.text(layer, 640, 360, "Đang tải…", 17, COLORS.dimText).setOrigin(0.5); return; }
    if (this.panel === "history") this.renderHistory(layer); else this.renderLeaderboard(layer);
  }
  private scrollControls(layer: Phaser.GameObjects.Container, total: number, visible: number) {
    this.button(layer, 252, 607, 200, "Trang trước", "arena_scroll_prev", () => this.modalScroller.scrollBy(-visible), this.modalScroller.first > 0);
    this.text(layer, 640, 607, total ? `${this.modalScroller.first + 1}–${Math.min(total, this.modalScroller.first + visible)} / ${total}` : "0 mục", 13, COLORS.dimText).setOrigin(0.5);
    this.button(layer, 1028, 607, 200, "Trang sau", "arena_scroll_next", () => this.modalScroller.scrollBy(visible), this.modalScroller.first + visible < total);
  }
  private renderDeckSelector(layer: Phaser.GameObjects.Container) {
    const decks = this.decks().filter(deck => matchesDeckText(this.deckQuery, deck.name, ...deck.heroIds.map(id => session.data.heroes[id]?.name ?? id)));
    const [first, last] = this.modalScroller.range(decks.length, 7);
    decks.slice(first, last).forEach((deck, i) => {
      const y = 221 + i * 51, selected = deck.id === this.selectedDeck()?.id;
      const c = this.button(layer, 640, y, 964, "", `arena_deck_${deck.id}`, () => {
        if (this.queued || this.pending || this.roomCode) return;
        const index = this.decks().findIndex(current => current.id === deck.id); if (index < 0) return;
        this.deckIndex = index; session.selectedDeckId = deck.id; this.closePanel();
      }, true, { variant: selected ? "primary" : "secondary" });
      c.hit.setData("actionLabel", deck.name);
      this.fit(c.panel, -468, -13, deck.name, 640, 15);
      this.fit(c.panel, -468, 7, deck.heroIds.map(id => session.data.heroes[id]?.name ?? id).join(" · "), 640, 11, COLORS.dimText);
      this.text(c.panel, 468, 0, this.pvpErrors(deck.id).length ? "Cần chỉnh sửa" : "Hợp lệ PvP", 13, this.pvpErrors(deck.id).length ? "#ffb0b0" : "#94d9bb").setOrigin(1, 0.5);
    });
    if (!decks.length) this.text(layer, 640, 350, "Không có deck phù hợp.", 17, COLORS.dimText).setOrigin(0.5);
    this.scrollControls(layer, decks.length, 7);
  }
  private renderHistory(layer: Phaser.GameObjects.Container) {
    const entries = this.history!;
    [[160, "Kết quả"], [295, "Đối thủ"], [615, "Chế độ"], [795, "Điểm"], [927, "Thời gian"]].forEach(([x, label]) => this.text(layer, x as number, 164, label as string, 14, COLORS.dimText));
    const [first, last] = this.modalScroller.range(entries.length, 8);
    entries.slice(first, last).forEach((entry, i) => {
      const y = 218 + i * 42;
      layer.add(roundedPanel(this, 640, y + 9, 970, 38, i % 2 ? 0x14253b : 0x102037, 1, 0x283b55, 5));
      this.text(layer, 160, y, RESULT_LABELS[entry.result ?? ""] ?? "—", 14, entry.result === "won" ? "#94d9bb" : entry.result === "lost" ? "#ffb0b0" : COLORS.text);
      this.fit(layer, 295, y, entry.opponent ?? "Vọng Nguyệt (máy)", 290);
      this.text(layer, 615, y, MODE_LABELS[entry.mode] ?? entry.mode, 14);
      this.text(layer, 795, y, entry.ratingDelta === null ? "—" : `${entry.ratingDelta >= 0 ? "+" : ""}${entry.ratingDelta}`, 14);
      this.text(layer, 927, y, new Date(entry.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), 12);
    });
    if (!entries.length) this.text(layer, 640, 350, "Chưa có trận nào.", 17, COLORS.dimText).setOrigin(0.5);
    this.scrollControls(layer, entries.length, 8);
  }
  private renderLeaderboard(layer: Phaser.GameObjects.Container) {
    const board = this.leaderboard!;
    [[160, "Vị trí"], [250, "Người chơi"], [655, "Hạng"], [850, "Điểm"], [965, "Thắng / Thua"]].forEach(([x, label]) => this.text(layer, x as number, 164, label as string, 14, COLORS.dimText));
    const [first, last] = this.modalScroller.range(board.entries.length, 7);
    board.entries.slice(first, last).forEach((entry, i) => {
      const y = 218 + i * 42;
      layer.add(roundedPanel(this, 640, y + 9, 970, 38, entry.rank !== null && entry.rank <= 3 ? 0x2a3035 : 0x102037, 1, 0x283b55, 5));
      this.text(layer, 160, y, `#${entry.rank ?? "—"}`, 14, entry.rank !== null && entry.rank <= 3 ? COLORS.gold : COLORS.text);
      this.fit(layer, 250, y, entry.username, 355);
      this.art(layer, `ui:rank_${entry.tier?.id}`, 639, y + 7, 28);
      this.fit(layer, 662, y, entry.tier?.name ?? "—", 170, 13);
      this.text(layer, 850, y, String(entry.rating), 14);
      this.text(layer, 965, y, `${entry.wins} / ${entry.losses}`, 14);
    });
    if (!board.entries.length) this.text(layer, 640, 350, "Chưa ai đủ 5 trận xếp hạng.", 17, COLORS.dimText).setOrigin(0.5);
    if (board.me) {
      const me = board.me; layer.add(roundedPanel(this, 640, 554, 964, 44, 0x263d46, 1, 0x94d9bb, 8));
      this.text(layer, 170, 546, me.rank === null ? `Bạn: ${me.rating} điểm · ${Math.min(5, me.rankedGames)}/5 trận · Cần ${Math.max(0, 5 - me.rankedGames)} trận nữa để lên bảng` : `Bạn: #${me.rank} · ${me.rating} điểm · ${me.tier?.name ?? "—"} · ${me.wins} thắng / ${me.losses} thua`, 14, "#94d9bb");
    }
    this.scrollControls(layer, board.entries.length, 7);
  }
  private syncInputs() {
    if (this.panel !== "decks") { this.search?.destroy(); this.search = null; }
    else if (!this.search) {
      this.search = arenaInput(this, "vn-arena-search", "Tìm tên bộ bài hoặc Hero", { x: 156, y: 148, w: 950, h: 38 }, value => { this.deckQuery = value; this.modalScroller.first = 0; this.render(); }, event => {
        if (event.key === "Escape") { event.preventDefault(); this.closePanel(); }
        if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); this.search?.input.blur(); this.controls.stepFocus("arena_deck_search", event.key === "Tab" && event.shiftKey); }
      }); this.search.input.value = this.deckQuery;
      this.search.input.addEventListener("focus", () => this.controls.restoreFocus("arena_deck_search"));
      this.controls.restoreFocus("arena_deck_search");
    }
    const showRoom = this.mode === "private" && !this.roomCode && !this.panel;
    if (!showRoom) { this.roomInput?.destroy(); this.roomInput = null; }
    else if (!this.roomInput) {
      this.roomInput = arenaInput(this, "vn-arena-room-code", "Mã phòng 6 ký tự", { x: 910, y: 436, w: 300, h: 40 }, value => { this.roomValue = value; this.render(); }, event => {
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
