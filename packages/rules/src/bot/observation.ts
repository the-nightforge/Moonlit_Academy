import { cloneState } from "../clone";
import { coopViewFor } from "../coop/view";
import { viewFor } from "../pvp/view";
import type { CombatEvent, CombatState, GameData } from "../types/index";

/** The mode a playtest decision runs under — drives what the seat may see. */
export type BotMode = "pve" | "pvp" | "coop";

/**
 * Everything a playtest policy may read for one decision. `visibleState` is the
 * seat-scoped, sanitized clone — the only combat data the policy touches.
 * `history` is the seat-visible event stream so far (caller must already have
 * redacted it: `redactEvents`/`coopRedactEvents`, or raw for PvE). `ownDeckCardIds`
 * is the deck the seat registered, when the mode lets the player know it.
 */
export interface BotObservation {
  mode: BotMode;
  seat: number;
  visibleState: CombatState;
  history: readonly CombatEvent[];
  ownDeckCardIds: readonly string[] | null;
}

/** Freeze `value` in place, recursively (state trees are plain objects/arrays). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * PvE seat view: the player's own draw order is secret even to them (the client
 * shows a count), `rngState` is engine-private, and `plannedIntents` are the
 * internal enemy chain — `01` §9.2 keeps them hidden; only the fund on the
 * portrait (`moonPower`, emitted via `intentsRevealed`) is public.
 */
function pveViewFor(state: CombatState): CombatState {
  const view = cloneState(state);
  view.rngState = 0;
  for (const player of view.players) {
    player.drawPile = player.drawPile.map((_, i) => `hidden_deck_${i}`);
  }
  for (const enemy of view.enemies) enemy.plannedIntents = [];
  return view;
}

/**
 * The one door every playtest policy reads combat through. Returns detached,
 * deeply frozen data: `pvp` uses the wire-level `viewFor`, `coop` the shared
 * `coopViewFor`, `pve` a dedicated sanitizer for solo fights (`17` §4.8/§9.1,
 * `01` §9.2). `data` is accepted for future deck/knowledge checks; today the
 * mode fully determines the view.
 */
export function makeBotObservation(
  data: GameData,
  state: CombatState,
  seat: number,
  mode: BotMode,
  history: readonly CombatEvent[],
  ownDeckCardIds: readonly string[] | null,
): BotObservation {
  void data;
  const visibleState =
    mode === "pvp" ? viewFor(state, seat) : mode === "coop" ? coopViewFor(state, seat) : pveViewFor(state);
  return deepFreeze<BotObservation>({
    mode,
    seat,
    visibleState,
    history: [...history],
    ownDeckCardIds: ownDeckCardIds === null ? null : [...ownDeckCardIds],
  });
}
