import { seatTag } from "./players";
import type { CombatEvent, CombatState, GameData, PlayerState } from "./types/index";

/** Draws from the top of `player`'s draw pile; stops when it is empty (never
 *  reshuffles). Cards past `handLimit` spill to the discard pile (`01` §4.2). */
export function drawCards(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  count: number,
  events: CombatEvent[],
): void {
  const drawn = player.drawPile.splice(0, Math.max(0, count));
  if (drawn.length === 0) return;
  const room = Math.max(0, data.combatConfig.handLimit - player.hand.length);
  const kept = drawn.slice(0, room);
  const spilled = drawn.slice(room);
  for (const id of kept) state.cards[id]!.heldTurns = 0;
  player.hand.push(...kept);
  player.discardPile.push(...spilled);
  if (kept.length > 0) events.push({ type: "cardsDrawn", instanceIds: kept, ...seatTag(state, player.index) });
  if (spilled.length > 0) events.push({ type: "cardDiscarded", instanceIds: spilled, ...seatTag(state, player.index) });
}

/** Draws until `player`'s hand holds `handSize` cards or the draw pile is empty. */
export function refillHand(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  events: CombatEvent[],
): void {
  drawCards(data, state, player, data.combatConfig.handSize - player.hand.length, events);
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
