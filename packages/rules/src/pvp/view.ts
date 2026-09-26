import { cloneState } from "../clone";
import type { CombatEvent, CombatState } from "../types/index";

/**
 * `17` §4.8 — the seat-scoped view of a combat. The opponent's hand and draw
 * pile become `hidden_*` placeholders (count only), their in-flight choice is
 * dropped, and `rngState` is zeroed so the view carries no information a
 * client could exploit. Own zones, heroes, gear and discards stay complete —
 * the view still answers `getValidTargets`/`isCardPlayable`/previews for the
 * viewer.
 */
export function viewFor(state: CombatState, player: number): CombatState {
  const view = cloneState(state);
  view.rngState = 0;
  const opponent = view.players.find((seat) => seat.index !== player);
  if (!opponent) return view;
  // Every opponent card not publicly discarded is hidden (hand, draw pile and
  // any pending Chiêm Bài options in limbo).
  const publicIds = new Set(opponent.discardPile);
  for (const [id, instance] of Object.entries(view.cards)) {
    if (instance.player === opponent.index && !publicIds.has(id)) delete view.cards[id];
  }
  opponent.hand = opponent.hand.map((_, i) => `hidden_hand_${i}`);
  opponent.drawPile = opponent.drawPile.map((_, i) => `hidden_deck_${i}`);
  opponent.pendingChoice = null;
  // A status belonging to the other seat reads as opponentTurn for the viewer.
  if (
    (state.status === "playerTurn" || state.status === "choosing") &&
    state.activePlayer !== player
  ) {
    view.status = "opponentTurn";
  } else if (state.status === "mulligan" && view.players[player]?.mulliganDone) {
    view.status = "opponentTurn";
  }
  return view;
}

/** Placeholder ids keep an event's *shape* (lengths) while hiding card identity. */
const hidden = (ids: string[], prefix: string) => ids.map((_, i) => `${prefix}${i}`);

/**
 * `17` §4.8 — strip opponent card identity from the event stream a seat
 * receives. Revealing events (draws, mulligan, Chiêm Bài) keep only their
 * counts; `cardPlayed` stays full — a played card is public.
 */
export function redactEvents(events: CombatEvent[], player: number): CombatEvent[] {
  return events.map((event) => {
    if (!("player" in event) || event.player === undefined || event.player === player) {
      return event;
    }
    switch (event.type) {
      case "cardsDrawn":
        return { ...event, instanceIds: hidden(event.instanceIds, "hidden_drawn_") };
      case "mulliganed":
        return {
          ...event,
          returned: hidden(event.returned, "hidden_returned_"),
          drawn: hidden(event.drawn, "hidden_drawn_"),
        };
      case "choiceOpened":
        return { ...event, options: hidden(event.options, "hidden_option_") };
      case "cardChosen":
        return { ...event, instanceId: "hidden_choice", bottomed: hidden(event.bottomed, "hidden_bottomed_") };
      default:
        return event;
    }
  });
}
