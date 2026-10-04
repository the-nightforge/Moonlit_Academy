import type Phaser from "phaser";
import { cardDefOf } from "rules";
import type { CardDef, CombatEvent, CombatState, GameData, IntentDef, UnitState } from "rules";
import { attackLookOf, cardColorOf, hpLossLook } from "./attack-style";
import { applyPresentationEvent } from "./combat-presentation";
import type { PresentationBindings } from "./combat-presentation";
import { resolvePlayedCard, seatAnchors, statusAppliedLabel, statusDisplayValue, unitAt } from "./combat-display";
import type { Point, SeatAnchors } from "./combat-display";
import type { PublicPlayedCard } from "../net/protocol";
import { COMBAT_LAYOUT, STATUS_ICONS, STATUS_LABELS, TEXT_BASE } from "./theme";
import { bloodMoonSurge, castCard, deathBurn, moonWheel, playAttack, reflectStrike, statusPop } from "./vfx";
import { HAND_AREA, MOON, handSlots } from "./combat-layout";
import type { CombatLayout } from "./combat-layout";
import { triggerAnchorKey } from "./combat-inspector";
import type { AnimationRuntime } from "./animation-runtime";
import type { CombatAudio } from "./combat-audio";

const WIDTH = 1280;
const { midY, unitFlash } = COMBAT_LAYOUT;

export interface AnimContext {
  gameData: GameData;
  /** The batch's working copy — every visible value moves off it mid-beat. */
  presentation: CombatState;
  /** The batch's post-action state — metadata the events don't carry resolves against it. */
  after: CombatState;
  /** The batch's pre-action state; `before === after` marks the intro reveal stream. */
  before?: CombatState;
  /** Scene hooks that patch rendered objects as the presentation moves. */
  bindings: PresentationBindings;
  /** Cast-time records of the batch's `cardPlayed` events (`16` §8.2). */
  revealedCards?: Record<string, PublicPlayedCard>;
  unitAnchors: Map<string, { x: number; y: number }>;
  unitViews: Map<string, Phaser.GameObjects.Container>;
  /** The local player's hand cards: a played card flies out of its slot. */
  cardViews?: Map<string, Phaser.GameObjects.Container>;
  /** Per-seat zone anchors (draw/discard/hand/resource/reserve). */
  seatAnchors: Map<number, SeatAnchors>;
  /** Builds a detached, runtime-tracked clone of a hand card for the cast beat. */
  castView?: (instanceId: string) => Phaser.GameObjects.Container | undefined;
  /** Where the moon icon sits (follows the background art); defaults to the layout spot. */
  moonAnchor?: { x: number; y: number };
  /** The shared layout — the draw flight lands on real hand slots from it. */
  layout?: CombatLayout;
  /** The local player's seat in a PvP view (`17` §4.8); 0 in PvE. */
  mySeat?: number;
  /** Per-batch animation scope: every timed/tweened FX goes through it. */
  runtime: AnimationRuntime;
  /** Procedural cue player — silent until unlocked and muted under volume 0. */
  audio?: CombatAudio;
  /** A public personal forfeit already observed for the local network seat. */
  forfeited?: boolean;
  /** Relic/weapon icon positions keyed `${player}:${kind}:${id}` — trigger flashes land here (`05` review). */
  triggerAnchors?: Map<string, { x: number; y: number }>;
}

function anchorsFor(ctx: AnimContext, player?: number) {
  return ctx.seatAnchors.get(player ?? 0) ?? seatAnchors(player ?? 0, ctx.mySeat ?? 0, ctx.presentation.mode);
}

function floatText(
  rt: AnimationRuntime,
  x: number,
  y: number,
  content: string,
  color: string,
  size: number,
  duration: number,
): Promise<void> {
  const text = rt.track(
    rt.scene.add
      .text(x, y, content, { ...TEXT_BASE, fontSize: `${size}px`, color })
      .setOrigin(0.5)
      .setDepth(100),
  );
  return rt.tween({
    targets: text,
    y: y - 34,
    alpha: 0,
    duration,
    ease: "Sine.easeOut",
    onComplete: () => text.destroy(),
  });
}

function flash(
  rt: AnimationRuntime,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  duration: number,
): Promise<void> {
  const rect = rt.track(rt.scene.add.rectangle(x, y, w, h, color, 0.45).setDepth(90));
  return rt.tween({
    targets: rect,
    alpha: 0,
    duration,
    onComplete: () => rect.destroy(),
  });
}

/** Looks up an intent of an enemy by id, including moon/blood moon overrides. */
function findIntent(ctx: AnimContext, enemyId: string, intentId: string): IntentDef | undefined {
  const defId = ctx.presentation.enemies.find((enemy) => enemy.id === enemyId)?.defId;
  const def = defId !== undefined ? ctx.gameData.enemies[defId] : undefined;
  if (!def) return undefined;
  return [
    ...def.intents,
    ...(def.moonOverrides ?? []).map((entry) => entry.intent),
    ...(def.bloodMoonOverride ? [def.bloodMoonOverride] : []),
  ].find((intent) => intent.id === intentId);
}

function instant(): Promise<void> {
  return Promise.resolve();
}

/**
 * Relic/Kỳ Vật/Lõi/weapon trigger feedback (`05` review): a flash on the
 * entry's own icon plus a short label right there — never a bare text blob at
 * screen center. An unregistered id falls back to the center float.
 */
