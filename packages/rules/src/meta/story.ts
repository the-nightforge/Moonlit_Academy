import { applyAction } from "../apply-action";
import { createCombat } from "../create-combat";
import type { Action, CombatEvent, CombatState, GameData, Loadout } from "../types/index";

export interface StorySetup {
  stageId: string;
  seed: number;
  heroIds: [string, string, string];
  deckCardIds: string[];
}

export type StoryReplayResult =
  | { ok: true; state: CombatState }
  | { ok: false; step: number; reason: string };

/** A story stage's combat (`18` §4.2): its encounter, started in the stage's moon. */
export function createStoryCombat(
  data: GameData,
  setup: StorySetup,
  loadout?: Loadout,
): { state: CombatState; events: CombatEvent[] } {
  const stage = data.storyStages[setup.stageId];
  if (!stage) throw new Error(`createStoryCombat: unknown stage "${setup.stageId}"`);
  return createCombat(
    data,
    {
      heroIds: setup.heroIds,
      encounterId: stage.encounterId,
      seed: setup.seed,
      deckCardIds: setup.deckCardIds,
      ...(stage.start ? { start: stage.start } : {}),
    },
    loadout,
  );
}

/** Rebuilds a story combat from the player's actions (`18` §4.2); same convention as `replayRun`. */
export function replayStoryCombat(
  data: GameData,
  setup: StorySetup,
  actions: readonly Action[],
  loadout?: Loadout,
): StoryReplayResult {
  let state = createStoryCombat(data, setup, loadout).state;
  for (let step = 0; step < actions.length; step++) {
    if (state.status === "won" || state.status === "lost") return { ok: false, step, reason: "actions after end" };
    const result = applyAction(data, state, actions[step]!);
    if (!result.ok) return { ok: false, step, reason: result.error };
    state = result.state;
  }
  return { ok: true, state };
}
