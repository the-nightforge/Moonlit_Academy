import type { Action, CombatState } from "./types/index";

/** The default answer to a seat's pending choice (server timer, bots): first card / keep the moon. */
export function autoChoiceAction(state: CombatState, seat: number): Action | null {
  const pending = state.players[seat]?.pendingChoice;
  if (!pending) return null;
  if (pending.kind === "chooseMoon") return { type: "chooseMoon", offset: 0, player: seat };
  const instanceId = pending.options[0];
  return instanceId === undefined ? null : { type: "chooseCard", instanceId, player: seat };
}