function triggerFlash(
  rt: AnimationRuntime,
  ctx: AnimContext,
  player: number | undefined,
  kind: "relic" | "runRelic" | "augment" | "weapon",
  id: string,
  label: string,
  color: string,
): Promise<void> {
  const anchor = ctx.triggerAnchors?.get(triggerAnchorKey(player ?? ctx.mySeat ?? 0, kind, id));
  if (anchor === undefined) return floatHeld(rt, WIDTH / 2, midY, label, color, 18, 400, 200);
  const colorNum = parseInt(color.slice(1), 16);
  return held(rt, 350, flash(rt, anchor.x, anchor.y, 40, 40, colorNum, 400), floatText(rt, anchor.x, anchor.y - 12, label, color, 14, 320));
}

/**
 * Routine feedback that must not stall the queue: the cosmetic tween fires
 * detached under the runtime while the beat holds only `hold` ms — the fade
 * keeps playing underneath the next beat and drains before the batch commits.
 */
function held(rt: AnimationRuntime, hold: number, ...cosmetics: Promise<void>[]): Promise<void> {
  for (const cosmetic of cosmetics) void cosmetic.catch(() => {});
  return rt.wait(hold);
}

/** A float text that reads for `hold` ms; its fade continues detached. */
function floatHeld(
  rt: AnimationRuntime,
  x: number,
  y: number,
  content: string,
  color: string,
  size: number,
  fade: number,
  hold: number,
): Promise<void> {
  return held(rt, hold, floatText(rt, x, y, content, color, size, fade));
}

type HpLostEvent = Extract<CombatEvent, { type: "hpLost" }>;
export type DamageEvent = Extract<CombatEvent, { type: "damageDealt" }>;

/** The reveal beats a fresh match opens with (`16` §8.2). */
const INTRO_TYPES = new Set<CombatEvent["type"]>(["combatStarted", "moonDecreesRolled", "turnStarted", "cardsDrawn"]);

/**
 * The intro reveal played once per scene on a fresh match start (`16` §8.2):
 * the real setup stream filtered to its four reveal beats, or — when no
 * stream traveled (local combat, older server) — a cosmetic stand-in built
 * from the public snapshot. Never a `createCombat` re-run, never a fake draw:
 * each `cardsDrawn` reveals the ids the seat's hand already holds.
 */
export function buildIntroEvents(state: CombatState, initialEvents: readonly CombatEvent[]): CombatEvent[] {
  const real = initialEvents.filter((event) => INTRO_TYPES.has(event.type));
  if (real.length > 0) return real;
  const intro: CombatEvent[] = [
    { type: "combatStarted" },
    { type: "moonDecreesRolled", moonIndex: state.moonIndex, decrees: [...state.moonDecrees] },
    ...state.players.map(
      (seat): CombatEvent => ({ type: "cardsDrawn", player: seat.index, instanceIds: [...seat.hand] }),
    ),
  ];
  // A snapshot still in mulligan has no turn to announce yet.
  if (state.status !== "mulligan") {
    intro.push({ type: "turnStarted", side: "hero", round: state.round, player: state.activePlayer });
  }
  return intro;
}

/**
 * Groups consecutive `damageDealt` events for parallel playback. A group takes
 * hits from one source on distinct targets; a repeated target, a different
 * source, or any non-damage event closes it — so repeated hits on one unit
 * still play one after another. This is an animation grouping only, not a
 * rules-level hit id. `groups.flat()` always equals `events`.
 */
export function groupDamageEvents(events: readonly CombatEvent[]): CombatEvent[][] {
  const groups: CombatEvent[][] = [];
  let open: DamageEvent[] = [];
  const seen = new Set<string>();
  const flush = () => {
    if (open.length === 0) return;
    groups.push(open);
    open = [];
    seen.clear();
  };
  for (const event of events) {
    if (event.type !== "damageDealt") {
      flush();
      groups.push([event]);
      continue;
    }
    const hit = event as DamageEvent;
    const sameSource = open.length === 0 || open[0]!.sourceId === hit.sourceId;
    if (sameSource && !seen.has(hit.targetId)) {
      open.push(hit);
      seen.add(hit.targetId);
      continue;
    }
    flush();
    open = [hit];
    seen.add(hit.targetId);
  }
  flush();
  return groups;
}

/** Events after which damage no longer comes from the last played card. */
const CARDLESS_SOURCES = new Set<CombatEvent["type"]>([
  "turnStarted",
  "intentExecuted",
  "summonActed",
  "relicTriggered",
  "weaponTriggered",
  "runRelicTriggered",
]);

const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** The unit's real bounds for flash sizing — its view first, then its layout rect. */
function unitBounds(ctx: AnimContext, unitId: string): { x: number; y: number; w: number; h: number } | undefined {
  const bounds = ctx.unitViews.get(unitId)?.getBounds();
  if (bounds !== undefined && typeof bounds.width === "number") {
    return { x: bounds.centerX, y: bounds.centerY, w: bounds.width, h: bounds.height };
  }
  const rect = ctx.layout?.units.get(unitId);
  if (rect === undefined) return undefined;
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, w: rect.w, h: rect.h };
}

/** Flash covering `unitId`'s view bounds — or the layout flash at its anchor. */
function unitFlashAt(rt: AnimationRuntime, ctx: AnimContext, unitId: string, color: number, duration: number): Promise<void> {
  const anchor = ctx.unitAnchors.get(unitId);
  const bounds = unitBounds(ctx, unitId);
  return flash(rt, bounds?.x ?? anchor?.x ?? 0, bounds?.y ?? anchor?.y ?? 0, bounds?.w ?? unitFlash.w, bounds?.h ?? unitFlash.h, color, duration);
}

