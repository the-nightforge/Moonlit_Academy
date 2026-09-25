import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};
import type { Action, CombatState, GameData, RunAction, RunState } from "../src/index";
import {
  applyRunAction,
  createRun,
  findNode,
  getValidTargets,
  isCardPlayable,
  reachableNodeIds,
} from "../src/index";

const data = loadGameData();
const TEAMS: [string, string, string][] = [
  ["m05", "f04", "m06"],
  ["m05", "f03", "f02"],
  ["m06", "f02", "f03"],
  ["m05", "f03", "f04"],
];
const SEEDS = [1, 2, 3, 4, 5];
const MAX_STEPS = 20000;
const MAX_COMBAT_ROUNDS = 60;

// Greedy floor: first playable card with its first valid target, else end turn.
function combatAction(gameData: GameData, state: CombatState): Action {
  for (const instanceId of state.hand) {
    if (!isCardPlayable(gameData, state, instanceId)) continue;
    const card = gameData.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const targetId = getValidTargets(gameData, state, instanceId)[0];
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
}

function runAction(gameData: GameData, run: RunState): RunAction {
  switch (run.status) {
    case "map":
      return { type: "chooseNode", nodeId: reachableNodeIds(run)[0]! };
    case "combat":
      return { type: "combat", action: combatAction(gameData, run.combat!) };
    case "reward":
      return { type: "pickCard", cardId: run.pendingReward!.cardChoices[0] ?? null };
    case "rest": {
      const hp = run.heroes.reduce((sum, h) => sum + h.hp, 0);
      const maxHp = run.heroes.reduce((sum, h) => sum + h.maxHp, 0);
      if (hp < 0.6 * maxHp || run.deck.length <= gameData.runConfig.minDeckSize) {
        return { type: "rest", choice: "heal" };
      }
      const cheapest = [...run.deck].sort(
        (a, b) => gameData.cards[a]!.cost - gameData.cards[b]!.cost,
      )[0]!;
      return { type: "rest", choice: "removeCard", cardId: cheapest };
    }
    case "treasure":
      return { type: "continue" };
    case "won":
    case "lost":
      throw new Error("run is over");
  }
}

function simulateRun(heroIds: [string, string, string], seed: number) {
  let run = createRun(data, { heroIds, seed }).run;
  let fights = 0;
  let stalled = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    if (run.status === "won" || run.status === "lost") break;
    if (run.status === "combat" && run.combat!.round > MAX_COMBAT_ROUNDS) {
      stalled = true;
      break;
    }
    const result = applyRunAction(data, run, runAction(data, run));
    if (!result.ok) throw new Error(`run action rejected: ${result.error}`);
    if (result.runEvents.some((e) => e.type === "nodeEntered" && e.nodeType !== "rest" && e.nodeType !== "treasure")) {
      fights += 1;
    }
    run = result.run;
  }
  return {
    result: stalled ? "stalled" : run.status,
    floor: run.position ? findNode(run, run.position)!.floor : 0,
    fights,
    deck: run.deck.length,
    relics: run.runRelicIds.length,
    hp: run.heroes.map((h) => `${h.defId}:${h.hp}/${h.maxHp}`).join(" "),
  };
}

describe("run playtest", () => {
  for (const team of TEAMS) {
    it(`${team.join("+")} chạy trọn lượt chơi`, () => {
      const rows = SEEDS.map((seed) => ({ seed, ...simulateRun(team, seed) }));
      console.log(`\n=== run · ${team.join("+")} ===`);
      console.table(rows);
      for (const row of rows) expect(["won", "lost", "stalled"]).toContain(row.result);
    });
  }
});
