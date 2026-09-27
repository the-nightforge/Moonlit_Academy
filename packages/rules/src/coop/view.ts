import { cloneState } from "../clone";
import type { CombatEvent, CombatState } from "../types/index";

/**
 * `17` §9.1 — the seat-scoped view of a co-op combat. Partners are allies, so
 * both hands stay fully visible; only the things that would leak hidden
 * information are stripped: both draw piles become `hidden_*` count-only
 * placeholders (their order is secret even from the owner — Chiêm Bài reveals
 * it deliberately), the partner's in-flight choice is dropped, and `rngState`
 * is zeroed. The shared turn keeps `status: "playerTurn"` for both seats —
 * there is no `opponentTurn` remap; a seat's own `done` flag says whether it
 * may still act.
 */
export function coopViewFor(state: CombatState, player: number): CombatState {
  const view = cloneState(state);
  view.rngState = 0;
  for (const seat of view.players) {
    seat.drawPile = seat.drawPile.map((_, i) => `hidden_deck_${i}`);
  }
  const partner = view.players.find((seat) => seat.index !== player);
  if (partner !== undefined) partner.pendingChoice = null;
  return view;
}

/** Placeholder ids keep an event's *shape* (lengths) while hiding card identity. */
const hidden = (ids: string[], prefix: string) => ids.map((_, i) => `${prefix}${i}`);

/**
 * `17` §9.1 — event redaction for a co-op seat. The partner's hand is public,
 * so draws/mulligans/chosen cards pass through untouched; the only partner
 * fields still stripped are the ones tied to draw-pile order: `choiceOpened`
 * options (unseen pile top) and `cardChosen.bottomed` (pile bottom).
 */
export function coopRedactEvents(events: CombatEvent[], player: number): CombatEvent[] {
  return events.map((event) => {
    if (!("player" in event) || event.player === undefined || event.player === player) {
      return event;
    }
    switch (event.type) {
      case "choiceOpened":
        return { ...event, options: hidden(event.options, "hidden_option_") };
      case "cardChosen":
        return { ...event, bottomed: hidden(event.bottomed, "hidden_bottomed_") };
      default:
        return event;
    }
  });
}
