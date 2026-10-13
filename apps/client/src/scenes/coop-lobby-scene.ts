import Phaser from "phaser";
import { dayKey } from "rules";
import { errorText } from "../account";
import { api, auth } from "../api";
import { NetMatch } from "../net/match";
import { NetSocket } from "../net/socket";
import type { ServerMessage } from "../net/protocol";
import { session } from "../session";
import { prepareCombatAssets } from "../ui/combat-assets";
import { coopLobbyError, coopLobbyModel, CoopLobbyFlow, normalizeCoopRoomCode, type CoopAction, type CoopRewards } from "../ui/coop-lobby-presentation";
import { CoopLobbyView } from "../ui/coop-lobby-view";
import { useDesignCamera } from "../ui/theme";
import { describeDeckError } from "./deck-select-scene";

/** Liên Thủ uses saved PvE decks, the existing protocol and combat asset gate. */
export class CoopLobbyScene extends Phaser.Scene {
  private view: CoopLobbyView | null = null;
  private flow = new CoopLobbyFlow();
  private net: NetSocket | null = null;
  private rewards: CoopRewards | null = null;
  private rewardsLoading = false;
  private rewardsError = "";
  private assetState: "idle" | "loading" | "ready" | "error" = "idle";
  private assetFailed = 0;
  private networkBlocked = false;
  private connectionError = false;
  private error = "";
  private notice = "";
  private generation = 0;
  private lastDay = "";
  private tickSecond = -1;
  private queueStamp = 0;
  private renderedProfile = session.profile;
  private renderedOnline = session.online;

  constructor() { super("coop-lobby"); }

