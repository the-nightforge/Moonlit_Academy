import { cardDefOf, displayDuration, DURATION_STATUSES, getStatus } from "rules";
import type { CardDef, CardInstance, CombatState, GameData, StatusId, UnitState } from "rules";
import type { PublicPlayedCard } from "../net/protocol";
import { STATUS_ICONS, STATUS_LABELS } from "./theme";
import { seatAnchorsFor } from "./combat-layout";

export interface Point {
  x: number;
  y: number;
}

/** Where one seat's zones live on screen — the same layout the renderers use. */
export interface SeatAnchors {
  draw: Point;
  discard: Point;
  hand: Point;
  resource: Point;
  reserve: Point;
}

/**
 * The on-screen anchors of a seat (`17` §7.3). Delegates to the shared layout
 * tables — renderers, the animator and tests all read one coordinate system.
 */
export function seatAnchors(player: number, mySeat: number, mode: CombatState["mode"]): SeatAnchors {
  return seatAnchorsFor(player, mySeat, mode);
}

/** Turn-measured statuses display in rounds: the rules' duration set plus freeze (until the owner's next turn, `01` §7.3). */
const TURN_STATUSES: ReadonlySet<StatusId> = new Set<StatusId>([...DURATION_STATUSES, "freeze"]);

/**
 * What a status shows as its number (`01` §15.5): PvP stores durations in
 * half-rounds, so turn-measured statuses display `ceil(value / 2)` rounds —
 * stacks and PvE keep the stored value.
 */
export function statusDisplayValue(state: CombatState, unit: UnitState, status: StatusId): number {
  const value = getStatus(unit, status)?.value ?? 0;
  if (state.mode === "pvp" && status === "freeze") return Math.ceil(value / 2);
  return displayDuration(state, unit, status);
}

/** `unit.statuses` with display values — for badges and tooltips. */
export function displayStatuses(state: CombatState, unit: UnitState): UnitState["statuses"] {
  return unit.statuses.map((entry) => ({ ...entry, value: statusDisplayValue(state, unit, entry.id) }));
}

/**
 * The `statusApplied` popup's label: `Name → total`, no `+`. Stacks use the
 * short STATUS_LABELS (`Mạnh → 5`); turn-measured statuses use the keyword's
 * full name and read rounds (`Đóng Băng → 1 vòng` for a PvP raw 2). `total` is
 * the event's new raw total — rendered on a copy so the unit is never mutated.
 */
export function statusAppliedLabel(
  state: CombatState,
  unit: UnitState,
  status: StatusId,
  total: number,
  data?: GameData,
): string {
  const copy: UnitState = {
    ...unit,
    statuses: [...unit.statuses.filter((entry) => entry.id !== status), { id: status, value: total }],
  };
  const display = statusDisplayValue(state, copy, status);
  if (!TURN_STATUSES.has(status)) return `${STATUS_LABELS[status]} → ${display}`;
  const keyword = STATUS_ICONS[status].keywordId;
  const name = data?.keywords[keyword]?.name ?? STATUS_LABELS[status];
  return `${name} → ${display} vòng`;
}

/**
 * The unit a floating label or FX anchors to — heroes, summons, then enemies;
 * `undefined` when the id is gone from this view (a unit that just died).
 */
export function unitAt(state: CombatState, unitId: string): UnitState | undefined {
  return (
    state.heroes.find((unit) => unit.id === unitId) ??
    state.summons?.find((unit) => unit.id === unitId) ??
    state.enemies.find((unit) => unit.id === unitId)
  );
}

/**
 * Resolves a `cardPlayed` to showable metadata (`16` §8.2): the server's
 * cast-time record wins — the playing seat's own record too — then `before`,
 * then `after` via `cardDefOf` (a PvP opponent's card is hidden in `before`
 * and can be absent again in `after` when it was recycled within the batch).
 */
export function resolvePlayedCard(
  data: GameData,
  before: CombatState,
  after: CombatState,
  instanceId: string,
  revealedCards?: Record<string, PublicPlayedCard>,
): PublicPlayedCard | undefined {
  const revealed = revealedCards?.[instanceId];
  if (revealed !== undefined) return revealed;
  for (const state of [before, after]) {
    const instance = state.cards[instanceId];
    if (instance === undefined) continue;
    const definition = cardDefOf(data, state, instance);
    if (definition !== undefined) return { instance, definition };
  }
  return undefined;
}

/** Re-exported so display code names the wire shape without a second import site. */
export type { PublicPlayedCard } from "../net/protocol";
