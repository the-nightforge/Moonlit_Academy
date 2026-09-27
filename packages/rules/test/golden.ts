import { createHash } from "node:crypto";
import type {
  Action,
  CombatEvent,
  CombatSetup,
  CombatState,
  GameData,
  Loadout,
  RunAction,
  RunEvent,
  RunSetup,
  RunState,
} from "../src/index";
import { applyAction, applyRunAction, createCombat, createRun } from "../src/index";
import { p0 } from "./helpers";
import { combatAction, runAction } from "./playtest-bot";

/**
 * Golden recordings (T213/T214, spec `17` §2.3): fixed bot games recorded before the
 * PlayerState rework. Records are immutable — when the state shape changes, only the
 * accessor functions below are repointed, never the JSON under `golden/`.
 *
 * IMPORTANT (Task 5a.2): every read of a per-player field goes through one of these
 * accessors. Task 3 turns `state.hand` into `p0(state).hand` here only.
 */
const playerHand = (state: CombatState) => p0(state).hand;
const playerDrawPile = (state: CombatState) => p0(state).drawPile;
const playerDiscardPile = (state: CombatState) => p0(state).discardPile;
const playerMoonPower = (state: CombatState) => p0(state).moonPower;
const playerMoonReserve = (state: CombatState) => p0(state).moonReserve;
const playerMoonPowerBonus = (state: CombatState) => p0(state).moonPowerBonus;
const playerCardsPlayed = (state: CombatState) => p0(state).cardsPlayedThisTurn;
const playerPendingChoice = (state: CombatState) => p0(state).pendingChoice;
const playerRunRelicIds = (state: CombatState) => p0(state).runRelicIds;
const playerHookCounters = (state: CombatState) => p0(state).hookCounters;
const playerWeapons = (state: CombatState) => p0(state).weapons;
const playerRelics = (state: CombatState) => p0(state).relics;

/** Stable projection of a combat — survives the PlayerState rework unchanged. */
export function combatProjection(state: CombatState) {
  const cardId = (instanceId: string) => state.cards[instanceId]?.cardId ?? instanceId;
  return {
    status: state.status,
    round: state.round,
    moonIndex: state.moonIndex,
    bloodMoonRounds: state.bloodMoonRounds,
    rngState: state.rngState,
    moonPower: playerMoonPower(state),
    moonReserve: playerMoonReserve(state),
    moonPowerBonus: playerMoonPowerBonus(state),
    cardsPlayedThisTurn: playerCardsPlayed(state),
    pendingChoice: playerPendingChoice(state)?.options.map(cardId) ?? null,
    hand: playerHand(state).map(cardId),
    drawPile: playerDrawPile(state).map(cardId),
    discardPile: playerDiscardPile(state).map(cardId),
    heroes: state.heroes.map((h) => ({
      id: h.id,
      defId: h.defId,
      position: h.position,
      hp: h.hp,
      maxHp: h.maxHp,
      armor: h.armor,
      alive: h.alive,
      statuses: h.statuses.map((s) => ({ id: s.id, value: s.value, sourceId: s.sourceId })),
      levelUpCounter: h.levelUpCounter,
      leveledUp: h.leveledUp,
    })),
    enemies: state.enemies.map((e) => ({
      id: e.id,
      defId: e.defId,
      position: e.position,
      hp: e.hp,
      maxHp: e.maxHp,
      armor: e.armor,
      alive: e.alive,
      statuses: e.statuses.map((s) => ({ id: s.id, value: s.value, sourceId: s.sourceId })),
      plannedIntents: e.plannedIntents.map((p) => ({
        intentId: p.intent.id,
        cost: p.cost,
        targetId: p.targetId,
      })),
      lastIntentIds: e.lastIntentIds,
      moonPower: e.moonPower,
      moonReserve: e.moonReserve,
    })),
    runRelicIds: playerRunRelicIds(state),
    hookCounters: playerHookCounters(state),
    weapons: playerWeapons(state).map((w) => ({ heroId: w.heroId, weaponId: w.weaponId, refinement: w.refinement })),
    relics: playerRelics(state).map((r) => ({ id: r.id, resonance: r.resonance })),
  };
}

