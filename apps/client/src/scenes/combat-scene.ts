import Phaser from "phaser";
import {
  activePlayerState,
  applyAction,
  cardDefOf,
  cardOwners,
  comboHintFor,
  getEffectiveCost,
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
  UnitState,
} from "rules";
import { errorText, resumeSession } from "../account";
import { applyRecordedRunAction } from "../run-session";
import { abandonStory, recordStoryAction, startStoryTicket, submitStory } from "../story-session";
import { NetMatch } from "../net/match";
import type { PushMetadata } from "../net/match";
import type { ServerMessage } from "../net/protocol";
import { cycleEncounter, recoverMatchGone, restartSession, session } from "../session";
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
import { confirmModal, isModalOpen, registerModal } from "../ui/widgets";
import { CombatAudio } from "../ui/combat-audio";
import { loadCombatSettings, saveCombatSettings, DEFAULT_COMBAT_SETTINGS } from "../ui/combat-settings";
import type { CombatSettings } from "../ui/combat-settings";
import { buildIntroEvents, playEventQueue } from "../ui/event-animator";
import { GLOW as VFX_GLOW, STAR as VFX_STAR, VIGNETTE, ensureTextures } from "../ui/vfx";
import { CombatPlayback, type PlaybackBatch } from "../ui/combat-playback";
import { createAnimationRuntime } from "../ui/animation-runtime";
import type { AnimationRuntime } from "../ui/animation-runtime";
import { createPresentation } from "../ui/combat-presentation";
import { HUD, hudImage } from "../ui/hud-art";
import { displayStatuses, heroTooltipLines, statusBadgeModels, unitAt, weaponForHero } from "../ui/combat-display";
import type { SeatAnchors } from "../ui/combat-display";
import { computeCombatLayout, endTurnAnchor, fitChoicePanel, handSlots } from "../ui/combat-layout";
import { OfflineTurnClock } from "../ui/turn-clock";
import type { CombatLayout } from "../ui/combat-layout";
import { moonHudModel, renderMoonHud } from "../ui/moon-hud";
import { InspectorView, drawComposition, pileModel, relicHudEntries, triggerAnchorKey } from "../ui/combat-inspector";
import type { RelicHudEntry } from "../ui/combat-inspector";
import { COMPACT_CARD, combatCardModel, cardOwnerLabel, drawCardFace, ellipsize } from "../ui/combat-card-view";
import { roundedPanel } from "../ui/rounded-panel";
import { showCombatSettings } from "../ui/combat-settings-dialog";
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
 * The round socket in the top frame of `backgrounds/background.webp`, in source
 * pixels (1671×941): where the moon icon sits and how big it fits. Re-measure
 * if the art changes.
 */
const BG_MOON_SOCKET = { x: 836, y: 26, size: 52 };

