import { applyAction } from "../apply-action";
import { createCombat } from "../create-combat";
import { grantHeroItem, type PullResult } from "./gacha";
import { masteryLevel } from "./profile";
import type { Action, CombatEvent, CombatState, GameData, Loadout, MasteryGain, Profile } from "../types/index";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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

export interface StoryRewards {
  firstClear: boolean;
  moonJade: number;
  darkIron: number;
  gains: MasteryGain[];
  hero: PullResult | null;
}

/** Stage `n` needs stage `n-1`; an arc's first stage needs every stage of the arc before (`18` §4.1). */
export function storyStageUnlocked(data: GameData, profile: Profile, stageId: string): boolean {
  const stage = data.storyStages[stageId];
  if (!stage) return false;
  const arcs = Object.values(data.storyArcs);
  const arcIndex = arcs.findIndex((arc) => arc.id === stage.arcId);
  const arc = arcs[arcIndex];
  if (!arc) return false;
  const cleared = new Set(profile.story.cleared);
  const index = arc.stageIds.indexOf(stageId);
  if (index > 0) return cleared.has(arc.stageIds[index - 1]!);
  return arcIndex === 0 || arcs[arcIndex - 1]!.stageIds.every((id) => cleared.has(id));
}

export function unlockedStageIds(data: GameData, profile: Profile): string[] {
  return Object.keys(data.storyStages).filter((id) => storyStageUnlocked(data, profile, id));
}

const NO_REWARDS: StoryRewards = { firstClear: false, moonJade: 0, darkIron: 0, gains: [], hero: null };

/** Records a verified story result (`18` §4.2); only the first win of a stage pays. */
export function applyStoryResult(
  data: GameData,
  profile: Profile,
  setup: StorySetup,
  won: boolean,
): { ok: true; profile: Profile; rewards: StoryRewards } {
  const stage = data.storyStages[setup.stageId];
  if (!won || !stage || profile.story.cleared.includes(stage.id)) {
    return { ok: true, profile, rewards: { ...NO_REWARDS, gains: [] } };
  }
  const next = clone(profile);
  next.story.cleared.push(stage.id);
  const moonJade = stage.firstClear.moonJade ?? 0;
  const darkIron = stage.firstClear.darkIron ?? 0;
  next.currencies.moonJade += moonJade;
  next.currencies.darkIron += darkIron;
  const xp = stage.firstClear.masteryXp ?? 0;
  const gains = xp === 0 ? [] : setup.heroIds.flatMap((heroId) => {
    const hero = next.heroes[heroId];
    if (!hero) return [];
    const levelBefore = masteryLevel(data, hero.xp);
    hero.xp += xp;
    return [{ heroId, xp, levelBefore, levelAfter: masteryLevel(data, hero.xp) }];
  });
  const arc = data.storyArcs[stage.arcId]!;
  const hero = arc.stageIds.at(-1) === stage.id ? grantHeroItem(data, next, arc.rewardHeroId) : null;
  return { ok: true, profile: next, rewards: { firstClear: true, moonJade, darkIron, gains, hero } };
}