/** Stable JSON for hashing: object keys sorted, arrays keep order. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export interface GoldenCombatRecord {
  kind: "combat";
  seed: number;
  label: string;
  setup: CombatSetup;
  loadout?: Loadout;
  actions: Action[];
  /** Full event stream, or its hash when the file size cap applies. */
  events: CombatEvent[] | { sha256: string };
  final: ReturnType<typeof combatProjection> | { sha256: string };
}

export interface GoldenRunRecord {
  kind: "run";
  seed: number;
  label: string;
  setup: RunSetup;
  loadout?: Loadout;
  actions: RunAction[];
  eventsHash: string;
  /** Full RunState — untouched by the PlayerState rework (combat is null at end). */
  final: RunState;
}

export type GoldenRecord = GoldenCombatRecord | GoldenRunRecord;

const MAX_ACTIONS = 5000;
const MAX_STEPS = 20000;
const MAX_COMBAT_ROUNDS = 60;

/** Replays a recorded combat from `createCombat` + `applyAction`; returns events + final state. */
export function replayCombatRecord(
  data: GameData,
  record: GoldenCombatRecord,
): { events: CombatEvent[]; state: CombatState } {
  const created = createCombat(data, record.setup, record.loadout);
  let state = created.state;
  const events = [...created.events];
  for (const action of record.actions) {
    const result = applyAction(data, state, action);
    if (!result.ok) throw new Error(`golden combat ${record.label}: action rejected: ${result.error}`);
    state = result.state;
    events.push(...result.events);
  }
  return { events, state };
}

/** Replays a recorded run action by action; returns the event stream + final run. */
export function replayRunRecord(
  data: GameData,
  record: GoldenRunRecord,
): { events: (CombatEvent | RunEvent)[]; run: RunState } {
  let run = createRun(data, record.setup, record.loadout).run;
  const events: (CombatEvent | RunEvent)[] = [];
  for (const action of record.actions) {
    const result = applyRunAction(data, run, action);
    if (!result.ok) throw new Error(`golden run ${record.label}: action rejected: ${result.error}`);
    events.push(...result.events, ...result.runEvents);
    run = result.run;
  }
  return { events, run };
}

/** Drives one standalone bot combat; throws if it stalls or an action is rejected. */
export function recordCombat(
  data: GameData,
  setup: CombatSetup,
  loadout: Loadout | undefined,
  label: string,
): GoldenCombatRecord {
  const created = createCombat(data, setup, loadout);
  let state = created.state;
  const events = [...created.events];
  const actions: Action[] = [];
  for (let step = 0; step < MAX_ACTIONS; step++) {
    if (state.status === "won" || state.status === "lost") break;
    if (state.round > MAX_COMBAT_ROUNDS) throw new Error(`golden combat ${label}: stalled`);
    const action = combatAction(data, state);
    const result = applyAction(data, state, action);
    if (!result.ok) throw new Error(`golden combat ${label}: action rejected: ${result.error}`);
    state = result.state;
    events.push(...result.events);
    actions.push(action);
  }
  return {
    kind: "combat",
    seed: setup.seed,
    label,
    setup,
    loadout,
    actions,
    events,
    final: combatProjection(state),
  };
}

/** Drives one bot run; stalled runs are kept (they are a legitimate outcome). */
export function recordRun(
  data: GameData,
  setup: RunSetup,
  loadout: Loadout | undefined,
  label: string,
): GoldenRunRecord {
  let run = createRun(data, setup, loadout).run;
  const events: (CombatEvent | RunEvent)[] = [];
  const actions: RunAction[] = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    if (run.status === "won" || run.status === "lost") break;
    if (run.status === "combat" && run.combat!.round > MAX_COMBAT_ROUNDS) break;
    const action = runAction(data, run);
    const result = applyRunAction(data, run, action);
    if (!result.ok) throw new Error(`golden run ${label}: action rejected: ${result.error}`);
    events.push(...result.events, ...result.runEvents);
    actions.push(action);
    run = result.run;
  }
  return {
    kind: "run",
    seed: setup.seed,
    label,
    setup,
    loadout,
    actions,
    eventsHash: sha256(events),
    final: run,
  };
}
