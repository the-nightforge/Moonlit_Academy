import { shuffle } from "./rng";
import type { CombatEvent, CombatState } from "./types/index";

export function drawCards(state: CombatState, count: number, events: CombatEvent[]): void {
  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      const shuffled = shuffle(state.discardPile, state.rngState);
      state.rngState = shuffled.rngState;
      state.drawPile = shuffled.items;
      state.discardPile = [];
      events.push({ type: "deckShuffled" });
    }
    const instanceId = state.drawPile.shift()!;
    if (state.hand.length >= 10) {
      state.discardPile.push(instanceId);
      events.push({ type: "cardDiscarded", instanceIds: [instanceId] });
    } else {
      state.hand.push(instanceId);
      drawn.push(instanceId);
    }
  }
  if (drawn.length > 0) events.push({ type: "cardsDrawn", instanceIds: drawn });
}
