import { heroesOf, seatTag } from "../players";
import { cardOwners } from "../queries";
import { runRelicHooks } from "../run-relic-hooks";
import { removeStatus } from "../statuses";
import { advanceRound, startPlayerTurn, tickDurations } from "../turn";
import type { CombatEvent, CombatState, GameData, PlayerState } from "../types/index";

/**
 * `17` §4.2–4.3 — a PvP turn end: the seat's own cleanup (turn-end hooks, broken
 * cards, Tích Tụ, reserve, freeze removal), then duration statuses tick for every
 * unit (they store `2 × rounds`, ticking once per either player's turn), then the
 * turn passes to the other seat — or the round advances and the first player goes.
 */
export function pvpEndTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const player = state.players[state.activePlayer]!;
  runRelicHooks(data, state, events, { type: "playerTurnEnd" }, player.index);
  if (state.status === "won" || state.status === "lost") return;
  const broken = player.hand.filter((id) =>
    cardOwners(state, state.cards[id]!).some((owner) => !owner?.alive),
  );
  if (broken.length > 0) {
    player.hand = player.hand.filter((id) => !broken.includes(id));
    player.discardPile.push(...broken);
    events.push({ type: "cardDiscarded", instanceIds: broken, ...seatTag(state, player.index) });
  }
  for (const id of player.hand) state.cards[id]!.heldTurns += 1;
  for (const instance of Object.values(state.cards)) delete instance.chosenThisTurn;
  const reserve = Math.min(data.combatConfig.moonReserveMax, player.moonPower);
  if (reserve !== player.moonReserve) {
    player.moonReserve = reserve;
    events.push({ type: "moonReserveChanged", side: "hero", value: reserve, ...seatTag(state, player.index) });
  }
  for (const hero of heroesOf(state, player.index)) removeStatus(hero, "freeze", events);
  tickDurations(state, events);

  const next = (player.index === state.firstPlayer ? 1 - player.index : state.firstPlayer!) as 0 | 1;
  state.activePlayer = next;
  if (player.index !== state.firstPlayer) {
    advanceRound(data, state, events);
    // Moon hooks inside advanceRound may have ended the match.
    if (["won", "lost"].includes(state.status)) return;
    if (state.round > data.pvpConfig.roundCap) {
      state.winner = "draw";
      state.status = "won";
      events.push({ type: "combatEnded", result: "draw", winner: "draw" });
      return;
    }
  }
  startPlayerTurn(data, state, state.players[next]!, events);
}
