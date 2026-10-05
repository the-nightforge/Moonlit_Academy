import { cardDefOf, displayDuration, DURATION_STATUSES, getStatus } from "rules";
import type { CardDef, CardInstance, CombatState, GameData, HeroState, LevelUpCounter, StatusId, UnitState } from "rules";
import type { PublicPlayedCard } from "../net/protocol";
import { SEAL_ICON, STATUS_ICONS, STATUS_LABELS } from "./theme";
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

/** One in-card status badge — a status, the seal, or the `+N` overflow marker. */
export interface StatusBadgeModel {
  id: StatusId | "seal" | "overflow";
  label: string;
  value?: number;
  hiddenCount?: number;
}

/**
 * The badges a `width`-wide unit card shows in at most two rows
 * (`05` review). Entries keep state order — never re-sorted, so a wrong
 * processing order can't masquerade as intent — with the seal last. Beyond
 * capacity the last slot becomes an overflow marker carrying `hiddenCount`;
 * the full list still lands in the badge tooltip via `statusTooltipNames`.
 */
export function statusBadgeModels(state: CombatState, unit: UnitState, width: number): StatusBadgeModel[] {
  const perRow = Math.max(1, Math.floor((width - 16) / 24));
  const capacity = perRow * 2;
  const entries: StatusBadgeModel[] = displayStatuses(state, unit).map((entry) => ({
    id: entry.id,
    label: STATUS_LABELS[entry.id] ?? entry.id,
    value: entry.value,
  }));
  if (unit.sealedBy !== undefined) entries.push({ id: "seal", label: "Ấn" });
  if (entries.length <= capacity) return entries;
  const shown = capacity - 1;
  return [
    ...entries.slice(0, shown),
    { id: "overflow", label: `+${entries.length - shown}`, hiddenCount: entries.length - shown },
  ];
}

/** Every status + seal as keyword names, in state order — the overflow tooltip's full list. */
export function statusTooltipNames(data: GameData, unit: UnitState): string[] {
  const names = unit.statuses.map(
    (entry) => data.keywords[STATUS_ICONS[entry.id]?.keywordId ?? ""]?.name ?? STATUS_LABELS[entry.id] ?? entry.id,
  );
  if (unit.sealedBy !== undefined) names.push(data.keywords[SEAL_ICON.keywordId]?.name ?? "Phong Ấn");
  return names;
}

/**
 * The Thức Tỉnh counter label (`counter/threshold`) with the rules' own
 * formula — constellation ≥2 swaps thresholds except for a Fair-Arena hero
 * (`17` §3.2). `null` once the hero is Thức Tỉnh — the star marks it instead.
 */
export function heroProgressLabel(data: GameData, _state: CombatState, hero: HeroState): string | null {
  if (hero.leveledUp) return null;
  const def = data.heroes[hero.defId];
  if (def === undefined) return null;
  const threshold =
    hero.constellation >= 2 && !hero.pvp ? def.levelUp.constellationThreshold : def.levelUp.threshold;
  return `${hero.levelUpCounter}/${threshold}`;
}

/** How each Thức Tỉnh counter grows — the `01` §8 table as short phrases. */
const COUNTER_CONDITION: Record<LevelUpCounter, string> = {
  damageTaken: "mất HP",
  turnsWithAllyRegen: "vòng có đồng đội đang Hồi Phục",
  enemiesKilled: "hạ kẻ địch bằng lá",
  freezesApplied: "áp Đóng Băng lên địch",
  buffsStolen: "cướp buff / đoạt Nguyệt Lực",
  hitsIntercepted: "chặn đòn cho đồng đội",
  schemeCardsPlayed: "đánh lá Mưu Lược",
  cardsChosen: "chọn lá qua Chiêm Bài",
  hpHealed: "hồi HP bằng lá",
  turnsSurvived: "sống sót qua lượt",
  moonShifts: "đánh lá có Chuyển Pha",
  studyPoints: "tích điểm (sống sót + lá Mưu Lược)",
  fullMoonsSeen: "đón pha Trăng Tròn",
  forbiddenHpLost: "mất HP vì lá Cấm Thuật",
  summonsMade: "triệu hồi Linh Thú",
  charmsApplied: "áp Mê Hoặc lên địch",
  debuffsApplied: "áp debuff lên địch",
  intentsSealed: "phong ấn chiêu địch",
  alliesFallen: "Hero ngã",
  backRowHits: "đánh trúng hàng sau",
};

/** Awakening only: the counter's condition, progress, and both forms' effects. */
export function heroTooltipLines(data: GameData, state: CombatState, hero: HeroState): string[] {
  const def = data.heroes[hero.defId]!;
  const selected = hero.levelUpForm === "alt" ? "alt" : "base";
  return [
    hero.leveledUp ? "Đã Thức Tỉnh" : `Điều kiện Thức Tỉnh: ${COUNTER_CONDITION[def.levelUp.counter]}`,
    hero.leveledUp ? "" : `Tiến độ Thức Tỉnh: ${heroProgressLabel(data, state, hero) ?? ""}`,
    `${def.levelUp.name} — dạng cơ bản${selected === "base" ? " · Đang chọn" : ""}`,
    def.levelUp.description,
    `${def.altLevelUp.name} — dạng thứ hai${selected === "alt" ? " · Đang chọn" : ""}`,
    def.altLevelUp.description,
  ];
}

/**
 * The seat's Trang Bị worn by this hero (`01` §14). `CombatWeapon.heroId` is the
 * hero DEFINITION id (`"m05"`), never the unit id (`"hero:m05"`/`"p0_hero:m05"`),
 * so the lookup is by `defId` within the hero's own seat.
 */
export function weaponForHero(
  state: CombatState,
  hero: HeroState,
): { id: string; refinement: number; seat: number } | undefined {
  const weapon = state.players[hero.player]?.weapons.find((w) => w.heroId === hero.defId);
  if (weapon === undefined) return undefined;
  return { id: weapon.weaponId, refinement: weapon.refinement, seat: hero.player };
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
