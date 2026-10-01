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
  HeroState,
  PlayerState,
  StatusInstance,
  SummonState,
} from "rules";
import { errorText, resumeSession } from "../account";
import { applyRecordedRunAction } from "../run-session";
import { recordStoryAction, startStoryTicket, submitStory } from "../story-session";
import type { NetMatch } from "../net/match";
import type { ServerMessage } from "../net/protocol";
import { cycleEncounter, restartSession, session } from "../session";
import type { Team } from "../session";
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
import { showCardTooltip, showTextTooltip } from "../ui/card-tooltip";
import { confirmModal, isModalOpen } from "../ui/widgets";
import { playEventQueue } from "../ui/event-animator";
import {
  BLOOD_MOON_BG,
  COLORS,
  COMBAT_LAYOUT,
  TEXT_BASE,
  OWNER_COLORS,
  PHASE_BG,
  SEAL_ICON,
  STATUS_ICONS,
  describePhase,
  RENDER_SCALE,
  useDesignCamera,
} from "../ui/theme";

const WIDTH = 1280;
const HEIGHT = 720;
const CARD_W = 110;
const CARD_H = 160;
/** Hand zone: clear of the draw pile (left) and the end-turn button (right). */
const HAND_LEFT = 130;
const HAND_RIGHT = 1140;
/** A hovered hand card is lifted (scaled 1.15) until its bottom edge shows. */
const HAND_LIFT_Y = HEIGHT - (CARD_H * 1.15) / 2 - 6;
/** Unit cards are portrait (2:3): enemies / opponents on the top row, own heroes below. */
const TOP_ROW_Y = 170;
const HERO_ROW_Y = 400;
const UNIT_W = 128;
const UNIT_H = 184;
const HERO_W = 136;
const HERO_H = 196;
const COOP_HERO_W = 112;
const COOP_HERO_H = 162;
const BOSS_W = 144;
const BOSS_H = 204;
const SUMMON_W = 88;
const SUMMON_H = 124;

/** Centers of `count` cards spread `step` apart around the screen's middle. */
function rowXs(count: number, step: number): number[] {
  return Array.from({ length: count }, (_, index) => WIDTH / 2 + (index - (count - 1) / 2) * step);
}

