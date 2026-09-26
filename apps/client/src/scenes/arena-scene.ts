import Phaser from "phaser";
import { auth } from "../api";
import { NetMatch } from "../net/match";
import { NetSocket } from "../net/socket";
import type { ServerMessage } from "../net/protocol";
import { session } from "../session";
import { COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";

const WIDTH = 1280;

/**
 * Temporary arena lobby (5c.4 — the full lobby with queue/rating lands in
 * Task 15): connect the realtime socket, then Đấu Tập or a private room by
 * code. Private rooms need a saved deck — `starter:` pseudo-decks are not
 * known to the server.
 */
export class ArenaScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private status: Phaser.GameObjects.Text | null = null;
  private deckIndex = 0;
  private roomCode: string | null = null;

  constructor() {
    super("arena");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.deckIndex = 0;
    this.roomCode = null;
    session.net ??= new NetSocket();
    const net = session.net;
    net.onMessage = (message) => this.onMessage(message);
    net.onStatus = (connected) => this.setStatus(connected ? "Đã kết nối." : "Mất kết nối — đang kết nối lại…");
    net.onRejoin = (snapshot) => {
      session.match = session.match?.matchId === snapshot.matchId ? session.match : new NetMatch(net, snapshot);
      session.match!.rejoin(snapshot);
      this.scene.start("combat");
    };
    net.connect();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      net.onMessage = () => {};
      net.onStatus = () => {};
    });
    this.render();
  }

  private setStatus(text: string): void {
    this.status?.setText(text);
  }

  private savedDecks() {
    return session.profile.decks;
  }

  private onMessage(message: ServerMessage): void {
    switch (message.type) {
      case "room.created":
      case "room.updated":
        this.roomCode = message.code;
        session.roomCode = message.code;
        this.setStatus(
          `Phòng ${message.code} · ${message.players.length}/2 người — gửi mã cho bạn bè.`,
        );
        break;
      case "room.closed":
        this.roomCode = null;
        session.roomCode = null;
        this.setStatus("Phòng đã đóng.");
        break;
      case "match.start":
        session.roomCode = null;
        session.match = new NetMatch(session.net!, message);
        this.scene.start("combat");
        break;
      case "error":
        this.setStatus(`Lỗi: ${message.error}`);
        break;
      default:
        if ("matchId" in message) session.match?.handle(message);
        break;
    }
  }

  private render(): void {
    this.root.removeAll(true);
    addText(this, this.root, WIDTH / 2, 60, "Đấu Trường (thử)", 28, COLORS.gold).setOrigin(0.5);
    addButton(this, this.root, 100, 30, 140, "◂ Chọn deck", () => this.scene.start("deck-select"));
    addButton(this, this.root, 1180, 30, 140, "Ngắt kết nối", () => {
      session.net?.close();
      session.net = null;
      this.scene.start("deck-select");
    });

    const decks = this.savedDecks();
    if (decks.length === 0) {
      addText(this, this.root, WIDTH / 2, 300, "Cần một deck đã lưu — hãy tạo deck ở màn Chọn deck trước.", 15, "#ff8080").setOrigin(0.5);
    } else {
      this.deckIndex = Math.min(this.deckIndex, decks.length - 1);
      addText(this, this.root, WIDTH / 2, 150, "Deck đấu:", 13, COLORS.dimText).setOrigin(0.5);
      decks.forEach((deck, index) => {
        const picked = index === this.deckIndex;
        addButton(this, this.root, WIDTH / 2, 190 + index * 40, 320, `${picked ? "◉ " : ""}${deck.name}`, () => {
          this.deckIndex = index;
          this.render();
        });
      });
      const deckId = decks[this.deckIndex]!.id;
      const net = session.net!;
      const send = (msg: unknown) => net.send(msg);
      addButton(this, this.root, WIDTH / 2 - 240, 480, 220, "Đấu Tập (máy)", () =>
        send({ type: "practice.start", mode: "pvp", deckId }),
      );
      addButton(this, this.root, WIDTH / 2, 480, 220, "Tạo phòng riêng", () =>
        send({ type: "room.create", mode: "pvp", deckId }),
      );
      addButton(this, this.root, WIDTH / 2 + 240, 480, 220, "Vào phòng (mã)", () => {
        const code = window.prompt("Mã phòng 6 ký tự:")?.trim().toUpperCase();
        if (code) send({ type: "room.join", code, deckId });
      });
    }
    this.status = addText(this, this.root, WIDTH / 2, 560, "", 14, COLORS.dimText).setOrigin(0.5);
    this.setStatus(session.net?.connected ? "Đã kết nối." : "Đang kết nối…");
    addText(this, this.root, WIDTH / 2, 660, `Tài khoản: ${auth.token ? "đã đăng nhập" : "offline"}`, 12, COLORS.dimText).setOrigin(0.5);
  }
}
