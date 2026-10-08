import Phaser from "phaser";
import { validateDeck } from "rules";
import { errorText } from "../account";
import { api } from "../api";
import { NetMatch } from "../net/match";
import { NetSocket } from "../net/socket";
import type { ServerMessage } from "../net/protocol";
import { session } from "../session";
import { COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addScreenHeader, addText, promptModal, showToast } from "../ui/widgets";
import { describeDeckError } from "./deck-select-scene";

const WIDTH = 1280;

/** `GET /api/coop/me` (`16` §8.9). */
interface CoopMeReply {
  clearsToday: number;
  rewardClaimsLeft: number;
}

/**
 * Liên Thủ lobby (`17` §9.3): the shared-turn raid lobby — queue, private
 * rooms by code, a bot partner for practice, and today's remaining reward
 * claims. Decks are checked with PvE rules — co-op uses the run loadout.
 */
export class CoopLobbyScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private status: Phaser.GameObjects.Text | null = null;
  private deckIndex = 0;
  private roomCode: string | null = null;
  private roomPlayers = 0;
  private me: CoopMeReply | null = null;
  private queued = false;
  private waitingSeconds = 0;

  constructor() {
    super("coop-lobby");
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
    session.net ??= new NetSocket();
    const net = session.net;
    net.onMessage = (message) => this.onMessage(message);
    net.onStatus = (connected) => {
      if (!connected) this.queued = false; // the server drops the queue on disconnect
      this.setStatus(connected ? "Đã kết nối." : "Mất kết nối — đang kết nối lại…");
      this.render();
    };
    net.onRecovery = (snapshot) => {
      if (snapshot === null) return; // no room — nothing to rejoin
      // registry.recover already rejoined a known match — never twice (`16` §8.4).
      if (session.match?.matchId !== snapshot.matchId) session.match = new NetMatch(net, snapshot);
      session.registry?.retain(session.match!);
      this.scene.start("combat");
    };
    net.connect();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      net.onMessage = () => {};
      net.onStatus = () => {};
      if (this.queued) net.send({ type: "queue.leave" });
    });
    this.render();
    showToast(this, session.notices.splice(0));
    this.refreshCoop();
  }

  private setStatus(text: string): void {
    this.status?.setText(text);
  }

  private refreshCoop(): void {
    api<CoopMeReply>("GET", "/coop/me").then(
      (me) => {
        this.me = me;
        if (this.scene.isActive()) this.render();
      },
      (error: unknown) => this.setStatus(`Lỗi hồ sơ Liên Thủ: ${errorText(error)}`),
    );
  }

  private decks() {
    return session.profile.decks;
  }

  private selectedDeck() {
    const decks = this.decks();
    if (decks.length === 0) return null;
    return decks[Math.min(this.deckIndex, decks.length - 1)]!;
  }

  /** Co-op decks follow run (PvE) rules (`17` §9.2 — server checks the same). */
  private deckErrors(deckId: string) {
    const deck = this.decks().find((d) => d.id === deckId);
    if (!deck) return [{ code: "badHeroes" } as const];
    return validateDeck(session.data, session.profile, deck);
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
        session.registry?.retain(session.match);
        this.scene.start("combat");
        break;
      case "error":
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
    addScreenHeader(this, this.root, {
      title: "Liên Thủ",
      back: { label: "Chọn deck", onBack: () => this.scene.start("deck-select") },
      currencies: session.profile.currencies,
    });
    addButton(this, this.root, 1180, 680, 160, "Ngắt kết nối", () => {
      session.net?.close();
      session.net = null;
      this.scene.start("deck-select");
    }, true, { variant: "danger" });

    const me = this.me;
    const cap = session.data.coopConfig.rewardedMatchesPerDay;
    addText(
      this, this.root, 40, 70,
      me === null
        ? "Đang tải hồ sơ Liên Thủ…"
        : `Hôm nay: ${me.clearsToday} trận thắng · còn ${me.rewardClaimsLeft}/${cap} lượt thưởng`,
      15,
      COLORS.gold,
    );
    addText(
      this, this.root, 40, 96,
      "Hai người cùng đánh Nguyệt Thực Ma Quân — lượt chung 45 giây, tay đồng đội lộ bài.",
      13,
      COLORS.dimText,
    );
    const emotes = (session.data.coopConfig.emotes ?? []).join(" · ");
    addText(this, this.root, 40, 118, `Biểu cảm: ${emotes}`, 11, COLORS.dimText);

    this.renderDecks();
    this.renderActions();
    this.status = addText(this, this.root, WIDTH / 2, 636, "", 14, COLORS.dimText).setOrigin(0.5);
    this.setStatus(session.net?.connected ? "Đã kết nối." : "Đang kết nối…");
  }

  private renderDecks(): void {
    const decks = this.decks();
    if (decks.length === 0) {
      addText(this, this.root, WIDTH / 2, 280, "Cần một deck đã lưu để vào trận.", 15, "#ff8080").setOrigin(0.5);
      addButton(this, this.root, WIDTH / 2, 324, 220, "Tạo deck ▸", () => this.scene.start("deck-select", { newDeck: true }), true, { variant: "primary" });
      return;
    }
    this.deckIndex = Math.min(this.deckIndex, decks.length - 1);
    addText(this, this.root, WIDTH / 2, 150, "Deck Liên Thủ (luật Tầm Nguyệt):", 13, COLORS.dimText).setOrigin(0.5);
    const data = session.data;
    decks.forEach((deck, index) => {
      const picked = index === this.deckIndex;
      const y = 182 + index * 40;
      const errors = this.deckErrors(deck.id);
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
      addText(this, this.root, WIDTH / 2 + 336, y, errors.length === 0 ? "✓" : `⚠ ${describeDeckError(data, errors[0]!)}`, 12, errors.length === 0 ? COLORS.gold : "#ff8080").setOrigin(1, 0.5);
    });
  }

  private renderActions(): void {
    const deck = this.selectedDeck();
    const valid = deck !== null && this.deckErrors(deck.id).length === 0;
    const deckId = deck?.id ?? "";
    const send = (msg: unknown) => session.net?.send(msg);
    const needDeck = { disabledReason: deck === null ? "Cần một deck đã lưu" : "Deck chưa hợp lệ — xem lỗi bên cạnh deck" };

    if (this.queued) {
      const seconds = Math.floor(this.waitingSeconds % 60).toString().padStart(2, "0");
      addText(this, this.root, 400, 428, `Đang tìm đồng đội · ${Math.floor(this.waitingSeconds / 60)}:${seconds}`, 15, COLORS.gold).setOrigin(0.5);
      addButton(this, this.root, 400, 470, 220, "Hủy tìm trận", () => this.leaveQueue());
    } else {
      addButton(this, this.root, 400, 470, 220, "Vào hàng chờ", () => {
        this.queued = true;
        this.waitingSeconds = 0;
        send({ type: "queue.join", mode: "coop", deckId });
        this.render();
      }, valid, { ...needDeck, variant: "primary" });
    }
    addButton(this, this.root, 640, 470, 220, "Tạo phòng riêng", () =>
      send({ type: "room.create", mode: "coop", deckId }), valid, needDeck);
    addButton(this, this.root, 880, 470, 220, "Vào phòng (mã)", () => {
      void promptModal(this, "Nhập mã phòng 6 ký tự bạn bè gửi:", { maxLength: 6, placeholder: "VD: K7Q2MX", confirmLabel: "Vào phòng" }).then((code) => {
        const trimmed = code?.trim().toUpperCase();
        if (trimmed) send({ type: "room.join", code: trimmed, deckId });
      });
    }, valid, needDeck);

    addButton(this, this.root, 400, 518, 220, "Đấu Tập (đồng đội máy)", () =>
      send({ type: "practice.start", mode: "coop", deckId }), valid, needDeck);
    addText(
      this, this.root, 640, 522,
      "Hàng chờ có thưởng · Phòng riêng và đồng đội máy không thưởng.",
      12,
      COLORS.dimText,
    ).setOrigin(0, 0.5);

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
}
