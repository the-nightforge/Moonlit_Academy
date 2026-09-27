import { applyAction } from "../apply-action";
import { createCoopCombat } from "../coop/create";
import { createPvpCombat } from "./create";
import type { Action, CombatEvent, CombatState, CoopSide, GameData, PvpSide } from "../types/index";

/**
 * Replays a recorded match (`17` §5.6): the same creation seed plus the same
 * ordered action log must reproduce the match bit-for-bit. Each entry carries
 * the seat that sent it; `system` actions (forfeit, timeout endTurn) replay
 * unchanged. Throws on the first rejected action — a log that does not replay
 * is corrupt. `mode: "coop"` replays through `createCoopCombat` (`17` §9.1);
 * omitted it stays a PvP match.
 */
export function replayMatch(
  data: GameData,
  setup: {
    seed: number;
    players: [PvpSide | CoopSide, PvpSide | CoopSide];
    mode?: "pvp" | "coop";
    /** Required when `mode === "coop"`; falls back to `coopConfig.encounterId`. */
    encounterId?: string;
  },
  log: { player: number; action: Action }[],
): { state: CombatState; events: CombatEvent[] } {
  const created =
    setup.mode === "coop"
      ? createCoopCombat(data, {
          seed: setup.seed,
          players: setup.players as [CoopSide, CoopSide],
          encounterId: setup.encounterId ?? data.coopConfig.encounterId,
        })
      : createPvpCombat(data, { seed: setup.seed, players: setup.players as [PvpSide, PvpSide] });
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
