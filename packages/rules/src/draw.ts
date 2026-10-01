import { checkCombatEnd, loseHp, processDeaths } from "./effects";
import { decreeModifier } from "./moon";
import { seatTag } from "./players";
import type { CombatEvent, CombatState, GameData, PlayerState } from "./types/index";

/**
 * Cards leaving the hand unplayed — Hủy Bài, Tàn Chiêu at turn end, hand
 * overflow (`01` §3.3, §4.2, §5.8). They land on the discard pile, then Đoạn
 * Tuyệt (`discardDamage`, `01` §7.5) hits the lowest-HP living opposing unit
 * of the seat once per card (HP ties break to the lower position).
 */
export function discardUnplayed(
  data: GameData,
  state: CombatState,
  player: PlayerState,
  instanceIds: string[],
  events: CombatEvent[],
): void {
  if (instanceIds.length === 0) return;
  player.discardPile.push(...instanceIds);
  events.push({ type: "cardDiscarded", instanceIds, ...seatTag(state, player.index) });
  const cut = decreeModifier(data, state, "discardDamage");
  if (!cut) return;
  for (let i = 0; i < instanceIds.length; i++) {
    const foes = (state.mode === "pvp"
      ? state.heroes.filter((hero) => hero.player !== player.index)
      : state.enemies
    ).filter((unit) => unit.alive && unit.hp > 0);
    const victim = foes.sort((a, b) => a.hp - b.hp || a.position - b.position)[0];
    if (!victim) return;
    loseHp(data, victim, cut.amount, "decree", events);
    processDeaths(data, state, events, undefined);
    if (checkCombatEnd(state, events)) return;
  }
}

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
  if (kept.length > 0) events.push({ type: "cardsDrawn", instanceIds: kept, ...seatTag(state, player.index) });
  discardUnplayed(data, state, player, spilled, events);
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
    discardUnplayed(data, state, player, [instanceId], events);
    return;
  }
  player.hand.push(instanceId);
}