  create() {
    this.generation++;
    useDesignCamera(this);
    this.flow = new CoopLobbyFlow();
    this.rewards = null;
    this.rewardsLoading = false;
    this.rewardsError = "";
    this.assetState = "idle";
    this.assetFailed = 0;
    this.networkBlocked = false;
    this.connectionError = false;
    this.error = "";
    this.notice = session.notices.splice(0).join(" ");
    this.tickSecond = -1;
    this.queueStamp = Date.now();
    const generation = this.generation, account = auth.generation;
    session.net ??= new NetSocket();
    const net = this.net = session.net;
    // Leave a waiting room from a different lobby before a new Liên Thủ request.
    let previousRoom = !!session.roomCode;
    session.roomCode = null;
    if (previousRoom && net.connected) { net.sendLobby({ type: "room.leave" }); previousRoom = false; }
    this.lastDay = this.period();
    this.view = new CoopLobbyView({
      back: () => this.back(), selectDeck: id => this.selectDeck(id),
      editDeck: () => this.editDeck(), createDeck: () => { if (this.flow.phase === "idle") this.scene.start("deck-select", { newDeck: true }); },
      start: (action, code) => this.startRequest(action, code), leave: () => this.leave(),
      reconnect: () => { if (session.online) net.connect(); },
      retryAssets: () => { this.assetState = "idle"; this.prepareAssets(); },
      retryRewards: () => { void this.refreshCoop(); },
      deckError: error => describeDeckError(session.data, error),
    });
    const message = (message: ServerMessage) => { if (this.current(generation, account)) this.onMessage(message); };
    const status = (connected: boolean) => {
      if (!this.current(generation, account)) return;
      if (connected) {
        if (previousRoom) { net.sendLobby({ type: "room.leave" }); previousRoom = false; }
        this.networkBlocked = false;
        if (this.connectionError) { this.error = ""; this.connectionError = false; }
      } else {
        this.flow.disconnected();
        session.roomCode = null;
        this.networkBlocked = true;
        this.connectionError = true;
        this.error = "Mất kết nối — đang kết nối lại. Hãy tìm đồng đội hoặc vào phòng lại sau khi kết nối.";
      }
      this.render();
    };
    net.onMessage = message;
    net.onStatus = status;
    net.onRecovery = snapshot => {
      if (session.net !== net || auth.generation !== account || snapshot === null) return;
      if (session.match?.matchId !== snapshot.matchId) session.match = new NetMatch(net, snapshot);
      session.registry?.retain(session.match!);
      (this.game.scene.getScenes(true)[0] ?? this).scene.start("combat");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || this.view?.dialogOpen) return;
      event.preventDefault();
      if (["joining-queue", "queued", "room"].includes(this.flow.phase)) this.leave();
      else this.back();
    };
    const focus = () => { if (document.visibilityState !== "hidden") void this.refreshCoop(); };
    window.addEventListener("keydown", escape);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      const type = this.flow.leave();
      if (type) net.sendLobby({ type });
      session.roomCode = null;
      if (net.onMessage === message) net.onMessage = () => {};
      if (net.onStatus === status) net.onStatus = () => {};
      window.removeEventListener("keydown", escape);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      this.view?.destroy();
      this.view = null;
    });
    this.render();
    if (session.online) net.connect();
    void this.refreshCoop();
    this.prepareAssets();
  }

  update() {
    if (!this.view) return;
    const second = Math.floor(Date.now() / 1000);
    if (second !== this.tickSecond) {
      this.tickSecond = second;
      const day = this.period();
      if (day !== this.lastDay) { this.lastDay = day; this.rewards = null; void this.refreshCoop(); this.render(); }
      else if (this.flow.phase === "queued" || this.flow.phase === "joining-queue") this.render();
    }
    if (this.renderedProfile !== session.profile || this.renderedOnline !== session.online) this.render();
  }

  private current(generation: number, account: number) {
    return !!this.view && this.generation === generation && auth.generation === account && this.net === session.net && this.scene.isActive();
  }
  private period() { return dayKey(session.data, this.net?.serverNow() ?? Date.now()); }
  private gate() {
    return { online: session.online, connected: !!this.net?.connected && !this.networkBlocked, assets: this.assetState, phase: this.flow.phase, rewards: this.rewards };
  }
  private model() { return coopLobbyModel(session.data, session.profile, session.selectedDeckId, this.gate()); }
  private render() {
    if (!this.view) return;
    this.renderedProfile = session.profile;
    this.renderedOnline = session.online;
    const waitingSeconds = this.flow.waitingSeconds + Math.max(0, (Date.now() - this.queueStamp) / 1000);
    this.view.render({ ...this.gate(), data: session.data, profile: session.profile, selectedDeckId: session.selectedDeckId,
      username: auth.username ?? "Bạn", room: this.flow.room, waitingSeconds, error: this.error, notice: this.notice,
      rewardsLoading: this.rewardsLoading, rewardsError: this.rewardsError, assetFailed: this.assetFailed });
  }

  private prepareAssets() {
    if (this.assetState === "loading" || this.assetState === "ready") return;
    this.assetState = "loading";
    this.render();
    const generation = this.generation, account = auth.generation;
    prepareCombatAssets(this).then(({ failed }) => {
      if (!this.current(generation, account)) return;
      this.assetFailed = failed.length;
      this.assetState = failed.length ? "error" : "ready";
      this.render();
    }, () => {
      if (!this.current(generation, account)) return;
      this.assetFailed = 1;
      this.assetState = "error";
      this.render();
    });
  }
  private async refreshCoop() {
    if (!this.view || this.rewardsLoading || !session.online) return;
    const generation = this.generation, account = auth.generation, period = this.period();
    this.rewardsLoading = true;
    this.render();
    try {
      const reply = await api<CoopRewards>("GET", "/coop/me");
      if (!this.current(generation, account) || period !== this.period()) return;
      this.rewards = reply;
      this.rewardsError = "";
    } catch (error) {
      if (this.current(generation, account) && period === this.period()) this.rewardsError = errorText(error);
    } finally {
      if (this.current(generation, account)) {
        this.rewardsLoading = false;
        if (period !== this.period()) { this.rewards = null; void this.refreshCoop(); }
        else this.render();
      }
    }
  }

  private selectDeck(id: string) {
    if (!this.model().canEdit || !session.profile.decks.some(deck => deck.id === id)) return;
    session.selectedDeckId = id;
    this.error = "";
    this.notice = "";
    this.render();
  }
  private editDeck() {
    const model = this.model();
    if (!model.canEdit || !model.selected) return;
    session.editingDeck = JSON.parse(JSON.stringify(model.selected.deck));
    this.scene.start("deck-builder", { back: "coop-lobby" });
  }
  private startRequest(action: CoopAction, rawCode?: string): boolean {
    const model = this.model();
    const code = action === "join-room" ? normalizeCoopRoomCode(rawCode ?? "") : null;
    if (action === "join-room" && !code) { this.error = "Mã phòng cần đúng 6 chữ hoặc số"; this.render(); return false; }
    if (!this.flow.begin(action, model.canStart)) { this.error = model.blockedReason; this.render(); return false; }
    const deckId = model.selected!.deck.id;
    this.error = "";
    this.notice = "";
    this.queueStamp = Date.now();
    const type = { queue: "queue.join", "create-room": "room.create", "join-room": "room.join", practice: "practice.start" }[action] as "queue.join" | "room.create" | "room.join" | "practice.start";
    if (!this.net?.sendLobby({ type, mode: "coop", deckId, ...(code ? { code } : {}) })) {
      this.flow.disconnected();
      this.networkBlocked = true;
      this.connectionError = true;
      this.error = "Kết nối vừa ngắt. Chờ kết nối lại trước khi vào trận.";
      this.render();
      return false;
    }
    this.render();
    return true;
  }
  private leave() {
    const type = this.flow.leave();
    if (!type) return;
    this.net?.sendLobby({ type });
    session.roomCode = null;
    this.notice = type === "queue.leave" ? "Đã hủy tìm đồng đội" : "Đã rời phòng";
    this.error = "";
    this.render();
  }
  private back() {
    if (["creating-room", "joining-room", "starting-practice", "match"].includes(this.flow.phase)) return;
    this.scene.start("deck-select");
  }
  private onMessage(message: ServerMessage) {
    if (message.type === "match.start") {
      this.flow.matchStarted();
      session.roomCode = null;
      session.match = new NetMatch(this.net!, message);
      session.registry?.retain(session.match);
      this.scene.start("combat");
      return;
    }
    if (this.flow.handle(message)) {
      if (message.type === "queue.status") this.queueStamp = Date.now();
      else if (message.type === "room.created" || message.type === "room.updated") { session.roomCode = this.flow.room?.code ?? null; this.error = ""; }
      else if (message.type === "room.closed") { session.roomCode = null; this.notice = "Phòng đã đóng"; }
      else if (message.type === "error") this.error = coopLobbyError(message.error);
      this.render();
    } else if ("matchId" in message) session.match?.handle(message);
  }
}
