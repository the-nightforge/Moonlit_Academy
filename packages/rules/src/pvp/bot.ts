import { chooseCombatAction } from "../bot";
import type { Action, CombatState, GameData } from "../types/index";

/**
 * `17` §4.9 — the PvP bot decides from a seat's view only (`viewFor`), so it can
 * never cheat. The returned Action carries `player` for `applyAction`.
 */
export function pvpBot(data: GameData, view: CombatState, player: number): Action {
  return { ...chooseCombatAction(data, view, player), player } as Action;
}
