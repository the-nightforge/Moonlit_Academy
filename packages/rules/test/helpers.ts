import { loadGameData } from "data";
import type { CardDef, CombatEvent, CombatState, GameData, IntentDef } from "../src/index";
import { applyAction, createCombat } from "../src/index";
import { idleIntent } from "./fixtures";

export function testData(): GameData {
  return loadGameData();
}

export interface TestCombatOverrides {
  heroIds?: [string, string, string];
  encounterId?: string;
  seed?: number;
  deckCardIds?: string[];
  heroes?: { hp: number; maxHp: number }[];
  runRelicIds?: string[];
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
  overrides.mutateData?.(data);
  const created = createCombat(data, {
    heroIds: overrides.heroIds ?? ["m05", "f04", "m06"],
    encounterId: overrides.encounterId ?? "enc_01",
    seed: overrides.seed ?? 42,
    deckCardIds: overrides.deckCardIds,
    heroes: overrides.heroes,
    runRelicIds: overrides.runRelicIds,
  });
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
  state.discardPile.push(...state.hand.filter((id) => !wanted.has(id)));
  state.hand = [];
  for (const id of ids) {
    for (const pile of [state.drawPile, state.discardPile]) {
      const index = pile.indexOf(id);
      if (index >= 0) {
        pile.splice(index, 1);
        break;
      }
    }
    state.hand.push(id);
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
  state.cards[instanceId] = { instanceId, cardId: card.id, ownerIds, heldTurns: 0 };
  state.hand.push(instanceId);
  return instanceId;
}
