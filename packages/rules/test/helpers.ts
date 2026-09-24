import { loadGameData } from "data";
import type { CombatEvent, CombatState, GameData } from "../src/index";
import { createCombat } from "../src/index";

let cachedData: GameData | undefined;

export function testData(): GameData {
  cachedData ??= loadGameData();
  return cachedData;
}

export interface TestCombatOverrides {
  heroIds?: [string, string, string];
  encounterId?: string;
  seed?: number;
  setup?: (state: CombatState) => void;
}

export function makeTestCombat(overrides: TestCombatOverrides = {}): {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
} {
  const data = testData();
  const { state, events } = createCombat(data, {
    heroIds: overrides.heroIds ?? ["m05", "f04", "m06"],
    encounterId: overrides.encounterId ?? "enc_01",
    seed: overrides.seed ?? 42,
  });
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
