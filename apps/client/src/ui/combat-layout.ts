import type { CombatState } from "rules";
import type { Point, SeatAnchors } from "./combat-display";

/** A rectangle in design pixels — x/y is the top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The shared combat geometry (`05`, review UI/layout): one pure function
 * produces every anchor renderers and the animator need — unit cards, seat
 * zones, the hand area, the controls column and the moon header. Nothing here
 * touches Phaser or `window`, so tests can assert the numbers directly.
 */
export interface CombatLayout {
  /** Card rect per unit id (heroes, enemies, summons — actual state only). */
  units: Map<string, Rect>;
  /** Zone anchors per player seat (draw/discard/hand/resource/reserve). */
  seats: Map<number, SeatAnchors>;
  /** The local hand's bounding area — slots spread inside it. */
  hand: Rect;
  /** The right-edge controls column; nothing combat may intrude. */
  controls: Rect;
  /** Current-moon icon center. */
  moon: Point;
  /** The eight schedule icons — a gap separates past and upcoming phases. */
  phaseSlots: Point[];
  /** The current phase/decree label strip under the moon. */
  phaseLabel: Rect;
}

// ---- Design-pixel geometry (1280×720, `05` + review table) ----

const UNIT_W = 136;
const UNIT_H = 196;
const COOP_UNIT_W = 100;
const COOP_UNIT_H = 148;
const SUMMON_W = 80;
const SUMMON_H = 108;

const HERO_XS = [470, 640, 810];
const COOP_OWN_XS = [300, 412, 524];
const COOP_PARTNER_XS = [660, 772, 884];
const OWN_ROW_Y = 424;
const FOE_ROW_Y = 200;
const SUMMON_XS = [1000, 1100];
const SUMMON_OWN_Y = 410;
const ENEMY_BAND = { left: 300, right: 920 };

export const HAND_AREA: Rect = { x: 130, y: 556, w: 1010, h: 160 };
const CONTROLS: Rect = { x: 1154, y: 48, w: 104, h: 652 };
export const MOON: Point = { x: 640, y: 40 };
const PHASE_SLOT_XS = [464, 504, 544, 584, 696, 736, 776, 816];
const PHASE_LABEL: Rect = { x: 390, y: 72, w: 500, h: 24 };

const OWN_ANCHORS: SeatAnchors = {
  draw: { x: 54, y: 424 },
  discard: { x: 54, y: 504 },
  hand: { x: 635, y: 636 },
  resource: { x: 1206, y: 104 },
  reserve: { x: 1206, y: 144 },
};
const PVP_OTHER_ANCHORS: SeatAnchors = {
  draw: { x: 54, y: 168 },
  discard: { x: 54, y: 248 },
  hand: { x: 156, y: 168 },
  resource: { x: 1206, y: 248 },
  reserve: { x: 1206, y: 288 },
};
const COOP_PARTNER_ANCHORS: SeatAnchors = {
  draw: { x: 970, y: 532 },
  discard: { x: 1080, y: 532 },
  hand: { x: 790, y: 532 },
  resource: { x: 1080, y: 316 },
  reserve: { x: 1130, y: 316 },
};

