import Phaser from "phaser";
import { validateDeck } from "rules";
import type { ArenaStats, HonorShopItemDef } from "rules";
import { errorText } from "../account";
import { api } from "../api";
import { NetMatch } from "../net/match";
import { NetSocket } from "../net/socket";
import type { ServerMessage } from "../net/protocol";
import { session } from "../session";
import { COLORS, TEXT_BASE, useDesignCamera } from "../ui/theme";
import { addButton, addCurrencyBar, addText } from "../ui/widgets";
import { describeDeckError } from "./deck-select-scene";

const WIDTH = 1280;

/** `GET /api/arena/me` (`16` §8.8). */
interface ArenaMeReply {
  arena: ArenaStats;
  tier: { id: string; name: string; minRating: number } | null;
  honorToday: { gained: number; cap: number };
  honorShop: HonorShopItemDef[];
  tiers: { id: string; name: string; minRating: number }[];
}

interface ArenaHistoryEntry {
  matchId: string;
  mode: string;
  opponent: string | null;
  result: string | null;
  ratingDelta: number | null;
  createdAt: number;
}

interface LeaderboardEntry {
  rank: number | null;
  username: string;
  rating: number;
  tier: { id: string; name: string; minRating: number } | null;
  wins: number;
  losses: number;
  rankedGames: number;
}

const MODE_LABELS: Record<string, string> = { ranked: "Xếp hạng", private: "Phòng riêng", practice: "Đấu Tập" };
const RESULT_LABELS: Record<string, string> = { won: "Thắng", lost: "Thua", draw: "Hòa" };
/** Spec §7.1 — the queue hints at Đấu Tập once the wait crosses this. */
const PRACTICE_HINT_SECONDS = 90;

/**
 * Full arena lobby (5d.3, `17` §7.1): rating/tier, ranked queue with a live
 * wait timer, private rooms by code, Đấu Tập, history, leaderboard and the
 * Vinh Dự shop. Only saved decks pass — the server resolves them by id.
 */
