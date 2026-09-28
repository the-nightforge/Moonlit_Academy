import { seatTag } from "./players";
import type { CombatEvent, CombatState, GameData, PlayerState } from "./types/index";

/** Draws from the top of `player`'s draw pile; stops when it is empty (never reshuffles). */
export function drawCards(
  state: CombatState,
  player: PlayerState,
  count: number,
  events: CombatEvent[],
): void {
  const drawn = player.drawPile.splice(0, Math.max(0, count));
  if (drawn.length === 0) return;
  for (const id of drawn) state.cards[id]!.heldTurns = 0;
  player.hand.push(...drawn);
  events.push({ type: "cardsDrawn", instanceIds: drawn, ...seatTag(state, player.index) });
}

/** Draws until `player`'s hand holds `handSize` cards or the draw pile is empty. */
export function refillHand(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  events: CombatEvent[],
): void {
  drawCards(state, player, data.combatConfig.handSize - player.hand.length, events);
}

/** Puts a card in the seat's hand; at `handLimit` it lands in the discard pile
 *  instead (`01` §4.6 — card effects may exceed `handSize`, never `handLimit`). */
export function addToHand(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  instanceId: string,
  events: CombatEvent[],
): void {
  if (player.hand.length >= data.combatConfig.handLimit) {
    player.discardPile.push(instanceId);
    events.push({ type: "cardDiscarded", instanceIds: [instanceId], ...seatTag(state, player.index) });
    return;
  }
  player.hand.push(instanceId);
}