/** Card backs traveling between two seat-zone anchors (discard, Luân Hồi). */
function zoneFlight(rt: AnimationRuntime, from: Point, to: Point, count: number): Promise<void> {
  const jobs = Array.from({ length: Math.max(1, count) }, (_, i) => {
    const back = rt.track(
      rt.scene.add
        .rectangle(from.x, from.y, 30, 44, 0x2c3e6e)
        .setStrokeStyle(1, 0xf4d35e)
        .setDepth(100),
    );
    return rt.tween({
      targets: back,
      x: to.x,
      y: to.y,
      alpha: 0.5,
      delay: i * 50,
      duration: 200,
      ease: "Sine.easeIn",
      onComplete: () => back.destroy(),
    });
  });
  return Promise.all(jobs).then(() => undefined);
}

/** The x a `instanceId` lands at in `seat`'s fanned hand row (its real slot — the shared layout math). */
function handSlotX(ctx: AnimContext, player: number | undefined, instanceId: string): number | undefined {
  const seat = ctx.presentation.players[player ?? 0];
  const index = seat?.hand.indexOf(instanceId) ?? -1;
  if (seat === undefined || index < 0) return undefined;
  return handSlots(seat.hand.length, ctx.layout?.hand ?? HAND_AREA)[index]?.x;
}

function isBloodMoonLoss(
  event: CombatEvent | undefined,
): event is HpLostEvent & { cause: "bloodMoon" } {
  return event?.type === "hpLost" && event.cause === "bloodMoon";
}

/** A line from one unit to another that fades out (enemy aim lines). */
function beam(
  rt: AnimationRuntime,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color = 0x9fd4ff,
  duration = 250,
  width = 3,
): Promise<void> {
  const g = rt.track(rt.scene.add.graphics().setDepth(96));
  g.lineStyle(width, color, 1).lineBetween(from.x, from.y, to.x, to.y);
  return rt.tween({
    targets: g,
    alpha: 0,
    duration,
    onComplete: () => g.destroy(),
  });
}

/** A status label flying from the victim to the thief (stealBuff). */
function flyLabel(
  rt: AnimationRuntime,
  from: { x: number; y: number },
  to: { x: number; y: number },
  content: string,
): Promise<void> {
  const text = rt.track(
    rt.scene.add
      .text(from.x, from.y - 62, content, { ...TEXT_BASE, fontSize: "15px", color: "#ffd97f" })
      .setOrigin(0.5)
      .setDepth(100),
  );
  return rt.tween({
    targets: text,
    x: to.x,
    y: to.y - 62,
    duration: 350,
    ease: "Sine.easeInOut",
    onComplete: () => text.destroy(),
  });
}

/**
 * Plays events in order. A few sequences read as one beat:
 * statusRemoved + statusApplied of the same status on another unit (a steal),
 * consecutive blood moon HP losses (together), and reflect after its hit.
 */
/**
 * Moves the presentation one event forward and refreshes the views it touched:
 * unit badges at the unit's own beat, seat chrome (hand, piles, resources) per
 * seat event, the moon badge on phase/decrees. No `renderAll` mid-batch.
 */
function applyBeat(ctx: AnimContext, event: CombatEvent): void {
  applyPresentationEvent(ctx.gameData, ctx.presentation, event, ctx.after, ctx.before);
  const presentation = ctx.presentation;
  const unit = (id: string) => ctx.bindings.updateUnit(id, presentation);
  const seat = (player?: number) => ctx.bindings.updateSeat(player ?? 0, presentation);
  switch (event.type) {
    case "damageDealt":
    case "hpLost":
    case "healed":
    case "armorGained":
    case "armorRemoved":
    case "statusApplied":
    case "statusRemoved":
      unit(event.targetId);
      return;
    case "unitDied":
    case "summonDismissed":
    case "summonActed":
    case "sealStripped":
      unit(event.unitId);
      return;
    case "heroRevived":
    case "heroLeveledUp":
      unit(event.heroId);
      return;
    case "summoned":
      ctx.bindings.ensureSummon(event.unitId, presentation);
      return;
    case "bossPhaseChanged":
    case "intentsRevealed":
    case "intentsCancelled":
    case "intentExecuted":
    case "intentSkipped":
    case "intentFizzled":
      unit(event.enemyId);
      return;
    case "moonReserveChanged":
      if (event.side === "enemy" && event.enemyId !== undefined) unit(event.enemyId);
      else seat(event.player);
      return;
    case "moonPowerChanged":
    case "cardsDrawn":
    case "cardPlayed":
    case "cardDiscarded":
    case "cardsRecycled":
    case "cardCreated":
    case "cardsPurged":
    case "mulliganed":
    case "cardChosen":
    case "choiceOpened":
    case "moonChoiceOpened":
    case "turnStarted":
      seat(event.player);
      return;
    case "moonShifted":
    case "moonDecreesRolled":
    case "bloodMoonChanged":
      ctx.bindings.updateMoon(presentation);
      return;
    default:
      return;
  }
}

/**
 * Plays events in order. A few sequences read as one beat:
 * statusRemoved + statusApplied of the same status on another unit (a steal),
 * consecutive blood moon HP losses (together), and reflect after its hit.
 */
