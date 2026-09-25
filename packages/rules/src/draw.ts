import type { CombatEvent, CombatState, GameData } from "./types/index";

/** Draws from the top of the draw pile; stops when it is empty (never reshuffles). */
export function drawCards(state: CombatState, count: number, events: CombatEvent[]): void {
  const drawn = state.drawPile.splice(0, Math.max(0, count));
  if (drawn.length === 0) return;
  state.hand.push(...drawn);
  events.push({ type: "cardsDrawn", instanceIds: drawn });
}

/** Draws until the hand holds `handSize` cards or the draw pile is empty. */
export function refillHand(data: GameData, state: CombatState, events: CombatEvent[]): void {
  drawCards(state, data.combatConfig.handSize - state.hand.length, events);
}
