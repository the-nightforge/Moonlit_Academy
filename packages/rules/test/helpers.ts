import { loadGameData, rawGameInput } from "data";
import type { CardDef, CombatEvent, CombatStart, CombatState, GameData, IntentDef, LevelUpCounter, LevelUpPassive, Loadout, PlayerState, Profile, StoryStageDef } from "../src/index";
import { applyAction, createCombat } from "../src/index";
import { idleIntent } from "./fixtures";

export function testData(): GameData {
  return loadGameData();
}

/** A deep copy of the raw JSON input `loadGameData` parses, for parse-level tests. */
export function rawTestInput(): any {
  return structuredClone(rawGameInput());
}

/** Two arcs × two stages on existing encounters, for story rule tests. */
export function withTestStory(data: GameData): void {
  data.storyArcs = {
    t_arc1: { id: "t_arc1", name: "Arc 1", stageIds: ["t_a1s1", "t_a1s2"], rewardHeroId: "m10" },
    t_arc2: { id: "t_arc2", name: "Arc 2", stageIds: ["t_a2s1", "t_a2s2"], rewardHeroId: "f02" },
  };
  const stage = (id: string, arcId: string, encounterId: string, extra: Partial<StoryStageDef> = {}): StoryStageDef => ({
    id, arcId, name: id, encounterId, before: [], after: [], firstClear: { moonJade: 40, darkIron: 1, masteryXp: 30 }, ...extra,
  });
  data.storyStages = {
    t_a1s1: stage("t_a1s1", "t_arc1", "enc_01"),
    t_a1s2: stage("t_a1s2", "t_arc1", "enc_02", { start: { moonIndex: 4 } }),
    t_a2s1: stage("t_a2s1", "t_arc2", "enc_03", { start: { bloodMoonRounds: 2 } }),
    t_a2s2: stage("t_a2s2", "t_arc2", "enc_01"),
  };
}

/** Seat 0 — every PvE combat's only player (`17` §2.1). */
export function p0(state: CombatState): PlayerState {
  return state.players[0]!;
}

/** The pending Chiêm Bài options of `seat` (throws unless the choice is a chooseCard). */
export function pendingCardOptions(state: CombatState, seat = 0): string[] {
  const pending = state.players[seat]!.pendingChoice;
  if (pending?.kind !== "chooseCard") throw new Error("expected a pending Chiêm Bài");
  return pending.options;
}

