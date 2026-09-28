import { runSummonActions } from "../summons";
import { advanceRound, endSeatTurn, startPlayerTurn, tickDurations } from "../turn";
import type { CombatEvent, CombatState, GameData } from "../types/index";

/**
 * `17` §4.2–4.3 — a PvP turn end: the seat's own cleanup (turn-end hooks, broken
 * cards, Tích Tụ, reserve, freeze removal), then duration statuses tick for every
 * unit (they store `2 × rounds`, ticking once per either player's turn), then the
 * turn passes to the other seat — or the round advances and the first player goes.
 */
export function pvpEndTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const player = state.players[state.activePlayer]!;
  endSeatTurn(data, state, player, events);
  if (state.status === "won" || state.status === "lost") return;
  runSummonActions(data, state, [player.index], events);
  if (["won", "lost"].includes(state.status)) return;
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