export class ArenaScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private status: Phaser.GameObjects.Text | null = null;
  private deckIndex = 0;
  private roomCode: string | null = null;
  private roomPlayers = 0;
  private me: ArenaMeReply | null = null;
  /** Ranked queue state — driven by `queue.status`, not a local clock. */
  private queued = false;
  private waitingSeconds = 0;
  private panel: "history" | "leaderboard" | null = null;
  private history: ArenaHistoryEntry[] | null = null;
  private leaderboard: { entries: LeaderboardEntry[]; me: LeaderboardEntry | null } | null = null;

  constructor() {
    super("arena");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.deckIndex = 0;
    this.roomCode = session.roomCode;
    this.roomPlayers = 0;
    this.me = null;
    this.queued = false;
    this.waitingSeconds = 0;
    this.panel = null;
    this.history = null;
    this.leaderboard = null;
    session.net ??= new NetSocket();
    const net = session.net;
    net.onMessage = (message) => this.onMessage(message);
    net.onStatus = (connected) => {
      if (!connected) this.queued = false; // the server drops the queue on disconnect
      this.setStatus(connected ? "Đã kết nối." : "Mất kết nối — đang kết nối lại…");
      this.render();
    };
    net.onRejoin = (snapshot) => {
      session.match = session.match?.matchId === snapshot.matchId ? session.match : new NetMatch(net, snapshot);
      session.match!.rejoin(snapshot);
      this.scene.start("combat");
    };
    net.connect();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      net.onMessage = () => {};
      net.onStatus = () => {};
      // Never leave a stranded queue entry when navigating away mid-wait.
      if (this.queued) net.send({ type: "queue.leave" });
    });
    this.render();
    this.refreshArena();
  }

  private setStatus(text: string): void {
    this.status?.setText(text);
  }

  private refreshArena(): void {
    api<ArenaMeReply>("GET", "/arena/me").then(
      (me) => {
        this.me = me;
        if (this.scene.isActive()) this.render();
      },
      (error: unknown) => this.setStatus(`Lỗi hồ sơ Đấu Trường: ${errorText(error)}`),
    );
  }

  /** Saved decks only — `starter:` pseudo-decks are unknown to the server. */
  private decks() {
    return session.profile.decks;
  }

  private selectedDeck() {
    const decks = this.decks();
    if (decks.length === 0) return null;
    return decks[Math.min(this.deckIndex, decks.length - 1)]!;
  }

  /** PvP rules check for the deck button states (`17` §7.2). */
  private pvpErrors(deckId: string) {
    const deck = this.decks().find((d) => d.id === deckId);
    if (!deck) return [{ code: "badHeroes" } as const];
    return validateDeck(session.data, session.profile, deck, { mode: "pvp" });
  }

  private onMessage(message: ServerMessage): void {
    switch (message.type) {
      case "queue.status":
        this.queued = true;
        this.waitingSeconds = message.waitingSeconds;
        this.render();
        break;
      case "room.created":
      case "room.updated":
        this.roomCode = message.code;
        this.roomPlayers = message.players.length;
        session.roomCode = message.code;
        this.render();
        break;
      case "room.closed":
        this.roomCode = null;
        this.roomPlayers = 0;
        session.roomCode = null;
        this.setStatus("Phòng đã đóng.");
        this.render();
        break;
      case "match.start":
        this.queued = false;
        session.roomCode = null;
        session.match = new NetMatch(session.net!, message);
        this.scene.start("combat");
        break;
      case "error":
        // Every error but "already in queue" means the join never landed.
        if (message.error !== "already in queue") this.queued = false;
        this.setStatus(`Lỗi: ${errorText(message.error)}`);
        this.render();
        break;
      default:
        if ("matchId" in message) session.match?.handle(message);
        break;
    }
  }

  private leaveQueue(): void {
    this.queued = false;
    session.net?.send({ type: "queue.leave" });
    this.render();
  }

  private render(): void {
    this.root.removeAll(true);
    addText(this, this.root, WIDTH / 2, 26, "Đấu Trường", 26, COLORS.gold).setOrigin(0.5);
    addButton(this, this.root, 90, 26, 140, "◂ Chọn deck", () => this.scene.start("deck-select"));
    addCurrencyBar(this, this.root, 200, 26, session.profile.currencies);
    addButton(this, this.root, 1185, 26, 140, "Ngắt kết nối", () => {
      session.net?.close();
      session.net = null;
      this.scene.start("deck-select");
    });

    this.renderStats();
    this.renderDecks();
    this.renderActions();
    this.status = addText(this, this.root, WIDTH / 2, 636, "", 14, COLORS.dimText).setOrigin(0.5);
    this.setStatus(session.net?.connected ? "Đã kết nối." : "Đang kết nối…");
    if (this.panel === "history") this.renderHistory();
    if (this.panel === "leaderboard") this.renderLeaderboard();
  }

  private renderStats(): void {
    const me = this.me;
    const arena = me?.arena ?? session.profile.arena;
    const tier = me?.tier?.name ?? "—";
    addText(this, this.root, 40, 70, `Điểm: ${arena.rating} · ${tier}`, 18, COLORS.gold);
    addText(
      this, this.root, 40, 96,
      `Thắng ${arena.wins} · Thua ${arena.losses} · Hòa ${arena.draws} — ${arena.rankedGames} trận xếp hạng`,
      13, COLORS.dimText,
    );
    const today = me?.honorToday ?? { gained: 0, cap: 120 };
    addText(this, this.root, 40, 118, `Vinh Dự hôm nay: ${today.gained}/${today.cap} ❖`, 13, COLORS.dimText);
  }

  private renderDecks(): void {
    const decks = this.decks();
    if (decks.length === 0) {
      addText(this, this.root, WIDTH / 2, 300, "Cần một deck đã lưu — hãy tạo deck ở màn Chọn deck trước.", 15, "#ff8080").setOrigin(0.5);
      return;
    }
    this.deckIndex = Math.min(this.deckIndex, decks.length - 1);
    addText(this, this.root, WIDTH / 2, 150, "Deck đấu (kiểm tra theo luật PvP):", 13, COLORS.dimText).setOrigin(0.5);
    const data = session.data;
    decks.forEach((deck, index) => {
      const picked = index === this.deckIndex;
      const y = 182 + index * 40;
      const errors = this.pvpErrors(deck.id);
      const heroes = deck.heroIds.map((id) => data.heroes[id]?.name ?? id).join(" · ");
      const row = this.add.rectangle(WIDTH / 2, y, 700, 34, picked ? 0x2a3a70 : 0x141b33);
      row.setStrokeStyle(1, picked ? COLORS.goldFill : COLORS.panelBorder);
      row.setInteractive({ useHandCursor: true });
      row.on("pointerup", () => {
        this.deckIndex = index;
        this.render();
      });
      this.root.add(row);
      addText(this, this.root, WIDTH / 2 - 336, y, `${picked ? "◉ " : ""}${deck.name} · ${heroes}`, 13).setOrigin(0, 0.5);
      addText(this, this.root, WIDTH / 2 + 336, y, errors.length === 0 ? "✓ PvP" : `⚠ ${describeDeckError(data, errors[0]!)}`, 12, errors.length === 0 ? COLORS.gold : "#ff8080").setOrigin(1, 0.5);
    });
  }

  private renderActions(): void {
    const deck = this.selectedDeck();
    const valid = deck !== null && this.pvpErrors(deck.id).length === 0;
    const deckId = deck?.id ?? "";
    const send = (msg: unknown) => session.net?.send(msg);

    if (this.queued) {
      const seconds = Math.floor(this.waitingSeconds % 60).toString().padStart(2, "0");
      addText(this, this.root, 400, 428, `Đang tìm trận xếp hạng · ${Math.floor(this.waitingSeconds / 60)}:${seconds}`, 15, COLORS.gold).setOrigin(0.5);
      addButton(this, this.root, 400, 470, 220, "Hủy tìm trận", () => this.leaveQueue());
      if (this.waitingSeconds >= PRACTICE_HINT_SECONDS) {
        addText(this, this.root, 400, 508, "Chờ lâu quá? Thử Đấu Tập với máy trong lúc chờ.", 12, COLORS.dimText).setOrigin(0.5);
      }
    } else {
      addButton(this, this.root, 400, 470, 220, "Xếp hạng", () => {
        this.queued = true;
        this.waitingSeconds = 0;
        send({ type: "queue.join", mode: "ranked", deckId });
        this.render();
      }, valid);
    }
    addButton(this, this.root, 640, 470, 220, "Tạo phòng riêng", () =>
      send({ type: "room.create", mode: "pvp", deckId }), valid);
    addButton(this, this.root, 880, 470, 220, "Vào phòng (mã)", () => {
      const code = window.prompt("Mã phòng 6 ký tự:")?.trim().toUpperCase();
      if (code) send({ type: "room.join", code, deckId });
    }, valid);

    addButton(this, this.root, 400, 518, 220, "Đấu Tập (máy)", () =>
      send({ type: "practice.start", mode: "pvp", deckId }), valid);
    addButton(this, this.root, 640, 518, 220, "Lịch sử", () => this.openPanel("history"));
    addButton(this, this.root, 880, 518, 220, "Bảng xếp hạng", () => this.openPanel("leaderboard"));
    addButton(this, this.root, 1110, 518, 200, "Cửa hàng Vinh Dự", () => this.scene.start("shop", { tab: "honor", back: "arena" }));

    if (this.roomCode) {
      addText(this, this.root, 640, 560, `Phòng ${this.roomCode} · ${this.roomPlayers}/2 — gửi mã cho bạn bè.`, 14, COLORS.gold).setOrigin(0.5);
      addButton(this, this.root, 880, 560, 140, "Rời phòng", () => {
        session.net?.send({ type: "room.leave" });
        this.roomCode = null;
        this.roomPlayers = 0;
        session.roomCode = null;
        this.render();
      });
    }
  }

  private openPanel(panel: "history" | "leaderboard"): void {
    this.panel = panel;
    if (panel === "history") {
      api<{ entries: ArenaHistoryEntry[] }>("GET", "/arena/history").then(
        (reply) => {
          this.history = reply.entries;
          if (this.scene.isActive()) this.render();
        },
        (error: unknown) => this.setStatus(`Lỗi lịch sử: ${errorText(error)}`),
      );
    } else {
      api<{ entries: LeaderboardEntry[]; me: LeaderboardEntry | null }>("GET", "/arena/leaderboard").then(
        (reply) => {
          this.leaderboard = reply;
          if (this.scene.isActive()) this.render();
        },
        (error: unknown) => this.setStatus(`Lỗi bảng xếp hạng: ${errorText(error)}`),
      );
    }
    this.render();
  }

  private panelShell(title: string): Phaser.GameObjects.Container {
    const layer = this.add.container(0, 0).setDepth(300);
    this.root.add(layer);
    layer.add(this.add.rectangle(WIDTH / 2, 360, WIDTH, 720, 0x000000, 0.85).setInteractive());
    layer.add(this.add.rectangle(WIDTH / 2, 360, 1000, 560, 0x0f1530).setStrokeStyle(1, COLORS.panelBorder));
    addText(this, layer, WIDTH / 2, 96, title, 20, COLORS.gold).setOrigin(0.5);
    addButton(this, layer, WIDTH / 2, 660, 200, "Đóng", () => {
      this.panel = null;
      this.render();
    });
    return layer;
  }

  private renderHistory(): void {
    const layer = this.panelShell("Lịch sử trận");
    const entries = this.history;
    if (entries === null) {
      addText(this, layer, WIDTH / 2, 360, "Đang tải…", 15, COLORS.dimText).setOrigin(0.5);
      return;
    }
    if (entries.length === 0) {
      addText(this, layer, WIDTH / 2, 360, "Chưa có trận nào.", 15, COLORS.dimText).setOrigin(0.5);
      return;
    }
    entries.slice(0, 14).forEach((entry, index) => {
      const y = 140 + index * 36;
      const mode = MODE_LABELS[entry.mode] ?? entry.mode;
      const opponent = entry.opponent ?? "Vọng Nguyệt (máy)";
      const result = RESULT_LABELS[entry.result ?? ""] ?? "—";
      const delta = entry.ratingDelta === null ? "" : `  ${entry.ratingDelta >= 0 ? "+" : ""}${entry.ratingDelta}đ`;
      const when = new Date(entry.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const color = entry.result === "won" ? COLORS.gold : entry.result === "lost" ? "#cc8888" : COLORS.dimText;
      layer.add(this.add.text(180, y, `${mode} · vs ${opponent} — ${result}${delta} · ${when}`, { ...TEXT_BASE, fontSize: "13px", color }).setOrigin(0, 0.5));
    });
  }

  private renderLeaderboard(): void {
    const layer = this.panelShell("Bảng xếp hạng");
    const board = this.leaderboard;
    if (board === null) {
      addText(this, layer, WIDTH / 2, 360, "Đang tải…", 15, COLORS.dimText).setOrigin(0.5);
      return;
    }
    if (board.entries.length === 0) {
      addText(this, layer, WIDTH / 2, 300, "Chưa ai đủ 5 trận xếp hạng.", 15, COLORS.dimText).setOrigin(0.5);
    }
    board.entries.slice(0, 12).forEach((entry, index) => {
      const y = 140 + index * 32;
      layer.add(
        this.add.text(
          180, y,
          `#${entry.rank}  ${entry.username}  ·  ${entry.rating} điểm · ${entry.tier?.name ?? "—"}  ·  ${entry.wins}T–${entry.losses}B`,
          { ...TEXT_BASE, fontSize: "13px", color: COLORS.text },
        ).setOrigin(0, 0.5),
      );
    });
    if (board.me) {
      const me = board.me;
      addText(
        this, layer, WIDTH / 2, 560,
        me.rank === null
          ? `Bạn: ${me.rating} điểm · ${me.tier?.name ?? "—"} — cần ${5 - me.rankedGames} trận nữa để lên bảng`
          : `Bạn: #${me.rank} · ${me.rating} điểm · ${me.tier?.name ?? "—"} · ${me.wins}T–${me.losses}B`,
        14, COLORS.gold,
      ).setOrigin(0.5);
    }
  }
}
