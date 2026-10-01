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
  StatusId,
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
import { GLOW as VFX_GLOW, STAR as VFX_STAR, ensureTextures } from "../ui/vfx";
import { HUD, hudImage } from "../ui/hud-art";
import { cardColorOf, cardIconOf } from "../ui/attack-style";
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
  visibleWorld,
} from "../ui/theme";

const WIDTH = 1280;
const HEIGHT = 720;
/**
 * The round socket in the top frame of `backgrounds/background.png`, in source
 * pixels (1671×941): where the moon icon sits and how big it fits. Re-measure
 * if the art changes.
 */
const BG_MOON_SOCKET = { x: 836, y: 26, size: 52 };

const CARD_W = 110;
const CARD_H = 160;
/** Hand zone: clear of the draw pile (left) and the end-turn button (right). */
const HAND_LEFT = 130;
const HAND_RIGHT = 1140;
/** A hovered hand card is lifted (scaled 1.15) until its bottom edge shows. */
const HAND_LIFT_Y = HEIGHT - (CARD_H * 1.15) / 2 - 6;
/** Unit cards are portrait (2:3): enemies / opponents on the top row, own heroes below. */
/** Both rows use one card size; the top row sits below the frame, clear of the moon socket. */
const UNIT_W = 136;
const UNIT_H = 196;
const TOP_ROW_Y = 170;
/** Own row: bottom edge ~46 px above the peeking hand (top ≈ 600), leaving the middle for the action. */
const HERO_ROW_Y = 456;
/** Corner radius of every card (units, hand, art). */
const CARD_RADIUS = 9;
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
  /** Draws the HP bar above the name strip when given. */
  maxHp?: number;
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
  /** Where the moon icon sits (the background art's socket); set by `renderBackground`. */
  private moonAnchor: { x: number; y: number; size: number } = { ...COMBAT_LAYOUT.moon, size: 46 };
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
    // The background covers the visible window, so a resize redraws the screen.
    const onResize = () => this.renderAll();
    this.scale.on("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", onResize));
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
      moonAnchor: this.moonAnchor,
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
    if (this.state.mode === "pvp") {
      this.renderOpponentRow();
      this.renderOpponentHand();
    } else {
      this.renderEnemies();
    }
    if (this.isCoop) this.renderPartnerHand();
    this.renderHeroes();
    // After the units: a centered top-row card reaches up to the frame socket.
    this.renderMoon();
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

  /** A black veil over everything the window shows (wider than the design area under EXPAND). */
  private screenDim(alpha: number): Phaser.GameObjects.Rectangle {
    const view = visibleWorld(this);
    return this.add.rectangle(view.x + view.w / 2, view.y + view.h / 2, view.w, view.h, 0x000000, alpha);
  }

  /** A w×h rounded box centered on (0, 0): optional fill, optional stroke. */
  private roundBox(
    w: number,
    h: number,
    fill: number | null,
    fillAlpha = 1,
    strokeWidth = 0,
    strokeColor = 0,
    radius = CARD_RADIUS,
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    if (fill !== null) g.fillStyle(fill, fillAlpha).fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    if (strokeWidth > 0) g.lineStyle(strokeWidth, strokeColor, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    return g;
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
  /**
   * Covers the whole visible window, anchored to the top edge so the art's
   * frame (and its moon socket) stays in view; extra height crops the bottom.
   * Also places the moon icon in that socket (`moonAnchor`).
   */
  private renderBackground() {
    const phase = this.gameData.moonPhases[this.state.moonIndex]!;
    const bloodMoon = this.state.bloodMoonRounds > 0;
    const view = visibleWorld(this);
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    const key = "backgrounds:background";
    this.moonAnchor = { x: COMBAT_LAYOUT.moon.x, y: COMBAT_LAYOUT.moon.y, size: 46 };
    if (!this.textures.exists(key)) {
      this.root.add(this.add.rectangle(cx, cy, view.w, view.h, bloodMoon ? BLOOD_MOON_BG : PHASE_BG[phase.id]));
      return;
    }
    const source = this.textures.get(key).getSourceImage();
    const scale = Math.max(view.w / source.width, view.h / source.height);
    this.root.add(this.add.image(cx, view.y, key).setOrigin(0.5, 0).setScale(scale));
    const socket = BG_MOON_SOCKET;
    this.moonAnchor = {
      x: cx + (socket.x - source.width / 2) * scale,
      y: view.y + socket.y * scale,
      size: socket.size * scale,
    };
    this.root.add(this.add.rectangle(cx, cy, view.w, view.h, 0x060a18, 0.3));
    if (bloodMoon) {
      this.root.add(this.add.rectangle(cx, cy, view.w, view.h, BLOOD_MOON_BG, 0.35));
      this.root.add(this.add.rectangle(cx, cy, view.w - 24, view.h - 24).setStrokeStyle(24, 0xc01030, 0.35));
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
  /** The current phase's icon, sitting bare in the background art's moon socket. */
  private renderMoon() {
    const { x, y, size } = this.moonAnchor;
    const phase = this.gameData.moonPhases[this.state.moonIndex]!;
    const bloodMoon = this.state.bloodMoonRounds > 0;
    const iconKey = `ui:moon_${bloodMoon ? "blood" : phase.id}`;
    const moon = this.textures.exists(iconKey)
      ? this.add.image(x, y, iconKey).setDisplaySize(size, size)
      : this.text(x, y, phase.icon, Math.round(size * 0.6), COLORS.gold).setOrigin(0.5);
    this.root.add(moon);
    moon.setInteractive();
    this.hoverTooltip(moon, () => ({ x: x + size / 2 + 8, y: y - 10 }), () => [
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
    c.add(this.roundBox(w, h, spec.hostile ? COLORS.panelEnemy : COLORS.panelHero, 1, isValidTarget ? 3 : 2, isValidTarget ? COLORS.goldFill : spec.frame));
    const panel = this.add.rectangle(0, 0, w, h, 0x000000, 0.001);
    c.add(panel);
    this.coverImage(spec.artKey, 0, 0, w - 6, h - 6, c);
    c.add(this.add.rectangle(0, h / 2 - 15, w - 6, 24, 0x0a0e20, 0.8));
    this.fitWidth(this.text(0, h / 2 - 15, spec.name, 12, spec.nameColor ?? COLORS.text, c).setOrigin(0.5), w - 14);
    this.hpPlate(c, spec, w, h);
    if (spec.stealth) this.stealthVeil(c, w, h);
    this.statusLooks(c, w, h, spec.statuses);
    if (!spec.alive) {
      c.add(this.roundBox(w, h, 0x000000, 0.6));
      this.text(0, 0, "Ngã", 18, "#ffffff", c).setOrigin(0.5);
      // Hồi Hồn (`18` §3.5): keep the gold frame readable over the dim overlay.
      if (isValidTarget) c.add(this.roundBox(w, h, null, 0, 3, COLORS.goldFill));
    }
    this.unitPanelHit(panel, w, h, id);
    this.hoverTooltip(panel, () => ({ x: x + w / 2 + 8, y: y - h / 2 }), spec.tooltip);
    this.statusIcons(spec, c);
    if (this.targeting !== null && !isValidTarget) c.setAlpha(0.4);
    return c;
  }

  /**
   * HP in a red heart at the top-left corner, armor as a shield under it, and a
   * thin HP bar above the name strip (green for allies, red for foes).
   */
  private hpPlate(c: Phaser.GameObjects.Container, spec: UnitCardSpec, w: number, h: number) {
    const gx = -w / 2 + 17;
    const gy = -h / 2 + 17;
    c.add(hudImage(this, HUD.heart, gx, gy, 0.95));
    c.add(this.add.text(gx, gy - 1, `${spec.hp}`, { ...TEXT_BASE, fontSize: "14px", fontStyle: "bold", color: "#ffffff", stroke: "#05070f", strokeThickness: 3 }).setOrigin(0.5));
    if (spec.armor > 0) {
      c.add(hudImage(this, HUD.shield, gx, gy + 32, 0.85));
      c.add(this.add.text(gx, gy + 31, `${spec.armor}`, { ...TEXT_BASE, fontSize: "12px", fontStyle: "bold", color: "#ffffff", stroke: "#0a1830", strokeThickness: 3 }).setOrigin(0.5));
    }
    if (!spec.maxHp) return;
    const barW = w - 12;
    const barY = h / 2 - 29;
    const ratio = Math.max(0, Math.min(1, spec.hp / spec.maxHp));
    const fill = spec.hostile ? 0xd03a4a : 0x4cc070;
    c.add(this.add.rectangle(0, barY, barW + 2, 6, 0x05070f, 0.85).setStrokeStyle(1, 0xb08a3a, 0.8));
    if (ratio > 0) {
      c.add(this.add.rectangle(-barW / 2, barY, barW * ratio, 4, fill).setOrigin(0, 0.5));
      c.add(this.add.rectangle(-barW / 2, barY - 1, barW * ratio, 1, 0xffffff, 0.35).setOrigin(0, 0.5));
    }
  }

  /** Point at distance `d` along a w×h card's border, clockwise from the top center. */
  private framePoint(w: number, h: number, d: number): { x: number; y: number } {
    const per = 2 * (w + h);
    let t = ((d % per) + per) % per;
    const legs: [number, (t: number) => { x: number; y: number }][] = [
      [w / 2, (t) => ({ x: t, y: -h / 2 })],
      [h, (t) => ({ x: w / 2, y: -h / 2 + t })],
      [w, (t) => ({ x: w / 2 - t, y: h / 2 })],
      [h, (t) => ({ x: -w / 2, y: h / 2 - t })],
      [w / 2, (t) => ({ x: -w / 2 + t, y: -h / 2 })],
    ];
    for (const [len, at] of legs) {
      if (t <= len) return at(t);
      t -= len;
    }
    return { x: 0, y: -h / 2 };
  }

  /** Thức Tỉnh progress: the frame is traced in gold from the top center, clockwise. */
  private frameTrace(c: Phaser.GameObjects.Container, w: number, h: number, progress: number) {
    if (progress <= 0) return;
    const g = this.add.graphics().lineStyle(2.5, COLORS.goldFill, 0.9);
    const total = 2 * (w + h) * progress;
    g.beginPath();
    const start = this.framePoint(w, h, 0);
    g.moveTo(start.x, start.y);
    for (let d = 4; d <= total; d += 4) {
      const p = this.framePoint(w, h, d);
      g.lineTo(p.x, p.y);
    }
    g.strokePath();
    c.add(g);
  }

  /** Thức Tỉnh: two moonlit neon comets run around the frame forever over a soft gold rim. */
  private neonFrame(c: Phaser.GameObjects.Container, w: number, h: number) {
    c.add(this.roundBox(w + 2, h + 2, null, 0, 2, 0xffe9a0, CARD_RADIUS + 1).setAlpha(0.55));
    const g = this.add.graphics().setBlendMode("ADD");
    c.add(g);
    const per = 2 * (w + h);
    const tail = per * 0.22;
    const run = { d: 0 };
    const draw = () => {
      g.clear();
      for (const offset of [0, per / 2]) {
        for (let i = 0; i < 18; i++) {
          const a = this.framePoint(w, h, run.d + offset - (tail * i) / 18);
          const b = this.framePoint(w, h, run.d + offset - (tail * (i + 1)) / 18);
          const fade = 1 - i / 18;
          // Moonlit neon: a wide cyan glow with a white-hot core, distinct from the gold frame.
          g.lineStyle(4 + 8 * fade, 0x4fc8ff, 0.5 * fade).lineBetween(a.x, a.y, b.x, b.y);
          g.lineStyle(2.5, 0xe8fbff, fade).lineBetween(a.x, a.y, b.x, b.y);
        }
        const head = this.framePoint(w, h, run.d + offset);
        g.fillStyle(0x4fc8ff, 0.45).fillCircle(head.x, head.y, 7);
        g.fillStyle(0xffffff, 1).fillCircle(head.x, head.y, 3);
      }
    };
    draw();
    const tween = this.tweens.add({ targets: run, d: per, duration: 2600, repeat: -1, ease: "Linear", onUpdate: draw });
    g.once("destroy", () => tween.remove());
  }

  /** A looping tween on a card part; it dies with the part when `renderAll` rebuilds the card. */
  private loopTween(target: Phaser.GameObjects.GameObject, config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">) {
    const tween = this.tweens.add({ targets: target, yoyo: true, repeat: -1, ease: "Sine.easeInOut", ...config });
    target.once("destroy", () => tween.remove());
  }

  /** Đóng Băng: an icy film with a frost rim and snowflakes on the card edges, breathing slowly. */
  private frostOverlay(c: Phaser.GameObjects.Container, w: number, h: number) {
    const ice = this.roundBox(w, h, 0x9fd4ff, 0.2, 3, 0xd8f0ff);
    c.add(ice.setAlpha(0.7));
    this.loopTween(ice, { alpha: 1, duration: 1300 });
    if (!this.textures.exists("ui:status_freeze")) return;
    for (const side of [-1, 1]) {
      const flake = this.add.image(side * (w / 2 - 2), -12, "ui:status_freeze").setDisplaySize(22, 22);
      c.add(flake);
      this.loopTween(flake, { angle: side * 25, duration: 2400 });
    }
  }

  /** Ẩn Thân: the card fades into a drifting mist. */
  private stealthVeil(c: Phaser.GameObjects.Container, w: number, h: number) {
    const mist = this.roundBox(w, h, 0x8899ff, 0.28);
    c.add(mist.setAlpha(0.35));
    c.setAlpha(0.72);
    this.loopTween(mist, { alpha: 1, duration: 1600 });
  }

  /**
   * Lasting looks of the statuses a unit carries, drawn inside its card so they
   * die with it on re-render. Ẩn Thân comes from `spec.stealth` (`stealthVeil`).
   */
  private statusLooks(c: Phaser.GameObjects.Container, w: number, h: number, statuses: StatusInstance[]) {
    ensureTextures(this);
    const looks: Partial<Record<StatusId, () => void>> = {
      freeze: () => this.frostOverlay(c, w, h),
      // Thiêu Đốt: heat along the bottom edge, embers rising off the card.
      burn: () => {
        this.edgeGlow(c, w, h, 0xff6a30);
        this.drift(c, w, h, { from: "bottom", speedY: [-55, -22], tint: [0xff8040, 0xffb060, 0xff5030], scale: 0.12, frequency: 70 });
      },
      // Khiêu Khích: a red rim pulsing around the card, the taunt flag swaying on its top edge.
      taunt: () => {
        this.rimPulse(c, w, h, 0xff6a50, true);
        this.edgeIcon(c, "ui:status_taunt", 0, -h / 2 - 2, 26, { angle: 8, duration: 900 }, [0.3, 0.9]);
      },
      // Suy Yếu: violet wisps sinking down the card.
      weak: () => this.drift(c, w, h, { from: "top", speedY: [18, 40], tint: [0xb9a8ff, 0x7a68c8], scale: 0.11, frequency: 150 }),
      // Dễ Vỡ: a glowing crack across the card, flickering.
      vulnerable: () => this.crack(c, w, h),
      // Đánh Dấu: a crosshair turning slowly over the card.
      mark: () => this.edgeIcon(c, "ui:status_mark", 0, -14, w * 0.62, { angle: 360, duration: 6000, yoyo: false, ease: "Linear" }, [0.5, 0.5], 0.5),
      // Hồi Phục: soft green light at the bottom, motes drifting up.
      regen: () => {
        this.edgeGlow(c, w, h, 0x58d870);
        this.drift(c, w, h, { from: "bottom", speedY: [-28, -12], tint: [0x7fe07f, 0xc8ffb0], scale: 0.1, frequency: 160 });
      },
      // Sức Mạnh: an orange power rim.
      strength: () => this.rimPulse(c, w, h, 0xffa060, false),
      // Cường Hóa: gold stars twinkling over the card.
      empower: () =>
        this.drift(c, w, h, { from: "all", speedY: [-4, 4], tint: [0xf4d35e, 0xfff4c2], scale: 0.32, frequency: 220, texture: VFX_STAR, lifespan: 800 }),
      // Phản Đòn: a light sheen sweeping across the card.
      reflect: () => this.sheen(c, w, h),
      // Hộ Vệ: a blue barrier around the card, breathing.
      guard: () => {
        const barrier = this.roundBox(w + 8, h + 8, 0x9fd4ff, 0.14, 2, 0x9fd4ff, CARD_RADIUS + 4);
        c.add(barrier.setAlpha(0.7));
        this.loopTween(barrier, { scaleX: 1.025, scaleY: 1.02, alpha: 1, duration: 1000 });
      },
      // Mê Hoặc: small hearts floating up.
      charm: () => {
        if (!this.textures.exists("ui:status_charm")) return;
        this.drift(c, w, h, { from: "bottom", speedY: [-30, -14], tint: [0xffffff], scale: 14 / (48 * RENDER_SCALE), frequency: 260, texture: "ui:status_charm", add: false });
      },
    };
    for (const status of statuses) looks[status.id]?.();
  }

  /** A soft colored glow breathing along the card's bottom edge. */
  private edgeGlow(c: Phaser.GameObjects.Container, w: number, h: number, color: number) {
    const glow = this.add.image(0, h / 2 - 8, VFX_GLOW).setBlendMode("ADD").setTint(color).setAlpha(0.3);
    glow.setScale((w / 64) * 0.75, 0.35);
    c.add(glow);
    this.loopTween(glow, { alpha: 0.55, duration: 650 });
  }

  /** A colored rim pulsing around the card; `halo` adds a wide soft outer band. */
  private rimPulse(c: Phaser.GameObjects.Container, w: number, h: number, color: number, halo: boolean) {
    const rim = this.roundBox(w + 4, h + 4, null, 0, 3, color, CARD_RADIUS + 2);
    c.add(rim);
    this.loopTween(rim, { alpha: 0.35, duration: 700 });
    if (!halo) return;
    const band = this.roundBox(w + 10, h + 10, null, 0, 8, color, CARD_RADIUS + 5).setAlpha(0.25);
    c.add(band);
    this.loopTween(band, { scaleX: 1.04, scaleY: 1.03, alpha: 0.45, duration: 700 });
  }

  /** A status icon sitting on the card, animated by `motion` (looping). */
  private edgeIcon(
    c: Phaser.GameObjects.Container,
    key: string,
    x: number,
    y: number,
    size: number,
    motion: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">,
    origin: [number, number],
    alpha = 1,
  ) {
    if (!this.textures.exists(key)) return;
    const icon = this.add.image(x, y, key).setDisplaySize(size, size).setOrigin(...origin).setAlpha(alpha);
    c.add(icon);
    this.loopTween(icon, motion);
  }

  /** Particles drifting over the card (inside it, so they go with it). */
  private drift(
    c: Phaser.GameObjects.Container,
    w: number,
    h: number,
    opts: {
      from: "top" | "bottom" | "all";
      speedY: [number, number];
      tint: number[];
      scale: number;
      frequency: number;
      texture?: string;
      lifespan?: number;
      add?: boolean;
    },
  ) {
    const y = opts.from === "top" ? -h / 2 + 16 : opts.from === "bottom" ? h / 2 - 10 : 0;
    c.add(
      this.add.particles(0, y, opts.texture ?? VFX_GLOW, {
        x: { min: -w / 2 + 6, max: w / 2 - 6 },
        ...(opts.from === "all" ? { y: { min: -h / 2 + 10, max: h / 2 - 30 } } : {}),
        speedY: { min: opts.speedY[0], max: opts.speedY[1] },
        speedX: { min: -10, max: 10 },
        lifespan: opts.lifespan ?? { min: 900, max: 1500 },
        scale: { start: opts.scale, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: opts.tint,
        blendMode: opts.add === false ? "NORMAL" : "ADD",
        frequency: opts.frequency,
      }),
    );
  }

  /** Dễ Vỡ: a jagged glowing crack from the top edge down the card, flickering. */
  private crack(c: Phaser.GameObjects.Container, w: number, h: number) {
    const path = [
      [0.2, -0.5],
      [0.06, -0.26],
      [0.2, -0.1],
      [-0.03, 0.08],
      [0.09, 0.22],
    ].map(([x, y]) => [x! * w, y! * h] as const);
    const g = this.add.graphics();
    for (const [width, color, alpha] of [[5, 0xff6a30, 0.35], [1.6, 0xffd2b0, 0.95]] as const) {
      g.lineStyle(width, color, alpha).beginPath();
      g.moveTo(path[0]![0], path[0]![1]);
      for (const [x, y] of path.slice(1)) g.lineTo(x, y);
      g.moveTo(path[2]![0], path[2]![1]).lineTo(path[2]![0] + w * 0.16, path[2]![1] + h * 0.06);
      g.strokePath();
    }
    c.add(g);
    this.loopTween(g, { alpha: 0.4, duration: 420 });
  }

  /** Phản Đòn: a narrow band of light sweeping across the card every couple of seconds. */
  private sheen(c: Phaser.GameObjects.Container, w: number, h: number) {
    const band = this.add.image(-w / 2 + 10, 0, VFX_GLOW).setBlendMode("ADD").setTint(0xcfe8ff).setAlpha(0.45);
    band.setScale(0.25, (h / 64) * 0.9);
    c.add(band);
    this.loopTween(band, { x: w / 2 - 10, duration: 700, yoyo: false, repeatDelay: 1600, ease: "Sine.easeInOut" });
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
      // Clear of the HP bar (h/2 - 32 … h/2 - 26).
      const iy = spec.h / 2 - 37 - r - Math.floor(index / perRow) * step;
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
    const rounded = `${key}@${w}x${h}`;
    if (!this.textures.exists(rounded)) {
      const source = this.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
      const scale = Math.max(w / source.width, h / source.height);
      const cropW = Math.min(source.width, w / scale);
      const cropH = Math.min(source.height, h / scale);
      const canvas = this.textures.createCanvas(rounded, Math.ceil(w * RENDER_SCALE), Math.ceil(h * RENDER_SCALE));
      if (!canvas) return null;
      const ctx = canvas.getContext();
      ctx.scale(RENDER_SCALE, RENDER_SCALE);
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, CARD_RADIUS - 2);
      ctx.clip();
      ctx.drawImage(source, (source.width - cropW) / 2, (source.height - cropH) / 2, cropW, cropH, 0, 0, w, h);
      canvas.refresh();
    }
    const img = this.add.image(x, y, rounded).setScale(1 / RENDER_SCALE);
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
      maxHp: summon.maxHp,
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
        maxHp: enemy.maxHp,
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
    this.root.add(this.screenDim(0.55).setDepth(200));
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
      maxHp: hero.maxHp,
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
    if (!hero.alive) return;
    if (hero.leveledUp) this.neonFrame(c, w, h);
    else this.frameTrace(c, w, h, Math.min(1, hero.levelUpCounter / threshold));
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
  /**
   * Draw pile as stacked card backs (up to three layers, by how many are left)
   * with a count lozenge; the discard pile as a small greyed back beside it.
   * `color` tints the backs of another seat's pile.
   */
  private renderPile(seat: PlayerState, y: number, color: number, owner: string) {
    const x = COMBAT_LAYOUT.pile.x + 34;
    const left = seat.drawPile.length;
    const low = left <= 6;
    const tint = owner === "của bạn" ? 0xffffff : color;
    const layers = left === 0 ? 0 : Math.min(3, 1 + Math.floor(left / 10));
    for (let i = layers - 1; i >= 0; i--) {
      this.root.add(hudImage(this, HUD.cardBack, x + i * 4, y - i * 4, 0.82).setTint(tint).setAlpha(i === 0 ? 1 : 0.85));
    }
    if (layers === 0) this.root.add(this.add.rectangle(x, y, 66, 95).setStrokeStyle(1, COLORS.panelBorder, 0.8));
    this.root.add(hudImage(this, HUD.count, x, y + 50));
    this.text(x, y + 50, `${left}`, 13, low ? "#ff8a8a" : COLORS.gold).setOrigin(0.5).setStroke("#05070f", 3);
    const discard = this.add.container(x + 52, y + 34);
    discard.add(hudImage(this, HUD.cardBack, 0, 0, 0.42).setTint(0x8890a8).setAlpha(0.8));
    discard.add(this.add.text(0, 0, `${seat.discardPile.length}`, { ...TEXT_BASE, fontSize: "12px", color: COLORS.text, stroke: "#05070f", strokeThickness: 3 }).setOrigin(0.5));
    this.root.add(discard);
    const hit = this.add.zone(x + 10, y, 110, 140).setInteractive();
    this.root.add(hit);
    this.hoverTooltip(hit, () => ({ x: x + 80, y: y - 40 }), () => [
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

    const isValidTarget = this.targeting === instanceId;
    const mulliganPicked = this.mulliganPicks.has(instanceId);
    // Frame: lacquer, gold double line, moon gate, plaque, parchment; the owner's color is the border.
    const grey = (img: Phaser.GameObjects.Image) => (broken ? img.setTint(0x80808a) : img);
    container.add(grey(hudImage(this, HUD.cardFace, 0, 0)));
    container.add(
      this.roundBox(
        CARD_W,
        CARD_H,
        null,
        0,
        isValidTarget || mulliganPicked ? 3 : 2,
        broken ? COLORS.dead : isValidTarget || mulliganPicked ? COLORS.goldFill : (OWNER_COLORS[ownerId] ?? COLORS.panelBorder),
      ),
    );
    // Moon gate (center 0,-17): the card's own art if there is one, else its tag icon in a tag-colored sky.
    const gateY = -17;
    const color = cardColorOf(card);
    if (!this.coverImage(`cards:${instance.cardId}`, 0, gateY, 48, 48, container)) {
      ensureTextures(this);
      container.add(this.add.image(0, gateY, VFX_GLOW).setBlendMode("ADD").setTint(color).setScale(0.62).setAlpha(broken ? 0.15 : 0.5));
      for (const [sx, sy, r] of [[-13, -9, 0.9], [12, -13, 0.7], [15, 6, 0.6], [-16, 7, 0.5]] as const) {
        container.add(this.add.circle(sx, gateY + sy, r, 0xffffff, 0.7));
      }
      const iconKey = cardIconOf(card);
      if (this.textures.exists(iconKey)) container.add(this.add.image(0, gateY, iconKey).setDisplaySize(34, 34).setAlpha(broken ? 0.5 : 1));
    }
    // Owner jewel on the bottom edge.
    container.add(
      this.add
        .rectangle(0, CARD_H / 2 - 4, 7, 7, OWNER_COLORS[ownerId] ?? COLORS.panelBorder)
        .setAngle(45)
        .setStrokeStyle(1, COLORS.goldFill),
    );
    // Name banner (red lacquer: attack, blue: skill), its left end under the cost coin.
    const bannerX = 9;
    const bannerY = -60;
    container.add(grey(hudImage(this, card.type === "attack" ? HUD.bannerAttack : HUD.bannerSkill, bannerX, bannerY)));
    container.add(
      this.fitWidth(
        this.add
          .text(bannerX + 4, bannerY, card.name, {
            ...TEXT_BASE,
            fontSize: card.name.length > 11 ? "10px" : "11px",
            fontStyle: "bold",
            color: "#fff1d0",
            stroke: "#2a0a0a",
            strokeThickness: 2,
          })
          .setOrigin(0.5),
        64,
      ),
    );
    // Type plaque: the weapon or bond overrides the card type.
    const plaque =
      weapon !== undefined ? `⚔ ${weapon.name}` : partnerId !== undefined ? "Song Hành" : card.type === "attack" ? "Tấn Công" : "Kỹ Năng";
    container.add(
      this.fitWidth(
        this.add.text(0, 19, plaque, { ...TEXT_BASE, fontSize: "9px", color: weapon !== undefined ? "#ffb080" : COLORS.gold }).setOrigin(0.5),
        56,
      ),
    );
    if (weapon !== undefined) {
      // Weapon card (`01` §14.2): inner orange frame and the weapon's name.
      if (!broken && !isValidTarget) {
        container.add(this.roundBox(CARD_W - 8, CARD_H - 8, null, 0, 2, 0xe08a3c, CARD_RADIUS - 2));
      }
    }
    if (partnerId !== undefined) {
      // Bond card: second owner's color as an inner border.
      if (!broken && !isValidTarget) {
        container.add(this.roundBox(CARD_W - 8, CARD_H - 8, null, 0, 2, OWNER_COLORS[partnerId] ?? COLORS.panelBorder, CARD_RADIUS - 2));
      }
    }

    const hintComboId = this.comboHints.get(instanceId);
    if (hintComboId !== undefined) {
      // Hợp Kích hint (`17` §9.3): bright frame marks a card whose other half
      // the partner already played this turn.
      container.add(this.roundBox(CARD_W - 4, CARD_H - 4, null, 0, 2, 0xffe080, CARD_RADIUS - 1));
      container.add(
        this.add
          .text(0, CARD_H / 2 - 14, "⚡ Hợp Kích", { ...TEXT_BASE, fontSize: "10px", color: "#ffe080", stroke: "#2a1a04", strokeThickness: 3 })
          .setOrigin(0.5),
      );
    }

    const effectiveCost = getEffectiveCost(this.gameData, this.state, instanceId);
    // Inset so the coin's rim sits clear of the card border.
    const coinX = -CARD_W / 2 + 19;
    const coinY = -60;
    container.add(hudImage(this, HUD.cost, coinX, coinY, 0.82));
    container.add(
      this.add
        .text(coinX, coinY, `${effectiveCost}`, {
          ...TEXT_BASE,
          fontSize: "15px",
          fontStyle: "bold",
          color: effectiveCost < card.cost ? COLORS.costCheap : COLORS.gold,
          stroke: "#05070f",
          strokeThickness: 3,
        })
        .setOrigin(0.5),
    );
    if (effectiveCost < card.cost) {
      container.add(
        this.add
          .text(coinX, coinY + 17, `${card.cost}`, {
            ...TEXT_BASE,
            fontSize: "10px",
            color: COLORS.dimText,
          })
          .setOrigin(0.5),
      );
      container.add(
        this.add.rectangle(coinX, coinY + 17, 9, 1, 0xffffff, 0.8),
      );
    }
    if (instance.heldTurns > 0 && card.keywords?.includes("tich_tu")) {
      container.add(
        this.add
          .text(0, 6, `Tích Tụ ${instance.heldTurns}`, { ...TEXT_BASE, fontSize: "10px", color: COLORS.gold, stroke: "#05070f", strokeThickness: 3 })
          .setOrigin(0.5),
      );
    }

    const body = this.add
      .text(0, 31, card.text, {
        ...TEXT_BASE,
        fontSize: "9px",
        color: "#3a2810",
        align: "center",
        lineSpacing: -1,
        wordWrap: { width: CARD_W - 24 },
      })
      .setOrigin(0.5, 0);
    // Long texts shrink until they fit the parchment (the tooltip has them full size).
    for (let size = 8.5; body.height > 41 && size >= 6.5; size -= 0.5) body.setFontSize(size);
    container.add(body);

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
      this.text(WIDTH / 2, 578, this.isCoop ? "Chờ đồng đội Đổi Bài…" : "Chờ đối thủ Đổi Bài…", 14, COLORS.dimText).setOrigin(0.5);
      return;
    }
    const picks = this.mulliganPicks.size;
    this.text(WIDTH / 2, 578, `Đổi Bài: chọn tối đa ${this.gameData.combatConfig.maxMulligan} lá để đổi`, 14, COLORS.gold).setOrigin(0.5);
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
    this.root.add(this.screenDim(0.6));
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
    this.root.add(this.screenDim(0.6));
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
      this.root.add(this.screenDim(0.65));
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
      this.root.add(this.screenDim(0.65));
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
    this.root.add(this.screenDim(0.65));
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
  /**
   * Nguyệt Lực orb: a dark glass core that brightens as it fills, ringed by one
   * arc per point up to the cap (gold; the kept Dự Trữ points green), the
   * number in the middle and the label underneath.
   */
  private renderMoonPower(seat: PlayerState) {
    const { x, y } = COMBAT_LAYOUT.moonPower;
    const power = seat.moonPower;
    const reserve = Math.min(seat.moonReserve, power);
    const cap = this.gameData.combatConfig.moonPower.cap;
    ensureTextures(this);
    const core = this.add.circle(x, y, 27, 0x0a0e20, 0.94).setStrokeStyle(1.5, COLORS.goldFill, 0.8);
    const glow = this.add.image(x, y, VFX_GLOW).setBlendMode("ADD").setTint(0xf4d35e);
    glow.setScale(0.55).setAlpha(0.12 + 0.6 * Math.min(1, power / cap));
    const arcs = this.add.graphics();
    const step = (Math.PI * 2) / cap;
    for (let i = 0; i < cap; i++) {
      const start = -Math.PI / 2 + i * step + 0.07;
      const color = i < reserve ? 0x7fe07f : i < power ? 0xf4d35e : 0x3a3524;
      arcs.lineStyle(5, color, i < power ? 1 : 0.9).beginPath().arc(x, y, 34, start, start + step - 0.14).strokePath();
    }
    this.root.add([glow, core, arcs]);
    this.text(x, y - 1, `${power}`, 24, COLORS.gold).setOrigin(0.5);
    this.text(x, y + 50, seat.moonPowerBonus > 0 ? `Nguyệt Lực +${seat.moonPowerBonus}` : "Nguyệt Lực", 11, COLORS.gold)
      .setOrigin(0.5)
      .setStroke("#05070f", 4);
    const orb = core;
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
    // A gold medallion: hourglass (✓ in co-op), the label, the round; it glows while it is your move.
    const medal = this.add.container(x, y);
    this.root.add(medal);
    if (active) {
      ensureTextures(this);
      const glow = this.add.image(0, 0, VFX_GLOW).setBlendMode("ADD").setTint(0xf4d35e).setScale(1.25).setAlpha(0.25);
      medal.add(glow);
      this.loopTween(glow, { alpha: 0.55, scale: 1.4, duration: 900 });
    }
    const face = hudImage(this, HUD.medallion, 0, 0);
    if (!active) face.setTint(0x6a6f88);
    medal.add(face);
    if (coop) medal.add(this.add.text(0, -16, "✓", { ...TEXT_BASE, fontSize: "24px", color: active ? COLORS.gold : COLORS.dimText }).setOrigin(0.5));
    else medal.add(hudImage(this, HUD.hourglass, 0, -16).setAlpha(active ? 1 : 0.45));
    const label = coop ? "Xong lượt" : "Kết thúc";
    medal.add(this.add.text(0, 6, label, { ...TEXT_BASE, fontSize: "12px", fontStyle: "bold", color: active ? COLORS.gold : COLORS.dimText }).setOrigin(0.5));
    medal.add(this.add.text(0, 24, `Vòng ${this.state.round}`, { ...TEXT_BASE, fontSize: "10px", color: active ? COLORS.text : COLORS.dimText }).setOrigin(0.5));
    const btn = this.add.circle(x, y, 52, 0x000000, 0.001);
    this.root.add(btn);
    btn.setInteractive({ useHandCursor: active });
    if (active) {
      btn.on("pointerover", () => medal.setScale(1.06));
      btn.on("pointerout", () => medal.setScale(1));
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