export async function playEventQueue(
  rt: AnimationRuntime,
  events: CombatEvent[],
  ctx: AnimContext,
): Promise<void> {
  /** The card whose effects are resolving: its hits take the card's look. */
  let card: CardDef | undefined;
  /** Repeated hits on one target shift their floats so the numbers never stack. */
  const hitCounts = new Map<string, number>();
  let previous: CombatEvent | undefined;
  const groups = groupDamageEvents(events);
  for (let g = 0; g < groups.length; g++) {
    // An abort between beats exits here — before applyBeat can repaint views
    // a rejoin just rebuilt, or a beat can spawn an untracked object (`16` §8.5).
    rt.assertActive();
    const group = groups[g]!;
    const event = group[0]!;
    const next = groups[g + 1]?.[0];
    if (event.type === "cardPlayed") {
      card = resolvePlayedCard(ctx.gameData, ctx.presentation, ctx.after, event.instanceId, ctx.revealedCards)?.definition;
      // The clone must exist before the seat refresh rebuilds the hand — the
      // real card view is hidden by `castView` and dies with the rebuild.
      const cast = ctx.castView?.(event.instanceId);
      applyBeat(ctx, event);
      await animateEvent(rt, event, ctx, card, 0, cast);
      previous = event;
      continue;
    }
    if (CARDLESS_SOURCES.has(event.type)) {
      card = undefined;
    }
    if (group.every((member) => member.type === "damageDealt")) {
      // Distinct targets of one source land together; the next group waits for
      // the decisive impacts plus a short beat so each hit stays readable.
      await Promise.all(
        (group as DamageEvent[]).map((hit) => {
          const index = hitCounts.get(hit.targetId) ?? 0;
          hitCounts.set(hit.targetId, index + 1);
          return animateEvent(rt, hit, ctx, card, index);
        }),
      );
      previous = group[group.length - 1];
      if (g + 1 < groups.length) await rt.wait(40);
      continue;
    }
    if (
      event.type === "statusRemoved" &&
      next?.type === "statusApplied" &&
      next.status === event.status &&
      next.targetId !== event.targetId
    ) {
      const from = ctx.unitAnchors.get(event.targetId);
      const to = ctx.unitAnchors.get(next.targetId);
      if (from && to) {
        const shown = statusDisplayValue(
          ctx.presentation,
          { statuses: [{ id: next.status, value: next.value }] } as UnitState,
          next.status,
        );
        applyBeat(ctx, event);
        applyBeat(ctx, next);
        await flyLabel(rt, from, to, `${STATUS_LABELS[next.status]} ${shown}`);
        previous = next;
        g++;
        continue;
      }
    }
    if (isBloodMoonLoss(event)) {
      // Consecutive blood moon losses are their own singleton groups — gather them.
      const losses: HpLostEvent[] = [event];
      while (isBloodMoonLoss(groups[g + 1]?.[0])) {
        losses.push(groups[g + 1]![0] as HpLostEvent);
        g++;
      }
      for (const loss of losses) applyBeat(ctx, loss);
      await Promise.all(losses.map((loss) => animateEvent(rt, loss, ctx)));
      previous = losses[losses.length - 1];
      continue;
    }
    if (event.type === "hpLost" && event.cause === "reflect" && previous?.type === "damageDealt") {
      const from = ctx.unitAnchors.get(previous.targetId);
      const to = ctx.unitAnchors.get(event.targetId);
      if (from && to) {
        applyBeat(ctx, event);
        await Promise.all([reflectStrike(rt, from, to), animateEvent(rt, event, ctx)]);
        previous = event;
        continue;
      }
    }
    applyBeat(ctx, event);
    await animateEvent(rt, event, ctx, card);
    previous = event;
  }
}