interface UnitCardSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  artKey: string;
  name: string;
  nameColor?: string;
  hp: number;
  hostile: boolean;
  armor: number;
  statuses: StatusInstance[];
  sealed: boolean;
  frame: number;
  alive: boolean;
  stealth?: boolean;
  tooltip: () => string[];
}

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
  /** Story mode (`18` §4.4): the ticket's stage + deck while the combat runs. */
  private storyStageId: string | null = null;
  private storyDeck: { id: string; heroIds: Team } | null = null;
  private storyFinishing = false;

  constructor() {
    super("combat");
  }

  private get isCoop(): boolean {
    return this.state.mode === "coop";
  }

  /** This combat belongs to a story ticket (`18` §4.4). */
  private get isStory(): boolean {
    return this.storyStageId !== null;
  }

  private get mySeatState() {
    return this.state.players[this.mySeat];
  }

  preload() {
    for (const [category, files] of Object.entries(manifest)) {
      for (const [key, url] of Object.entries(files)) {
        // SVG icons rasterize at the canvas scale so they stay sharp under the zoomed camera.
        if (url.endsWith(".svg")) this.load.svg(`${category}:${key}`, url, { scale: RENDER_SCALE });
        else this.load.image(`${category}:${key}`, url);
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
    this.storyStageId = session.story?.setup.stageId ?? null;
    this.storyDeck = session.story?.deck ?? null;
    this.storyFinishing = false;
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
        !isModalOpen() &&
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
      .text(WIDTH / 2, COMBAT_LAYOUT.midY, banner.text, { ...TEXT_BASE, fontSize: "30px", color: banner.color })
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
    // Story combats record every accepted action for the server's replay (`18` §4.4).
    if (!run && session.story) recordStoryAction(action);
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
      // A story combat that just ended goes to the server for verification (`18` §4.4).
      if (this.isStory && session.story !== null && (newState.status === "won" || newState.status === "lost")) {
        this.finishStory();
      }
      this.renderAll();
      this.inputLocked = this.storyFinishing;
    });
    return true;
  }

  /** Sends the finished story combat; win → after-dialogue, loss → retry panel, error → back to Cốt Truyện. */
  private finishStory(): void {
    if (this.storyFinishing || session.story === null) return;
    this.storyFinishing = true;
    this.inputLocked = true;
    submitStory().then(
      () => {
        if (session.lastStory?.won === true && this.storyStageId !== null) {
          session.pendingStageId = null;
          this.scene.start("dialogue", { stageId: this.storyStageId, part: "after" });
          return;
        }
        this.storyFinishing = false;
        this.inputLocked = false;
        this.renderAll();
      },
      (error: unknown) => {
        session.pendingStageId = null;
        session.notices.push(errorText(error));
        this.scene.start("story");
      },
    );
  }

  /** Loss: a fresh ticket for the same stage + deck, then a clean combat (`18` §4.4). */
  private retryStory(): void {
    const stageId = this.storyStageId;
    const deck = this.storyDeck;
    if (this.storyFinishing) return;
    if (stageId === null || deck === null) {
      session.pendingStageId = null;
      this.scene.start("story");
      return;
    }
    this.storyFinishing = true;
    startStoryTicket(stageId, deck).then(
      () => this.scene.restart(),
      (error: unknown) => {
        session.pendingStageId = null;
        session.notices.push(errorText(error));
        this.scene.start("story");
      },
    );
  }

  private playEvents(events: CombatEvent[]): Promise<void> {
    return playEventQueue(this, events, {
      gameData: this.gameData,
      state: this.state,
      unitAnchors: this.unitAnchors,
      unitViews: this.unitViews,
      cardViews: this.cardViews,
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
      .text(WIDTH / 2, 572, errorLabel(error), {
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
    this.renderBackground();
    this.unitAnchors.clear();
    this.unitViews.clear();
    this.errorText = undefined;
    this.timerText = null;
    this.comboHints =
      this.isCoop && this.state.status === "playerTurn" && this.mySeatState !== undefined && !this.mySeatState.done
        ? comboHintFor(this.gameData, this.state, this.mySeat)
        : new Map();
    this.renderTopBar();
    this.renderMoon();
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

  /** Shrinks a one-line label that would overrun its panel. */
  private fitWidth(text: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
    if (text.width > maxWidth) text.setScale(maxWidth / text.width);
    return text;
  }

  /**
   * The artwork fills the screen under a light scrim; Huyết Nguyệt adds a red
   * wash and a red edge. Without the artwork the phase color is the background.
   */
  private renderBackground() {
    const phase = this.gameData.moonPhases[this.state.moonIndex]!;
    const bloodMoon = this.state.bloodMoonRounds > 0;
    const art = this.coverImage("backgrounds:background", WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, this.root);
    if (art === null) {
      this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, bloodMoon ? BLOOD_MOON_BG : PHASE_BG[phase.id]));
      return;
    }
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x060a18, 0.3));
    if (bloodMoon) {
      this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, BLOOD_MOON_BG, 0.35));
      this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH - 24, HEIGHT - 24).setStrokeStyle(24, 0xc01030, 0.35));
    }
  }

  /** The encounter being fought: story stage, run node or the single-combat pick. */
  private encounterName(): string {
    const run = session.run;
    const runNode = run?.map.floors.flat().find((node) => node.id === run.position);
    const stage = session.story ? this.gameData.storyStages[session.story.setup.stageId] : undefined;
    if (stage) return stage.name;
    return this.gameData.encounters[runNode?.encounterId ?? session.encounterId]?.name ?? "";
  }

  /** Shows `lines` while the pointer is over `target` (a text tooltip at `at`). */
  private hoverTooltip(
    target: Phaser.GameObjects.GameObject,
    at: () => { x: number; y: number },
    lines: () => string[],
  ) {
    target.on("pointerover", () => {
      this.tooltip?.destroy();
      const { x, y } = at();
      this.tooltip = showTextTooltip(this, x, y, lines());
    });
    target.on("pointerout", () => {
      this.tooltip?.destroy();
      this.tooltip = null;
    });
  }

  /** A round badge: dark fill, colored ring, centered label. */
  private badge(
    x: number,
    y: number,
    r: number,
    label: string,
    ring: number,
    parent: Phaser.GameObjects.Container,
    fill = 0x0a0e20,
    size = 13,
    color: string = COLORS.text,
  ): Phaser.GameObjects.Arc {
    const circle = this.add.circle(x, y, r, fill, 0.92).setStrokeStyle(2, ring);
    parent.add(circle);
    this.text(x, y, label, size, color, parent).setOrigin(0.5);
    return circle;
  }

  /**
   * Top-left plate: the encounter (PvE) or the opponent / partner (PvP, co-op).
   * Details — Kỳ Vật, the other seat's Nguyệt Lực and hand — live in its tooltip.
   */
  private renderTopBar() {
    const match = this.netMatch;
    const other = match ? this.state.players.find((p) => p.index !== this.mySeat) : undefined;
    const otherInfo = match?.others[0];
    const plate = this.add.graphics();
    plate.fillStyle(0x0a0e20, 0.78).fillRoundedRect(16, 14, 240, 44, 22);
    plate.lineStyle(1, COLORS.panelBorder).strokeRoundedRect(16, 14, 240, 44, 22);
    this.root.add(plate);
    const glyph = this.state.mode === "pvp" ? "⚔" : this.isCoop ? "♥" : "☾";
    this.badge(38, 36, 18, glyph, COLORS.goldFill, this.root, COLORS.button, 16, COLORS.gold);
    const name = otherInfo ? `${otherInfo.username}${otherInfo.connected ? "" : " ⛔"}` : this.encounterName();
    this.fitWidth(this.text(64, 36, name, 14).setOrigin(0, 0.5), this.isCoop ? 150 : 180);
    if (this.isCoop && other?.done === true && this.state.status === "playerTurn") {
      this.badge(232, 36, 11, "✓", COLORS.goldFill, this.root, 0x0a0e20, 12, COLORS.gold);
    }
    const hit = this.add.zone(136, 36, 240, 44).setInteractive();
    this.root.add(hit);
    this.hoverTooltip(hit, () => ({ x: 16, y: 64 }), () => {
      if (other && otherInfo) {
        return [
          `${this.isCoop ? "Đồng đội" : "Đối thủ"} ${otherInfo.username}${otherInfo.connected ? "" : " — mất kết nối"}`,
          `Nguyệt Lực ${other.moonPower} · Dự Trữ ${Math.min(other.moonReserve, other.moonPower)}`,
          `Trên tay ${other.hand.length} lá`,
          this.isCoop && this.state.status === "playerTurn" ? (other.done ? "Đã xong lượt" : "Đang đánh") : "",
        ];
      }
      const seat = activePlayerState(this.state);
      const relics = seat.runRelicIds.map((id: string) => (this.gameData.runRelics[id] ?? this.gameData.augments[id])?.name ?? id);
      return [name, relics.length > 0 ? `Kỳ Vật · Lõi: ${relics.join(" · ")}` : ""];
    });
    // The other seat's draw pile sits at the top row's height (`17` §7.3 piles).
    if (other) this.renderPile(other, TOP_ROW_Y, this.isCoop ? 0x5f8fdd : 0x9a6fd0, this.isCoop ? "Đồng đội" : "Đối thủ");
    this.text(WIDTH - 40, 36, "⚙", 18, COLORS.dimText).setOrigin(0.5);
    if (match && !match.ended) {
      const flag = this.badge(WIDTH - 136, 36, 16, "⚑", 0x884455, this.root, 0x40202a, 14, "#ff9090");
      flag.setInteractive({ useHandCursor: true });
      flag.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) return;
        void confirmModal(this, "Bỏ cuộc trận này? Trận tính là thua.", { label: "Bỏ cuộc", danger: true }).then((ok) => {
          if (ok && this.netMatch && !this.netMatch.ended) this.netMatch.resign();
        });
      });
      this.hoverTooltip(flag, () => ({ x: WIDTH - 300, y: 60 }), () => ["Bỏ cuộc"]);
    }
    if (match && match.deadline !== null) {
      const { x, y } = COMBAT_LAYOUT.endTurn;
      this.timerText = this.text(x, y - 66, "", 15, COLORS.gold).setOrigin(0.5);
    }
  }

  /** Current moon phase only, in the artwork's top ornament; rules in the tooltip. */
  private renderMoon() {
    const { x, y } = COMBAT_LAYOUT.moon;
    const phase = this.gameData.moonPhases[this.state.moonIndex]!;
    const bloodMoon = this.state.bloodMoonRounds > 0;
    const iconKey = `ui:moon_${bloodMoon ? "blood" : phase.id}`;
    const hasIcon = this.textures.exists(iconKey);
    const ring = this.badge(x, y, 28, hasIcon ? "" : phase.icon, bloodMoon ? 0xff5a5a : COLORS.goldFill, this.root, 0x0a0e20, 28);
    if (hasIcon) this.root.add(this.add.image(x, y, iconKey).setDisplaySize(46, 46));
    ring.setInteractive();
    this.hoverTooltip(ring, () => ({ x: x + 36, y: y - 20 }), () => [
      phase.name,
      describePhase(phase),
      bloodMoon ? `Huyết Nguyệt — còn ${this.state.bloodMoonRounds} vòng` : "",
    ]);
  }

  /**
   * One unit as a portrait card: art, HP badge (top-left), armor under it,
   * status icons inside above the name strip. Name and numbers in detail are
   * in the hover tooltip. Registered for targeting and animations.
   */
  private renderUnitCard(spec: UnitCardSpec): Phaser.GameObjects.Container {
    const { id, x, y, w, h } = spec;
    const c = this.add.container(x, y);
    this.root.add(c);
    this.unitAnchors.set(id, { x, y });
    this.unitViews.set(id, c);
    const isValidTarget = this.targeting !== null && this.validTargetIds.has(id);
    const panel = this.add.rectangle(0, 0, w, h, spec.hostile ? COLORS.panelEnemy : COLORS.panelHero);
    panel.setStrokeStyle(isValidTarget ? 3 : 2, isValidTarget ? COLORS.goldFill : spec.frame);
    c.add(panel);
    this.coverImage(spec.artKey, 0, 0, w - 6, h - 6, c);
    c.add(this.add.rectangle(0, h / 2 - 15, w - 6, 24, 0x0a0e20, 0.8));
    this.fitWidth(this.text(0, h / 2 - 15, spec.name, 12, spec.nameColor ?? COLORS.text, c).setOrigin(0.5), w - 14);
    this.badge(-w / 2 + 16, -h / 2 + 16, 16, `${spec.hp}`, spec.hostile ? COLORS.hpFillEnemy : COLORS.hpFillHero, c,
      spec.hostile ? 0x4a1818 : 0x183a20, 13);
    if (spec.armor > 0) this.badge(-w / 2 + 16, -h / 2 + 46, 12, `${spec.armor}`, 0x9fd4ff, c, 0x1e3a5a, 11);
    if (spec.statuses.some((status) => status.id === "freeze")) this.frostOverlay(c, w, h);
    if (spec.stealth) this.stealthVeil(c, w, h);
    if (!spec.alive) {
      c.add(this.add.rectangle(0, 0, w, h, 0x000000, 0.6));
      this.text(0, 0, "Ngã", 18, "#ffffff", c).setOrigin(0.5);
      // Hồi Hồn (`18` §3.5): keep the gold frame readable over the dim overlay.
      if (isValidTarget) c.add(this.add.rectangle(0, 0, w, h).setStrokeStyle(3, COLORS.goldFill));
    }
    this.unitPanelHit(panel, w, h, id);
    this.hoverTooltip(panel, () => ({ x: x + w / 2 + 8, y: y - h / 2 }), spec.tooltip);
    this.statusIcons(spec, c);
    if (this.targeting !== null && !isValidTarget) c.setAlpha(0.4);
    return c;
  }

  /** A looping tween on a card part; it dies with the part when `renderAll` rebuilds the card. */
  private loopTween(target: Phaser.GameObjects.GameObject, config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">) {
    const tween = this.tweens.add({ targets: target, yoyo: true, repeat: -1, ease: "Sine.easeInOut", ...config });
    target.once("destroy", () => tween.remove());
  }

  /** Đóng Băng: an icy film with a frost rim and snowflakes on the card edges, breathing slowly. */
  private frostOverlay(c: Phaser.GameObjects.Container, w: number, h: number) {
    const ice = this.add.rectangle(0, 0, w, h, 0x9fd4ff, 0.08).setStrokeStyle(3, 0xd8f0ff, 0.9);
    c.add(ice);
    this.loopTween(ice, { fillAlpha: 0.2, duration: 1300 });
    if (!this.textures.exists("ui:status_freeze")) return;
    for (const side of [-1, 1]) {
      const flake = this.add.image(side * (w / 2 - 2), -12, "ui:status_freeze").setDisplaySize(22, 22);
      c.add(flake);
      this.loopTween(flake, { angle: side * 25, duration: 2400 });
    }
  }

  /** Ẩn Thân: the card fades into a drifting mist. */
  private stealthVeil(c: Phaser.GameObjects.Container, w: number, h: number) {
    const mist = this.add.rectangle(0, 0, w, h, 0x8899ff, 0.1);
    c.add(mist);
    c.setAlpha(0.72);
    this.loopTween(mist, { fillAlpha: 0.28, duration: 1600 });
  }

  /** In-card status icons, bottom-up rows above the name strip; each explains itself on hover. */
  private statusIcons(spec: UnitCardSpec, c: Phaser.GameObjects.Container) {
    const icons = spec.statuses.map((status) => ({ ...STATUS_ICONS[status.id], value: status.value, iconKey: `ui:status_${status.id}` }));
    if (spec.sealed) icons.push({ ...SEAL_ICON, value: 0, iconKey: "ui:seal" });
    const r = 10;
    const step = 2 * r + 4;
    const perRow = Math.max(1, Math.floor((spec.w - 8) / step));
    icons.forEach((icon, index) => {
      const ix = -spec.w / 2 + 6 + r + (index % perRow) * step;
      const iy = spec.h / 2 - 30 - r - Math.floor(index / perRow) * step;
      const hasIcon = this.textures.exists(icon.iconKey);
      const circle = this.badge(ix, iy, r, hasIcon ? "" : icon.glyph, icon.color, c, 0x0a0e20, 12);
      if (hasIcon) c.add(this.add.image(ix, iy, icon.iconKey).setDisplaySize(2 * r - 1, 2 * r - 1));
      if (icon.value > 0) {
        c.add(
          this.add
            .text(ix + r + 1, iy + r + 1, `${icon.value}`, { ...TEXT_BASE, fontSize: "10px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
            .setOrigin(1, 1),
        );
      }
      const keyword = this.gameData.keywords[icon.keywordId];
      circle.setInteractive({ useHandCursor: this.targeting !== null });
      circle.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.onUnitClicked(spec.id);
      });
      this.hoverTooltip(circle, () => ({ x: spec.x + spec.w / 2 + 8, y: spec.y + iy }), () => [
        `${keyword?.name ?? icon.keywordId}${icon.value > 0 ? ` ${icon.value}` : ""}`,
        keyword?.text ?? "",
      ]);
    });
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
   * Linh Thú (`01` §17): a small portrait card in its side's summon zone, right
   * of the row. Valid `ally` picks, and `enemy` picks for the opposing seat in PvP.
   */
  private renderSummonPanel(summon: SummonState, cx: number, cy: number, hostile: boolean): void {
    const name = this.gameData.summons[summon.summonId]?.name ?? "Linh Thú";
    this.renderUnitCard({
      id: summon.id,
      x: cx,
      y: cy,
      w: SUMMON_W,
      h: SUMMON_H,
      artKey: `summons:${summon.summonId}`,
      name,
      nameColor: COLORS.gold,
      hp: summon.hp,
      hostile,
      armor: summon.armor,
      statuses: summon.statuses,
      sealed: summon.sealedBy !== undefined,
      frame: COLORS.panelBorder,
      alive: true,
      tooltip: () => [name, `HP ${summon.hp}/${summon.maxHp}${summon.armor > 0 ? ` · Giáp ${summon.armor}` : ""}`],
    });
  }

  /** The living Linh Thú of `heroes`, left to right from `startX` (the row's summon zone). */
  private renderSummonRow(heroes: HeroState[], y: number, startX: number, hostile: boolean) {
    heroes
      .flatMap((hero) => this.summonOfHero(hero.id) ?? [])
      .forEach((summon, index) => this.renderSummonPanel(summon, startX + index * (SUMMON_W + 12), y, hostile));
  }

  private renderEnemies() {
    const enemies = this.state.enemies;
    const bossId = this.state.boss?.enemyId;
    const xs = rowXs(enemies.length, (bossId !== undefined ? BOSS_W : UNIT_W) + 42);
    enemies.forEach((enemy, index) => {
      const def = this.gameData.enemies[enemy.defId]!;
      const boss = enemy.id === bossId && def.phases !== undefined;
      const w = boss ? BOSS_W : UNIT_W;
      const h = boss ? BOSS_H : UNIT_H;
      const c = this.renderUnitCard({
        id: enemy.id,
        x: xs[index]!,
        y: TOP_ROW_Y,
        w,
        h,
        artKey: `enemies:${enemy.defId}`,
        name: def.name,
        hp: enemy.hp,
        hostile: true,
        armor: enemy.armor,
        statuses: enemy.statuses,
        sealed: enemy.sealedBy !== undefined,
        frame: COLORS.panelBorder,
        alive: enemy.alive,
        stealth: enemy.statuses.some((s: StatusInstance) => s.id === "stealth"),
        tooltip: () => this.enemyTooltip(enemy, def),
      });
      if (boss) this.renderBossBadges(c, w, h);
    });
  }

  /** Nguyệt Lực stays public (`01` §9.2) but off the card: the enemy's hover tooltip. */
  private enemyTooltip(enemy: EnemyState, def: { name: string; phases?: { hpBelow: number }[] }): string[] {
    const boss = this.state.boss;
    const phases = def.phases;
    const bossLines =
      boss !== undefined && boss.enemyId === enemy.id && phases !== undefined
        ? [
            `Giai đoạn ${boss.phase}/${phases.length}` +
              (boss.phase < phases.length ? ` — sang giai đoạn sau khi HP dưới ${Math.round(phases[boss.phase]!.hpBelow * 100)}%` : ""),
            boss.reviveCountdown !== null ? `Hồi sinh sau ${boss.reviveCountdown} vòng` : "",
          ]
        : [];
    return [
      def.name,
      `HP ${enemy.hp}/${enemy.maxHp}${enemy.armor > 0 ? ` · Giáp ${enemy.armor}` : ""}`,
      `Nguyệt Lực ${enemy.moonPower}${enemy.moonReserve > 0 ? ` (+${enemy.moonReserve} Dự Trữ)` : ""}`,
      enemy.sealedBy !== undefined ? "Phong Ấn: chiêu lượt tới chỉ còn damage" : "",
      ...bossLines,
    ];
  }

  /** Co-op boss (`17` §9.3): phase badge top-right, revive countdown under it. */
  private renderBossBadges(c: Phaser.GameObjects.Container, w: number, h: number): void {
    const boss = this.state.boss!;
    const phases = this.gameData.enemies[this.state.enemies.find((e) => e.id === boss.enemyId)!.defId]!.phases!;
    this.badge(w / 2 - 18, -h / 2 + 18, 16, `${boss.phase}/${phases.length}`, COLORS.goldFill, c, 0x0a0e20, 11, COLORS.gold);
    if (boss.reviveCountdown !== null) {
      this.badge(w / 2 - 18, -h / 2 + 52, 14, `☾${boss.reviveCountdown}`, 0xff8090, c, 0x3a1020, 11, "#ff8090");
    }
  }

  /**
   * Co-op (`17` §9.3): the partner's hand as small cost tiles under the top-left
   * plate — visible but not playable; hover shows the card.
   */
  private renderPartnerHand(): void {
    const partner = this.state.players.find((p) => p.index !== this.mySeat);
    if (!partner) return;
    partner.hand.forEach((instanceId, index) => {
      const x = 34 + index * 34;
      const y = 86;
      const instance = this.state.cards[instanceId];
      const card = instance ? cardDefOf(this.gameData, this.state, instance) : undefined;
      if (instance === undefined || card === undefined) return;
      const tile = this.add.rectangle(x, y, 30, 40, 0x141b33).setStrokeStyle(1, OWNER_COLORS[instance.ownerIds[0]!] ?? 0x5f8fdd);
      this.root.add(tile);
      this.text(x, y, `${card.cost}`, 12).setOrigin(0.5);
      tile.setInteractive();
      tile.on("pointerover", () => {
        this.tooltip?.destroy();
        this.tooltip = showCardTooltip(this, x + 20, y + 200, this.gameData, card);
      });
      tile.on("pointerout", () => {
        this.tooltip?.destroy();
        this.tooltip = null;
      });
    });
  }

  /** PvP (`17` §7.3): the opponent's heroes take the top row, intents hidden. */
  private renderOpponentRow() {
    const opponents = this.state.heroes.filter((hero) => hero.player !== this.mySeat);
    const xs = rowXs(opponents.length, UNIT_W + 42);
    opponents.forEach((hero, index) => {
      this.renderHeroCard(hero, xs[index]!, TOP_ROW_Y, UNIT_W, UNIT_H, true, COLORS.panelBorder);
    });
    // Opposing Linh Thú are `enemy` targets (`01` §17.3).
    this.renderSummonRow(opponents, TOP_ROW_Y, (xs.at(-1) ?? WIDTH / 2) + UNIT_W / 2 + 34 + SUMMON_W / 2, true);
  }

  /** The opponent's hand — face-down card backs under the top-left plate (`17` §4.8). */
  private renderOpponentHand() {
    const oppSeat = this.state.players.find((p) => p.index !== this.mySeat);
    if (!oppSeat) return;
    for (let i = 0; i < oppSeat.hand.length; i++) {
      this.root.add(this.add.rectangle(30 + i * 26, 84, 22, 32, 0x2c3e6e).setStrokeStyle(1, COLORS.panelBorder));
    }
  }

  /** Fixed emote list + mute (`17` §7.3, `pvp-config.emotes`); one send per 3 s. */
  private renderEmoteControls(): void {
    const btn = this.badge(WIDTH - 88, 36, 16, session.emotesMuted ? "🔕" : "💬", this.emotePanel ? COLORS.goldFill : COLORS.panelBorder, this.root, COLORS.button, 13);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) {
        this.emotePanel = !this.emotePanel;
        this.renderAll();
      }
    });
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

  /**
   * A hero's portrait card: HP / armor badges, status icons, and top-right the
   * Thức Tỉnh badge — a ★ ringed by its progress, solid gold once awakened.
   */
  private renderHeroCard(hero: HeroState, x: number, y: number, w: number, h: number, hostile: boolean, frame: number) {
    const def = this.gameData.heroes[hero.defId]!;
    const upKey = `heroes:${hero.defId}_up`;
    // Shown from state: the second form's name, the Tinh Hồn 2 threshold (`01` §8).
    const passiveName = hero.levelUpForm === "alt" ? def.altLevelUp.name : def.levelUp.name;
    const threshold = hero.constellation >= 2 ? def.levelUp.constellationThreshold : def.levelUp.threshold;
    const c = this.renderUnitCard({
      id: hero.id,
      x,
      y,
      w,
      h,
      artKey: hero.leveledUp && this.textures.exists(upKey) ? upKey : `heroes:${hero.defId}`,
      name: def.name,
      nameColor: hero.leveledUp ? COLORS.gold : COLORS.text,
      hp: hero.hp,
      hostile,
      armor: hero.armor,
      statuses: hero.statuses,
      sealed: hero.sealedBy !== undefined,
      frame: hero.leveledUp ? COLORS.goldFill : frame,
      alive: hero.alive,
      stealth: hero.statuses.some((s) => s.id === "stealth"),
      tooltip: () => [
        `${def.name}${hero.leveledUp ? " ★" : ""}`,
        `HP ${hero.hp}/${hero.maxHp}${hero.armor > 0 ? ` · Giáp ${hero.armor}` : ""}`,
        hero.leveledUp ? `${passiveName} — đã Thức Tỉnh` : `${passiveName}: ${hero.levelUpCounter}/${threshold}`,
        hero.sealedBy !== undefined ? "Phong Ấn: lá lượt tới chỉ còn damage" : "",
      ],
    });
    const bx = w / 2 - 16;
    const by = -h / 2 + 16;
    this.badge(bx, by, 13, "★", COLORS.goldFill, c, hero.leveledUp ? COLORS.goldFill : 0x0a0e20, 13, hero.leveledUp ? "#0a0e20" : COLORS.dimText);
    const progress = hero.leveledUp ? 0 : Math.min(1, hero.levelUpCounter / threshold);
    if (progress > 0) {
      const arc = this.add.graphics();
      arc.lineStyle(3, COLORS.goldFill).beginPath().arc(bx, by, 13, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2).strokePath();
      c.add(arc);
    }
  }

  private renderHeroes() {
    const coop = this.isCoop;
    const own = this.state.heroes.filter((hero) => hero.player === this.mySeat);
    // Co-op (`17` §9.3): all 6 heroes — own 3 left, partner's 3 right (blue frames).
    const partner = coop ? this.state.heroes.filter((hero) => hero.player !== this.mySeat) : [];
    const heroes = this.state.mode === "pvp" || coop ? [...own, ...partner] : this.state.heroes;
    const w = coop ? COOP_HERO_W : HERO_W;
    const h = coop ? COOP_HERO_H : HERO_H;
    const xs = coop
      ? heroes.map((_, index) => WIDTH / 2 + (index < 3 ? -1 : 1) * (18 + w / 2) + (index < 3 ? index - 2 : index - 3) * (w + 12))
      : rowXs(heroes.length, w + 34);
    heroes.forEach((hero, index) => {
      const frame = coop && hero.player !== this.mySeat ? 0x5f8fdd : COLORS.panelBorder;
      this.renderHeroCard(hero, xs[index]!, HERO_ROW_Y, w, h, false, frame);
    });
    this.renderSummonRow(heroes, HERO_ROW_Y, Math.max(...xs) + w / 2 + 34 + SUMMON_W / 2, false);
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

  /**
   * A seat's draw pile as card backs peeking from the left edge, with diamonds:
   * cards left (red when 6 or fewer) and the discard count under it.
   */
  private renderPile(seat: PlayerState, y: number, color: number, owner: string) {
    const { x } = COMBAT_LAYOUT.pile;
    this.root.add(this.add.rectangle(x + 5, y + 5, 84, 120, 0x1b2448).setStrokeStyle(1, COLORS.panelBorder));
    this.root.add(this.add.rectangle(x, y, 84, 120, 0x223060).setStrokeStyle(2, color));
    this.text(x + 22, y, "☾", 22, COLORS.gold).setOrigin(0.5);
    const left = seat.drawPile.length;
    const low = left <= 6;
    this.root.add(this.add.rectangle(84, y - 22, 28, 28, low ? 0x7a2a2a : color).setAngle(45).setStrokeStyle(1, 0x0a0e20));
    this.text(84, y - 22, `${left}`, 13, low ? "#ffd0d0" : "#ffffff").setOrigin(0.5);
    this.root.add(this.add.rectangle(84, y + 24, 22, 22, 0x3a3f55).setAngle(45).setStrokeStyle(1, 0x0a0e20));
    this.text(84, y + 24, `${seat.discardPile.length}`, 11, COLORS.dimText).setOrigin(0.5);
    const hit = this.add.zone(48, y, 100, 130).setInteractive();
    this.root.add(hit);
    this.hoverTooltip(hit, () => ({ x: 104, y: y - 40 }), () => [
      `Chồng bài ${owner}`,
      `Còn ${left} lá · Bỏ ${seat.discardPile.length} lá`,
    ]);
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
      // Hand cards peek from the bottom edge: hovering always lifts them into full view.
      const inHand = y === COMBAT_LAYOUT.handY;
      const liftY = inHand ? HAND_LIFT_Y : y - 18;
      this.tooltip = showCardTooltip(
        this,
        x + CARD_W / 2 + 10,
        liftY - 40,
        this.gameData,
        cardDefOf(this.gameData, this.state, instance)!,
        hintName !== undefined ? [`⚡ ${hintName} — đồng đội đã đánh nửa kia`] : [],
      );
      if (!broken && (inHand || this.state.status === "playerTurn" || this.state.status === "mulligan")) {
        container.setScale(1.15);
        container.y = liftY;
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
      COMBAT_LAYOUT.midY,
      `Chọn mục tiêu cho ${card.name} — chuột phải / Esc để hủy`,
      13,
      COLORS.gold,
    ).setOrigin(0.5);
  }

  private renderMulliganBar() {
    if (this.state.players[this.mySeat]?.mulliganDone) {
      this.text(WIDTH / 2, 550, this.isCoop ? "Chờ đồng đội Đổi Bài…" : "Chờ đối thủ Đổi Bài…", 14, COLORS.dimText).setOrigin(0.5);
      return;
    }
    const picks = this.mulliganPicks.size;
    this.text(WIDTH / 2, 550, `Đổi Bài: chọn tối đa ${this.gameData.combatConfig.maxMulligan} lá để đổi`, 14, COLORS.gold).setOrigin(0.5);
    // Where the end-turn button sits: the phase's main action keeps one place.
    this.endScreenButton(1180, COMBAT_LAYOUT.endTurn.y, picks > 0 ? `Đổi (${picks})` : "Giữ nguyên", () => {
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
    if (this.isStory) {
      const won = this.state.status === "won";
      const stage = this.storyStageId !== null ? this.gameData.storyStages[this.storyStageId] : undefined;
      this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.65));
      this.text(
        WIDTH / 2,
        HEIGHT / 2 - 40,
        won ? "THẮNG" : "THUA",
        56,
        won ? COLORS.gold : "#cc5555",
      ).setOrigin(0.5);
      if (stage) this.text(WIDTH / 2, HEIGHT / 2 + 12, `Cốt Truyện — ${stage.name}`, 15, COLORS.dimText).setOrigin(0.5);
      if (this.storyFinishing || session.story !== null) {
        this.text(WIDTH / 2, HEIGHT / 2 + 56, "Đang gửi kết quả lên server…", 15, COLORS.dimText).setOrigin(0.5);
      } else {
        // A loss leaves the ticket closed; a win already moved on to the after-dialogue.
        this.endScreenButton(WIDTH / 2 - 100, HEIGHT / 2 + 96, "Thử Lại", () => this.retryStory());
        this.endScreenButton(WIDTH / 2 + 100, HEIGHT / 2 + 96, "Về Cốt Truyện", () => {
          session.pendingStageId = null;
          this.scene.start("story");
        });
      }
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
    // Story combats are replayed by the server — no local editing like netMatch.
    if (!this.debugVisible || this.netMatch || this.isStory) return;
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
    // Nothing to spend while Đổi Bài is open.
    if (this.state.status !== "mulligan") this.renderMoonPower(seat);

    // A full hand (up to `handLimit`) squeezes its cards to stay inside the zone;
    // the hovered card is lifted above its neighbours in renderCard.
    const hand = seat.hand;
    const spacing = hand.length < 2 ? 0 : Math.min(CARD_W + 10, (HAND_RIGHT - HAND_LEFT - CARD_W) / (hand.length - 1));
    const handWidth = (hand.length - 1) * spacing + CARD_W;
    const left = Phaser.Math.Clamp(WIDTH / 2 - handWidth / 2, HAND_LEFT, HAND_RIGHT - handWidth);
    hand.forEach((instanceId, index) => {
      this.renderCard(instanceId, left + CARD_W / 2 + index * spacing, COMBAT_LAYOUT.handY);
    });

    this.renderPile(seat, COMBAT_LAYOUT.pile.y, 0x3f7fd0, "của bạn");
    if (this.state.status !== "mulligan" && this.state.status !== "won" && this.state.status !== "lost") {
      this.renderEndTurn(seat);
    }
  }

  /** Top-right, under the settings icon: Nguyệt Lực, Dự Trữ as a green badge when kept. */
  private renderMoonPower(seat: PlayerState) {
    const { x, y } = COMBAT_LAYOUT.moonPower;
    const power = seat.moonPower;
    const reserve = Math.min(seat.moonReserve, power);
    const orb = this.badge(x, y, 30, `${power}`, COLORS.goldFill, this.root, 0x2a2410, 24, COLORS.gold);
    if (reserve > 0) this.badge(x, y + 46, 13, `${reserve}`, 0x7fe07f, this.root, 0x1f4a2a, 12);
    orb.setInteractive();
    this.hoverTooltip(orb, () => ({ x: x - 250, y: y + 34 }), () => [
      `Nguyệt Lực ${power}`,
      reserve > 0 ? `Trong đó ${reserve} Dự Trữ (giữ từ lượt trước)` : "",
      seat.moonPowerBonus > 0 ? `+${seat.moonPowerBonus} mỗi lượt` : "",
    ]);
  }

  /**
   * Bottom-right round button: ⌛ ends the turn (✓ marks the seat done in co-op,
   * `17` §9.3) and shows the round. Dim while it is not this seat's move; the
   * tooltip says whose turn it is.
   */
  private renderEndTurn(seat: PlayerState) {
    const { x, y } = COMBAT_LAYOUT.endTurn;
    const coop = this.isCoop;
    const canAct = this.state.status === "playerTurn" || (coop && this.state.status === "choosing");
    const myDone = coop && seat.done === true;
    const active = canAct && !myDone;
    const btn = this.add.circle(x, y, 46, active ? COLORS.button : 0x23283c, 0.95);
    btn.setStrokeStyle(active ? 2 : 1, active ? COLORS.goldFill : COLORS.panelBorder);
    this.root.add(btn);
    this.text(x, y - 8, coop ? "✓" : "⌛", 26, active ? COLORS.gold : COLORS.dimText).setOrigin(0.5);
    this.text(x, y + 22, `Vòng ${this.state.round}`, 11, active ? COLORS.text : COLORS.dimText).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: active });
    if (active) {
      btn.on("pointerover", () => btn.setFillStyle(0x3a5090, 0.95));
      btn.on("pointerout", () => btn.setFillStyle(COLORS.button, 0.95));
      btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0 && !this.inputLocked) this.dispatch({ type: "endTurn" });
      });
    }
    const keep = Math.min(this.gameData.combatConfig.moonReserveMax, seat.moonPower);
    const partnerDone = this.state.players.find((p) => p.index !== this.mySeat)?.done === true;
    const waiting = myDone
      ? partnerDone ? "Chờ lượt kẻ địch" : "Đã xong — chờ đồng đội"
      : this.state.status === "enemyTurn"
        ? "Lượt kẻ địch"
        : this.state.status === "opponentTurn"
          ? coop ? "Chờ đồng đội" : "Lượt đối thủ"
          : "";
    this.hoverTooltip(btn, () => ({ x: x - 290, y: y - 60 }), () =>
      active
        ? [`${coop ? "Xong lượt" : "Kết thúc lượt"} (phím E) — vòng ${this.state.round}`, `Giữ ${keep} Nguyệt Lực sang lượt sau`]
        : [waiting, `Vòng ${this.state.round}`],
    );
  }

}
