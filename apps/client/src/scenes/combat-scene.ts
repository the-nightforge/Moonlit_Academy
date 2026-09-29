import Phaser from "phaser";
import {
  activePlayerState,
  applyAction,
  cardDefOf,
  comboHintFor,
  getEffectiveCost,
  getPlayCardError,
  getValidTargets,
  isCardPlayable,
  summonOf,
} from "rules";
import type {
  Action,
  CombatEvent,
  CombatState,
  EnemyState,
  GameData,
  StatusInstance,
  SummonState,
} from "rules";
import { resumeSession } from "../account";
import { applyRecordedRunAction } from "../run-session";
import type { NetMatch } from "../net/match";
import type { ServerMessage } from "../net/protocol";
import { cycleEncounter, restartSession, session } from "../session";
import {
  debugAddMoonPower,
  debugAdjustHeroHp,
  debugDrawCards,
  debugKillEnemy,
  debugSetBloodMoon,
  debugSetLeveledUp,
  debugSetMoon,
  describeEvent,
} from "../debug";
import manifest from "virtual:assets-manifest";
import { showCardTooltip } from "../ui/card-tooltip";
import { playEventQueue } from "../ui/event-animator";
import {
  BLOOD_MOON_BG,
  BLOOD_MOON_TEXT,
  COLORS,
  TEXT_BASE,
  OWNER_COLORS,
  PHASE_BG,
  STATUS_LABELS,
  describePhase,
  useDesignCamera,
} from "../ui/theme";

const WIDTH = 1280;
const HEIGHT = 720;
const CARD_W = 110;
const CARD_H = 160;
const SUMMON_W = 112;
const SUMMON_H = 62;
/** Hand zone: clear of the Nguyệt Lực block (left) and the pile / end-turn column (right). */
const HAND_LEFT = 180;
const HAND_RIGHT = 1045;

const ERROR_LABELS: [RegExp, string][] = [
  [/not the player turn/, "Chưa tới lượt người chơi"],
  [/not in hand/, "Lá không còn trên tay"],
  [/broken/, "Tàn Chiêu — chủ lá đã ngã"],
  [/frozen/, "Chủ lá đang Đóng Băng"],
  [/blood moon/, "Cần Huyết Nguyệt"],
  [/moonPower/, "Không đủ Nguyệt Lực"],
  [/no target/, "Lá này không cần mục tiêu"],
  [/requires a target/, "Cần chọn mục tiêu"],
  [/invalid target/, "Mục tiêu không hợp lệ"],
  [/mulligan pending/, "Hãy Đổi Bài trước"],
  [/choice pending/, "Hãy chọn 1 lá"],
  [/too many cards to mulligan/, "Chỉ đổi tối đa 2 lá"],
  [/already done/, "Bạn đã Xong — chờ đồng đội"],
];

function errorLabel(error: string): string {
  return ERROR_LABELS.find(([pattern]) => pattern.test(error))?.[1] ?? error;
}

export class CombatScene extends Phaser.Scene {
  private gameData!: GameData;
  private state!: CombatState;
  private root!: Phaser.GameObjects.Container;
  private targeting: string | null = null;
  private validTargetIds = new Set<string>();
  private cardViews = new Map<string, Phaser.GameObjects.Container>();
  private unitAnchors = new Map<string, { x: number; y: number }>();
  private unitViews = new Map<string, Phaser.GameObjects.Container>();
  private errorText?: Phaser.GameObjects.Text;
  private inputLocked = false;
  private debugVisible = false;
  private mulliganPicks = new Set<string>();
  private tooltip: Phaser.GameObjects.Container | null = null;
  /** Network match binding (`16` §8); null in offline/PvE combats. */
  private netMatch: NetMatch | null = null;
  private mySeat = 0;
  private timerText: Phaser.GameObjects.Text | null = null;
  private netDown = false;
  private emotePanel = false;
  private lastEmoteAt = 0;
  /** Co-op: own hand cards that complete a partner's Hợp Kích half → combo id. */
  private comboHints = new Map<string, string>();
  /** Queue of banners to flash after the next event batch (Hợp Kích, phase). */
  private bannerQueue: { text: string; color: string }[] = [];

  constructor() {
    super("combat");
  }

  private get isCoop(): boolean {
    return this.state.mode === "coop";
  }

  private get mySeatState() {
    return this.state.players[this.mySeat];
  }

  preload() {
    for (const [category, files] of Object.entries(manifest)) {
      for (const [key, url] of Object.entries(files)) {
        this.load.image(`${category}:${key}`, url);
      }
    }
  }

