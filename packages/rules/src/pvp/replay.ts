import { applyAction } from "../apply-action";
import { createPvpCombat } from "./create";
import type { Action, CombatEvent, CombatState, GameData, PvpSide } from "../types/index";

/**
 * Replays a recorded match (`17` §5.6): the same creation seed plus the same
 * ordered action log must reproduce the match bit-for-bit. Each entry carries
 * the seat that sent it; `system` actions (forfeit) replay unchanged. Throws on
 * the first rejected action — a log that does not replay is corrupt.
 */
export function replayMatch(
  data: GameData,
  setup: { seed: number; players: [PvpSide, PvpSide] },
  log: { player: number; action: Action }[],
): { state: CombatState; events: CombatEvent[] } {
  const created = createPvpCombat(data, setup);
  let state = created.state;
  const events = [...created.events];
  for (const [index, entry] of log.entries()) {
    const action = { ...entry.action, player: entry.player } as Action;
    const result = applyAction(data, state, action);
    if (!result.ok) {
      throw new Error(`replayMatch: action ${index} (${action.type}) rejected: ${result.error}`);
    }
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
