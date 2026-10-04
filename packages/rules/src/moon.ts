import { relicAt } from "./gear";
import { summonsOf } from "./players";
import { nextRandom } from "./rng";
import { applyStatus, DEBUFF_STATUSES, DURATION_STATUSES, removeStatus } from "./statuses";
import type {
  CardTag,
  CombatEvent,
  CombatStart,
  CombatState,
  GameData,
  MoonDecreeDef,
  MoonModifier,
  StatusId,
  UnitState,
} from "./types/index";

/** Modifier types that only Nguyệt Lệnh may carry (not relics, augments, moon relics). */
export const DECREE_ONLY_MODIFIERS: ReadonlySet<MoonModifier["type"]> = new Set([
  "firstHitBonus", "turnMoonPowerBonus", "turnStartDraw", "turnStartHeal", "debuffDurationBonus",
  "turnStartStatusOnHighestHp", "firstSingleHitReduction", "attackChainBonus", "buffMultiplier",
  "stealthSuppressed", "discardForMoonPower", "discardDamage", "bloodPact", "reflectMultiplier",
  "keepArmor", "chooseCardExtraLook", "freeChooseCard", "recycleDiscard",
]);

/** The Nguyệt Lệnh rolled for phase `index` (default: the current phase). */
export function currentDecree(data: GameData, state: CombatState, index = state.moonIndex): MoonDecreeDef | undefined {
  const id = state.moonDecrees?.[index];
  return data.moonPhases[index]?.decrees.find((decree) => decree.id === id);
}

/**
 * Huyết Nguyệt is a hidden phase: while it burns it REPLACES the current
 * phase — tag bonus and Nguyệt Lệnh stop applying until it ends (`01` §7.4).
 * The wheel itself keeps turning (`moonIndex` still advances at round end).
 */
export function phaseSuppressed(state: CombatState): boolean {
  return state.bloodMoonRounds > 0;
}

/** Tag bonus + rolled decree of a phase (`01` §7). */
export function phaseModifiers(data: GameData, state: CombatState, index = state.moonIndex): MoonModifier[] {
  return [...(data.moonPhases[index]?.tagBonus ?? []), ...(currentDecree(data, state, index)?.modifiers ?? [])];
}

export function decreeModifier<T extends MoonModifier["type"]>(
  data: GameData,
  state: CombatState,
  type: T,
): Extract<MoonModifier, { type: T }> | undefined {
  if (phaseSuppressed(state)) return undefined;
  return phaseModifiers(data, state).find((m): m is Extract<MoonModifier, { type: T }> => m.type === type);
}

/**
 * Start phase and one decree per phase (`01` §7.3). A side stream seeded from
 * `rngState` keeps the combat RNG (decks, intents) where it was.
 */
export function rollMoon(data: GameData, state: CombatState, start: CombatStart | undefined, events: CombatEvent[]): void {
  let rng = (state.rngState ^ 0x6d2b79f5) >>> 0;
  const roll = (n: number): number => {
    const next = nextRandom(rng);
    rng = next.rngState;
    return Math.floor(next.value * n);
  };
  state.moonIndex = roll(data.moonPhases.length);
  state.moonDecrees = data.moonPhases.map((phase) => phase.decrees[roll(phase.decrees.length)]!.id);
  if (start?.moonIndex !== undefined) state.moonIndex = start.moonIndex;
  for (const phase of data.moonPhases) {
    const id = start?.decrees?.[phase.id];
    if (id !== undefined) state.moonDecrees[phase.index] = id;
  }
  events.push({ type: "moonDecreesRolled", moonIndex: state.moonIndex, decrees: [...state.moonDecrees] });
  enterPhase(data, state, events);
}

/**
 * Runs every time `moonIndex` becomes a phase — round end, `shiftMoon`, Chọn
 * Pha, or the rolled start phase (`01` §7.6). Currently only Nguyệt Chiếu uses
 * the point: `stealthSuppressed` strips Ẩn Thân from every unit.
 */