  create() {
    this.gameData = session.data;
    this.netMatch = session.match;
    this.state = this.netMatch ? this.netMatch.view : session.state;
    this.mySeat = this.netMatch?.you ?? 0;
    this.netDown = false;
    this.timerText = null;
    this.emotePanel = false;
    this.targeting = null;
    this.validTargetIds.clear();
    this.mulliganPicks.clear();
    this.inputLocked = false;
    if (this.netMatch) this.bindNet(this.netMatch);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unbindNet());
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.cancelTargeting();
    });
    this.input.keyboard?.on("keydown-ESC", () => this.cancelTargeting());
    this.input.keyboard?.on("keydown-E", () => {
      if (
        !this.inputLocked &&
        this.state.status === "playerTurn" &&
        !(this.isCoop && this.mySeatState?.done === true)
      ) {
        this.dispatch({ type: "endTurn" });
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.code === "Backquote") {
        this.debugVisible = !this.debugVisible;
        this.renderAll();
      }
    });
    this.renderAll();
  }

  // ---- action pipeline ----

  /** Routes `match.*` frames to the live match and wires socket status. */
  private bindNet(match: NetMatch): void {
    const net = session.net!;
    net.onMessage = (message: ServerMessage) => {
      if ("matchId" in message && match.handle(message)) return;
      if (message.type === "error") this.showError(message.error);
    };
    net.onStatus = (connected) => {
      this.netDown = !connected;
      if (this.scene.isActive()) this.renderAll();
    };
    net.onRejoin = (snapshot) => {
      match.rejoin(snapshot);
      this.state = match.view;
      this.targeting = null;
      this.mulliganPicks.clear();
      this.inputLocked = false;
      if (this.scene.isActive()) this.renderAll();
    };
    match.onPush = (events, view) => this.onNetPush(events, view);
    match.onEnd = () => {
      this.inputLocked = true;
      this.renderAll();
      // Ranked matches settle server-side; pull the fresh profile (rating, Vinh Dự).
      if (match.ended?.profileRev !== undefined && match.ended.profileRev !== session.rev) {
        void resumeSession().catch(() => {});
      }
    };
    match.onRejected = (reason) => {
      this.inputLocked = false;
      this.showError(reason);
    };
    match.onEmote = (from, emoteId) => this.showEmote(from, emoteId);
  }

  private unbindNet(): void {
    if (!this.netMatch) return;
    this.netMatch.onPush = () => {};
    this.netMatch.onEnd = () => {};
    this.netMatch.onRejected = () => {};
    this.netMatch.onEmote = () => {};
  }

  /** Incoming/own emote: a fading line under the opponent strip (`17` §7.3). */
  private showEmote(from: number, emoteId: string): void {
    if (from !== this.mySeat && session.emotesMuted) return;
    const name = from === this.mySeat ? "Bạn" : (this.netMatch?.others.find((o) => o.seat === from)?.username ?? "Đối thủ");
    const text = this.add
      .text(WIDTH / 2, 78, `${name}: ${emoteId}`, { ...TEXT_BASE, fontSize: "15px", color: COLORS.gold })
      .setOrigin(0.5)
      .setDepth(150);
    this.tweens.add({ targets: text, alpha: 0, delay: 2400, duration: 600, onComplete: () => text.destroy() });
  }

  /** A `match.events` push: animate the events, then render the new view. */
  private onNetPush(events: CombatEvent[], view: CombatState): void {
    if (!this.scene.isActive()) {
      this.state = view;
      return;
    }
    this.targeting = null;
    this.inputLocked = true;
    // Co-op banners queue on the event stream (`17` §9.3).
    for (const event of events) {
      if (event.type === "coopComboTriggered") {
        const name = this.gameData.coopCombos[event.comboId]?.name ?? event.comboId;
        this.bannerQueue.push({ text: `HỢP KÍCH — ${name}!`, color: COLORS.gold });
      }
      if (event.type === "bossPhaseChanged") {
        this.bannerQueue.push({ text: `Nguyệt Thực Ma Quân — Giai đoạn ${event.phase}`, color: "#ff8090" });
      }
    }
    void this.playEvents(events).then(() => {
      this.state = view;
      this.renderAll();
      this.inputLocked = this.netMatch?.ended !== null;
      this.playBanners();
    });
  }

  /** Fades a queued banner at screen center, one every beat. */
  private playBanners(): void {
    const banner = this.bannerQueue.shift();
    if (banner === undefined || !this.scene.isActive()) {
      this.bannerQueue = [];
      return;
    }
    const text = this.add
      .text(WIDTH / 2, 300, banner.text, { ...TEXT_BASE, fontSize: "30px", color: banner.color })
      .setOrigin(0.5)
      .setDepth(180)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: text, alpha: 1, scale: 1, duration: 220 });
    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 1400,
      duration: 500,
      onComplete: () => {
        text.destroy();
        this.playBanners();
      },
    });
  }

  private dispatch(action: Action): boolean {
    if (this.inputLocked) return false;
    if (this.netMatch) {
      // The server validates; rejected actions come back as match.rejected.
      this.netMatch.sendAction(action);
      this.inputLocked = true;
      return true;
    }
    const run = session.run;
    const result = run
      ? applyRecordedRunAction({ type: "combat", action })
      : applyAction(this.gameData, this.state, action);
    if (!result.ok) {
      this.showError(result.error);
      return false;
    }
    let newState: CombatState = this.state;
    let backToRun = false;
    if ("run" in result) {
      session.run = result.run;
      backToRun = result.run.combat === null;
      newState = result.run.combat ?? this.state;
    } else {
      newState = result.state;
    }
    session.state = newState;
    session.events.push(...result.events);
    this.targeting = null;
    this.inputLocked = true;
    const events = result.events;
    void this.playEvents(events).then(() => {
      if (backToRun) {
        this.scene.start("run");
        return;
      }
      this.state = newState;
      this.renderAll();
      this.inputLocked = false;
    });
    return true;
  }

  private playEvents(events: CombatEvent[]): Promise<void> {
    return playEventQueue(this, events, {
      gameData: this.gameData,
      state: this.state,
      unitAnchors: this.unitAnchors,
      unitViews: this.unitViews,
      mySeat: this.mySeat,
    });
  }

  private onCardClicked(instanceId: string) {
    if (this.state.status === "mulligan") {
      if (this.inputLocked) return;
      if (this.mulliganPicks.has(instanceId)) this.mulliganPicks.delete(instanceId);
      else if (this.mulliganPicks.size < this.gameData.combatConfig.maxMulligan) this.mulliganPicks.add(instanceId);
      this.renderAll();
      return;
    }
    if (this.inputLocked || this.state.status !== "playerTurn") return;
    if (this.targeting === instanceId) {
      this.cancelTargeting();
      return;
    }
    const instance = this.state.cards[instanceId]!;
    const card = cardDefOf(this.gameData, this.state, instance)!;
    if (!isCardPlayable(this.gameData, this.state, instanceId)) {
      const probeTarget =
        card.target === "none"
          ? undefined
          : getValidTargets(this.gameData, this.state, instanceId)[0] ?? "enemy:0";
      const error = getPlayCardError(this.gameData, this.state, {
        type: "playCard",
        instanceId,
        ...(probeTarget !== undefined ? { targetId: probeTarget } : {}),
      });
      this.shakeCard(instanceId);
      this.showError(error ?? "Không đánh được");
      return;
    }
    if (card.target === "none") {
      this.dispatch({ type: "playCard", instanceId });
      return;
    }
    this.targeting = instanceId;
    this.validTargetIds = new Set(getValidTargets(this.gameData, this.state, instanceId));
    this.renderAll();
  }

  private onUnitClicked(unitId: string) {
    if (
      this.inputLocked ||
      this.targeting === null ||
      !this.validTargetIds.has(unitId)
    )
      return;
    this.dispatch({ type: "playCard", instanceId: this.targeting, targetId: unitId });
  }

  private cancelTargeting() {
    if (this.inputLocked || this.targeting === null) return;
    this.targeting = null;
    this.validTargetIds.clear();
    this.renderAll();
  }

  private shakeCard(instanceId: string) {
    const view = this.cardViews.get(instanceId);
    if (!view) return;
    this.tweens.add({ targets: view, x: view.x + 7, duration: 45, yoyo: true, repeat: 3 });
  }

  private showError(error: string) {
    this.errorText?.destroy();
    const text = this.add
      .text(WIDTH / 2, 525, errorLabel(error), {
        ...TEXT_BASE,
        fontSize: "15px",
        color: "#ff8080",
      })
      .setOrigin(0.5);
    this.errorText = text;
    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 900,
      duration: 800,
      onComplete: () => text.destroy(),
    });
  }

  // ---- rendering ----

  private renderAll() {
    this.root.removeAll(true);
    this.tooltip?.destroy();
    this.tooltip = null;
    this.cardViews.clear();
    const phase = this.gameData.moonPhases[this.state.moonIndex]!;
    const background = this.state.bloodMoonRounds > 0 ? BLOOD_MOON_BG : PHASE_BG[phase.id];
    this.root.add(
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, background).setDepth(-10),
    );
    this.unitAnchors.clear();
    this.unitViews.clear();
    this.errorText = undefined;
    this.timerText = null;
    this.comboHints =
      this.isCoop && this.state.status === "playerTurn" && this.mySeatState !== undefined && !this.mySeatState.done
        ? comboHintFor(this.gameData, this.state, this.mySeat)
        : new Map();
    this.renderTopBar();
    this.renderMoonWheel();
    if (this.state.mode === "pvp") {
      this.renderOpponentRow();
      this.renderOpponentHand();
    } else {
      this.renderEnemies();
    }
    if (this.isCoop) this.renderPartnerHand();
    this.renderHeroes();
    this.renderBottomBar();
    if (this.netMatch && !this.netMatch.ended) this.renderEmoteControls();
    if (this.targeting !== null) this.renderTargetingHint();
    if (this.state.status === "won" || this.state.status === "lost") {
      this.renderCombatEnd();
    }
    if (this.state.status === "mulligan") this.renderMulliganBar();
    // Co-op keeps `playerTurn` open while a seat's Chiêm Bài choice is pending.
    if (this.state.status === "choosing" || (this.isCoop && this.mySeatState?.pendingChoice)) {
      this.renderChoiceOverlay();
    }
    if (this.netDown) this.renderReconnectOverlay();
    this.renderDebugPanel();
  }

  /** Per-frame: the shared turn clock counts down to the server deadline. */
  update(): void {
    if (!this.timerText || !this.netMatch) return;
    const deadline = this.netMatch.deadline;
    if (deadline === null) {
      this.timerText.setText("");
      return;
    }
    const left = Math.max(0, deadline - (session.net?.serverNow() ?? Date.now()));
    this.timerText.setText(`⏱ ${Math.ceil(left / 1000)}s`);
  }

  private restart(seed?: number, encounterId?: string): void {
    restartSession(seed, encounterId);
    this.syncFromSession();
  }

  private syncFromSession(): void {
    this.state = session.state;
    this.targeting = null;
    this.validTargetIds.clear();
    this.mulliganPicks.clear();
    this.inputLocked = false;
    this.renderAll();
  }

  private text(
    x: number,
    y: number,
    content: string,
    size = 14,
    color: string = COLORS.text,
    parent?: Phaser.GameObjects.Container,
  ) {
    const t = this.add.text(x, y, content, {
      ...TEXT_BASE,
      fontSize: `${size}px`,
      color,
    });
    (parent ?? this.root).add(t);
    return t;
  }

  private renderTopBar() {
    this.text(24, 14, `Vòng ${this.state.round}`, 16);
    const match = this.netMatch;
    if (match) {
      // Partner strip (co-op) / opponent strip (`17` §7.3): name, NL, pile counts.
      const otherSeat = this.state.players.find((p) => p.index !== this.mySeat);
      const otherInfo = match.others[0];
      if (otherSeat && otherInfo) {
        const doneTag = this.isCoop && this.state.status === "playerTurn"
          ? otherSeat.done ? " · ✓ xong" : " · đang đánh"
          : "";
        this.text(
          24,
          36,
          `${this.isCoop ? "Đồng đội " : ""}${otherInfo.username}${otherInfo.connected ? "" : " ⛔"} — NL ${otherSeat.moonPower} · DT ${Math.min(otherSeat.moonReserve, otherSeat.moonPower)} · Tay ${otherSeat.hand.length} · Chồng ${otherSeat.drawPile.length} · Bỏ ${otherSeat.discardPile.length}${doneTag}`,
          12,
          COLORS.dimText,
        );
      }
      const myDone = this.isCoop && this.mySeatState?.done === true;
      const partnerDone = this.isCoop && otherSeat?.done === true;
      const label =
        this.state.status === "playerTurn" || this.state.status === "choosing"
          ? this.isCoop
            ? myDone
              ? partnerDone ? "— Chờ lượt kẻ địch —" : "— Đã xong · chờ đồng đội —"
              : "— Lượt chung —"
            : "— Lượt của bạn —"
          : this.state.status === "opponentTurn" || (this.state.status === "mulligan" && this.state.players[this.mySeat]!.mulliganDone)
            ? this.isCoop ? "— Chờ đồng đội —" : "— Lượt đối thủ —"
            : this.isCoop && this.state.status === "enemyTurn"
              ? "— Lượt kẻ địch —"
              : "";
      if (label) this.text(WIDTH / 2, 40, label, 15, COLORS.gold).setOrigin(0.5, 0);
      if (match.deadline !== null) {
        this.timerText = this.text(1150, 40, "", 16, COLORS.gold).setOrigin(1, 0);
      }
    } else {
      const seat = activePlayerState(this.state);
      if (seat.runRelicIds.length > 0) {
        const names = seat.runRelicIds
          .map((id: string) => (this.gameData.runRelics[id] ?? this.gameData.augments[id])?.name ?? id)
          .join(" · ");
        this.text(24, 36, `Kỳ Vật · Lõi: ${names}`, 11, COLORS.dimText);
      }
    }
    const phase = this.gameData.moonPhases[this.state.moonIndex]!;
    this.text(WIDTH / 2, 14, `( ${phase.icon} ${phase.name} )`, 16).setOrigin(0.5, 0);
    this.text(WIDTH - 24, 14, "⚙", 18, COLORS.dimText).setOrigin(1, 0);
  }

  private renderMoonWheel() {
    const y = 58;
    this.gameData.moonPhases.forEach((phase, index) => {
      const x = WIDTH / 2 + (index - 3.5) * 36;
      const active = index === this.state.moonIndex;
      if (active) {
        const halo = this.add.circle(x, y, 16, COLORS.panelBorder, 0.6);
        this.root.add(halo);
      }
      this.text(x, y, phase.icon, active ? 22 : 15)
        .setOrigin(0.5)
        .setAlpha(active ? 1 : 0.45);
    });
    const next =
      this.gameData.moonPhases[(this.state.moonIndex + 1) % this.gameData.moonPhases.length]!;
    const effect = describePhase(next);
    this.text(
      WIDTH / 2 + 190,
      y,
      `→ kế tiếp: ${next.icon} ${effect}`,
      12,
      COLORS.dimText,
    ).setOrigin(0, 0.5);
    if (this.state.bloodMoonRounds > 0) {
      this.text(
        WIDTH / 2 - 170,
        y,
        `🔴 Huyết Nguyệt · còn ${this.state.bloodMoonRounds} vòng`,
        13,
        BLOOD_MOON_TEXT,
      ).setOrigin(1, 0.5);
    }
  }

  private hpBar(
    x: number,
    y: number,
    width: number,
    hp: number,
    maxHp: number,
    fill: number,
    parent: Phaser.GameObjects.Container,
  ) {
    const height = 14;
    parent.add(this.add.rectangle(x, y, width, height, COLORS.hpTrack).setOrigin(0, 0.5));
    const fillWidth = Math.max(0, (hp / maxHp) * width);
    if (fillWidth > 0) {
      parent.add(this.add.rectangle(x, y, fillWidth, height, fill).setOrigin(0, 0.5));
    }
    this.text(x + width / 2, y, `${hp}/${maxHp}`, 10, COLORS.text, parent).setOrigin(0.5);
  }

  private statusChips(
    x: number,
    y: number,
    statuses: StatusInstance[],
    maxWidth: number,
    parent: Phaser.GameObjects.Container,
  ) {
    let cursor = x;
    let row = y;
    for (const status of statuses) {
      const label = `${STATUS_LABELS[status.id]} ${status.value}`;
      const chipWidth = label.length * 7 + 12;
      if (cursor + chipWidth > x + maxWidth) {
        cursor = x;
        row += 20;
      }
      parent.add(this.add.rectangle(cursor, row, chipWidth, 16, 0x0a0e20).setOrigin(0, 0.5));
      this.text(cursor + chipWidth / 2, row, label, 10, "#cfd6f0", parent).setOrigin(0.5, 0.5);
      cursor += chipWidth + 4;
    }
  }

  // Draws a texture cover-fitted into a w×h box centered at (x, y).
  // Returns null when the texture is missing so callers can fall back.
  private coverImage(
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    parent: Phaser.GameObjects.Container,
  ): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(key)) return null;
    const source = this.textures.get(key).getSourceImage();
    const scale = Math.max(w / source.width, h / source.height);
    const cropW = Math.min(source.width, w / scale);
    const cropH = Math.min(source.height, h / scale);
    const img = this.add.image(x, y, key);
    img.setScale(scale);
    img.setCrop(
      (source.width - cropW) / 2,
      (source.height - cropH) / 2,
      cropW,
      cropH,
    );
    parent.add(img);
    return img;
  }

  private unitPanelHit(
    panel: Phaser.GameObjects.Rectangle,
    w: number,
    h: number,
    unitId: string,
  ) {
    const selectable = this.targeting !== null && this.validTargetIds.has(unitId);
    // A Rectangle's hit area is in local space measured from its top-left corner.
    panel.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: selectable,
    });
    panel.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.onUnitClicked(unitId);
    });
  }

  /** The living Linh Thú belonging to hero `heroId` (`01` §17), if any. */
  private summonOfHero(heroId: string): SummonState | undefined {
    const summon = summonOf(this.state, heroId);
    return summon?.alive === true ? summon : undefined;
  }

  /**
   * Linh Thú (`01` §17): a compact unit panel — name, HP bar, armor, status
   * chips. Registered in `unitAnchors`/`unitViews` so damage animations and
   * targeting treat it like any other unit (Linh Thú are valid `ally` picks,
   * and `enemy` picks for the opposing seat in PvP).
   */
  private renderSummonPanel(
    summon: SummonState,
    cx: number,
    cy: number,
    w = SUMMON_W,
  ): void {
    const h = SUMMON_H;
    const c = this.add.container(cx, cy);
    this.root.add(c);
    this.unitAnchors.set(summon.id, { x: cx, y: cy });
    this.unitViews.set(summon.id, c);
    const isValidTarget = this.validTargetIds.has(summon.id);
    const panel = this.add.rectangle(0, 0, w, h, COLORS.panelHero);
    panel.setStrokeStyle(
      this.targeting && isValidTarget ? 2 : 1,
      this.targeting && isValidTarget ? COLORS.goldFill : COLORS.panelBorder,
    );
    c.add(panel);
    const name = this.gameData.summons[summon.summonId]?.name ?? "Linh Thú";
    const nameText = this.text(0, -h / 2 + 11, name, 11, COLORS.gold, c).setOrigin(0.5);
    if (nameText.width > w - 8) nameText.setScale((w - 8) / nameText.width);
    // Phong Ấn (`01` §5.6): same marker enemies and opposing heroes show —
    // bottom-right inside the panel (the 4px gap above can't hold a label).
    if (summon.sealedBy !== undefined) {
      this.text(w / 2 - 9, h / 2 - 11, "⛨", 11, "#b9a8ff", c).setOrigin(1, 0.5);
    }
    this.hpBar(-w / 2 + 8, -5, w - 16, summon.hp, summon.maxHp, COLORS.hpFillHero, c);
    if (summon.armor > 0) {
      this.text(-w / 2 + 8, h / 2 - 12, `🛡 ${summon.armor}`, 10, COLORS.armor, c);
    }
    this.statusChips(
      summon.armor > 0 ? -w / 2 + 44 : -w / 2 + 8,
      h / 2 - 12,
      summon.statuses,
      w - (summon.armor > 0 ? 52 : 16),
      c,
    );
    if (this.targeting && !isValidTarget) c.setAlpha(0.4);
    this.unitPanelHit(panel, w, h, summon.id);
  }

  private renderEnemies() {
    const enemies = this.state.enemies;
    const panelW = this.isCoop ? 280 : 220;
    const panelH = 140;
    enemies.forEach((enemy, index) => {
      const cx = (WIDTH / (enemies.length + 1)) * (index + 1);
      // Phong Ấn: the unit is sealed — its next-turn intents lose every non-damage effect.
      if (enemy.sealedBy !== undefined) {
        this.text(cx, 132, "⛨ Phong Ấn", 12, "#b9a8ff").setOrigin(0.5, 1);
      }
      const cy = 205;
      const c = this.add.container(cx, cy);
      this.root.add(c);
      this.unitAnchors.set(enemy.id, { x: cx, y: cy });
      this.unitViews.set(enemy.id, c);
      const isValidTarget = this.validTargetIds.has(enemy.id);
      const panel = this.add.rectangle(0, 0, panelW, panelH, COLORS.panelEnemy);
      panel.setStrokeStyle(
        this.targeting && isValidTarget ? 2 : 1,
        this.targeting && isValidTarget ? COLORS.goldFill : COLORS.panelBorder,
      );
      c.add(panel);
      const enemyArt = this.coverImage(
        `enemies:${enemy.defId}`,
        0,
        0,
        panelW - 6,
        panelH - 6,
        c,
      );
      if (enemyArt) {
        c.add(this.add.rectangle(0, 0, panelW - 6, panelH - 6, 0x0a0e20, 0.45));
      }
      const def = this.gameData.enemies[enemy.defId]!;
      this.text(0, -panelH / 2 + 16, def.name, 15, COLORS.text, c).setOrigin(0.5);
      this.text(
        panelW / 2 - 10,
        -panelH / 2 + 16,
        `NL ${enemy.moonPower}${enemy.moonReserve > 0 ? ` +${enemy.moonReserve}` : ""}`,
        11,
        COLORS.gold,
        c,
      ).setOrigin(1, 0.5);
      this.hpBar(-panelW / 2 + 14, -14, panelW - 28, enemy.hp, enemy.maxHp, COLORS.hpFillEnemy, c);
      this.renderBossExtras(enemy, def, c, panelW, panelH);
      if (enemy.armor > 0) {
        this.text(-panelW / 2 + 14, 12, `🛡 ${enemy.armor}`, 12, COLORS.armor, c);
      }
      this.statusChips(-panelW / 2 + 14, 38, enemy.statuses, panelW - 28, c);
      if (!enemy.alive) {
        c.add(this.add.rectangle(0, 0, panelW, panelH, 0x000000, 0.55));
        this.text(0, 0, "Ngã", 20, "#ffffff", c).setOrigin(0.5);
      } else if (enemy.statuses.some((s) => s.id === "stealth")) {
        c.add(this.add.rectangle(0, 0, panelW, panelH, 0x8899ff, 0.12));
      }
      if (this.targeting && !isValidTarget) c.setAlpha(0.4);
      this.unitPanelHit(panel, panelW, panelH, enemy.id);
    });
  }

  /**
   * Co-op boss furniture (`17` §9.3): the phase ticks on the HP bar (each
   * `phases[i].hpBelow` threshold) and, in the final phase, the revive
   * countdown before the boss stands back up.
   */
  private renderBossExtras(
    enemy: EnemyState,
    def: { name: string; phases?: { hpBelow: number }[] },
    c: Phaser.GameObjects.Container,
    panelW: number,
    panelH: number,
  ): void {
    const boss = this.state.boss;
    if (boss === undefined || boss.enemyId !== enemy.id || def.phases === undefined) return;
    const phases = def.phases;
    const barX = -panelW / 2 + 14;
    const barW = panelW - 28;
    // Threshold marks where the NEXT phase begins (phase 1's hpBelow is 1).
    for (let i = 1; i < phases.length; i++) {
      const markX = barX + phases[i]!.hpBelow * barW;
      c.add(this.add.rectangle(markX, -14, 2, 20, 0xffd080));
    }
    this.text(
      barX + barW - 4,
      -panelH / 2 + 32,
      `Giai đoạn ${boss.phase}/${phases.length}`,
      11,
      COLORS.gold,
      c,
    ).setOrigin(1, 0.5);
    if (boss.reviveCountdown !== null) {
      this.text(
        0,
        panelH / 2 - 18,
        `☾ Hồi sinh sau ${boss.reviveCountdown} vòng`,
        12,
        "#ff8090",
        c,
      ).setOrigin(0.5);
    }
  }

  /**
   * Co-op (`17` §9.3): the partner's hand, shrunk — visible but not playable.
   * Cards keep their owner-colored border and show a tooltip on hover.
   */
  private renderPartnerHand(): void {
    const partner = this.state.players.find((p) => p.index !== this.mySeat);
    if (!partner) return;
    const hand = partner.hand;
    const mw = 46;
    const mh = 50;
    const spacing = mw + 4;
    const startX = WIDTH / 2 - ((hand.length - 1) * spacing) / 2;
    hand.forEach((instanceId, index) => {
      const x = startX + index * spacing;
      const y = 528;
      const instance = this.state.cards[instanceId];
      const card = instance ? cardDefOf(this.gameData, this.state, instance) : undefined;
      if (instance === undefined || card === undefined) return;
      const mini = this.add.container(x, y);
      this.root.add(mini);
      const ownerId = instance.ownerIds[0]!;
      const back = this.add.rectangle(0, 0, mw, mh, 0x141b33);
      back.setStrokeStyle(1, OWNER_COLORS[ownerId] ?? COLORS.panelBorder);
      mini.add(back);
      mini.add(
        this.add
          .text(-mw / 2 + 12, -mh / 2 + 10, `${card.cost}`, { ...TEXT_BASE, fontSize: "10px", color: COLORS.text })
          .setOrigin(0.5),
      );
      mini.add(
        this.add
          .text(0, 4, card.name, {
            ...TEXT_BASE,
            fontSize: "8px",
            color: COLORS.text,
            align: "center",
            wordWrap: { width: mw - 6 },
          })
          .setOrigin(0.5, 0.5),
      );
      mini.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-mw / 2, -mh / 2, mw, mh),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      });
      mini.on("pointerover", () => {
        this.tooltip?.destroy();
        this.tooltip = showCardTooltip(this, x + mw / 2 + 8, y, this.gameData, card);
      });
      mini.on("pointerout", () => {
        this.tooltip?.destroy();
        this.tooltip = null;
      });
    });
  }

  /** PvP (`17` §7.3): the opponent's heroes take the enemy row, intents hidden. */
  private renderOpponentRow() {
    const opponents = this.state.heroes.filter((hero) => hero.player !== this.mySeat);
    const panelW = 220;
    const panelH = 140;
    opponents.forEach((hero, index) => {
      const cx = (WIDTH / (opponents.length + 1)) * (index + 1);
      // Phong Ấn (`01` §5.6): the hero is sealed — its cards lose every non-damage effect next turn.
      if (hero.sealedBy !== undefined) {
        this.text(cx, 132, "⛨ Phong Ấn", 12, "#b9a8ff").setOrigin(0.5, 1);
      }
      const cy = 205;
      const c = this.add.container(cx, cy);
      this.root.add(c);
      this.unitAnchors.set(hero.id, { x: cx, y: cy });
      this.unitViews.set(hero.id, c);
      const isValidTarget = this.validTargetIds.has(hero.id);
      const panel = this.add.rectangle(0, 0, panelW, panelH, COLORS.panelEnemy);
      panel.setStrokeStyle(
        this.targeting && isValidTarget ? 2 : 1,
        this.targeting && isValidTarget ? COLORS.goldFill : COLORS.panelBorder,
      );
      c.add(panel);
      const upKey = `heroes:${hero.defId}_up`;
      const heroArt = this.coverImage(
        hero.leveledUp && this.textures.exists(upKey) ? upKey : `heroes:${hero.defId}`,
        0, 0, panelW - 6, panelH - 6, c,
      );
      if (heroArt) c.add(this.add.rectangle(0, 0, panelW - 6, panelH - 6, 0x0a0e20, 0.45));
      const def = this.gameData.heroes[hero.defId]!;
      this.text(0, -panelH / 2 + 16, `${def.name}${hero.leveledUp ? " ★" : ""}`, 15, COLORS.text, c).setOrigin(0.5);
      this.hpBar(-panelW / 2 + 14, -14, panelW - 28, hero.hp, hero.maxHp, COLORS.hpFillEnemy, c);
      if (hero.armor > 0) this.text(-panelW / 2 + 14, 12, `🛡 ${hero.armor}`, 12, COLORS.armor, c);
      this.statusChips(-panelW / 2 + 14, 38, hero.statuses, panelW - 28, c);
      if (!hero.alive) {
        c.add(this.add.rectangle(0, 0, panelW, panelH, 0x000000, 0.55));
        this.text(0, 0, "Ngã", 20, "#ffffff", c).setOrigin(0.5);
      }
      if (this.targeting && !isValidTarget) c.setAlpha(0.4);
      this.unitPanelHit(panel, panelW, panelH, hero.id);
      // Linh Thú (`01` §17): no room under the opponent row — the panel sits in
      // the gap right of its hero (opposing summons are `enemy` targets, §17.3).
      const summon = this.summonOfHero(hero.id);
      if (summon) this.renderSummonPanel(summon, cx + panelW / 2 + 50, cy, 92);
    });
  }

  /** The opponent's hand — face-down card backs only (`17` §4.8). */
  private renderOpponentHand() {
    const oppSeat = this.state.players.find((p) => p.index !== this.mySeat);
    if (!oppSeat) return;
    const count = oppSeat.hand.length;
    const startX = WIDTH / 2 - ((count - 1) * 34) / 2;
    for (let i = 0; i < count; i++) {
      const back = this.add
        .rectangle(startX + i * 34, 110, 30, 44, 0x2c3e6e)
        .setStrokeStyle(1, COLORS.panelBorder);
      this.root.add(back);
    }
  }

  /** Fixed emote list + mute (`17` §7.3, `pvp-config.emotes`); one send per 3 s. */
  private renderEmoteControls(): void {
    const btn = this.add.rectangle(1204, 36, 110, 30, COLORS.button);
    btn.setStrokeStyle(1, this.emotePanel ? COLORS.goldFill : COLORS.panelBorder);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
    btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) {
        this.emotePanel = !this.emotePanel;
        this.renderAll();
      }
    });
    this.root.add(btn);
    this.text(1204, 36, `${session.emotesMuted ? "🔕" : "💬"} Biểu cảm`, 12).setOrigin(0.5);
    if (!this.emotePanel) return;
    const emotes = (this.isCoop ? this.gameData.coopConfig.emotes : this.gameData.pvpConfig.emotes) ?? [];
    const layer = this.add.container(0, 0).setDepth(120);
    this.root.add(layer);
    const panelH = emotes.length * 34 + 50;
    layer.add(this.add.rectangle(1120, 60 + panelH / 2, 220, panelH, 0x0f1530).setStrokeStyle(1, COLORS.panelBorder));
    emotes.forEach((emote, index) => {
      const y = 76 + index * 34;
      const row = this.add.rectangle(1120, y, 208, 30, 0x141b33).setInteractive({ useHandCursor: true });
      row.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) return;
        const now = Date.now();
        if (now - this.lastEmoteAt < 3000) {
          this.showError("Chờ một chút giữa hai biểu cảm");
          return;
        }
        this.lastEmoteAt = now;
        this.netMatch!.sendEmote(emote);
        this.emotePanel = false;
        this.renderAll();
      });
      layer.add(row);
      layer.add(this.add.text(1120, y, emote, { ...TEXT_BASE, fontSize: "13px", color: COLORS.text }).setOrigin(0.5));
    });
    const muteY = 76 + emotes.length * 34;
    const mute = this.add.rectangle(1120, muteY, 208, 30, 0x203040).setInteractive({ useHandCursor: true });
    mute.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) {
        session.emotesMuted = !session.emotesMuted;
        this.renderAll();
      }
    });
    layer.add(mute);
    layer.add(this.add.text(1120, muteY, session.emotesMuted ? "Bật biểu cảm" : "Tắt biểu cảm", { ...TEXT_BASE, fontSize: "12px", color: COLORS.dimText }).setOrigin(0.5));
  }

  private renderReconnectOverlay() {
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.55).setDepth(200));
    this.text(WIDTH / 2, HEIGHT / 2, "Mất kết nối — đang kết nối lại…", 20, COLORS.gold)
      .setOrigin(0.5)
      .setDepth(201);
  }

  private renderHeroes() {
    const coop = this.isCoop;
    // Co-op (`17` §9.3): all 6 heroes — own 3 left, partner's 3 right.
    const heroes = this.state.mode === "pvp"
      ? this.state.heroes.filter((hero) => hero.player === this.mySeat)
      : coop
        ? [
            ...this.state.heroes.filter((hero) => hero.player === this.mySeat),
            ...this.state.heroes.filter((hero) => hero.player !== this.mySeat),
          ]
        : this.state.heroes;
    const panelW = coop ? 190 : 240;
    const panelH = coop ? 150 : 170;
    // Rows sit a bit higher than the enemy row suggests: a hero's Linh Thú
    // panel (`01` §17) hangs directly below and must stay clear of the hand.
    const cy = coop ? 380 : 394;
    if (coop) {
      const partnerName = this.netMatch?.others[0]?.username ?? "Đồng đội";
      this.text(322, 290, "Bạn", 13, COLORS.gold).setOrigin(0.5);
      this.text(958, 290, `Đồng đội ${partnerName}`, 13, "#8fb8ff").setOrigin(0.5);
      this.root.add(this.add.rectangle(WIDTH / 2, 420, 1, 175, 0x2a3454));
    }
    heroes.forEach((hero, index) => {
      const cx = coop
        ? index < 3
          ? 122 + index * 200
          : 758 + (index - 3) * 200
        : (WIDTH / (heroes.length + 1)) * (index + 1);
      const c = this.add.container(cx, cy);
      this.root.add(c);
      this.unitAnchors.set(hero.id, { x: cx, y: cy });
      this.unitViews.set(hero.id, c);
      const isValidTarget = this.validTargetIds.has(hero.id);
      const panel = this.add.rectangle(0, 0, panelW, panelH, COLORS.panelHero);
      // Seat-colored frame in co-op: own heroes gold, partner's blue (`17` §9.3).
      const seatColor = coop && hero.player !== this.mySeat ? 0x5f8fdd : COLORS.panelBorder;
      panel.setStrokeStyle(
        this.targeting && isValidTarget ? 2 : hero.leveledUp ? 2 : coop ? 2 : 1,
        this.targeting && isValidTarget
          ? COLORS.goldFill
          : hero.leveledUp
            ? COLORS.goldFill
            : seatColor,
      );
      c.add(panel);
      const upKey = `heroes:${hero.defId}_up`;
      const heroArt = this.coverImage(
        hero.leveledUp && this.textures.exists(upKey) ? upKey : `heroes:${hero.defId}`,
        0,
        0,
        panelW - 6,
        panelH - 6,
        c,
      );
      if (heroArt) {
        c.add(this.add.rectangle(0, 0, panelW - 6, panelH - 6, 0x0a0e20, 0.45));
      }
      const def = this.gameData.heroes[hero.defId]!;
      const star = hero.leveledUp ? " ★" : "";
      this.text(
        0,
        -panelH / 2 + 18,
        `${def.name}${star}`,
        16,
        hero.leveledUp ? COLORS.gold : COLORS.text,
        c,
      ).setOrigin(0.5);
      this.hpBar(-panelW / 2 + 16, -30, panelW - 32, hero.hp, hero.maxHp, COLORS.hpFillHero, c);
      if (hero.armor > 0) {
        this.text(-panelW / 2 + 16, -4, `🛡 ${hero.armor}`, 12, COLORS.armor, c);
      }
      this.statusChips(-panelW / 2 + 16, 22, hero.statuses, panelW - 32, c);
      // Shown from state: the second form's name, the Tinh Hồn 2 threshold (`01` §8).
      const passiveName = hero.levelUpForm === "alt" ? def.altLevelUp.name : def.levelUp.name;
      const threshold = hero.constellation >= 2 ? def.levelUp.constellationThreshold : def.levelUp.threshold;
      const progress = hero.leveledUp ? passiveName : `${passiveName} ${hero.levelUpCounter}/${threshold}`;
      this.text(0, panelH / 2 - 20, progress, 11, COLORS.dimText, c).setOrigin(0.5);
      if (!hero.alive) {
        c.add(this.add.rectangle(0, 0, panelW, panelH, 0x000000, 0.55));
        this.text(0, 0, "Ngã", 20, "#ffffff", c).setOrigin(0.5);
        // Hồi Hồn (`18` §3.5): a fallen Hero can be a `fallenAlly` pick — keep
        // the gold frame readable over the dim overlay (the overlay rects are
        // not interactive, so the panel below still takes the click).
        if (this.targeting && isValidTarget) {
          c.add(this.add.rectangle(0, 0, panelW, panelH).setStrokeStyle(2, COLORS.goldFill));
        }
      }
      if (this.targeting && !isValidTarget) c.setAlpha(0.4);
      this.unitPanelHit(panel, panelW, panelH, hero.id);
      // Linh Thú (`01` §17): its compact panel hangs directly below the owner's.
      const summon = this.summonOfHero(hero.id);
      if (summon) {
        this.renderSummonPanel(summon, cx, cy + panelH / 2 + 4 + SUMMON_H / 2);
      }
    });
    // Hộ Vệ (`18` §2.2): a thin gold link from each guarded hero to its guardian.
    // Anchors for both rows (opponent row renders before this) already exist.
    const links = this.add.graphics();
    let drewLink = false;
    for (const hero of this.state.heroes) {
      const guard = hero.statuses.find((status) => status.id === "guard");
      if (guard?.sourceId === undefined) continue;
      const from = this.unitAnchors.get(hero.id);
      const to = this.unitAnchors.get(guard.sourceId);
      if (from === undefined || to === undefined) continue;
      links.lineStyle(2, COLORS.goldFill, 0.5).lineBetween(from.x, from.y, to.x, to.y);
      drewLink = true;
    }
    if (drewLink) this.root.add(links);
    else links.destroy();
  }

  private renderCard(instanceId: string, x: number, y: number) {
    const instance = this.state.cards[instanceId]!;
    const card = cardDefOf(this.gameData, this.state, instance)!;
    const weapon = this.gameData.weapons[instance.cardId];
    const [ownerId, partnerId] = instance.ownerIds as [string, string | undefined];
    const broken = instance.ownerIds.some(
      (id) => !this.state.heroes.find((hero) => hero.defId === id)?.alive,
    );
    const playable = isCardPlayable(this.gameData, this.state, instanceId);
    const container = this.add.container(x, y);
    this.root.add(container);
    this.cardViews.set(instanceId, container);

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, broken ? 0x30303a : 0x141b33);
    const isValidTarget = this.targeting === instanceId;
    const mulliganPicked = this.mulliganPicks.has(instanceId);
    bg.setStrokeStyle(
      isValidTarget || mulliganPicked ? 3 : 2,
      broken
        ? COLORS.dead
        : isValidTarget || mulliganPicked
          ? COLORS.goldFill
          : (OWNER_COLORS[ownerId] ?? COLORS.panelBorder),
    );
    container.add(bg);
    const cardArt =
      this.coverImage(`cards:${instance.cardId}`, 0, 0, CARD_W - 6, CARD_H - 6, container) ??
      this.coverImage(`heroes:${ownerId}`, 0, 0, CARD_W - 6, CARD_H - 6, container);
    if (cardArt) {
      container.add(this.add.rectangle(0, 0, CARD_W - 6, CARD_H - 6, 0x0a0e20, 0.5));
    }
    if (weapon !== undefined) {
      // Weapon card (`01` §14.2): inner orange frame and the weapon's name.
      if (!broken && !isValidTarget) {
        container.add(this.add.rectangle(0, 0, CARD_W - 8, CARD_H - 8).setStrokeStyle(2, 0xe08a3c));
      }
      container.add(
        this.add
          .text(CARD_W / 2 - 8, -CARD_H / 2 + 10, `⚔ ${weapon.name}`, { ...TEXT_BASE, fontSize: "10px", color: "#ffb080" })
          .setOrigin(1, 0.5),
      );
    }
    if (partnerId !== undefined) {
      // Bond card: second owner's color as an inner border.
      if (!broken && !isValidTarget) {
        container.add(
          this.add
            .rectangle(0, 0, CARD_W - 8, CARD_H - 8)
            .setStrokeStyle(2, OWNER_COLORS[partnerId] ?? COLORS.panelBorder),
        );
      }
      container.add(
        this.add
          .text(CARD_W / 2 - 8, -CARD_H / 2 + 10, "Song Hành", {
            ...TEXT_BASE,
            fontSize: "11px",
            color: COLORS.gold,
          })
          .setOrigin(1, 0.5),
      );
    }

    const hintComboId = this.comboHints.get(instanceId);
    if (hintComboId !== undefined) {
      // Hợp Kích hint (`17` §9.3): bright frame marks a card whose other half
      // the partner already played this turn.
      container.add(
        this.add.rectangle(0, 0, CARD_W - 4, CARD_H - 4).setStrokeStyle(2, 0xffe080),
      );
      container.add(
        this.add
          .text(0, CARD_H / 2 - 12, "⚡ Hợp Kích", { ...TEXT_BASE, fontSize: "10px", color: "#ffe080" })
          .setOrigin(0.5),
      );
    }

    const effectiveCost = getEffectiveCost(this.gameData, this.state, instanceId);
    const badge = this.add.circle(-CARD_W / 2 + 14, -CARD_H / 2 + 14, 12, 0x0a0e20);
    badge.setStrokeStyle(1, COLORS.panelBorder);
    container.add(badge);
    container.add(
      this.add
        .text(-CARD_W / 2 + 14, -CARD_H / 2 + 14, `${effectiveCost}`, {
          ...TEXT_BASE,
          fontSize: "14px",
          color: effectiveCost < card.cost ? COLORS.costCheap : COLORS.text,
        })
        .setOrigin(0.5),
    );
    if (effectiveCost < card.cost) {
      container.add(
        this.add
          .text(-CARD_W / 2 + 30, -CARD_H / 2 + 14, `${card.cost}`, {
            ...TEXT_BASE,
            fontSize: "10px",
            color: COLORS.dimText,
          })
          .setOrigin(0, 0.5),
      );
      container.add(
        this.add.rectangle(-CARD_W / 2 + 34, -CARD_H / 2 + 14, 10, 1, 0xffffff, 0.7),
      );
    }
    if (instance.heldTurns > 0 && card.keywords?.includes("tich_tu")) {
      container.add(
        this.add
          .text(0, -CARD_H / 2 + 34, `Tích Tụ ${instance.heldTurns}`, { ...TEXT_BASE, fontSize: "10px", color: COLORS.gold })
          .setOrigin(0.5),
      );
    }

    container.add(
      this.add
        .text(0, -20, card.name, {
          ...TEXT_BASE,
          fontSize: "13px",
          color: COLORS.text,
          align: "center",
          wordWrap: { width: CARD_W - 14 },
        })
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(0, 42, card.text, {
          ...TEXT_BASE,
          fontSize: "9px",
          color: COLORS.dimText,
          align: "center",
          wordWrap: { width: CARD_W - 12 },
        })
        .setOrigin(0.5, 0),
    );

    if (mulliganPicked) {
      container.add(
        this.add
          .text(0, 0, "Đổi", { ...TEXT_BASE, fontSize: "16px", color: COLORS.gold })
          .setOrigin(0.5),
      );
    }
    if (broken) {
      container.add(
        this.add
          .text(0, 0, "Tàn Chiêu", { ...TEXT_BASE, fontSize: "14px", color: "#bbbbbb" })
          .setOrigin(0.5),
      );
    } else if (!playable && !isValidTarget && this.state.status !== "mulligan") {
      container.setAlpha(0.5);
    }

    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    container.on("pointerover", () => {
      this.tooltip?.destroy();
      const hintName =
        hintComboId !== undefined ? this.gameData.coopCombos[hintComboId]?.name : undefined;
      this.tooltip = showCardTooltip(
        this,
        x + CARD_W / 2 + 10,
        y - 40,
        this.gameData,
        cardDefOf(this.gameData, this.state, instance)!,
        hintName !== undefined ? [`⚡ ${hintName} — đồng đội đã đánh nửa kia`] : [],
      );
      if (!broken && (this.state.status === "playerTurn" || this.state.status === "mulligan")) {
        container.setScale(1.15);
        container.y = y - 18;
        container.setDepth(10);
        // Depth does not reorder a container's children: lift the card over its neighbours.
        this.root.bringToTop(container);
      }
    });
    container.on("pointerout", () => {
      this.tooltip?.destroy();
      this.tooltip = null;
      container.setScale(1);
      container.y = y;
      container.setDepth(0);
    });
    container.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.onCardClicked(instanceId);
    });
    return container;
  }

  private renderTargetingHint() {
    const card = cardDefOf(this.gameData, this.state, this.state.cards[this.targeting!]!)!;
    this.text(
      WIDTH / 2,
      92,
      `Chọn mục tiêu cho ${card.name} — chuột phải / Esc để hủy`,
      13,
      COLORS.gold,
    ).setOrigin(0.5);
  }

  private renderMulliganBar() {
    if (this.state.players[this.mySeat]?.mulliganDone) {
      this.text(WIDTH / 2, 520, this.isCoop ? "Chờ đồng đội Đổi Bài…" : "Chờ đối thủ Đổi Bài…", 14, COLORS.dimText).setOrigin(0.5);
      return;
    }
    const picks = this.mulliganPicks.size;
    this.text(WIDTH / 2, 520, `Đổi Bài: chọn tối đa ${this.gameData.combatConfig.maxMulligan} lá để đổi`, 14, COLORS.gold).setOrigin(0.5);
    this.endScreenButton(1150, 600, picks > 0 ? `Đổi (${picks})` : "Giữ nguyên", () => {
      const instanceIds = [...this.mulliganPicks];
      this.mulliganPicks.clear();
      this.dispatch({ type: "mulligan", instanceIds });
    });
  }

  private renderChoiceOverlay() {
    const pending = this.state.players[this.mySeat]!.pendingChoice!;
    if (pending.kind === "chooseMoon") {
      this.renderMoonChoice(pending.options);
      return;
    }
    if (pending.kind !== "chooseCard") return;
    const options = pending.options;
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6));
    this.text(WIDTH / 2, 250, "Chiêm Bài — chọn 1 lá, các lá còn lại xuống đáy chồng", 16, COLORS.gold).setOrigin(0.5);
    const spacing = CARD_W + 30;
    const startX = WIDTH / 2 - ((options.length - 1) * spacing) / 2;
    options.forEach((instanceId, index) => {
      const view = this.renderCard(instanceId, startX + index * spacing, 380);
      view.setDepth(50).setAlpha(1); // renderCard dims cards that are not playable right now
      view.removeAllListeners("pointerup");
      view.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.dispatch({ type: "chooseCard", instanceId });
      });
    });
  }

  /**
   * Chọn Pha (`18` §2.2): three horizontal options — keep the phase or push the
   * wheel +1/+2. Each button previews the phase it would land on.
   */
  private renderMoonChoice(options: number[]) {
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6));
    this.text(
      WIDTH / 2,
      250,
      "Chọn Pha — chọn pha trăng cho lượt này",
      16,
      COLORS.gold,
    ).setOrigin(0.5);
    const spacing = 240;
    const startX = WIDTH / 2 - ((options.length - 1) * spacing) / 2;
    options.forEach((raw, index) => {
      const offset = raw as 0 | 1 | 2;
      const x = startX + index * spacing;
      const y = 380;
      const phase =
        this.gameData.moonPhases[(this.state.moonIndex + offset) % this.gameData.moonPhases.length]!;
      const panel = this.add.rectangle(x, y, 212, 116, 0x141b33);
      panel.setStrokeStyle(1, COLORS.goldFill);
      panel.setInteractive({ useHandCursor: true });
      panel.on("pointerover", () => panel.setFillStyle(0x2a3a70));
      panel.on("pointerout", () => panel.setFillStyle(0x141b33));
      panel.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.dispatch({ type: "chooseMoon", offset });
      });
      this.root.add(panel);
      this.text(x, y - 42, offset === 0 ? "Giữ pha" : `+${offset}`, 12, COLORS.dimText).setOrigin(0.5);
      this.text(x, y - 12, `${phase.icon} ${phase.name}`, 16, COLORS.gold).setOrigin(0.5);
      this.root.add(
        this.add
          .text(x, y + 18, describePhase(phase), {
            ...TEXT_BASE,
            fontSize: "11px",
            color: COLORS.dimText,
            align: "center",
            wordWrap: { width: 196 },
          })
          .setOrigin(0.5, 0),
      );
    });
  }

  private renderCombatEnd() {
    if (this.netMatch) {
      const end = this.netMatch.ended;
      const won = end ? end.result === "won" : this.state.winner === this.mySeat;
      const draw = end?.result === "draw";
      const reasons: Record<string, string> = {
        resign: "Đối thủ bỏ cuộc",
        timeout: "Đối thủ hết giờ quá nhiều lần",
        disconnect: "Đối thủ mất kết nối",
        combat: "",
      };
      const myReasons: Record<string, string> = {
        resign: "Bạn đã bỏ cuộc",
        timeout: "Bạn hết giờ quá nhiều lần",
        disconnect: "Bạn mất kết nối quá lâu",
        combat: "",
      };
      this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.65));
      this.text(
        WIDTH / 2, HEIGHT / 2 - 40,
        draw ? "HÒA" : won ? "THẮNG" : "THUA",
        56,
        draw ? COLORS.dimText : won ? COLORS.gold : "#cc5555",
      ).setOrigin(0.5);
      this.text(
        WIDTH / 2, HEIGHT / 2 + 20,
        (won || draw ? reasons : myReasons)[end?.reason ?? "combat"] ?? "",
        16, COLORS.dimText,
      ).setOrigin(0.5);
      // Ranked settlement arrives with match.end (`16` §8.8).
      if (end?.rating) {
        const delta = end.rating.after - end.rating.before;
        this.text(
          WIDTH / 2, HEIGHT / 2 + 50,
          `Điểm xếp hạng: ${end.rating.before} → ${end.rating.after} (${delta >= 0 ? "+" : ""}${delta})`,
          15, COLORS.gold,
        ).setOrigin(0.5);
      }
      if (end?.rewards) {
        // Co-op payout: Nguyệt Ngọc / Nguyệt Trần (+ first-win tag), `16` §8.9.
        const parts = [
          end.rewards.honor !== undefined && end.rewards.honor > 0 ? `+${end.rewards.honor} Vinh Dự ❖` : "",
          end.rewards.moonJade !== undefined && end.rewards.moonJade > 0 ? `+${end.rewards.moonJade} Nguyệt Ngọc` : "",
          end.rewards.moonDust !== undefined && end.rewards.moonDust > 0 ? `+${end.rewards.moonDust} Nguyệt Trần` : "",
          end.rewards.firstWin ? "Thắng đầu ngày" : "",
        ].filter((part) => part.length > 0);
        if (parts.length > 0) {
          this.text(WIDTH / 2, HEIGHT / 2 + 72, parts.join("   "), 14, COLORS.gold).setOrigin(0.5);
        }
      }
      const coopMatch = this.netMatch.mode.startsWith("coop");
      this.endScreenButton(WIDTH / 2, HEIGHT / 2 + 116, coopMatch ? "Về Liên Thủ" : "Về Đấu Trường", () => {
        session.match = null;
        this.scene.start(coopMatch ? "coop-lobby" : "arena");
      });
      return;
    }
    const won = this.state.status === "won";
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.65));
    this.text(
      WIDTH / 2,
      HEIGHT / 2 - 30,
      won ? "THẮNG" : "THUA",
      56,
      won ? COLORS.gold : "#cc5555",
    ).setOrigin(0.5);
    this.text(
      WIDTH / 2,
      HEIGHT / 2 + 30,
      won ? "Vọng Nguyệt Thư Viện còn đứng." : "Thư viện đã bị xâm chiếm.",
      16,
      COLORS.dimText,
    ).setOrigin(0.5);
    this.endScreenButton(WIDTH / 2 - 180, HEIGHT / 2 + 90, "Chơi lại", () => this.restart());
    this.endScreenButton(WIDTH / 2, HEIGHT / 2 + 90, "Trận khác", () => {
      cycleEncounter(1);
      this.syncFromSession();
    });
    this.endScreenButton(WIDTH / 2 + 180, HEIGHT / 2 + 90, "Chọn deck", () =>
      this.scene.start("deck-select"),
    );
  }

  private endScreenButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): void {
    const btn = this.add.rectangle(x, y, 160, 42, COLORS.button);
    btn.setStrokeStyle(1, COLORS.goldFill);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
    btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(btn);
    this.text(x, y, label, 14).setOrigin(0.5);
  }

  private debugButton(
    x: number,
    y: number,
    width: number,
    label: string,
    onClick: () => void,
    fontSize = 11,
  ): void {
    const btn = this.add.rectangle(x, y, width, 22, COLORS.button).setOrigin(0, 0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
    btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(btn);
    this.text(x + width / 2, y, label, fontSize).setOrigin(0.5);
  }

  private renderDebugPanel(): void {
    if (!this.debugVisible || this.netMatch) return;
    const x = WIDTH - 336;
    this.root.add(
      this.add
        .rectangle(x + 168, HEIGHT / 2, 336, HEIGHT - 16, 0x0a0e20, 0.93)
        .setStrokeStyle(1, COLORS.panelBorder),
    );
    let y = 30;
    const line = (label: string, size = 12) => {
      this.text(x + 14, y, label, size);
      y += 20;
    };
    line(`DEBUG — seed ${session.seed} · ${session.encounterId}`, 13);
    if (session.run) line("⚠ Sửa trận trong lượt chơi: server sẽ không công nhận kết quả", 11);
    this.debugButton(x + 14, y + 10, 100, "Chơi lại", () => this.restart());
    this.debugButton(x + 124, y + 10, 80, "Seed +1", () => this.restart(session.seed + 1));
    this.debugButton(x + 214, y + 10, 90, "Trận kế ▸", () => {
      cycleEncounter(1);
      this.syncFromSession();
    });
    y += 36;
    this.debugButton(x + 14, y + 10, 100, "Chọn deck", () => this.scene.start("deck-select"));
    this.text(x + 128, y + 10, "Huyết Nguyệt:", 11).setOrigin(0, 0.5);
    [0, 1, 2, 3].forEach((rounds, index) => {
      this.debugButton(x + 214 + index * 28, y + 10, 24, `${rounds}`, () => {
        debugSetBloodMoon(rounds);
        this.renderAll();
      });
    });
    y += 36;
    this.debugButton(x + 14, y + 10, 110, "+3 Nguyệt Lực", () => {
      debugAddMoonPower();
      this.renderAll();
    });
    this.debugButton(x + 134, y + 10, 80, "Rút 1 lá", () => {
      debugDrawCards(1);
      this.renderAll();
    });
    y += 36;
    line("Đặt pha:");
    this.gameData.moonPhases.forEach((phase, index) => {
      this.debugButton(x + 14 + index * 38, y + 8, 32, phase.icon, () => {
        debugSetMoon(index);
        this.renderAll();
      });
    });
    y += 32;
    line("HP Hero:");
    this.state.heroes.forEach((hero, index) => {
      const def = this.gameData.heroes[hero.defId]!;
      this.text(x + 14, y + 8, `${hero.leveledUp ? "★ " : ""}${def.name} ${hero.hp}/${hero.maxHp}`, 11);
      this.debugButton(x + 200, y + 8, 44, "-5", () => {
        debugAdjustHeroHp(index, -5);
        this.renderAll();
      });
      this.debugButton(x + 250, y + 8, 44, "+5", () => {
        debugAdjustHeroHp(index, 5);
        this.renderAll();
      });
      this.debugButton(x + 300, y + 8, 24, "★", () => {
        debugSetLeveledUp(index);
        this.renderAll();
      });
      y += 28;
    });
    this.state.enemies.forEach((enemy, index) => {
      if (!enemy.alive) return;
      const def = this.gameData.enemies[enemy.defId]!;
      this.debugButton(x + 14, y + 8, 180, `Giết: ${def.name}`, () => {
        debugKillEnemy(index);
        this.renderAll();
      }, 10);
      y += 28;
    });
    y += 6;
    line("— Sự kiện —", 11);
    for (const event of session.events.slice(-12)) {
      line(describeEvent(this.state, this.gameData, event), 10);
    }
  }

  private renderBottomBar() {
    const seat = this.state.players[this.mySeat] ?? activePlayerState(this.state);
    const power = seat.moonPower;
    const reserve = Math.min(seat.moonReserve, power);
    this.text(30, 545, "Nguyệt Lực", 13, COLORS.dimText);
    this.text(30, 566, "◉".repeat(power - reserve), 16, COLORS.gold);
    if (reserve > 0) this.text(30 + (power - reserve) * 12, 566, "◈".repeat(reserve), 16, COLORS.costCheap);
    this.text(30, 592, reserve > 0 ? `${power} (Dự Trữ ${reserve})` : `${power}`, 12, COLORS.dimText);
    const extras = [
      seat.cardsPlayedThisTurn > 0 ? `Liên Hoàn ${seat.cardsPlayedThisTurn}` : "",
      seat.moonPowerBonus > 0 ? `+${seat.moonPowerBonus}/lượt` : "",
    ].filter((part) => part.length > 0);
    if (extras.length > 0) this.text(30, 612, extras.join("  ·  "), 12, COLORS.gold);

    // A full hand (up to `handLimit`) squeezes its cards to stay inside the zone;
    // the hovered card is lifted above its neighbours in renderCard.
    const hand = seat.hand;
    const spacing = hand.length < 2 ? 0 : Math.min(CARD_W + 10, (HAND_RIGHT - HAND_LEFT - CARD_W) / (hand.length - 1));
    const handWidth = (hand.length - 1) * spacing + CARD_W;
    const left = Phaser.Math.Clamp(WIDTH / 2 - handWidth / 2, HAND_LEFT, HAND_RIGHT - handWidth);
    hand.forEach((instanceId, index) => {
      this.renderCard(instanceId, left + CARD_W / 2 + index * spacing, 632);
    });

    const pile = seat.drawPile.length;
    this.text(1090, 548, `Chồng bài ${pile}`, 16, pile <= 6 ? "#ff8080" : COLORS.text);
    this.text(1090, 576, `Bỏ ${seat.discardPile.length}`, 13, COLORS.dimText);

    if (this.state.status === "playerTurn" || (this.isCoop && this.state.status === "choosing")) {
      const btnX = 1150;
      const btnY = 660;
      // Co-op (`17` §9.3): "Xong" marks this seat done; the shared turn ends
      // only when both seats are done (or the 45 s clock runs out).
      const myDone = this.isCoop && seat.done === true;
      const btn = this.add.rectangle(btnX, btnY, 190, 56, myDone ? 0x23283c : COLORS.button);
      btn.setStrokeStyle(1, myDone ? COLORS.panelBorder : COLORS.goldFill);
      if (!myDone) {
        btn.setInteractive({ useHandCursor: true });
        btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
        btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
        btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (pointer.button === 0 && !this.inputLocked) this.dispatch({ type: "endTurn" });
        });
      }
      this.root.add(btn);
      this.text(btnX, btnY, this.isCoop ? (myDone ? "ĐÃ XONG ✓" : "XONG") : "KẾT THÚC LƯỢT", 15).setOrigin(0.5);
      this.text(
        btnX,
        btnY + 30,
        `Giữ ${Math.min(this.gameData.combatConfig.moonReserveMax, seat.moonPower)}`,
        11,
        COLORS.dimText,
      ).setOrigin(0.5, 0);
      if (this.isCoop) {
        const partner = this.state.players.find((p) => p.index !== this.mySeat);
        if (partner) {
          this.text(
            1090,
            612,
            `Đồng đội: ${partner.done ? "đã xong ✓" : "đang đánh…"}`,
            12,
            partner.done ? COLORS.gold : COLORS.dimText,
          );
        }
      }
    }
    if (this.netMatch && !this.netMatch.ended) {
      const btn = this.add.rectangle(1150, 590, 100, 30, 0x40202a);
      btn.setStrokeStyle(1, 0x884455);
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0 && window.confirm("Bỏ cuộc trận này?")) this.netMatch!.resign();
      });
      this.root.add(btn);
      this.text(1150, 590, "Bỏ cuộc", 12, "#ff9090").setOrigin(0.5);
    }
  }
}