const CARD_W = COMPACT_CARD.w;
const CARD_H = COMPACT_CARD.h;
/** Unit cards are portrait (2:3): enemies / opponents on the top row, own heroes below. */
const UNIT_W = 136;
const UNIT_H = 196;
/** Corner radius of every card (units, hand, art). */
const CARD_RADIUS = 9;
const BOSS_W = 144;
const BOSS_H = 204;
const SUMMON_W = 80;
const SUMMON_H = 108;
// Co-op group labels sit just above each seat's 148-tall hero row (y424).
const OWN_ROW_TOP_LABEL = 424 - 74 - 14;
const GROUP_LABEL_X_OWN = 412; // center of own slots 300/412/524
const GROUP_LABEL_X_PARTNER = 772; // center of partner slots 660/772/884

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
  /** The unit this spec was built from — badge models read raw status state. */
  unit?: UnitState;
  /** The wearer's Trang Bị — its badge is the weapon-trigger anchor (`05` review). */
  weapon?: { id: string; refinement: number; seat: number };
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
  private rootReady = false;
  private targeting: string | null = null;
  private validTargetIds = new Set<string>();
  /** The aim line from the selected card to the hovered valid target. */
  private aimLine?: Phaser.GameObjects.Graphics;
  /** The hover-only link from a Hộ Vệ badge to its guardian. */
  private guardTether?: Phaser.GameObjects.Graphics;
  private cardViews = new Map<string, Phaser.GameObjects.Container>();
  /** The shared geometry — recomputed per render so new units get anchors. */
  private layout!: CombatLayout;
  /** Where the moon icon sits (the background art's socket); set by `renderBackground`. */
  private moonAnchor: { x: number; y: number; size: number } = { x: 640, y: 40, size: 46 };
  private unitAnchors = new Map<string, { x: number; y: number }>();
  private unitViews = new Map<string, Phaser.GameObjects.Container>();
  /** The spec each unit card was last rendered with — `refreshUnit` rebuilds from its geometry. */
  private unitSpecs = new Map<string, UnitCardSpec>();
  /** Per-seat chrome (hand, piles, moon power) the batch bindings rebuild surgically. */
  private seatLayers = new Map<number, Phaser.GameObjects.Container>();
  /** Relic/weapon icon positions keyed `${player}:${kind}:${id}` — trigger flashes land here (`05` review). */
  private triggerAnchors = new Map<string, { x: number; y: number }>();
  /** The pile/relic modal — scene-owned so it dies with the scene. */
  private inspector?: InspectorView;
  /** Holds the moon badge so `updateMoon` can repaint it mid-batch. */
  private moonLayer?: Phaser.GameObjects.Container;
  /** Hand cards currently flying their cast clone — hover/click ignores them. */
  private castingIds = new Set<string>();
  private errorText?: Phaser.GameObjects.Text;
  private inputLocked = false;
  private debugVisible = false;
  private mulliganPicks = new Set<string>();
  private tooltip: Phaser.GameObjects.Container | null = null;
  /** The pending choice can be collapsed to a banner so the board stays inspectable. */
  private choiceCollapsed = false;
  private lastPendingChoice: PlayerState["pendingChoice"] = null;
  /** Wheel handler owned by the choice panel's scroll viewport (removed on rebuild). */
  private choiceWheel?: (pointer: Phaser.Input.Pointer, over: unknown, dx: number, dy: number) => void;
  /** Network match binding (`16` §8); null in offline/PvE combats. */
  private netMatch: NetMatch | null = null;
  private mySeat = 0;
  private timerText: Phaser.GameObjects.Text | null = null;
  /** Offline turn clock (`combatConfig.turnSeconds`); null when a net match drives the deadline. */
  private turnClock: OfflineTurnClock | null = null;
  private endTurnObjects: Phaser.GameObjects.GameObject[] = [];
  private netDown = false;
  private emotePanel = false;
  private lastEmoteAt = 0;
  /** Co-op: own hand cards that complete a partner's Hợp Kích half → combo id. */
  private comboHints = new Map<string, string>();

  /** Story mode (`18` §4.4): the ticket's stage + deck while the combat runs. */
  private storyStageId: string | null = null;
  private storyDeck: { id: string; heroIds: Team } | null = null;
  private storyFinishing = false;
  /** Serial playback of event batches: local actions and server pushes queue here. */
  private playback!: CombatPlayback;
  /** The newest state the pipeline has seen; the next batch animates from it. */
  private latestState!: CombatState;
  private renderQueued = false;
  /** Post-commit follow-ups keyed by their batch (run transition, story finish). */
  private commitWork = new Map<PlaybackBatch, () => void>();
  /** Local presentation preferences — each playback batch snapshots them. */
  private settings: CombatSettings = DEFAULT_COMBAT_SETTINGS;
  private audio: CombatAudio = new CombatAudio(this.settings);

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
    this.rootReady = false;
    this.endTurnObjects = [];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.rootReady = false;
      this.endTurnObjects = [];
    });
    this.gameData = session.data;
    this.netMatch = session.match;
    this.state = this.netMatch ? this.netMatch.view : session.state;
    this.mySeat = this.netMatch?.you ?? 0;
    this.netDown = false;
    this.timerText = null;
    this.turnClock = this.netMatch ? null : new OfflineTurnClock(this.gameData.combatConfig.turnSeconds);
    this.emotePanel = false;
    this.targeting = null;
    this.validTargetIds.clear();
    this.mulliganPicks.clear();
    this.inputLocked = false;
    this.storyStageId = session.story?.setup.stageId ?? null;
    this.storyDeck = session.story?.deck ?? null;
    this.storyFinishing = false;
    this.latestState = this.state;
    this.renderQueued = false;
    this.commitWork.clear();
    this.triggerAnchors.clear();
    this.inspector = new InspectorView(this, registerModal);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.inspector?.destroy());
    this.playback = new CombatPlayback({
      play: (batch, signal) => this.playBatch(batch, signal),
      commit: (batch) => this.commitBatch(batch),
      busy: () => this.syncInputLock(),
      failed: (error, latest) => this.playFailed(error, latest),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.playback.dispose());
    if (this.netMatch) this.bindNet(this.netMatch);
    this.syncInputLock();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unbindNet());
    // The background covers the visible window, so a resize redraws the screen.
    const onResize = () => this.requestRender();
    this.scale.on("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", onResize));
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.rootReady = true;
    this.input.mouse?.disableContextMenu();
    // Preferences are local-only; the audio context waits for the first gesture.
    this.settings = loadCombatSettings(
      localStorage,
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    );
    this.audio = new CombatAudio(this.settings);
    const unlock = () => void this.audio.unlock();
    this.input.once("pointerdown", unlock);
    this.input.keyboard?.once("keydown", unlock);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.dispose());
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        if (this.collapseChoice()) return;
        this.cancelTargeting();
      }
    });
    // A modal (settings, confirm) owns Esc — combat targeting yields to it.
    this.input.keyboard?.on("keydown-ESC", () => {
      if (isModalOpen()) return;
      if (this.collapseChoice()) return;
      this.cancelTargeting();
    });
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
        this.requestRender();
      }
    });
    this.renderAll();
    // A fresh match opens with the intro reveal; a rejoin renders settled
    // state. Local combats are always fresh — their snapshot synthesizes the
    // cosmetic stream (`16` §8.2).
    if (this.netMatch === null || this.netMatch.fresh) {
      const intro = buildIntroEvents(this.state, this.netMatch?.initialEvents ?? []);
      if (intro.length > 0) this.playback.enqueue({ before: this.state, after: this.state, events: intro });
    }
  }

  // ---- action pipeline ----

  /** Routes `match.*` frames to the live match and wires socket status. */
  private bindNet(match: NetMatch): void {
    const net = session.net!;
    // Retain for the account lifetime: frames keep landing if this scene exits (`16` §8.4).
    session.registry?.retain(match);
    net.onMessage = (message: ServerMessage) => {
      if ("matchId" in message && match.handle(message)) return;
      if (message.type === "error") this.showError(message.error);
    };
    net.onStatus = (connected) => {
      this.netDown = !connected;
      this.syncInputLock();
      if (this.scene.isActive()) this.requestRender();
    };
    net.onRecovery = (snapshot) => {
      if (snapshot !== null) {
        if (snapshot.matchId !== match.matchId) {
          // The server holds a different match — adopt it and rebind (`16` §8.4).
          this.unbindNet();
          const next = new NetMatch(net, snapshot);
          session.match = next;
          session.registry?.retain(next);
          this.netMatch = next;
          this.mySeat = next.you;
          this.bindNet(next);
          this.applyNetRejoin(session.registry?.consumeLostPending(next.matchId) ?? false);
          return;
        }
        // registry.recover already rejoined — render the reconciled view.
        const lostPending =
          session.registry !== null ? session.registry.consumeLostPending(match.matchId) : match.rejoin(snapshot);
        this.applyNetRejoin(lostPending);
        return;
      }
      // No room left — the match is gone; leave for the lobby (`16` §8.4).
      recoverMatchGone(match, {
        abortPlayback: () => this.playback.reset(),
        startScene: (key) => {
          if (this.scene.isActive()) this.scene.start(key);
        },
        refreshProfile: () => resumeSession(),
      });
    };
    // A `match.sync` answer resyncs the seat the same way a welcome rejoin does.
    match.onRejoin = (_snapshot, lostPending) => this.applyNetRejoin(lostPending);
    match.onPush = (events, view, metadata) => this.onNetPush(events, view, metadata);
    match.onEnd = () => {
      this.inputLocked = true;
      // Terminal screen after the queued beats have played out.
      this.playback.whenIdle(() => {
        this.syncInputLock();
        if (this.scene.isActive()) this.renderAll();
      });
      // Profile refresh and the settlement notice are the registry's job (`16` §8.4).
    };
    match.onRejected = (reason) => {
      this.syncInputLock();
      this.showError(reason);
    };
    match.onEmote = (from, emoteId) => this.showEmote(from, emoteId);
  }

  /** Rejoin/sync: rebuild everything from the authoritative view (`16` §8.5). */
  private applyNetRejoin(lostPending: boolean): void {
    const match = this.netMatch!;
    // The rejoin's snapshot replaces everything: abort in-flight/queued
    // playback before rebuilding the UI from the authoritative view.
    this.playback.reset();
    this.commitWork.clear();
    this.state = match.view;
    this.latestState = match.view;
    this.targeting = null;
    this.mulliganPicks.clear();
    this.syncInputLock();
    if (this.scene.isActive()) this.renderAll();
    if (lostPending) this.showError("Thao tác chưa được xác nhận, hãy thử lại.");
  }

  private unbindNet(): void {
    if (!this.netMatch) return;
    this.netMatch.onPush = () => {};
    this.netMatch.onEnd = () => {};
    this.netMatch.onRejected = () => {};
    this.netMatch.onEmote = () => {};
    this.netMatch.onRejoin = () => {};
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

  /** A `match.events` push: queue the batch; its `after` view commits once the events played. */
  private onNetPush(events: CombatEvent[], view: CombatState, metadata?: PushMetadata): void {
    if (!this.scene.isActive()) {
      this.state = view;
      this.latestState = view;
      return;
    }
    this.targeting = null;
    // Combo/phase banners are queue beats inside the event stream (`17` §9.3).
    this.playback.enqueue({
      before: this.latestState,
      after: view,
      events,
      revealedCards: metadata?.revealedCards,
    });
    this.latestState = view;
  }

  /**
   * A dispatched `playCard`/`chooseCard`/`mulligan` removes the hovered card from
   * the board — destroy its tooltip immediately instead of waiting for a
   * `pointerout` that never fires once the container is rebuilt.
   */
  private hideCardTooltipOn(action: Action): void {
    if (action.type !== "playCard" && action.type !== "chooseCard" && action.type !== "mulligan") return;
    this.tooltip?.destroy();
    this.tooltip = null;
  }

  private dispatch(action: Action): boolean {
    if (this.inputLocked) return false;
    if (this.netMatch) {
      // The server validates; rejected actions come back as match.rejected.
      // A false return means the frame never left — nothing new is pending.
      if (!this.netMatch.sendAction(action)) {
        this.showError(
          this.netMatch.pending ? "Đang chờ xác nhận thao tác trước…" : "Mất kết nối — thao tác chưa gửi được.",
        );
        return false;
      }
      this.hideCardTooltipOn(action);
      this.syncInputLock();
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
    this.hideCardTooltipOn(action);
    const batch: PlaybackBatch = { before: this.latestState, after: newState, events: result.events };
    this.latestState = newState;
    // Post-commit: run graph transition or story verification (`18` §4.4).
    this.commitWork.set(batch, () => {
      if (backToRun) {
        this.scene.start("run");
        return;
      }
      if (this.isStory && session.story !== null && (newState.status === "won" || newState.status === "lost")) {
        this.finishStory();
      }
    });
    this.playback.enqueue(batch);
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

  /** One batch's beat: all FX owned by a per-batch runtime the queue can abort. */
  private playBatch(batch: PlaybackBatch, signal: AbortSignal): Promise<void> {
    // The batch snapshots the current preferences — a mid-batch change waits
    // for the next batch's runtime (`16` §8.3).
    const runtime = createAnimationRuntime(this, signal, this.settings);
    return playEventQueue(runtime, batch.events, {
      gameData: this.gameData,
      presentation: createPresentation(batch.before),
      after: batch.after,
      before: batch.before,
      bindings: {
        updateUnit: (unitId, visual) => this.refreshUnit(unitId, visual),
        updateSeat: (player, visual) => this.refreshSeat(player, visual),
        ensureSummon: (unitId, visual) => this.ensureSummonView(unitId, visual),
        updateMoon: (visual) => this.refreshMoon(visual),
      },
      revealedCards: batch.revealedCards,
      unitAnchors: this.unitAnchors,
      unitViews: this.unitViews,
      cardViews: this.cardViews,
      seatAnchors: this.layout.seats,
      castView: (instanceId) => this.makeCastView(instanceId),
      moonAnchor: this.moonAnchor,
      layout: this.layout,
      mySeat: this.mySeat,
      triggerAnchors: this.triggerAnchors,
      runtime,
      audio: this.audio,
      forfeited: this.netMatch?.forfeited,
    })
      .then(() => runtime.drain())
      .finally(() => {
        runtime.dispose();
        // An abort leaves the source card dimmed+deafened — restore it; the
        // commit render rebuilds everything anyway. The source may already be
        // destroyed (a mid-batch seat refresh rebuilds the hand), so only a
        // still-live view gets its interactivity back.
        for (const id of this.castingIds) {
          const view = this.cardViews.get(id);
          if (view === undefined || view.scene === undefined) continue;
          view.setAlpha(1);
          view.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
          });
        }
        this.castingIds.clear();
      });
  }

  /** A detached clone of a hand card for the cast beat; the source sleeps meanwhile. */
  private makeCastView(instanceId: string): Phaser.GameObjects.Container | undefined {
    const source = this.cardViews.get(instanceId);
    if (source === undefined) return undefined;
    const clone = this.renderCard(instanceId, source.x, source.y, { register: false, interactive: false });
    source.setAlpha(0);
    source.disableInteractive();
    this.castingIds.add(instanceId);
    return clone;
  }

  private seatLayerOf(playerIndex: number): Phaser.GameObjects.Container {
    return this.seatLayers.get(playerIndex) ?? this.root;
  }

  // ---- presentation bindings ----

  /**
   * One unit's card refilled from the visual state in place — the container
   * (and its anchor) survives so in-flight shakes keep their target. Specs
   * rebuild from the unit's stored geometry plus `visual`'s live fields.
   */
  private refreshUnit(unitId: string, visual: CombatState): void {
    const view = this.unitViews.get(unitId);
    const prev = this.unitSpecs.get(unitId);
    if (view === undefined || prev === undefined) return;
    const { x, y, w, h, hostile, frame } = prev;
    const hero = visual.heroes.find((u) => u.id === unitId);
    const enemy = hero === undefined ? visual.enemies.find((u) => u.id === unitId) : undefined;
    const summon = hero === undefined && enemy === undefined ? visual.summons?.find((u) => u.id === unitId) : undefined;
    let spec: UnitCardSpec | undefined;
    let boss = false;
    if (hero !== undefined) spec = this.heroSpecOf(hero, x, y, w, h, hostile, frame, visual);
    else if (enemy !== undefined) ({ spec, boss } = this.enemySpecOf(enemy, x, y, visual));
    else if (summon !== undefined) spec = this.summonSpecOf(summon, x, y, hostile, visual);
    if (spec === undefined) return;
    // The container itself may carry a stale alpha/transform from a lunged
    // attack, a targeting dim or a cleared Ẩn Thân veil — reset before refill.
    view.setPosition(spec.x, spec.y).setAlpha(1).setScale(1).setAngle(0);
    view.removeAll(true);
    this.fillUnitCard(view, spec);
    if (boss) this.renderBossBadges(view, spec.w, spec.h, visual);
    if (hero !== undefined && hero.alive) {
      // The Thức Tỉnh ring/neon lives outside the card fill — re-lay it.
      const def = this.gameData.heroes[hero.defId]!;
      const threshold =
        hero.constellation >= 2 && !hero.pvp ? def.levelUp.constellationThreshold : def.levelUp.threshold;
      if (hero.leveledUp) this.neonFrame(view, spec.w, spec.h);
      else this.frameTrace(view, spec.w, spec.h, Math.min(1, hero.levelUpCounter / threshold));
    }
    this.unitSpecs.set(unitId, spec);
  }

  /** One seat's hand/pile/orb re-rendered from the visual state; the layer itself is wiped first. */
  private refreshSeat(playerIndex: number, visual: CombatState): void {
    const layer = this.seatLayers.get(playerIndex);
    const seat = visual.players.find((p) => p.index === playerIndex);
    if (layer === undefined || seat === undefined) return;
    layer.removeAll(true);
    // Card views the wipe destroyed must not linger as live references —
    // casts, shakes and the abort-restore all reach for this map.
    for (const [id, view] of this.cardViews) {
      if (view.scene === undefined) this.cardViews.delete(id);
    }
    if (playerIndex === this.mySeat) {
      if (visual.status !== "mulligan") this.renderMoonPower(seat, layer);
      this.renderSeatHand(seat, visual, layer);
      this.renderPile(seat, this.layout.seats.get(playerIndex)!, 0x3f7fd0, "của bạn", layer);
    } else {
      this.renderPile(seat, this.layout.seats.get(playerIndex)!, this.isCoop ? 0x5f8fdd : 0x9a6fd0, this.isCoop ? "Đồng đội" : "Đối thủ", layer);
      if (this.state.mode === "pvp") {
        this.renderOpponentHand(seat, layer);
        this.renderOpponentResource(seat, layer);
      }
      else if (this.isCoop) this.renderPartnerHand(seat, layer, visual);
    }
  }

  /**
   * A summon that appeared mid-batch (`summoned`): build its card immediately
   * in the next free slot of its side's summon zone so a following
   * `summonActed`/damage event already finds its anchor.
   */
  private ensureSummonView(unitId: string, visual: CombatState): void {
    if (this.unitViews.has(unitId)) {
      this.refreshUnit(unitId, visual);
      return;
    }
    const summon = visual.summons?.find((s) => s.id === unitId);
    if (summon === undefined) return;
    const hostile = this.state.mode === "pvp" && summon.player !== this.mySeat;
    // The layout slot the summon occupies in the visual state — the same math
    // the full render uses, so a later renderAll lands on the same spot.
    const rect = computeCombatLayout(visual, this.mySeat).units.get(unitId);
    this.renderSummonPanel(
      summon,
      rect?.x !== undefined ? rect.x + rect.w / 2 : WIDTH / 2,
      rect?.y !== undefined ? rect.y + rect.h / 2 : 410,
      hostile,
      visual,
    );
  }

  /** The moon medallion re-rendered from the visual state (phase turn, Huyết Nguyệt). */
  private refreshMoon(visual: CombatState): void {
    const layer = this.moonLayer;
    if (layer === undefined) return;
    layer.removeAll(true);
    this.renderMoon(visual);
  }

  /** The batch finished its beat: commit its state and redraw. */
  private commitBatch(batch: PlaybackBatch): void {
    this.state = batch.after;
    this.renderAll();
    const work = this.commitWork.get(batch);
    if (work !== undefined) {
      this.commitWork.delete(batch);
      work();
    }
  }

  /** A batch failed mid-beat (not an abort — a real bug): resync to its `after`. */
  private playFailed(error: unknown, latest: CombatState): void {
    console.error("combat playback failed:", error);
    // The failed batch's post-commit follow-up can never run — don't retain it.
    for (const [batch] of this.commitWork) {
      if (batch.after === latest) this.commitWork.delete(batch);
    }
    this.state = latest;
    this.latestState = latest;
    this.showError("Có lỗi khi hiển thị — đã đồng bộ lại trạng thái");
    this.renderAll();
  }

  /** The single source of truth for the input lock (`16` §8.4). */
  private syncInputLock(): void {
    const previous = this.inputLocked;
    this.inputLocked =
      this.playback.busy ||
      (this.netMatch?.pending ?? false) ||
      this.netMatch?.ended != null ||
      this.storyFinishing ||
      (this.netMatch !== null && this.netDown);
    if (this.rootReady && this.root.scene && previous !== this.inputLocked && this.endTurnObjects.length > 0) {
      for (const object of this.endTurnObjects) this.root.remove(object, true);
      this.endTurnObjects = [];
      this.renderEndTurn(this.state.players[this.mySeat]!);
    }
  }

  /** Redraws once the queue drains — immediately when it is already idle. */
  private requestRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    this.playback.whenIdle(() => {
      this.renderQueued = false;
      if (this.scene.isActive()) this.renderAll();
    });
  }

  private onCardClicked(instanceId: string) {
    if (this.state.status === "mulligan") {
      if (this.inputLocked) return;
      if (this.mulliganPicks.has(instanceId)) this.mulliganPicks.delete(instanceId);
      else if (this.mulliganPicks.size < this.gameData.combatConfig.maxMulligan) this.mulliganPicks.add(instanceId);
      this.requestRender();
      return;
    }
    if (this.inputLocked || this.state.status !== "playerTurn" || this.castingIds.has(instanceId)) return;
    if (this.targeting === instanceId) {
      this.cancelTargeting();
      return;
    }
    const instance = this.state.cards[instanceId]!;
    const card = cardDefOf(this.gameData, this.state, instance)!;
    if (!isCardPlayable(this.gameData, this.state, instanceId)) {
      // The model's reason lands just above the hand — never an English rule string.
      const reason = combatCardModel(this.gameData, this.state, instanceId, instance.player).disabledReason;
      this.shakeCard(instanceId);
      this.showError(reason ?? "Không đánh được");
      return;
    }
    if (card.target === "none") {
      this.dispatch({ type: "playCard", instanceId });
      return;
    }
    this.targeting = instanceId;
    this.validTargetIds = new Set(getValidTargets(this.gameData, this.state, instanceId));
    this.requestRender();
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
    this.clearAimLine();
    this.requestRender();
  }

  /** A gold line from the selected card to the unit under the pointer (`05`). */
  private drawAimLine(unitId: string): void {
    this.clearAimLine();
    if (this.targeting === null) return;
    const cardView = this.cardViews.get(this.targeting);
    const instance = this.state.cards[this.targeting];
    const ownerAnchor = instance !== undefined ? this.unitAnchors.get(cardOwners(this.state, instance)[0]?.id ?? "") : undefined;
    const from = cardView !== undefined ? { x: cardView.x, y: cardView.y } : ownerAnchor;
    const to = this.unitAnchors.get(unitId) ?? this.unitViews.get(unitId);
    if (from === undefined || to === undefined) return;
    const g = this.add.graphics().setDepth(40);
    g.lineStyle(2.5, COLORS.goldFill, 0.9).lineBetween(from.x, from.y, to.x, to.y);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    g.fillStyle(COLORS.goldFill, 0.9).fillTriangle(
      to.x,
      to.y,
      to.x - 14 * Math.cos(angle - 0.42),
      to.y - 14 * Math.sin(angle - 0.42),
      to.x - 14 * Math.cos(angle + 0.42),
      to.y - 14 * Math.sin(angle + 0.42),
    );
    this.root.add(g);
    this.aimLine = g;
  }

  private clearAimLine(): void {
    this.aimLine?.destroy();
    this.aimLine = undefined;
  }

  /** Is a mandatory choice (Chọn Pha / Chiêm Bài) currently on screen expanded? */
  private choiceOverlayOpen(): boolean {
    if (this.choiceCollapsed || this.mySeatState?.pendingChoice === undefined || this.mySeatState.pendingChoice === null) {
      return false;
    }
    return this.state.status === "choosing" || this.isCoop;
  }

  /**
   * Esc/right-click on a choice panel folds it to a banner (the choice itself
   * is mandatory — rules have no cancel). Returns true when it handled input.
   */
  private collapseChoice(): boolean {
    if (this.inputLocked || !this.choiceOverlayOpen()) return false;
    this.choiceCollapsed = true;
    this.requestRender();
    return true;
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
    this.endTurnObjects = [];
    this.layout = computeCombatLayout(this.state, this.mySeat);
    this.root.removeAll(true);
    this.tooltip?.destroy();
    this.tooltip = null;
    if (this.choiceWheel !== undefined) {
      this.input.off("wheel", this.choiceWheel);
      this.choiceWheel = undefined;
    }
    this.aimLine = undefined; // the graphics die with root's rebuild
    this.guardTether = undefined;
    this.cardViews.clear();
    this.castingIds.clear();
    this.seatLayers.clear();
    this.renderBackground();
    this.unitAnchors.clear();
    this.unitViews.clear();
    this.unitSpecs.clear();
    this.triggerAnchors.clear();
    this.errorText = undefined;
    this.timerText = null;
    for (const player of this.state.players) {
      const layer = this.add.container(0, 0);
      this.root.add(layer);
      this.seatLayers.set(player.index, layer);
    }
    this.moonLayer = this.add.container(0, 0);
    this.root.add(this.moonLayer);
    this.comboHints =
      this.isCoop && this.state.status === "playerTurn" && this.mySeatState !== undefined && !this.mySeatState.done
        ? comboHintFor(this.gameData, this.state, this.mySeat)
        : new Map();
    this.renderTopBar();
    const otherSeat = this.state.players.find((p) => p.index !== this.mySeat);
    if (this.state.mode === "pvp") {
      this.renderOpponentRow();
      this.renderOpponentHand(otherSeat, this.seatLayerOf(otherSeat?.index ?? -1));
    } else {
      this.renderEnemies();
    }
    if (this.isCoop) this.renderPartnerHand(otherSeat, this.seatLayerOf(otherSeat?.index ?? -1), this.state);
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

  /** Per-frame: countdown to the server deadline (online) or the local turn
   *  clock (offline — expiry auto-`endTurn`s, clock freezes while locked/modal). */
  update(_time: number, delta: number): void {
    if (!this.timerText) return;
    if (this.netMatch) {
      const deadline = this.netMatch.deadline;
      if (deadline === null) {
        this.timerText.setText("");
        return;
      }
      const left = Math.max(0, deadline - (session.net?.serverNow() ?? Date.now()));
      this.timerText.setText(`⏱ ${Math.ceil(left / 1000)}s`);
      return;
    }
    if (!this.turnClock) return;
    const frozen = this.inputLocked || isModalOpen();
    // One clock per decision window: committed snapshots jump playerTurn →
    // playerTurn across the synchronous enemy turn, so `round:activePlayer`
    // (plus the mulligan flag for the pre-turn Chọn Pha) is the reset signal.
    // `choosing` keeps the same clock running, matching the server deadline.
    const acting = this.state.status === "playerTurn" || this.state.status === "choosing";
    const turnKey = acting
      ? `${this.state.round}:${this.state.activePlayer}:${this.state.players[this.mySeat]?.mulliganDone === true ? 1 : 0}`
      : null;
    const left = this.turnClock.tick(turnKey, frozen, delta);
    if (left === null) {
      this.timerText.setText("");
      return;
    }
    this.timerText.setText(`⏱ ${Math.ceil(left / 1000)}s`);
    this.timerText.setColor(left <= 10000 ? "#ff5a4e" : COLORS.gold);
    // A pending Chiêm Bài answers first; the expiry fires once the seat can act.
    if (left <= 0 && !frozen && this.state.status === "playerTurn") this.dispatch({ type: "endTurn" });
  }

  private restart(seed?: number, encounterId?: string): void {
    restartSession(seed, encounterId);
    this.syncFromSession();
  }

  private syncFromSession(): void {
    // A rebuilt combat supersedes any in-flight beat: abort, then render.
    this.playback.reset();
    this.commitWork.clear();
    this.state = session.state;
    this.latestState = session.state;
    this.targeting = null;
    this.validTargetIds.clear();
    this.mulliganPicks.clear();
    this.syncInputLock();
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
    this.moonAnchor = { x: this.layout.moon.x, y: this.layout.moon.y, size: 46 };
    if (!this.textures.exists(key)) {
      this.root.add(this.add.rectangle(cx, cy, view.w, view.h, bloodMoon ? BLOOD_MOON_BG : PHASE_BG[phase.id]));
      if (bloodMoon) this.bloodMoonDressing(view, 0);
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
    if (bloodMoon) this.bloodMoonDressing(view, 0.09);
  }

  /**
   * Huyết Nguyệt's lasting look: a faint wash + an edge vignette (the art
   * stays readable, the rim bleeds) + sparse embers drifting up. All parts
   * live on `root`, so they die with the next rebuild.
   */
  private bloodMoonDressing(view: { x: number; y: number; w: number; h: number }, wash: number) {
    ensureTextures(this);
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    if (wash > 0) this.root.add(this.add.rectangle(cx, cy, view.w, view.h, BLOOD_MOON_BG, wash));
    this.root.add(
      this.add
        .image(cx, cy, VIGNETTE)
        .setDisplaySize(view.w + 8, view.h + 8)
        .setTint(0x90142c)
        .setAlpha(0.45),
    );
    const embers = this.add.particles(view.x + view.w / 2, view.y + view.h, VFX_GLOW, {
      x: { min: -view.w / 2, max: view.w / 2 },
      y: { min: -view.h * 0.65, max: 0 },
      speedY: { min: -30, max: -12 },
      speedX: { min: -8, max: 8 },
      lifespan: { min: 2600, max: 4400 },
      scale: { start: 0.14, end: 0 },
      alpha: { start: 0.2, end: 0 },
      tint: [0x8a1420, 0xc03040],
      frequency: 340,
      maxParticles: 26,
      blendMode: "ADD",
    });
    this.root.add(embers);
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
    if (other) {
      this.renderPile(other, this.layout.seats.get(other.index)!, this.isCoop ? 0x5f8fdd : 0x9a6fd0, this.isCoop ? "Đồng đội" : "Đối thủ", this.seatLayers.get(other.index));
      if(this.state.mode === "pvp") this.renderOpponentResource(other,this.seatLayerOf(other.index));
    }
    // Relic/Kỳ Vật/Lõi strip under the encounter plate (`05` review): own seat only —
    // enemy content stays at x≥232 so the strip never overlaps it.
    this.renderRelicStrip(this.mySeatState);
    const gear = this.badge(WIDTH - 40, 36, 16, "⚙", COLORS.panelBorder, this.root, COLORS.button, 15, COLORS.dimText);
    gear.setInteractive({ useHandCursor: true });
    gear.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.openSettings();
    });
    this.hoverTooltip(gear, () => ({ x: WIDTH - 260, y: 64 }), () => ["Thiết lập"]);
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
    // Local fights (offline, run node, story stage) have no resign flag —
    // leaving just drops the local attempt; runs and story tickets close too.
    if (!match && this.state.status !== "won" && this.state.status !== "lost") {
      const exit = this.badge(WIDTH - 88, 36, 16, "✕", 0x884455, this.root, 0x40202a, 13, "#ff9090");
      exit.setInteractive({ useHandCursor: true });
      exit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) return;
        const prompt = this.isStory
          ? "Rời trận? Màn Cốt Truyện chưa hoàn thành."
          : session.run !== null
            ? "Bỏ lượt chơi này? Toàn bộ tiến trình sẽ mất."
            : "Rời trận? Tiến trình trận đấu sẽ mất.";
        void confirmModal(this, prompt, { label: "Rời trận", danger: true }).then((ok) => {
          if (!ok) return;
          if (this.isStory) {
            void abandonStory();
            session.pendingStageId = null;
            this.scene.start("story");
          } else {
            session.run = null;
            this.scene.start("deck-select");
          }
        });
      });
      this.hoverTooltip(exit, () => ({ x: WIDTH - 280, y: 60 }), () => ["Rời trận"]);
    }
    if ((match && match.deadline !== null) || this.turnClock) {
      const { x, y } = endTurnAnchor(this.layout);
      this.timerText = this.text(x, y - 66, "", 15, COLORS.gold).setOrigin(0.5);
    }
  }

  /**
   * Own seat's Nguyệt Bảo/Kỳ Vật/Lõi strip under the encounter plate (`05`
   * review): x16..208, six a row, two rows, ten direct icons then a `+N`
   * overflow that opens the inspector list. Every icon is also that entry's
   * trigger anchor so `relicTriggered` flashes land on it — two seats holding
   * the same id never collide because the key carries the seat.
   */
  private renderRelicStrip(seat: PlayerState | undefined): void {
    if (seat === undefined) return;
    const entries = relicHudEntries(this.gameData, this.state, seat.index);
    const KIND_GLYPH: Record<RelicHudEntry["kind"], [string, number, string]> = {
      relic: ["☾", COLORS.goldFill, COLORS.gold],
      runRelic: ["✦", 0x4a6fa5, "#9fd4ff"],
      augment: ["◆", 0x6a4a85, "#e0b0ff"],
      weapon: ["⚔", 0x7a4a30, "#ffb080"],
    };
    const MAX = 10;
    const slotAt = (i: number) => ({ x: 29 + (i % 6) * 32, y: 85 + Math.floor(i / 6) * 32 });
    entries.slice(0, MAX).forEach((entry, i) => {
      const { x, y } = slotAt(i);
      const [glyph, ring, color] = KIND_GLYPH[entry.kind];
      const icon = this.badge(x, y, 13, glyph, ring, this.root, 0x0a0e20, 12, color);
      icon.setInteractive({ useHandCursor: true });
      icon.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.inspector?.openRelic(entry);
      });
      this.hoverTooltip(icon, () => ({ x: x + 20, y: y + 22 }), () => [entry.name, entry.description]);
      this.triggerAnchors.set(triggerAnchorKey(seat.index, entry.kind, entry.id), { x, y });
      if (entry.count !== undefined && entry.count > 1) {
        this.text(x + 11, y + 9, `${entry.count}`, 9, COLORS.gold, this.root).setOrigin(0.5).setStroke("#05070f", 3);
      }
    });
    if (entries.length > MAX) {
      const { x, y } = slotAt(MAX);
      const more = this.badge(x, y, 13, `+${entries.length - MAX}`, COLORS.panelBorder, this.root, 0x0a0e20, 11, COLORS.dimText);
      more.setInteractive({ useHandCursor: true });
      more.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.inspector?.openRelics(entries);
      });
      this.hoverTooltip(more, () => ({ x: x + 20, y: y + 22 }), () => [`Còn ${entries.length - MAX} mục nữa`, "Bấm để xem tất cả"]);
    }
  }

  /**
   * Current moon in the art socket; its tooltip also explains the next phase.
   */
  private renderMoon(state: CombatState = this.state) {
    const { x, y, size } = this.moonAnchor;
    const phase = this.gameData.moonPhases[state.moonIndex]!;
    const bloodMoon = state.bloodMoonRounds > 0;
    const iconKey = `ui:moon_${phase.id}`;
    const layer = this.moonLayer ?? this.root;
    const model = moonHudModel(this.gameData, state);
    const hud = renderMoonHud(this, model, this.layout, this.moonAnchor, (t, cfg) => this.loopTween(t, cfg));
    layer.add(hud);
    // Huyết Nguyệt replaces the phase (`01` §7.4) — the socket shows the
    // dedicated blood-moon icon, not the covered phase's glyph.
    const moon = bloodMoon
      ? this.textures.exists("ui:moon_blood")
        ? this.add.image(x, y, "ui:moon_blood").setDisplaySize(size, size)
        : this.add
            .text(x, y, phase.icon, { ...TEXT_BASE, fontSize: `${Math.round(size * 0.6)}px`, color: "#d03a4a" })
            .setOrigin(0.5)
      : this.textures.exists(iconKey)
        ? this.add.image(x, y, iconKey).setDisplaySize(size, size)
        : this.add.text(x, y, phase.icon, { ...TEXT_BASE, fontSize: `${Math.round(size * 0.6)}px`, color: COLORS.gold }).setOrigin(0.5);
    layer.add(moon);
    moon.setName("moon_current").setInteractive();
    // Huyết Nguyệt IS the current phase while it burns: the suppressed
    // phase's name shows as covered, its effects read as paused.
    this.hoverTooltip(moon, () => ({ x: x + size / 2 + 8, y: y - 10 }), () =>
      bloodMoon
        ? [
            "Huyết Nguyệt — pha hiện tại",
            `${model.phase.name} đang bị che — Ưu Đãi Pha và Nguyệt Lệnh tạm ngừng`,
            `${model.next.name} — pha kế tiếp`,
            model.next.description,
          ]
        : [
            `${model.phase.name} — pha hiện tại`,
            model.phase.description,
            `${model.next.name} — pha kế tiếp`,
            model.next.description,
          ],
    );
  }

  /**
   * One unit as a portrait card: art, HP bar, armor at top-left,
   * status icons inside above the name strip. Name and numbers in detail are
   * in the hover tooltip. Registered for targeting and animations.
   */
  private renderUnitCard(spec: UnitCardSpec): Phaser.GameObjects.Container {
    const c = this.add.container(spec.x, spec.y);
    this.root.add(c);
    this.unitAnchors.set(spec.id, { x: spec.x, y: spec.y });
    this.unitViews.set(spec.id, c);
    this.fillUnitCard(c, spec);
    this.unitSpecs.set(spec.id, spec);
    return c;
  }

  /** (Re)fills a unit card's contents from its spec — the container survives, so in-flight shakes keep their target. */
  private fillUnitCard(c: Phaser.GameObjects.Container, spec: UnitCardSpec): void {
    const { id, x, y, w, h } = spec;
    const isValidTarget = this.targeting !== null && this.validTargetIds.has(id);
    c.add(this.roundBox(w, h, spec.hostile ? COLORS.panelEnemy : COLORS.panelHero, 1, isValidTarget ? 3 : 2, isValidTarget ? COLORS.goldFill : spec.frame));
    const panel = this.add.rectangle(0, 0, w, h, 0x000000, 0.001);
    c.add(panel);
    // Missing art leaves a readable silhouette — never an empty frame.
    if (this.coverImage(spec.artKey, 0, 0, w - 6, h - 6, c) === null) {
      this.unitSilhouette(c, w, h, spec.hostile);
    }
    c.add(this.add.rectangle(0, h / 2 - 15, w - 6, 24, 0x0a0e20, 0.8));
    // The name strip is the whole footer now — centered; Thức Tỉnh detail
    // stays on the tooltip and the gold frame trace.
    const footerY = h / 2 - 15;
    this.text(0, footerY, ellipsize(this, spec.name, w - 16, 11, 1), 11, spec.nameColor ?? COLORS.text, c)
      .setOrigin(0.5).setName("unit_name");
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
    // Trang Bị stacks under the corner armor badge; it is also the trigger anchor.
    if (spec.weapon !== undefined && spec.alive) {
      const weapon = spec.weapon;
      const wx = x - w / 2 + 15;
      const wy = y - h / 2 + 46;
      const def = this.gameData.weapons[weapon.id];
      const entry: RelicHudEntry = {
        id: weapon.id,
        kind: "weapon",
        name: def?.name ?? weapon.id,
        description:
          def === undefined
            ? "Chưa có mô tả."
            : `${def.text}${def.refinement[weapon.refinement - 1] ? ` — Tinh Luyện ${weapon.refinement}: ${def.refinement[weapon.refinement - 1]!.text}` : ""}`,
      };
      const icon = this.badge(-w / 2 + 15, -h / 2 + 46, 11, "⚔", 0x7a4a30, c, 0x0a0e20, 10, "#ffb080").setName("unit_weapon");
      icon.setInteractive({ useHandCursor: true });
      icon.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.inspector?.openRelic(entry);
      });
      this.hoverTooltip(icon, () => ({ x: wx + 18, y: wy - 40 }), () => [entry.name, entry.description]);
      this.triggerAnchors.set(triggerAnchorKey(weapon.seat, "weapon", weapon.id), { x: wx, y: wy });
    }
    if (this.targeting !== null && !isValidTarget) c.setAlpha(0.4);
  }

  /** A faceless figure when the portrait texture is absent — unit stays identified by its name strip. */
  private unitSilhouette(c: Phaser.GameObjects.Container, w: number, h: number, hostile: boolean): void {
    const tint = hostile ? 0x4a3055 : 0x2c3d63;
    const g = this.add.graphics();
    g.fillStyle(tint, 0.9).fillCircle(0, -h * 0.16, w * 0.2);
    g.fillStyle(tint, 0.9).fillEllipse(0, h * 0.18, w * 0.62, h * 0.44);
    g.lineStyle(1.5, 0x8a90a8, 0.5);
    g.strokeCircle(0, -h * 0.16, w * 0.2);
    g.strokeEllipse(0, h * 0.18, w * 0.62, h * 0.44);
    c.add(g);
  }

  /**
   * Armor in the freed top-left corner and readable current/max HP on the
   * bottom bar.
   */
  private hpPlate(c: Phaser.GameObjects.Container, spec: UnitCardSpec, w: number, h: number) {
    const gx = -w / 2 + 17;
    const gy = -h / 2 + 17;
    if (spec.armor > 0) {
      c.add(hudImage(this, HUD.shield, gx, gy, 0.85));
      c.add(this.add.text(gx, gy - 1, `${spec.armor}`, { ...TEXT_BASE, fontSize: "12px", fontStyle: "bold", color: "#ffffff", stroke: "#0a1830", strokeThickness: 3 }).setOrigin(0.5));
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
    // Summons also retain readable current/max when the top badge is absent.
    c.add(
        this.add
          .text(0, barY - 1, `${spec.hp}/${spec.maxHp}`, {
            ...TEXT_BASE,
            fontSize: "10px",
            color: "#e8f0ff",
            stroke: "#05070f",
            strokeThickness: 2,
          })
          .setOrigin(0.5).setName("unit_hp"),
    );
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
        const textureWidth = this.textures.get("ui:status_charm").getSourceImage().width;
        this.drift(c, w, h, { from: "bottom", speedY: [-30, -14], tint: [0xffffff], scale: 14 / textureWidth, frequency: 260, texture: "ui:status_charm", add: false });
      },
    };
    // At most three ambient looks per unit (`05` review) — freeze, burn and
    // guard win slots, then whatever remains in state order. Every status
    // still carries a badge; the looks are ambience, not information.
    const AMBIENT_PRIORITY: readonly StatusId[] = ["freeze", "burn", "guard"];
    const ordered = [
      ...AMBIENT_PRIORITY.filter((id) => statuses.some((status) => status.id === id)),
      ...statuses.map((status) => status.id).filter((id) => !AMBIENT_PRIORITY.includes(id)),
    ];
    for (const id of ordered.slice(0, 3)) looks[id]?.();
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
    // Two rows max (`05` review); the `+N` marker keeps the rest a hover away.
    const badges =
      spec.unit !== undefined
        ? statusBadgeModels(this.state, spec.unit, spec.w)
        : spec.statuses.map((status) => ({ id: status.id as StatusId | "seal" | "overflow", label: status.id, value: status.value }));
    const compact = spec.w < 100;
    const r = compact ? 8 : 10;
    const step = 2 * r + 4;
    const perRow = compact ? 2 : Math.max(1, Math.floor((spec.w - 16) / step));
    badges.forEach((badge, index) => {
      const ix = compact ? 2 + (index % perRow) * step : -spec.w / 2 + 8 + r + (index % perRow) * step;
      // Clear of the HP bar (h/2 - 32 … h/2 - 26).
      const iy = spec.h / 2 - 37 - r - Math.floor(index / perRow) * step;
      if (badge.id === "overflow") {
        const circle = this.badge(ix, iy, r, badge.label, 0x8a90a8, c, 0x0a0e20, 10);
        this.hoverTooltip(circle, () => ({ x: spec.x + spec.w / 2 + 8, y: spec.y + iy }), () =>
          this.fullStatusLines(spec),
        );
        return;
      }
      const icon =
        badge.id === "seal"
          ? { ...SEAL_ICON, iconKey: "ui:seal" }
          : { ...STATUS_ICONS[badge.id as StatusId], iconKey: `ui:status_${badge.id}` };
      const value = badge.value ?? 0;
      const hasIcon = this.textures.exists(icon.iconKey);
      const circle = this.badge(ix, iy, r, hasIcon ? "" : icon.glyph, icon.color, c, 0x0a0e20, 12);
      if (hasIcon) c.add(this.add.image(ix, iy, icon.iconKey).setDisplaySize(2 * r - 1, 2 * r - 1));
      if (value > 0) {
        c.add(
          this.add
            .text(ix + r + 1, iy + r + 1, `${value}`, { ...TEXT_BASE, fontSize: "10px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
            .setOrigin(1, 1),
        );
      }
      const keyword = this.gameData.keywords[icon.keywordId];
      circle.setInteractive({ useHandCursor: this.targeting !== null });
      circle.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.onUnitClicked(spec.id);
      });
      this.hoverTooltip(circle, () => ({ x: spec.x + spec.w / 2 + 8, y: spec.y + iy }), () => [
        `${keyword?.name ?? icon.keywordId}${value > 0 ? ` ${value}` : ""}`,
        keyword?.text ?? "",
        badge.id === "seal" ? this.sealSourceLine(spec) : this.statusSourceLine(spec, badge.id),
      ]);
      // Hộ Vệ (`18` §2.2): the tether to the guardian shows on hover only —
      // drawing every link always turned dense boards into spaghetti.
      const sourceId =
        badge.id === "guard" ? spec.unit?.statuses.find((status) => status.id === "guard")?.sourceId : undefined;
      if (sourceId !== undefined) {
        circle.on("pointerover", () => this.drawGuardTether(spec, ix, iy, sourceId));
        circle.on("pointerout", () => this.clearGuardTether());
      }
    });
  }

  /** Every status + seal with its source — the `+N` marker's full list. */
  private fullStatusLines(spec: UnitCardSpec): string[] {
    const lines: string[] = [];
    for (const status of spec.statuses) {
      const icon = STATUS_ICONS[status.id];
      const keyword = icon !== undefined ? this.gameData.keywords[icon.keywordId] : undefined;
      lines.push(
        `${keyword?.name ?? status.id}${status.value > 0 ? ` ${status.value}` : ""}${this.statusSourceLine(spec, status.id)}`,
      );
    }
    if (spec.sealed) lines.push(`${this.gameData.keywords[SEAL_ICON.keywordId]?.name ?? "Phong Ấn"}${this.sealSourceLine(spec)}`);
    return lines;
  }

  /** ` (từ <source>)` when the status carries a known caster — e.g. the guardian hero. */
  private statusSourceLine(spec: UnitCardSpec, statusId: StatusId | "seal" | "overflow"): string {
    const sourceId = spec.unit?.statuses.find((status) => status.id === statusId)?.sourceId;
    if (sourceId === undefined) return "";
    return ` — từ ${this.unitDisplayName(sourceId)}`;
  }

  private sealSourceLine(spec: UnitCardSpec): string {
    const sourceId = spec.unit?.sealedBy;
    return sourceId === undefined ? "" : ` — từ ${this.unitDisplayName(sourceId)}`;
  }

  /** A unit's display name for status sources, whichever side it sits on. */
  private unitDisplayName(unitId: string): string {
    const unit = unitAt(this.state, unitId);
    if (unit === undefined) return unitId;
    const summon = this.state.summons?.find((s) => s.id === unitId);
    if (summon !== undefined) return this.gameData.summons[summon.summonId]?.name ?? "Linh Thú";
    return this.gameData.heroes[unit.defId]?.name ?? this.gameData.enemies[unit.defId]?.name ?? unitId;
  }

  /** The gold tether from a hovered Hộ Vệ badge to its guardian (`18` §2.2). */
  private drawGuardTether(spec: UnitCardSpec, ix: number, iy: number, sourceId: string): void {
    this.clearGuardTether();
    const to = this.unitAnchors.get(sourceId);
    if (to === undefined) return;
    const g = this.add.graphics().setDepth(39);
    g.lineStyle(2.5, COLORS.goldFill, 0.9).lineBetween(spec.x + ix, spec.y + iy, to.x, to.y);
    this.root.add(g);
    this.guardTether = g;
  }

  private clearGuardTether(): void {
    this.guardTether?.destroy();
    this.guardTether = undefined;
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
    panel.on("pointerover", () => {
      if (this.targeting !== null && this.validTargetIds.has(unitId)) this.drawAimLine(unitId);
    });
    panel.on("pointerout", () => this.clearAimLine());
  }

  /** The living Linh Thú belonging to hero `heroId` (`01` §17), if any. */
  private summonOfHero(heroId: string): SummonState | undefined {
    const summon = summonOf(this.state, heroId);
    return summon?.alive === true ? summon : undefined;
  }

  private summonSpecOf(summon: SummonState, cx: number, cy: number, hostile: boolean, state = this.state): UnitCardSpec {
    const name = this.gameData.summons[summon.summonId]?.name ?? "Linh Thú";
    return {
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
      statuses: displayStatuses(state, summon),
      sealed: summon.sealedBy !== undefined,
      frame: COLORS.panelBorder,
      alive: true,
      unit: summon,
      tooltip: () => [name, `HP ${summon.hp}/${summon.maxHp}${summon.armor > 0 ? ` · Giáp ${summon.armor}` : ""}`],
    };
  }

  /**
   * Linh Thú (`01` §17): a small portrait card in its side's summon zone, right
   * of the row. Valid `ally` picks, and `enemy` picks for the opposing seat in PvP.
   */
  private renderSummonPanel(summon: SummonState, cx: number, cy: number, hostile: boolean, state = this.state): void {
    this.renderUnitCard(this.summonSpecOf(summon, cx, cy, hostile, state));
  }

  /** The living Linh Thú of `heroes`, each in its side's summon slot from the layout. */
  private renderSummonRow(heroes: HeroState[], hostile: boolean) {
    const summons = heroes.flatMap((hero) => this.summonOfHero(hero.id) ?? []);
    summons.forEach((summon) => {
      const rect = this.layout.units.get(summon.id);
      if (rect !== undefined) this.renderSummonPanel(summon, rect.x + rect.w / 2, rect.y + rect.h / 2, hostile);
    });
  }

  private enemySpecOf(enemy: EnemyState, x: number, y: number, state = this.state): { spec: UnitCardSpec; boss: boolean } {
    const def = this.gameData.enemies[enemy.defId]!;
    const boss = enemy.id === state.boss?.enemyId && def.phases !== undefined;
    const w = boss ? BOSS_W : UNIT_W;
    const h = boss ? BOSS_H : UNIT_H;
    return {
      boss,
      spec: {
        id: enemy.id,
        x,
        y,
        w,
        h,
        artKey: `enemies:${enemy.defId}`,
        name: def.name,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        hostile: true,
        armor: enemy.armor,
        statuses: displayStatuses(state, enemy),
        sealed: enemy.sealedBy !== undefined,
        frame: COLORS.panelBorder,
        alive: enemy.alive,
        stealth: enemy.statuses.some((s: StatusInstance) => s.id === "stealth"),
        unit: enemy,
        tooltip: () => this.enemyTooltip(enemy, def, state),
      },
    };
  }

  private renderEnemies() {
    for (const enemy of this.state.enemies) {
      const rect = this.layout.units.get(enemy.id);
      if (rect === undefined) continue;
      const { spec, boss } = this.enemySpecOf(enemy, rect.x + rect.w / 2, rect.y + rect.h / 2);
      const c = this.renderUnitCard(spec);
      if (boss) this.renderBossBadges(c, spec.w, spec.h);
    }
  }

  /** Nguyệt Lực stays public (`01` §9.2) but off the card: the enemy's hover tooltip. */
  private enemyTooltip(enemy: EnemyState, def: { name: string; phases?: { hpBelow: number }[] }, state = this.state): string[] {
    const boss = state.boss;
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
  private renderBossBadges(c: Phaser.GameObjects.Container, w: number, h: number, state = this.state): void {
    const boss = state.boss!;
    const phases = this.gameData.enemies[state.enemies.find((e) => e.id === boss.enemyId)!.defId]!.phases!;
    this.badge(w / 2 - 18, -h / 2 + 18, 16, `${boss.phase}/${phases.length}`, COLORS.goldFill, c, 0x0a0e20, 11, COLORS.gold);
    if (boss.reviveCountdown !== null) {
      this.badge(w / 2 - 18, -h / 2 + 52, 14, `☾${boss.reviveCountdown}`, 0xff8090, c, 0x3a1020, 11, "#ff8090");
    }
  }

  /**
   * Co-op (`17` §9.3): the partner's hand as small cost tiles under the top-left
   * plate — visible but not playable; hover shows the card.
   */
  private renderPartnerHand(partner?: PlayerState, parent = this.root, state = this.state): void {
    partner ??= state.players.find((p) => p.index !== this.mySeat);
    if (!partner) return;
    // Compact 24px tiles on the partner's hand anchor (`05`): 656..930 × y=532.
    const anchor = this.layout.seats.get(partner.index)?.hand ?? { x: 790, y: 532 };
    const count = partner.hand.length;
    const gap = count > 1 ? Math.min(30, (274 - 24) / (count - 1)) : 0;
    partner.hand.forEach((instanceId, index) => {
      const x = anchor.x - ((count - 1) * gap) / 2 + index * gap;
      const y = anchor.y;
      const instance = state.cards[instanceId];
      const card = instance ? cardDefOf(this.gameData, state, instance) : undefined;
      if (instance === undefined || card === undefined) return;
      const tile = this.add.rectangle(x, y, 24, 34, 0x141b33).setStrokeStyle(1, OWNER_COLORS[instance.ownerIds[0]!] ?? 0x5f8fdd);
      parent.add(tile);
      // The partner's cost, not ours — their seat's modifiers apply (`17` §16).
      const model = combatCardModel(this.gameData, state, instanceId, partner.index);
      const partnerCost = model.effectiveCost;
      this.text(x, y, `${partnerCost}`, 12, partnerCost < card.cost ? "#8fd08f" : COLORS.text, parent).setOrigin(0.5);
      tile.setInteractive();
      tile.on("pointerover", () => {
        this.tooltip?.destroy();
        this.tooltip = showCardTooltip(this, x, y - 120, this.gameData, card, [cardOwnerLabel(model,true)], { effectiveCost: model.effectiveCost, costReasons: model.costReasons });
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
    opponents.forEach((hero) => {
      const rect = this.layout.units.get(hero.id);
      if (rect !== undefined) {
        this.renderHeroCard(hero, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, true, COLORS.panelBorder);
      }
    });
    // Opposing Linh Thú are `enemy` targets (`01` §17.3).
    this.renderSummonRow(opponents, true);
  }

  /** The opponent's hand — face-down card backs at their seat's hand marker (`17` §4.8). */
  private renderOpponentHand(oppSeat?: PlayerState, parent = this.root) {
    oppSeat ??= this.state.players.find((p) => p.index !== this.mySeat);
    if (!oppSeat) return;
    const anchor = this.layout.seats.get(oppSeat.index)?.hand ?? { x: 156, y: 168 };
    const count = oppSeat.hand.length;
    for (let i = 0; i < count; i++) {
      parent.add(this.add.rectangle(anchor.x + (i - (count - 1) / 2) * 26, anchor.y, 22, 32, 0x2c3e6e).setStrokeStyle(1, COLORS.panelBorder));
    }
  }

  private renderOpponentResource(seat: PlayerState, parent: Phaser.GameObjects.Container) {
    const anchors=this.layout.seats.get(seat.index)!;
    this.text(anchors.resource.x,anchors.resource.y,`Nguyệt Lực ${seat.moonPower}`,12,COLORS.text,parent).setOrigin(0.5).setName("opponent_power").setStroke("#05070f",3);
    this.text(anchors.reserve.x,anchors.reserve.y,`Dự Trữ ${Math.min(seat.moonReserve,seat.moonPower)}`,11,"#a5d5b5",parent).setOrigin(0.5).setName("opponent_reserve").setStroke("#05070f",3);
  }

  /** Fixed emote list + mute (`17` §7.3, `pvp-config.emotes`); one send per 3 s. */
  private renderEmoteControls(): void {
    const btn = this.badge(WIDTH - 88, 36, 16, session.emotesMuted ? "🔕" : "💬", this.emotePanel ? COLORS.goldFill : COLORS.panelBorder, this.root, COLORS.button, 13);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) {
        this.emotePanel = !this.emotePanel;
        this.requestRender();
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
        this.requestRender();
      });
      layer.add(row);
      layer.add(this.add.text(1120, y, emote, { ...TEXT_BASE, fontSize: "13px", color: COLORS.text }).setOrigin(0.5));
    });
    const muteY = 76 + emotes.length * 34;
    const mute = this.add.rectangle(1120, muteY, 208, 30, 0x203040).setInteractive({ useHandCursor: true });
    mute.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) {
        session.emotesMuted = !session.emotesMuted;
        this.requestRender();
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
   * A hero's portrait card with health bar, armor, statuses and awakening footer.
   */
  private heroSpecOf(hero: HeroState, x: number, y: number, w: number, h: number, hostile: boolean, frame: number, state = this.state): UnitCardSpec {
    const def = this.gameData.heroes[hero.defId]!;
    const weapon = weaponForHero(state, hero);
    const upKey = `heroes:${hero.defId}_up`;
    return {
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
      statuses: displayStatuses(state, hero),
      sealed: hero.sealedBy !== undefined,
      frame: hero.leveledUp ? COLORS.goldFill : frame,
      alive: hero.alive,
      stealth: hero.statuses.some((s) => s.id === "stealth"),
      unit: hero,
      weapon,
      tooltip: () => heroTooltipLines(this.gameData, state, hero),
    };
  }

  private renderHeroCard(hero: HeroState, x: number, y: number, w: number, h: number, hostile: boolean, frame: number, state = this.state) {
    const spec = this.heroSpecOf(hero, x, y, w, h, hostile, frame, state);
    const c = this.renderUnitCard(spec);
    if (!hero.alive) return;
    const def = this.gameData.heroes[hero.defId]!;
    // Same threshold the rules roll for (`17` §3.2): Tinh Hồn perks stay off in Fair Arena.
    const threshold = hero.constellation >= 2 && !hero.pvp ? def.levelUp.constellationThreshold : def.levelUp.threshold;
    if (hero.leveledUp) this.neonFrame(c, w, h);
    else this.frameTrace(c, w, h, Math.min(1, hero.levelUpCounter / threshold));
  }

  private renderHeroes() {
    const coop = this.isCoop;
    const own = this.state.heroes.filter((hero) => hero.player === this.mySeat);
    // Co-op (`17` §9.3): all 6 heroes — own 3 left, partner's 3 right (blue frames).
    const partner = coop ? this.state.heroes.filter((hero) => hero.player !== this.mySeat) : [];
    const heroes = this.state.mode === "pvp" || coop ? [...own, ...partner] : this.state.heroes;
    heroes.forEach((hero) => {
      const rect = this.layout.units.get(hero.id);
      if (rect === undefined) return;
      const frame = coop && hero.player !== this.mySeat ? 0x5f8fdd : COLORS.panelBorder;
      this.renderHeroCard(hero, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, false, frame);
    });
    this.renderSummonRow(heroes, false);
    // Co-op group titles over each seat's hero row (`17` §9.3); the partner's
    // ready state rides along so `done` never needs a console read.
    if (coop) {
      const rowTop = OWN_ROW_TOP_LABEL;
      this.text(GROUP_LABEL_X_OWN, rowTop, "Đội của bạn", 12, COLORS.dimText, this.root).setOrigin(0.5);
      const partnerSeat = this.state.players.find((player) => player.index !== this.mySeat);
      const partnerLabel = partnerSeat?.done === true ? "Đồng đội · Đã xong" : "Đồng đội";
      this.text(GROUP_LABEL_X_PARTNER, rowTop, partnerLabel, 12, "#8fb8ff", this.root).setOrigin(0.5);
    }
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
  private renderPile(seat: PlayerState, anchors: SeatAnchors, color: number, owner: string, parent = this.root) {
    const { x, y } = anchors.draw;
    const left = seat.drawPile.length;
    const low = left <= 6;
    const tint = owner === "của bạn" ? 0xffffff : color;
    const layers = left === 0 ? 0 : Math.min(3, 1 + Math.floor(left / 10));
    // The generated card back art; falls back to the procedural HUD back.
    const backAt = (bx: number, by: number, scale: number) =>
      this.textures.exists("cards:card_back")
        ? this.add.image(bx, by, "cards:card_back").setDisplaySize(80 * scale, 116 * scale)
        : hudImage(this, HUD.cardBack, bx, by, scale);
    for (let i = layers - 1; i >= 0; i--) {
      parent.add(backAt(x + i * 4, y - i * 4, 0.82).setTint(tint).setAlpha(i === 0 ? 1 : 0.85));
    }
    if (layers === 0) parent.add(this.add.rectangle(x, y, 66, 95).setStrokeStyle(1, COLORS.panelBorder, 0.8));
    parent.add(hudImage(this, HUD.count, x, y + 50));
    this.text(x, y + 50, `${left}`, 13, low ? "#ff8a8a" : COLORS.gold, parent).setOrigin(0.5).setStroke("#05070f", 3);
    const discard = this.add.container(anchors.discard.x, anchors.discard.y);
    discard.add(backAt(0, 0, 0.42).setTint(0x8890a8).setAlpha(0.8));
    discard.add(this.add.text(0, 0, `${seat.discardPile.length}`, { ...TEXT_BASE, fontSize: "12px", color: COLORS.text, stroke: "#05070f", strokeThickness: 3 }).setOrigin(0.5));
    parent.add(discard);
    // The hover zone spans whichever way this seat's discard sits from its draw.
    // Clicking either pile opens the inspector (`05` review): the draw pile
    // shows count + composition (own seat only), never the draw order.
    const drawHit = this.add.zone(anchors.draw.x, anchors.draw.y, 90, 130).setName(`pile_draw_${seat.index}`).setInteractive({ useHandCursor: true });
    parent.add(drawHit);
    this.hoverTooltip(drawHit,()=>({x:anchors.draw.x+50,y:anchors.draw.y-50}),()=>[`Chồng rút ${owner}`,`Còn ${left} lá`,"Bấm để xem chi tiết"]);
    drawHit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      this.inspector?.openPile(
        pileModel(this.gameData, this.state, seat.index, "draw", this.mySeat),
        drawComposition(this.gameData, this.state, seat.index, this.mySeat),
      );
    });
    const discardHit = this.add.zone(anchors.discard.x, anchors.discard.y, 90, 70).setName(`pile_discard_${seat.index}`).setInteractive({ useHandCursor: true });
    parent.add(discardHit);
    this.hoverTooltip(discardHit,()=>({x:anchors.discard.x+50,y:anchors.discard.y-50}),()=>[`Chồng bỏ ${owner}`,`${seat.discardPile.length} lá`,"Bấm để xem chi tiết"]);
    discardHit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      this.inspector?.openPile(pileModel(this.gameData, this.state, seat.index, "discard", this.mySeat));
    });
  }

  private renderCard(
    instanceId: string,
    x: number,
    y: number,
    opts: { state?: CombatState; parent?: Phaser.GameObjects.Container; register?: boolean; interactive?: boolean } = {},
  ) {
    const state = opts.state ?? this.state;
    const parent = opts.parent ?? this.root;
    const instance = state.cards[instanceId]!;
    const card = cardDefOf(this.gameData, state, instance)!;
    const weapon = this.gameData.weapons[instance.cardId];
    const [ownerId, partnerId] = instance.ownerIds as [string, string | undefined];
    const model = combatCardModel(this.gameData, state, instanceId, instance.player);
    // Owners resolve by seat+defId (`17` §2.1) — a same-defId hero of the other seat is not the owner.
    const broken = cardOwners(state, instance).some((owner) => !owner?.alive);
    const playable = model.playable;
    const container = this.add.container(x, y);
    parent.add(container);
    if (opts.register !== false) this.cardViews.set(instanceId, container);

    const isValidTarget = this.targeting === instanceId;
    const mulliganPicked = this.mulliganPicks.has(instanceId);
    // LoR-style face: full-bleed art under a gradient band, keyword icons,
    // auto-fitted full text, cost coin + tag emblem; the owner color frames it.
    drawCardFace(
      this,
      {
        title: model.title,
        body: `${cardOwnerLabel(model)} ${model.fullText}`,
        cost: model.effectiveCost,
        costBase: model.baseCost,
        emblem: model.iconKey,
        keywordIds: model.keywordIds,
        artKeys: model.artKeys,
        border: broken ? COLORS.dead : isValidTarget || mulliganPicked ? COLORS.goldFill : (OWNER_COLORS[ownerId] ?? COLORS.panelBorder),
        borderWidth: isValidTarget || mulliganPicked ? 3 : 2,
        grey: broken,
      },
      "compact",
      container,
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
          .text(0, -CARD_H / 2 + 12, "⚡ Hợp Kích", { ...TEXT_BASE, fontSize: "10px", color: "#ffe080", stroke: "#2a1a04", strokeThickness: 3 })
          .setOrigin(0.5),
      );
    }
    if (instance.heldTurns > 0 && card.keywords?.includes("tich_tu")) {
      container.add(
        this.add
          .text(0, -CARD_H / 2 + 40, `Tích Tụ ${instance.heldTurns}`, { ...TEXT_BASE, fontSize: "10px", color: COLORS.gold, stroke: "#05070f", strokeThickness: 3 })
          .setOrigin(0.5),
      );
    }

    if (mulliganPicked) {
      ensureTextures(this);
      container.add(this.roundBox(CARD_W - 4, CARD_H - 4, 0x05070f, 0.55, 0, 0, CARD_RADIUS - 1));
      container.add(this.add.image(0, -14, VFX_GLOW).setBlendMode("ADD").setTint(0xf4d35e).setScale(0.46).setAlpha(0.6));
      container.add(this.add.circle(0, -14, 22, 0x0a0e26, 0.95).setStrokeStyle(1.5, COLORS.goldFill).setName("card_swap_gate"));
      container.add(hudImage(this, HUD.swap, 0, -14, 0.8).setName("card_swap_icon"));
    }
    if (broken) {
      container.add(
        this.add
          .text(0, 0, "Tàn Chiêu", { ...TEXT_BASE, fontSize: "14px", color: "#bbbbbb" })
          .setOrigin(0.5),
      );
    } else if (!playable && !isValidTarget && state.status !== "mulligan") {
      container.setAlpha(0.5);
    }

    // The selected card keeps its lift until cancel/commit (`05` review).
    if (this.targeting === instanceId) {
      const inHand = y === this.layout.hand.y + this.layout.hand.h / 2;
      const scale = inHand ? 1.1 : 1.15;
      container.setScale(scale);
      container.y = inHand ? this.handLiftY(scale) : y - 18;
      container.setDepth(10);
      parent.bringToTop(container);
    }

    if (opts.interactive === false) return container;
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    container.on("pointerover", () => {
      // A card whose clone is mid-cast is asleep — no hover, no lift.
      if (this.castingIds.has(instanceId)) return;
      this.tooltip?.destroy();
      const hintName =
        hintComboId !== undefined ? this.gameData.coopCombos[hintComboId]?.name : undefined;
      // The raise stops short of the hero row's bottom edge — a 180-tall card
      // tops out at 1.10× there; the tooltip preview carries the close read.
      const inHand = y === this.layout.hand.y + this.layout.hand.h / 2;
      const liftScale = inHand ? 1.1 : 1.15;
      // The preview prefers a side clear of the own-hero row; a crowded mid
      // card keeps the roomier side instead of covering both neighbours.
      const row = this.state.heroes
        .filter((h) => h.player === this.mySeat)
        .map((h) => this.layout.units.get(h.id))
        .filter((r): r is { x: number; y: number; w: number; h: number } => r !== undefined);
      const rowLeft = Math.min(...row.map((r) => r.x), 1280);
      const rowRight = Math.max(...row.map((r) => r.x + r.w), 0);
      const liftY = inHand ? this.handLiftY(liftScale) : y - 18;
      const rightX = x + CARD_W / 2 + 10;
      const leftX = x - CARD_W / 2 - 10 - 320;
      const rightFits = rightX + 320 <= 1272;
      const leftFits = leftX >= 8;
      const overlapX = (lx: number) => row.reduce((n, r) => n + Math.max(0, Math.min(lx + 320, r.x + r.w) - Math.max(lx, r.x)), 0);
      const tipX =
        rightFits && rightX >= rowRight ? rightX
        : leftFits && leftX + 320 <= rowLeft ? leftX
        : rightFits && (!leftFits || overlapX(rightX) <= overlapX(leftX)) ? rightX
        : leftFits ? leftX
        : rightX;
      this.tooltip = showCardTooltip(
        this,
        tipX,
        liftY - 40,
        this.gameData,
        cardDefOf(this.gameData, state, instance)!,
        [cardOwnerLabel(model,true), ...(hintName !== undefined ? [`⚡ ${hintName} — đồng đội đã đánh nửa kia`] : [])],
        {
          effectiveCost: model.effectiveCost,
          costReasons: model.costReasons,
          ...(model.disabledReason !== null ? { disabledReason: model.disabledReason } : {}),
        },
      );
      if (!broken && (inHand || state.status === "playerTurn" || state.status === "mulligan")) {
        container.setDepth(10);
        // Depth does not reorder a container's children: lift the card over its neighbours.
        parent.bringToTop(container);
        if (!this.inputLocked) this.liftCard(container, liftY, liftScale);
      }
    });
    container.on("pointerout", () => {
      if (this.castingIds.has(instanceId)) return;
      this.tooltip?.destroy();
      this.tooltip = null;
      if (this.targeting === instanceId) return;
      this.liftCard(container, y, 1);
      container.setDepth(0);
    });
    container.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.onCardClicked(instanceId);
    });
    container.once("destroy", () => {
      this.cardHoverTweens.get(container)?.stop();
      this.cardHoverTweens.delete(container);
    });
    return container;
  }

  /**
   * The y a raised in-hand card lands at for `scale` — its top edge kisses
   * the own-hero row's bottom, so the lift never covers the heroes.
   */
  private handLiftY(scale: number): number {
    const rowBottom = this.state.heroes
      .filter((h) => h.player === this.mySeat)
      .map((h) => this.layout.units.get(h.id))
      .reduce((m, r) => Math.max(m, (r?.y ?? 0) + (r?.h ?? 0)), 0);
    return rowBottom + (CARD_H * scale) / 2;
  }

  /** A card's in-flight hover tween — a re-hover retweens from where it is. */
  private readonly cardHoverTweens = new Map<Phaser.GameObjects.Container, Phaser.Tweens.Tween>();

  /** Smooths the hover raise/drop; the new tween replaces the in-flight one. */
  private liftCard(container: Phaser.GameObjects.Container, y: number, scale: number) {
    this.cardHoverTweens.get(container)?.stop();
    const tween = this.tweens.add({
      targets: container,
      y,
      scale,
      duration: 160,
      ease: "Cubic.easeOut",
      onComplete: () => this.cardHoverTweens.delete(container),
    });
    this.cardHoverTweens.set(container, tween);
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

  /**
   * Đổi Bài: a lacquer plate under the top moon (swap emblem, title, hint, one pip
   * per pick) and the medallion where end turn sits. Once done, the plate
   * says who is still choosing.
   */
  private renderMulliganBar() {
    const done = this.state.players[this.mySeat]?.mulliganDone === true;
    const max = this.gameData.combatConfig.maxMulligan;
    const picks = this.mulliganPicks.size;
    const plate = this.add.container(WIDTH / 2, 76).setName("mulligan_banner");
    this.root.add(plate);
    const w = done ? 250 : 320;
    plate.add(this.roundBox(w, 30, 0x0a0e26, 0.92, 1.5, COLORS.goldFill, 15));
    plate.add(hudImage(this, done ? HUD.hourglass : HUD.swap, -w / 2 + 22, 0, done ? 0.7 : 0.8).setAlpha(done ? 0.7 : 1));
    const title = this.add.text(-w / 2 + 42, 0, "Đổi Bài", { ...TEXT_BASE, fontSize: "15px", fontStyle: "bold", color: COLORS.gold }).setOrigin(0, 0.5);
    plate.add(title);
    const hint = done ? (this.isCoop ? "chờ đồng đội…" : "chờ đối thủ…") : `chọn tối đa ${max} lá`;
    plate.add(this.add.text(title.x + title.width + 10, 1, hint, { ...TEXT_BASE, fontSize: "12px", color: COLORS.dimText }).setOrigin(0, 0.5));
    if (done) return;
    for (let i = 0; i < max; i++) {
      plate.add(
        this.add
          .rectangle(w / 2 - 22 - (max - 1 - i) * 16, 0, 9, 9, i < picks ? COLORS.goldFill : 0x0a0e26)
          .setAngle(45)
          .setStrokeStyle(1.2, COLORS.goldFill),
      );
    }
    const { x, y } = endTurnAnchor(this.layout);
    const btn = this.medallionButton(x, y, true, hudImage(this, HUD.swap, 0, -16), picks > 0 ? `Đổi ${picks} lá` : "Giữ nguyên", "Vào trận", () => {
      const instanceIds = [...this.mulliganPicks];
      this.mulliganPicks.clear();
      this.dispatch({ type: "mulligan", instanceIds });
    });
    this.hoverTooltip(btn, () => ({ x: x - 290, y: y - 60 }), () => [
      picks > 0 ? `Đổi ${picks} lá đã chọn rồi vào trận` : "Giữ nguyên tay bài rồi vào trận",
    ]);
  }

  private renderChoiceOverlay() {
    const pending = this.state.players[this.mySeat]!.pendingChoice!;
    // A new choice always opens expanded; the collapse survives re-renders of
    // the same choice (e.g. resize) so inspecting the board isn't interrupted.
    if (pending !== this.lastPendingChoice) {
      this.lastPendingChoice = pending;
      this.choiceCollapsed = false;
    }
    if (this.choiceCollapsed) {
      const view = visibleWorld(this);
      const banner = this.add.container(view.x + view.w / 2, view.y + 24);
      banner.add(this.roundBox(320, 34, 0x0a0e26, 0.94, 1.5, COLORS.goldFill, 17));
      const label = pending.kind === "chooseMoon" ? "Chờ chọn pha — bấm để mở lại" : "Chờ chọn bài — bấm để mở lại";
      banner.add(this.add.text(0, 0, label, { ...TEXT_BASE, fontSize: "13px", color: COLORS.gold }).setOrigin(0.5));
      const hit = this.add.rectangle(0, 0, 320, 34, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) {
          this.choiceCollapsed = false;
          this.requestRender();
        }
      });
      banner.add(hit);
      this.root.add(banner);
      return;
    }
    if (pending.kind === "chooseMoon") {
      this.renderMoonChoice(pending.options);
      return;
    }
    if (pending.kind !== "chooseCard") return;
    const options = pending.options;
    this.root.add(this.screenDim(0.6));
    this.text(WIDTH / 2, 250, "Chiêm Bài — chọn 1 lá, các lá còn lại xuống đáy chồng", 16, COLORS.gold).setOrigin(0.5);
    this.collapseButton(WIDTH / 2 + 320, 250);
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
   * Chọn Pha (`18` §2.2): a single panel listing the options vertically —
   * keep the phase or push the wheel +1/+2. The panel fits the measured text
   * (`fitChoicePanel`) and long decree texts scroll under a mask instead of
   * shrinking the font. Esc / right-click / "Thu nhỏ" folds it to a banner.
   */
  private renderMoonChoice(options: number[]) {
    this.root.add(this.screenDim(0.6));
    const view = visibleWorld(this);
    const PANEL_W = 360;
    const PAD = 18;
    const TITLE_H = 44;
    const cx = view.x + view.w / 2;
    const textW = PANEL_W - PAD * 2;

    // Measure every option row first — the panel fits the real text height.
    const rows = options.map((raw) => {
      const offset = raw as 0 | 1 | 2;
      const phaseIndex = (this.state.moonIndex + offset) % this.gameData.moonPhases.length;
      const desc = describePhase(this.gameData, this.state, phaseIndex);
      const probe = this.add
        .text(-2000, -2000, desc, { ...TEXT_BASE, fontSize: "11px", color: COLORS.dimText, wordWrap: { width: textW } });
      const h = 26 + probe.height + 16;
      probe.destroy();
      return { offset, phaseIndex, desc, h };
    });
    // fitChoicePanel adds 96px of chrome (title strip + paddings) on top of the
    // measured content height, then clamps the panel inside the visible world.
    const panelRect = fitChoicePanel(
      rows.reduce((sum, row) => sum + row.h, 0),
      view,
    );
    const box = this.roundBox(panelRect.w, panelRect.h, 0x101830, 0.97, 1.5, COLORS.goldFill, CARD_RADIUS);
    box.setPosition(cx, panelRect.y + panelRect.h / 2);
    this.root.add(box);
    this.text(cx, panelRect.y + 22, "Chọn Pha — chọn pha trăng cho lượt này", 15, COLORS.gold).setOrigin(0.5);
    this.collapseButton(cx + panelRect.w / 2 - 26, panelRect.y + 20);

    const regionTop = panelRect.y + TITLE_H;
    const regionH = panelRect.y + panelRect.h - 14 - regionTop;
    const bandTop = regionTop;
    const bandBottom = regionTop + regionH;
    const inBand = (pointer: Phaser.Input.Pointer) => {
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      return wp.y >= bandTop && wp.y <= bandBottom;
    };

    const content = this.add.container(0, 0);
    let cy = regionTop;
    for (const row of rows) {
      const phase = this.gameData.moonPhases[row.phaseIndex]!;
      const block = roundedPanel(this,cx,cy+row.h/2-4,PANEL_W-14,row.h-8,0x141b33,1,COLORS.panelBorder,10)
        .setInteractive({ useHandCursor: true });
      block.on("pointerover", () => { block.setAlpha(0.8); });
      block.on("pointerout", () => { block.setAlpha(1); });
      block.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        // The mask clips pixels, not input — only honour clicks in the viewport.
        if (pointer.button === 0 && inBand(pointer)) this.dispatch({ type: "chooseMoon", offset: row.offset });
      });
      content.add(block);
      content.add(
        this.add
          .text(cx - textW / 2, cy + 2, `${row.offset === 0 ? "Giữ pha" : `+${row.offset}`} — ${phase.icon} ${phase.name}`, {
            ...TEXT_BASE,
            fontSize: "14px",
            fontStyle: "bold",
            color: COLORS.gold,
          })
          .setOrigin(0, 0),
      );
      content.add(
        this.add
          .text(cx - textW / 2, cy + 24, row.desc, {
            ...TEXT_BASE,
            fontSize: "11px",
            color: COLORS.dimText,
            wordWrap: { width: textW },
          })
          .setOrigin(0, 0),
      );
      cy += row.h;
    }
    const contentH = cy - regionTop;
    this.root.add(content);

    if (contentH > regionH) {
      // Long decrees: clip to the region and wheel-scroll — never shrink font.
      const veil = this.add.rectangle(cx, regionTop + regionH / 2, PANEL_W - 4, regionH).setVisible(false);
      this.root.add(veil);
      content.setMask(veil.createGeometryMask());
      const scroll = (dy: number) => {
        const min = -(contentH - regionH);
        content.y = Phaser.Math.Clamp(content.y - dy, min, 0);
      };
      this.choiceWheel = (pointer, _over, _dx, dy) => {
        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        if (dy !== 0 && wp.x >= panelRect.x && wp.x <= panelRect.x + panelRect.w && wp.y >= bandTop && wp.y <= bandBottom) {
          scroll(dy * 0.6);
        }
      };
      this.input.on("wheel", this.choiceWheel);
      this.text(cx, panelRect.y + panelRect.h - 12, "cuộn để xem thêm", 10, COLORS.dimText).setOrigin(0.5, 1);
    }
  }

  /** The choice panel's clear close control — folds to the reopen banner. */
  private collapseButton(x: number, y: number) {
    const btn = this.add.container(x, y);
    btn.add(this.roundBox(64, 22, 0x1a2440, 0.9, 1, COLORS.goldFill, 11));
    btn.add(this.add.text(0, 0, "Thu nhỏ", { ...TEXT_BASE, fontSize: "11px", color: COLORS.dimText }).setOrigin(0.5));
    const hit = this.add.rectangle(0, 0, 64, 22, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) {
        this.choiceCollapsed = true;
        this.requestRender();
      }
    });
    btn.add(hit);
    this.root.add(btn);
  }

  private renderCombatEnd() {
    if (this.netMatch) {
      const end = this.netMatch.ended;
      const won = end ? end.result === "won" : this.state.mode === "coop" ? this.state.status === "won" && !this.netMatch.forfeited : this.state.winner === this.mySeat;
      const draw = end ? end.result === "draw" : this.state.winner === "draw";
      // Terminal recovery lands here without a combatEnded beat — the audio
      // instance dedupes so an earlier beat's sting never repeats (`16` §8.3).
      this.audio.play(draw ? "resultDraw" : won ? "victory" : "defeat");
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
      // Result known, settlement still in flight — rewards land via the registry.
      if (this.netMatch.settlement.status === "pending") {
        this.text(WIDTH / 2, HEIGHT / 2 + 72, "Đang nhận kết quả thưởng…", 14, COLORS.dimText).setOrigin(0.5);
      }
      // Settlement write failed server-side: the result stands, rewards follow (`16` §8.4).
      if (this.netMatch.settlement.status === "failed") {
        this.text(
          WIDTH / 2, HEIGHT / 2 + 72,
          "Không nhận được thông tin thưởng; hồ sơ sẽ được cập nhật lại.",
          14, "#cc5555",
        ).setOrigin(0.5);
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
      this.audio.play(won ? "victory" : "defeat");
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
        this.endScreenButton(WIDTH / 2 - 100, HEIGHT / 2 + 96, "Thử lại", () => this.retryStory());
        this.endScreenButton(WIDTH / 2 + 100, HEIGHT / 2 + 96, "Về Cốt Truyện", () => {
          session.pendingStageId = null;
          this.scene.start("story");
        });
      }
      return;
    }
    const won = this.state.status === "won";
    this.audio.play(won ? "victory" : "defeat");
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

  /**
   * The ⚙ modal: speed, reduced motion, volume. Purely local presentation —
   * the server deadline keeps running while it is open, and a running batch
   * keeps the settings it started with (`16` §8.3). Esc/Enter dismiss it via
   * the modal's own handlers; control updates preserve modal ownership.
   */
  private openSettings(): void {
    if (isModalOpen()) return;
    showCombatSettings(this, this.settings, next => this.applySettings(next));
  }

  /** Applies new preferences to audio immediately and to the next batch's runtime. */
  private applySettings(next: CombatSettings): void {
    this.settings = next;
    this.audio.configure(next);
    this.refreshMoon(this.state);
    try {
      saveCombatSettings(localStorage, next);
    } catch {
      // Storage denied (private mode) — preferences simply won't persist.
    }
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
        this.requestRender();
      });
    });
    y += 36;
    this.debugButton(x + 14, y + 10, 110, "+3 Nguyệt Lực", () => {
      debugAddMoonPower();
      this.requestRender();
    });
    this.debugButton(x + 134, y + 10, 80, "Rút 1 lá", () => {
      debugDrawCards(1);
      this.requestRender();
    });
    y += 36;
    line("Đặt pha:");
    this.gameData.moonPhases.forEach((phase, index) => {
      this.debugButton(x + 14 + index * 38, y + 8, 32, phase.icon, () => {
        debugSetMoon(index);
        this.requestRender();
      });
    });
    y += 32;
    line("HP Hero:");
    this.state.heroes.forEach((hero, index) => {
      const def = this.gameData.heroes[hero.defId]!;
      this.text(x + 14, y + 8, `${hero.leveledUp ? "★ " : ""}${def.name} ${hero.hp}/${hero.maxHp}`, 11);
      this.debugButton(x + 200, y + 8, 44, "-5", () => {
        debugAdjustHeroHp(index, -5);
        this.requestRender();
      });
      this.debugButton(x + 250, y + 8, 44, "+5", () => {
        debugAdjustHeroHp(index, 5);
        this.requestRender();
      });
      this.debugButton(x + 300, y + 8, 24, "★", () => {
        debugSetLeveledUp(index);
        this.requestRender();
      });
      y += 28;
    });
    this.state.enemies.forEach((enemy, index) => {
      if (!enemy.alive) return;
      const def = this.gameData.enemies[enemy.defId]!;
      this.debugButton(x + 14, y + 8, 180, `Giết: ${def.name}`, () => {
        debugKillEnemy(index);
        this.requestRender();
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
    const layer = this.seatLayerOf(seat.index);
    // Nothing to spend while Đổi Bài is open.
    if (this.state.status !== "mulligan") this.renderMoonPower(seat, layer);
    this.renderSeatHand(seat, this.state, layer);
    this.renderPile(seat, this.layout.seats.get(seat.index)!, 0x3f7fd0, "của bạn", layer);
    if (this.state.status !== "mulligan" && this.state.status !== "won" && this.state.status !== "lost") {
      this.renderEndTurn(seat);
    }
  }

  /** A seat's hand row — my seat's interactive cards in the bottom bar. */
  private renderSeatHand(seat: PlayerState, state: CombatState, parent: Phaser.GameObjects.Container): void {
    // A full hand squeezes into the shared hand area; the hovered card lifts
    // above its neighbours in renderCard.
    const slots = handSlots(seat.hand.length, this.layout.hand);
    seat.hand.forEach((instanceId, index) => {
      const slot = slots[index];
      if (slot !== undefined) this.renderCard(instanceId, slot.x, slot.y, { state, parent });
    });
  }

  /** Top-right, under the settings icon: Nguyệt Lực, Dự Trữ as a green badge when kept. */
  /**
   * Nguyệt Lực orb: a dark glass core that brightens as it fills, ringed by one
   * arc per point up to the cap (gold; the kept Dự Trữ points green), the
   * number in the middle and the label underneath.
   */
  private renderMoonPower(seat: PlayerState, parent = this.root) {
    const { x, y } = this.layout.seats.get(this.mySeat)?.resource ?? { x: 1206, y: 104 };
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
    parent.add([glow, core, arcs]);
    this.text(x, y - 1, `${power}`, 24, COLORS.gold, parent).setOrigin(0.5);
    this.text(x, y + 50, seat.moonPowerBonus > 0 ? `Nguyệt Lực +${seat.moonPowerBonus}` : "Nguyệt Lực", 11, COLORS.gold, parent)
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
    const firstObject = this.root.list.length;
    const { x, y } = endTurnAnchor(this.layout);
    const coop = this.isCoop;
    const canAct = this.state.status === "playerTurn" || (coop && this.state.status === "choosing");
    const myDone = coop && seat.done === true;
    const active = canAct && !myDone && !this.inputLocked;
    const busyLabel = this.netDown ? "Mất kết nối" : this.inputLocked ? "Đang xử lý…" : null;
    const icon = coop
      ? this.add.text(0, -16, "✓", { ...TEXT_BASE, fontSize: "24px", color: active ? COLORS.gold : COLORS.dimText }).setOrigin(0.5)
      : hudImage(this, HUD.hourglass, 0, -16).setAlpha(active ? 1 : 0.45);
    const btn = this.medallionButton(x, y, active, icon, busyLabel ?? (coop ? "Xong lượt" : "Kết thúc"), `Vòng ${this.state.round}`, () =>
      this.dispatch({ type: "endTurn" }),
    );
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
        : [busyLabel ?? waiting, `Vòng ${this.state.round}`],
    );
    this.endTurnObjects = this.root.list.slice(firstObject);
  }

  /**
   * The phase's main action (end turn, Đổi Bài): a gold medallion with an
   * icon, a label and a small line under it; it glows while it can be pressed.
   * Returns the hit circle for the tooltip.
   */
  private medallionButton(
    x: number,
    y: number,
    active: boolean,
    icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text,
    label: string,
    sub: string,
    onClick: () => void,
  ): Phaser.GameObjects.Arc {
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
    medal.add([face, icon]);
    medal.add(this.add.text(0, 6, label, { ...TEXT_BASE, fontSize: "12px", fontStyle: "bold", color: active ? COLORS.gold : COLORS.dimText }).setOrigin(0.5));
    medal.add(this.add.text(0, 24, sub, { ...TEXT_BASE, fontSize: "10px", color: active ? COLORS.text : COLORS.dimText }).setOrigin(0.5));
    const btn = this.add.circle(x, y, 52, 0x000000, 0.001);
    this.root.add(btn);
    btn.setInteractive({ useHandCursor: active });
    if (active) {
      btn.on("pointerover", () => medal.setScale(1.06));
      btn.on("pointerout", () => medal.setScale(1));
      btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0 && !this.inputLocked) onClick();
      });
    }
    return btn;
  }

}