export function enterPhase(data: GameData, state: CombatState, events: CombatEvent[]): void {
  if (!decreeModifier(data, state, "stealthSuppressed")) return;
  for (const unit of [...state.heroes, ...summonsOf(state), ...state.enemies]) {
    removeStatus(unit, "stealth", events);
  }
}

/**
 * Decree adjustments to one status application (`01` §7.5): Nguyệt Chiếu
 * suppresses Ẩn Thân, Cuồng Nguyệt multiplies listed buffs, Thiên Bình extends
 * duration debuffs (PvP ×2). Returns the adjusted amount, or null when the
 * application is suppressed. Applies to every source, not only card effects.
 */
export function decreeStatusAmount(
  data: GameData,
  state: CombatState,
  status: StatusId,
  amount: number,
): number | null {
  if (status === "stealth" && decreeModifier(data, state, "stealthSuppressed")) return null;
  const buff = decreeModifier(data, state, "buffMultiplier");
  if (buff?.statuses.includes(status)) amount *= buff.multiplier;
  const extend = decreeModifier(data, state, "debuffDurationBonus");
  if (extend && DEBUFF_STATUSES.has(status) && DURATION_STATUSES.has(status)) {
    amount += extend.amount * (state.mode === "pvp" ? 2 : 1);
  }
  return amount;
}

/** `applyStatus` with decree adjustments — the counterpart of the `applyStatus` effect case for direct applications (`01` §7.5). */
export function applyStatusDecreed(
  data: GameData,
  state: CombatState,
  unit: UnitState,
  status: StatusId,
  amount: number,
  sourceId: string,
  events: CombatEvent[],
): void {
  const adjusted = decreeStatusAmount(data, state, status, amount);
  if (adjusted === null) return;
  applyStatus(unit, status, adjusted, sourceId, events);
}

/**
 * Moon phase modifiers plus the always-on modifiers of the run relics, augments
 * and moon relics held by seat `player`; `while: "bloodMoon"` ones only during
 * blood moon (`01` §14.4, `17` §2.1).
 */
export function activeModifiers(data: GameData, state: CombatState, player: number): MoonModifier[] {
  const seat = state.players[player]!;
  const relicModifiers = seat.runRelicIds.flatMap(
    (id) => (data.runRelics[id] ?? data.augments[id])?.modifiers ?? [],
  );
  const moonRelicModifiers = seat.relics.flatMap((relic) => {
    const def = data.relics[relic.id];
    return def ? (relicAt(def, relic.resonance).modifiers ?? []) : [];
  });
  const phase = phaseSuppressed(state) ? [] : phaseModifiers(data, state);
  return [...phase, ...relicModifiers, ...moonRelicModifiers].filter(
    (modifier) => modifier.type !== "costModifierForTag" || modifier.while !== "bloodMoon" || state.bloodMoonRounds > 0,
  );
}

export function moonCardDamageMultiplier(data: GameData, state: CombatState, player: number, tags: CardTag[]): number {
  let multiplier = 1;
  for (const modifier of activeModifiers(data, state, player)) {
    if (modifier.type === "damageMultiplierForTag" && tags.includes(modifier.tag)) {
      multiplier *= modifier.multiplier;
    }
  }
  return multiplier;
}

export function moonHealMultiplier(data: GameData, state: CombatState, player: number): number {
  let multiplier = 1;
  for (const modifier of activeModifiers(data, state, player)) {
    if (modifier.type === "healMultiplier") multiplier *= modifier.multiplier;
  }
  return multiplier;
}

export function moonStealthDurationBonus(data: GameData, state: CombatState, player: number): number {
  let bonus = 0;
  for (const modifier of activeModifiers(data, state, player)) {
    if (modifier.type === "stealthDurationBonus") bonus += modifier.amount;
  }
  return bonus;
}

export function moonArmorMultiplier(data: GameData, state: CombatState, player: number): number {
  let multiplier = 1;
  for (const modifier of activeModifiers(data, state, player)) {
    if (modifier.type === "armorMultiplier") multiplier *= modifier.multiplier;
  }
  return multiplier;
}