/** A new profile that owns every hero (tests of rules that do not care about ownership). */
export function ownAllHeroes(data: GameData, profile: Profile): Profile {
  const heroes = { ...profile.heroes };
  for (const heroId of Object.keys(data.heroes)) {
    heroes[heroId] ??= { xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" };
  }
  return { ...profile, heroes };
}

/** Removes every decree effect: phases keep only their tag bonus (legacy-free test baseline). */
export function withoutDecrees(data: GameData): void {
  for (const phase of data.moonPhases) for (const decree of phase.decrees) decree.modifiers = [];
}

export interface TestCombatOverrides {
  heroIds?: [string, string, string];
  encounterId?: string;
  seed?: number;
  deckCardIds?: string[];
  heroes?: { hp: number; maxHp: number }[];
  runRelicIds?: string[];
  loadout?: Loadout;
  /** "real" keeps the rolled/pinned decree modifiers; default strips them via `withoutDecrees`. */
  decrees?: "real";
  /** `CombatSetup.start` — pins moonIndex / decree ids (`01` §7.6). Default `{ moonIndex: 1 }`. */
  start?: CombatStart;
  mutateData?: (data: GameData) => void;
  /** Default: an empty mulligan is sent so the state is at the player's first turn. */
  mulligan?: "pending";
  setup?: (state: CombatState) => void;
}

export function makeTestCombat(overrides: TestCombatOverrides = {}): {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
} {
  const data = testData();
  if (overrides.decrees !== "real") withoutDecrees(data);
  overrides.mutateData?.(data);
  const created = createCombat(data, {
    heroIds: overrides.heroIds ?? ["m05", "f04", "m06"],
    encounterId: overrides.encounterId ?? "enc_01",
    seed: overrides.seed ?? 42,
    deckCardIds: overrides.deckCardIds,
    heroes: overrides.heroes,
    runRelicIds: overrides.runRelicIds,
    start: overrides.start ?? { moonIndex: 1 },
  }, overrides.loadout);
  let { state } = created;
  const events = [...created.events];
  if (overrides.mulligan !== "pending") {
    const kept = applyAction(data, state, { type: "mulligan", instanceIds: [] });
    if (!kept.ok) throw new Error(`test: mulligan failed: ${kept.error}`);
    state = kept.state;
    events.push(...kept.events);
  }
  overrides.setup?.(state);
  return { data, state, events };
}

export function instanceIdOf(state: CombatState, cardId: string): string {
  const instance = Object.values(state.cards).find((card) => card.cardId === cardId);
  if (!instance) throw new Error(`test: no card instance for "${cardId}"`);
  return instance.instanceId;
}

export function setHand(state: CombatState, cardIds: string[]): void {
  const ids = cardIds.map((cardId) => instanceIdOf(state, cardId));
  const wanted = new Set(ids);
  p0(state).discardPile.push(...p0(state).hand.filter((id) => !wanted.has(id)));
  p0(state).hand = [];
  for (const id of ids) {
    for (const pile of [p0(state).drawPile, p0(state).discardPile]) {
      const index = pile.indexOf(id);
      if (index >= 0) {
        pile.splice(index, 1);
        break;
      }
    }
    p0(state).hand.push(id);
  }
}

export function setIntent(
  state: CombatState,
  position: number,
  intent: IntentDef,
  targetId: string | null,
): void {
  setPlan(state, position, [{ intent, targetId }]);
}

export function setPlan(
  state: CombatState,
  position: number,
  plan: { intent: IntentDef; targetId: string | null }[],
): void {
  state.enemies[position]!.plannedIntents = plan.map((entry) => ({ ...entry, cost: 0 }));
}

export function idleEnemies(state: CombatState): void {
  for (const enemy of state.enemies) {
    enemy.plannedIntents = [{ intent: idleIntent, cost: 0, targetId: null }];
  }
}

export function makeEnemiesIdle(data: GameData): void {
  for (const def of Object.values(data.enemies)) {
    def.intents = [{ ...idleIntent, cost: 0 }];
    def.moonOverrides = [];
  }
}

export function injectCard(state: CombatState, data: GameData, card: CardDef): string {
  data.cards[card.id] = card;
  const instanceId = `test_${card.id}`;
  const ownerIds = card.bond ? [...card.bond.owners] : [card.ownerId!];
  state.cards[instanceId] = { instanceId, cardId: card.id, ownerIds, player: 0, heldTurns: 0 };
  p0(state).hand.push(instanceId);
  return instanceId;
}

/** Rewrites an existing hero's level-up so a phase-7 mechanic can be tested before its hero exists. */
export function withLevelUp(
  heroId: string,
  patch: { counter?: LevelUpCounter; threshold?: number; passive?: LevelUpPassive; altPassive?: LevelUpPassive },
): (data: GameData) => void {
  return (data) => {
    const hero = data.heroes[heroId]!;
    hero.levelUp = {
      ...hero.levelUp,
      ...(patch.counter !== undefined ? { counter: patch.counter } : {}),
      ...(patch.threshold !== undefined ? { threshold: patch.threshold, constellationThreshold: patch.threshold } : {}),
      ...(patch.passive !== undefined ? { passive: patch.passive } : {}),
    };
    if (patch.altPassive !== undefined) hero.altLevelUp = { ...hero.altLevelUp, passive: patch.altPassive };
  };
}
