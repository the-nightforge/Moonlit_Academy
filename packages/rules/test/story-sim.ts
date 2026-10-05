declare const console: { log(...args: unknown[]): void; table(...args: unknown[]): void };

import type { CombatState, GameData } from "../src/index";
import { applyAction, chooseCombatAction, createStoryCombat, starterDeck } from "../src/index";

const MAX_ROUNDS = 60;
const MAX_STEPS = 4000;

export interface StoryCell {
  runs: number;
  won: number;
  stalled: number;
  roundSum: number;
  deckedOut: number;
}

/** Simulate one story stage × one team across seeds with the honest bot
 *  (public information only). Returns win/deck-out aggregates per the 7c gate:
 *  win%, average rounds, Cạn Bài %. */
export function runStoryCell(
  data: GameData,
  stageId: string,
  heroIds: [string, string, string],
  seeds: readonly number[],
): StoryCell {
  const deckCardIds = starterDeck(data, heroIds);
  const cell: StoryCell = { runs: 0, won: 0, stalled: 0, roundSum: 0, deckedOut: 0 };
  for (const seed of seeds) {
    let state: CombatState = createStoryCombat(data, { stageId, seed, heroIds, deckCardIds }).state;
    let out = false;
    let steps = 0;
    while (state.status !== "won" && state.status !== "lost" && steps < MAX_STEPS) {
      const result = applyAction(data, state, chooseCombatAction(data, state, 0));
      if (!result.ok) throw new Error(`story-sim ${stageId} seed ${seed}: action rejected: ${result.error}`);
      state = result.state;
      if (result.events.some((event) => event.type === "deckedOut")) out = true;
      steps += 1;
      if (state.round > MAX_ROUNDS) break;
    }
    cell.runs += 1;
    cell.roundSum += state.round;
    if (out) cell.deckedOut += 1;
    if (state.status === "won") cell.won += 1;
    else if (state.status !== "lost") cell.stalled += 1;
  }
  return cell;
}

export function printStorySim(
  label: string,
  data: GameData,
  teams: [string, string, string][],
  seeds: readonly number[],
): void {
  const stageIds = Object.keys(data.storyStages);
  const rows = stageIds.map((stageId) => {
    const cells = teams.map((team) => runStoryCell(data, stageId, team, seeds));
    const fmt = (c: StoryCell) =>
      `${((c.won / c.runs) * 100).toFixed(0)} / ${(c.roundSum / c.runs).toFixed(1)} / ${((c.deckedOut / c.runs) * 100).toFixed(0)}`;
    return {
      màn: `${stageId} ${data.storyStages[stageId]!.name}`,
      [teams[0]!.join("+")]: fmt(cells[0]!),
      [teams[1]!.join("+")]: fmt(cells[1]!),
      [teams[2]!.join("+")]: fmt(cells[2]!),
      "đội tốt nhất": `${Math.max(...cells.map((c) => (c.won / c.runs) * 100)).toFixed(0)}%`,
      kẹt: cells.reduce((n, c) => n + c.stalled, 0),
    };
  });
  console.log(`\n=== ${label} (thắng% / vòng TB / Cạn Bài%) ===`);
  console.table(rows);
}