/** `w`×`h` card rect centered on (`cx`, `cy`). */
function cardRect(cx: number, cy: number, w: number, h: number): Rect {
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Strict rectangle intersection — touching edges do not count as overlap. */
export function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Evenly spaced centers inside a band; n=1 lands on the band's middle. */
function bandXs(count: number, band: { left: number; right: number }): number[] {
  const span = band.right - band.left;
  return Array.from({ length: count }, (_v, i) => band.left + (span * (i + 0.5)) / count);
}

/**
 * One seat's zone anchors — the same table `computeCombatLayout` bakes into
 * its `seats` map and `combat-display.seatAnchors` delegates to, so renderers
 * and the animator never maintain a second coordinate system.
 */
export function seatAnchorsFor(player: number, mySeat: number, mode: CombatState["mode"]): SeatAnchors {
  if (player === mySeat) return { ...OWN_ANCHORS };
  return { ...(mode === "coop" ? COOP_PARTNER_ANCHORS : PVP_OTHER_ANCHORS) };
}

/** The end-turn medallion's center inside the controls column. */
export function endTurnAnchor(layout: CombatLayout): Point {
  return { x: layout.controls.x + layout.controls.w / 2, y: layout.controls.y + layout.controls.h - 52 };
}

/**
 * Resolves the screen position of every unit and seat zone for one viewer.
 * Boss enemies keep their larger frame; everything is keyed by actual unit id
 * so mid-batch additions (summons) can occupy the same slot math.
 */
export function computeCombatLayout(state: CombatState, mySeat: number): CombatLayout {
  const units = new Map<string, Rect>();
  const coop = state.mode === "coop";

  for (const seat of state.players) {
    const heroes = state.heroes.filter((hero) => hero.player === seat.index);
    if (coop) {
      const xs = seat.index === mySeat ? COOP_OWN_XS : COOP_PARTNER_XS;
      heroes.forEach((hero, i) => {
        units.set(hero.id, cardRect(xs[i] ?? xs[xs.length - 1]!, OWN_ROW_Y, COOP_UNIT_W, COOP_UNIT_H));
      });
    } else {
      const hostile = seat.index !== mySeat;
      heroes.forEach((hero, i) => {
        units.set(hero.id, cardRect(HERO_XS[i] ?? HERO_XS[HERO_XS.length - 1]!, hostile ? FOE_ROW_Y : OWN_ROW_Y, UNIT_W, UNIT_H));
      });
    }
  }

  const enemyXs = bandXs(Math.max(state.enemies.length, 1), ENEMY_BAND);
  state.enemies.forEach((enemy, i) => {
    const boss = state.boss?.enemyId === enemy.id;
    const w = boss ? 144 : UNIT_W;
    const h = boss ? 204 : UNIT_H;
    units.set(enemy.id, cardRect(enemyXs[i] ?? ENEMY_BAND.left, FOE_ROW_Y, w, h));
  });

  // Summons get per-seat slot pairs — a seat's extra summons wrap downward in
  // pairs instead of piling onto the first slot or drifting into controls.
  const summonCounts = new Map<number, number>();
  for (const summon of state.summons ?? []) {
    const i = summonCounts.get(summon.player) ?? 0;
    summonCounts.set(summon.player, i + 1);
    const baseY = summon.player === mySeat ? SUMMON_OWN_Y : FOE_ROW_Y;
    const slotY = baseY + Math.floor(i / SUMMON_XS.length) * (SUMMON_H + 8);
    units.set(summon.id, cardRect(SUMMON_XS[i % SUMMON_XS.length]!, slotY, SUMMON_W, SUMMON_H));
  }

  const seats = new Map<number, SeatAnchors>();
  for (const seat of state.players) {
    seats.set(seat.index, seatAnchorsFor(seat.index, mySeat, state.mode));
  }

  return {
    units,
    seats,
    hand: { ...HAND_AREA },
    controls: { ...CONTROLS },
    moon: { ...MOON },
    phaseSlots: PHASE_SLOT_XS.map((x) => ({ x, y: MOON.y })),
    phaseLabel: { ...PHASE_LABEL },
  };
}

/**
 * Card centers inside a hand area — gap capped at 120 so a short hand stays
 * clustered on the area's center instead of stretching edge to edge. `y` is
 * the area's vertical center; the caller lifts the hovered card itself.
 */
export function handSlots(count: number, area: Rect, cardWidth = UNIT_W - 26): Point[] {
  if (count <= 0) return [];
  const gap = count < 2 ? 0 : Math.min(120, (area.w - cardWidth) / (count - 1));
  const span = gap * (count - 1);
  const first = area.x + area.w / 2 - span / 2;
  const y = area.y + area.h / 2;
  return Array.from({ length: count }, (_v, i) => ({ x: first + i * gap, y }));
}

/**
 * The Chọn Pha panel: fixed 360 wide, height grows with the measured text and
 * clamps to the visible rect — long decrees scroll instead of shrinking font.
 */
export function fitChoicePanel(textHeight: number, visible: Rect): Rect {
  const w = 360;
  const h = Math.min(textHeight + 96, visible.h - 32);
  return {
    x: visible.x + (visible.w - w) / 2,
    y: visible.y + (visible.h - h) / 2,
    w,
    h,
  };
}
