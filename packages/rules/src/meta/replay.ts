import { applyRunAction, createRun } from "../run/run";
import type { GameData, Loadout, RunAction, RunSetup, RunState } from "../types/index";

export type ReplayResult =
  | { ok: true; run: RunState }
  | { ok: false; step: number; reason: string };

/**
 * Rebuilds a run from its setup and the actions the player sent (`14` §4.2).
 * Pure: the same data, setup and actions always give the same run.
 */
export function replayRun(
  data: GameData,
  setup: RunSetup,
  actions: readonly RunAction[],
  loadout?: Loadout,
): ReplayResult {
  let run = createRun(data, setup, loadout).run;
  for (let step = 0; step < actions.length; step++) {
    if (run.status === "won" || run.status === "lost") return { ok: false, step, reason: "actions after end" };
    const result = applyRunAction(data, run, actions[step]!);
    if (!result.ok) return { ok: false, step, reason: result.error };
    run = result.run;
  }
  return { ok: true, run };
}