function animateEvent(
  rt: AnimationRuntime,
  event: CombatEvent,
  ctx: AnimContext,
  card?: CardDef,
  hitIndex = 0,
  cast?: Phaser.GameObjects.Container,
): Promise<void> {
  const anchorOf = (unitId: string) => ctx.unitAnchors.get(unitId);

  switch (event.type) {
    case "turnStarted": {
      const label =
        event.player !== undefined
          ? event.player === ctx.mySeat
            ? "— Lượt của bạn —"
            : "— Lượt đối thủ —"
          : event.side === "hero"
            ? "— Lượt người chơi —"
            : "— Lượt kẻ địch —";
      return floatHeld(rt, WIDTH / 2, midY, label, "#cfd6f0", 16, 250, 120);
    }
    case "cardsDrawn": {
      const ids = event.instanceIds;
      if (ids.length === 0) return instant();
      ctx.audio?.play("draw");
      const anchors = anchorsFor(ctx, event.player);
      const mine = (event.player ?? 0) === (ctx.mySeat ?? 0);
      const spacing = mine ? 70 : ctx.presentation.mode === "coop" ? 34 : 26;
      return Promise.all(
        ids.map((id, i) => {
          // The remote seat's draws stay face-down backs — count only, no card identity.
          const rect = rt.track(
            rt.scene.add
              .rectangle(anchors.draw.x + 6, anchors.draw.y, 30, 44, 0x2c3e6e)
              .setStrokeStyle(1, 0xf4d35e)
              .setDepth(100),
          );
          // Own-seat backs land on the slot the id already holds in the hand.
          const toX = mine ? (handSlotX(ctx, event.player, id) ?? WIDTH / 2 + (i - (ids.length - 1) / 2) * spacing) : anchors.hand.x + i * spacing;
          return rt.tween({
            targets: rect,
            x: toX,
            y: anchors.hand.y,
            delay: i * 60,
            duration: 120,
            onComplete: () => rect.destroy(),
          });
        }),
      ).then(() => undefined);
    }
    case "deckShuffled": {
      const draw = anchorsFor(ctx, event.player).draw;
      return floatHeld(rt, draw.x + 60, draw.y - 70, "Xáo lại chồng bỏ", "#cfd6f0", 12, 300, 150);
    }
    case "cardPlayed": {
      ctx.audio?.play("cast");
      const resolved = resolvePlayedCard(ctx.gameData, ctx.presentation, ctx.after, event.instanceId, ctx.revealedCards);
      const card = resolved?.definition;
      const view = cast ?? ctx.cardViews?.get(event.instanceId);
      if (card && view) {
        const target = event.targetId !== undefined ? anchorOf(event.targetId) : undefined;
        return castCard(rt, view, { x: WIDTH / 2, y: midY }, cardColorOf(card), target);
      }
      // Another seat's card (co-op partner, PvP opponent): no hand view to fly.
      return floatHeld(rt, WIDTH / 2, midY, `◆ ${card?.name ?? "Lá bài"}`, "#f4d35e", 22, 300, 200);
    }
    case "cardDiscarded": {
      ctx.audio?.play("draw");
      const anchors = anchorsFor(ctx, event.player);
      return zoneFlight(rt, anchors.hand, anchors.discard, event.instanceIds.length);
    }
    case "cardsRecycled": {
      // Luân Hồi (`01` §3.3): card backs travel discard → draw.
      ctx.audio?.play("draw");
      const anchors = anchorsFor(ctx, event.player);
      return zoneFlight(rt, anchors.discard, anchors.draw, event.instanceIds.length);
    }
    case "cardCreated": {
      ctx.audio?.play("draw");
      // `18` §2.2: the token flies from its owner hero's panel into the hand;
      // a full hand leaves only a "Tay đầy" note over the hero.
      const card = ctx.gameData.cards[event.cardId];
      const owner =
        card?.ownerId === undefined
          ? undefined
          : ctx.presentation.heroes.find(
              (hero) => hero.defId === card.ownerId && hero.player === (event.player ?? 0),
            );
      const anchor = owner === undefined ? undefined : anchorOf(owner.id);
      if (event.instanceId === null) {
        if (!anchor) return instant();
        return floatText(rt, anchor.x, anchor.y - 62, "Tay đầy", "#ff8080", 14, 350);
      }
      const anchors = anchorsFor(ctx, event.player);
      const from = anchor ?? { x: anchors.draw.x + 6, y: anchors.draw.y };
      const mine = (event.player ?? 0) === (ctx.mySeat ?? 0);
      const rect = rt.track(
        rt.scene.add
          .rectangle(from.x, from.y, 30, 44, 0x2c3e6e)
          .setStrokeStyle(1, 0xf4d35e)
          .setDepth(100),
      );
      return rt.tween({
        targets: rect,
        x: anchors.hand.x,
        y: anchors.hand.y,
        alpha: mine ? 1 : 0.6,
        duration: 180,
        onComplete: () => rect.destroy(),
      });
    }
    case "damageDealt": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) {
        applyBeat(ctx, event);
        return instant();
      }
      const from = anchorOf(event.sourceId) ?? { x: anchor.x, y: anchor.y + 200 };
      const fromHero = ctx.presentation.heroes.some((hero) => hero.id === event.sourceId);
      const look = attackLookOf(ctx.gameData, ctx.presentation, event.sourceId, card);
      let seen!: () => void;
      const impactSeen = new Promise<void>((resolve) => (seen = resolve));
      // The badge, the number and the flinch all land at the decisive impact;
      // the attack's tail (ribbon retraction, trail fade) keeps running under
      // the runtime and drains before the batch commits.
      let impactError: unknown;
      const attack = playAttack(look, from, anchor, {
        blocked: event.hpLost === 0,
        runtime: rt,
        ...(fromHero ? { attackerView: ctx.unitViews.get(event.sourceId) } : {}),
        onImpact: () => {
          seen();
          applyBeat(ctx, event);
          ctx.audio?.play(event.hpLost > 0 ? "hit" : "block");
          const view = ctx.unitViews.get(event.targetId);
          if (view && rt.reducedMotion) {
            void rt.tween({ targets: view, alpha: 0.55, duration: 80, yoyo: true });
          } else if (view) {
            void rt.tween({ targets: view, x: view.x + 6, duration: 45, yoyo: true, repeat: 3 });
          }
          const offset = hitIndex * 14;
          const jobs = [
            floatText(rt, anchor.x + offset, anchor.y - 50 - offset, event.hpLost > 0 ? `-${event.hpLost}` : "Chặn",
              event.hpLost > 0 ? "#ff6b6b" : "#9aa3c0", 20, 350),
          ];
          if (event.blocked > 0) jobs.push(floatText(rt, anchor.x + offset, anchor.y - 24 - offset, `🛡 ${event.blocked}`, "#9fd4ff", 13, 300));
          void Promise.all(jobs).catch(() => {});
        },
      });
      // An abort mid-flight rejects the attack before the impact — unblock the
      // queue, but a real failure inside onImpact must surface, not vanish.
      void attack.then(
        () => seen(),
        (error) => {
          impactError = error;
          seen();
        },
      );
      return impactSeen.then(() => {
        if (impactError !== undefined) throw impactError;
      });
    }
    case "hpLost": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      const look = hpLossLook(event.cause);
      return held(
        rt,
        180,
        unitFlashAt(rt, ctx, event.targetId, look.color, 200),
        floatText(rt, anchor.x, anchor.y - 50, `${look.label} -${event.amount}`, css(look.color), 18, 250),
      );
    }
    case "bloodMoonChanged": {
      ctx.audio?.play("moon");
      const moonAt = ctx.moonAnchor ?? MOON;
      if (event.rounds === 0) {
        return floatHeld(rt, moonAt.x, moonAt.y + 60, "Huyết Nguyệt tan", "#cfd6f0", 16, 500, 250);
      }
      // Only an ignition gets the surge — a roundEnd decrement is a quiet
      // countdown next to the moon, never another screen flash.
      if (event.cause === "roundEnd") {
        return floatHeld(rt, moonAt.x, moonAt.y + 60, `Huyết Nguyệt còn ${event.rounds} vòng`, "#ff8080", 13, 350, 180);
      }
      const surge = bloodMoonSurge(rt, { x: moonAt.x, y: moonAt.y });
      const banner = rt.track(
        rt.scene.add
          .text(WIDTH / 2, midY - 60, "HUYẾT NGUYỆT", {
            ...TEXT_BASE,
            fontSize: "30px",
            color: "#ff5a5a",
            stroke: "#20040a",
            strokeThickness: 6,
          })
          .setOrigin(0.5)
          .setDepth(100),
      );
      const announce = rt.tween({
        targets: banner,
        scale: 1.06,
        duration: 380,
        yoyo: true,
        hold: 260,
        ease: "Sine.easeOut",
        onComplete: () => banner.destroy(),
      });
      return held(rt, 450, surge, announce);
    }
    case "healed": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      ctx.audio?.play("heal");
      return held(
        rt,
        200,
        unitFlashAt(rt, ctx, event.targetId, 0x2e8b57, 250),
        floatText(rt, anchor.x, anchor.y - 50, `+${event.amount}`, "#7fe07f", 18, 300),
      );
    }
    case "armorGained": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      return floatHeld(rt, anchor.x, anchor.y - 40, `🛡 +${event.amount}`, "#9fd4ff", 15, 200, 150);
    }
    case "armorRemoved": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      // The badge shatters at the unit — a ring pop plus the labeled beat.
      const ring = rt.track(
        rt.scene.add.circle(anchor.x, anchor.y - 32, 14).setStrokeStyle(2, 0x9fd4ff).setDepth(95),
      );
      const shatter = rt.tween({
        targets: ring,
        scale: 2,
        alpha: 0,
        duration: 280,
        ease: "Sine.easeOut",
        onComplete: () => ring.destroy(),
      });
      return held(rt, 180, shatter, floatText(rt, anchor.x, anchor.y - 50, "🛡 Vỡ Giáp", "#9fd4ff", 15, 280));
    }
    case "statusApplied": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      void statusPop(rt, anchor, `ui:status_${event.status}`, STATUS_ICONS[event.status].color).catch(() => {});
      const unit = unitAt(ctx.presentation, event.targetId) ?? ({ statuses: [] } as unknown as UnitState);
      return floatHeld(
        rt,
        anchor.x,
        anchor.y - 62,
        statusAppliedLabel(ctx.presentation, unit, event.status, event.value, ctx.gameData),
        "#ffd97f",
        13,
        150,
        120,
      );
    }
    case "statusRemoved": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      void statusPop(rt, anchor, `ui:status_${event.status}`, STATUS_ICONS[event.status].color, true).catch(() => {});
      return floatHeld(rt, anchor.x, anchor.y - 62, `-${STATUS_LABELS[event.status]}`, "#8b93b8", 12, 150, 120);
    }
    case "moonPowerChanged": {
      const at = anchorsFor(ctx, event.player).resource;
      return floatHeld(rt, at.x - 60, at.y, `Nguyệt Lực ${event.value}`, "#f4d35e", 12, 160, 80);
    }
    case "moonShifted": {
      // The Nguyệt Luân turns at center stage and settles into the moon badge; the new phase's name floats down.
      const phase = ctx.gameData.moonPhases[event.to];
      const phaseIds = ctx.gameData.moonPhases.map((entry) => entry.id);
      const at = ctx.moonAnchor ?? MOON;
      // Routine shifts take ~550 ms; a card-forced shift lingers ~900 ms (`01` §7.4).
      ctx.audio?.play("moon");
      void floatText(rt, at.x, at.y + 46, phase?.name ?? "", "#f4d35e", 15, 400).catch(() => {});
      return moonWheel(rt, { x: WIDTH / 2, y: midY }, at, phaseIds, event.from, event.to, 0xf4d35e, event.cause === "card" ? 900 : 550);
    }
    case "moonDecreesRolled": {
      // `01` §7.6 — minimal banner: start phase + its decree. Full Nguyệt Lệnh UI is Task 7.
      ctx.audio?.play("moon");
      const phase = ctx.gameData.moonPhases[event.moonIndex];
      const decree = phase?.decrees.find((d) => d.id === event.decrees[event.moonIndex]);
      const label = phase ? `${phase.icon} ${phase.name} · ${decree?.name ?? "—"}` : "Nguyệt Luân";
      return floatHeld(rt, WIDTH / 2, 300, label, "#f4d35e", 22, 600, 400);
    }
    case "intentsRevealed":
      // Enemies no longer telegraph their chain (`01` §9.2) — nothing to show.
      return instant();
    case "intentsCancelled": {
      const anchor = anchorOf(event.enemyId);
      if (!anchor) return instant();
      return floatHeld(rt, anchor.x, anchor.y - 110, `Tỏa Nguyệt hủy ${event.intentIds.length} chiêu`, "#9fd4ff", 13, 450, 150);
    }
    case "sealStripped": {
      const anchor = anchorOf(event.unitId);
      if (!anchor) return instant();
      // refId is an intentId for enemies, a card instanceId for hero cards, a summonId for Linh Thú.
      const instance = ctx.presentation.cards[event.refId];
      const ref = ctx.presentation.enemies.some((enemy) => enemy.id === event.unitId)
        ? findIntent(ctx, event.unitId, event.refId)?.name
        : ctx.presentation.summons?.some((summon) => summon.id === event.unitId)
          ? ctx.gameData.summons[event.refId]?.name
          : instance ? cardDefOf(ctx.gameData, ctx.presentation, instance)?.name : undefined;
      return floatHeld(rt, anchor.x, anchor.y - 110, `Phong Ấn: ${ref ?? ""} mất hiệu ứng`, "#b9a8ff", 13, 450, 150);
    }
    case "intentExecuted": {
      const anchor = anchorOf(event.enemyId);
      const view = ctx.unitViews.get(event.enemyId);
      if (!anchor || !view) return instant();
      const target = event.targetId ? anchorOf(event.targetId) : undefined;
      const intent = findIntent(ctx, event.enemyId, event.intentId);
      // Untargeted attacks (area damage) point at every living hero.
      const aimed = target
        ? [target]
        : intent?.kind === "attack"
          ? ctx.presentation.heroes.filter((hero) => hero.alive).flatMap((hero) => anchorOf(hero.id) ?? [])
          : [];
      const dx = target ? (target.x - anchor.x) * 0.18 : 0;
      const dy = target ? (target.y - anchor.y) * 0.18 : (aimed.length > 0 ? 20 : 0);
      // Reduced motion trades the lunge for an alpha pulse with the same beat.
      const signal = rt.reducedMotion
        ? rt.tween({ targets: view, alpha: 0.45, duration: 40, yoyo: true })
        : rt.tween({ targets: view, x: anchor.x + dx, y: anchor.y + dy, duration: 40, yoyo: true });
      void floatText(rt, anchor.x, anchor.y + 90, intent?.name ?? "", "#ffb070", 18, 400).catch(() => {});
      if (intent?.kind !== "attack" && intent?.kind !== "attackDefend") {
        for (const to of aimed) void beam(rt, anchor, to, 0xff7050, 350, 5).catch(() => {});
      }
      return Promise.all([signal, rt.wait(60)]).then(() => undefined);
    }
    case "intentSkipped": {
      const anchor = anchorOf(event.enemyId);
      if (!anchor) return instant();
      return floatHeld(rt, anchor.x, anchor.y - 80, "Đóng Băng — bỏ qua", "#9fd4ff", 13, 300, 120);
    }
    case "intentFizzled": {
      const anchor = anchorOf(event.enemyId);
      if (!anchor) return instant();
      return floatHeld(rt, anchor.x, anchor.y - 80, "Hụt", "#8b93b8", 13, 250, 120);
    }
    case "heroLeveledUp": {
      ctx.audio?.play("levelUp");
      const anchor = anchorOf(event.heroId);
      const jobs: Promise<void>[] = [
        floatText(rt, WIDTH / 2, midY, `★ ${event.name} ★`, "#f4d35e", 26, 900),
      ];
      if (anchor) jobs.push(unitFlashAt(rt, ctx, event.heroId, 0xf4d35e, 500));
      return held(rt, 500, ...jobs);
    }
    case "unitDied": {
      const anchor = anchorOf(event.unitId);
      if (!anchor) return instant();
      ctx.audio?.play("death");
      const boss = ctx.presentation.boss?.enemyId === event.unitId;
      return deathBurn(rt, ctx.unitViews.get(event.unitId), anchor, boss);
    }
    case "runRelicTriggered": {
      const relic = ctx.gameData.runRelics[event.runRelicId];
      const augment = relic === undefined ? ctx.gameData.augments[event.runRelicId] : undefined;
      const name = relic?.name ?? augment?.name ?? event.runRelicId;
      const kind = relic !== undefined ? "runRelic" : "augment";
      return triggerFlash(rt, ctx, event.player, kind, event.runRelicId, `✦ ${name}`, relic === undefined ? "#e0b0ff" : "#9fd4ff");
    }
    case "relicTriggered": {
      const name = ctx.gameData.relics[event.relicId]?.name ?? event.relicId;
      return triggerFlash(rt, ctx, event.player, "relic", event.relicId, `☾ ${name}`, "#f4d35e");
    }
    case "weaponTriggered": {
      const name = ctx.gameData.weapons[event.weaponId]?.name ?? event.weaponId;
      // `heroId` on the event is the hero DEFINITION id; match either id shape.
      const player =
        event.player ??
        ctx.presentation.heroes.find((hero) => hero.id === event.heroId || hero.defId === event.heroId)?.player;
      return triggerFlash(rt, ctx, player, "weapon", event.weaponId, `⚔ ${name}`, "#ffb080");
    }
    case "combatEnded": {
      // Seat-relative win: PvP carries `winner`, PvE the viewer's `result` —
      // the audio instance dedupes against a later terminal recovery frame.
      const won =
        !ctx.forfeited && (event.winner === "draw" ? false : event.winner !== undefined ? event.winner === (ctx.mySeat ?? 0) : event.result === "won");
      ctx.audio?.play(event.result === "draw" ? "resultDraw" : won ? "victory" : "defeat");
      return instant();
    }
    case "playerForfeited": {
      const reasons: Record<string, string> = {
        resign: "bỏ cuộc",
        timeout: "hết giờ",
        disconnect: "mất kết nối",
      };
      const who = event.player === ctx.mySeat ? "Bạn" : "Đối thủ";
      return floatHeld(rt, WIDTH / 2, midY, `${who} ${reasons[event.reason] ?? event.reason}`, "#ff8080", 22, 700, 300);
    }
    case "playerDisconnected":
      return floatHeld(
        rt,
        WIDTH / 2,
        300,
        event.player === ctx.mySeat ? "Bạn đang ngoại tuyến" : "Đối thủ mất kết nối…",
        "#8b93b8",
        16,
        600,
        250,
      );
    case "mulliganed":
      return floatHeld(rt, WIDTH / 2, 550, `Đổi ${event.returned.length} lá`, "#cfd6f0", 14, 250, 150);
    case "choiceOpened":
      return floatHeld(rt, WIDTH / 2, 550, "Chiêm Bài", "#f4d35e", 16, 250, 150);
    case "moonChoiceOpened":
      return floatHeld(rt, WIDTH / 2, 550, "Chọn Pha", "#f4d35e", 16, 250, 150);
    case "cardChosen":
      return instant();
    case "deckedOut":
      return floatHeld(rt, WIDTH / 2, midY, "CẠN BÀI", "#ff8080", 28, 700, 350);
    case "cardsPurged": {
      const draw = anchorsFor(ctx, event.player).draw;
      return floatHeld(rt, draw.x + 90, draw.y - 70, `-${event.instanceIds.length} lá (Tán Chiêu)`, "#8b93b8", 12, 300, 150);
    }
    case "moonReserveChanged": {
      if (event.side === "hero") {
        const at = anchorsFor(ctx, event.player).reserve;
        return floatHeld(rt, at.x - 60, at.y, `Dự Trữ ${event.value}`, "#7fd4ff", 13, 250, 120);
      }
      const anchor = event.enemyId !== undefined ? anchorOf(event.enemyId) : undefined;
      if (!anchor) return instant();
      return floatHeld(rt, anchor.x, anchor.y - 95, `Dự Trữ ${event.value}`, "#7fd4ff", 11, 150, 120);
    }
    case "summoned": {
      // Linh Thú (`01` §17): its panel only exists after the next render, so
      // the glow plays at the summon anchor when present (awaken swap) and at
      // the owner Hero's otherwise.
      const anchor = anchorOf(event.unitId) ?? anchorOf(event.ownerHeroId);
      if (!anchor) return instant();
      const glow = rt.track(
        rt.scene.add
          .circle(anchor.x, anchor.y, 40)
          .setStrokeStyle(3, 0xf4d35e)
          .setDepth(95),
      );
      const ring = rt.tween({
        targets: glow,
        scale: 1.7,
        alpha: 0,
        duration: 500,
        ease: "Sine.easeOut",
        onComplete: () => glow.destroy(),
      });
      const name = ctx.gameData.summons[event.summonId]?.name ?? "Linh Thú";
      return held(rt, 300, ring, floatText(rt, anchor.x, anchor.y - 62, `Triệu hồi — ${name}`, "#f4d35e", 18, 500));
    }
    case "summonActed": {
      const anchor = anchorOf(event.unitId);
      if (!anchor) return instant();
      const summon = ctx.presentation.summons?.find((unit) => unit.id === event.unitId);
      const name = (summon && ctx.gameData.summons[summon.summonId]?.name) ?? "Linh Thú";
      return floatHeld(rt, anchor.x, anchor.y - 44, name, "#9fd4ff", 14, 300, 120);
    }
    case "summonDismissed": {
      const anchor = anchorOf(event.unitId);
      const view = ctx.unitViews.get(event.unitId);
      if (!anchor && !view) return instant();
      const jobs: Promise<void>[] = [];
      if (view) {
        jobs.push(rt.tween({ targets: view, alpha: 0, duration: 400 }));
      }
      if (anchor) {
        jobs.push(floatText(rt, anchor.x, anchor.y - 30, "Linh Thú biến mất", "#8b93b8", 13, 350));
      }
      return held(rt, 300, ...jobs);
    }
    case "heroRevived": {
      // Hồi Hồn (`18` §3.5): the fallen card brightens back as it stands.
      const anchor = anchorOf(event.heroId);
      const view = ctx.unitViews.get(event.heroId);
      const jobs: Promise<void>[] = [
        floatText(rt, anchor?.x ?? WIDTH / 2, (anchor?.y ?? 400) - 62, "Hồi Hồn", "#f4d35e", 20, 600),
      ];
      if (anchor) jobs.push(unitFlashAt(rt, ctx, event.heroId, 0xf4d35e, 500));
      if (view && anchor) {
        jobs.push(rt.tween({ targets: view, alpha: 1, scale: 1, y: anchor.y, duration: 420, ease: "Sine.easeOut" }));
      }
      return held(rt, 450, ...jobs);
    }
    case "coopComboTriggered": {
      // Hợp Kích (`01` §16.4): the banner lands mid-queue, not after the batch commits.
      const name = ctx.gameData.coopCombos[event.comboId]?.name ?? event.comboId;
      return floatHeld(rt, WIDTH / 2, midY - 30, `HỢP KÍCH — ${name}!`, "#f4d35e", 28, 800, 400);
    }
    case "bossPhaseChanged": {
      // `01` §16.5: the phase banner is a queue beat like any other.
      const defId = ctx.presentation.enemies.find((enemy) => enemy.id === event.enemyId)?.defId;
      const name = (defId !== undefined ? ctx.gameData.enemies[defId]?.name : undefined) ?? "Ma Quân";
      return floatHeld(rt, WIDTH / 2, midY - 30, `${name} — Giai đoạn ${event.phase}`, "#ff8090", 26, 800, 400);
    }
    default:
      return instant();
  }
}
