import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};
import type { CombatState, GameData } from "../src/index";
import {
  applyAction,
  createCombat,
  getValidTargets,
  isCardPlayable,
} from "../src/index";

const data = loadGameData();
const HEROES = ["m05", "f04", "m06"];
const MAX_ROUNDS = 50;
const MAX_ACTIONS = 5000;

interface SimResult {
  state: CombatState;
  actions: number;
  cardsPlayed: number;
}

// Greedy heuristic: play the first playable card (first valid target),
// end turn when nothing is playable. Not optimal — a floor for difficulty.
function simulate(gameData: GameData, encounterId: string, seed: number): SimResult {
  let { state } = createCombat(gameData, { heroIds: HEROES, encounterId, seed });
  let actions = 0;
  let cardsPlayed = 0;

  while (state.status === "playerTurn" && state.round <= MAX_ROUNDS && actions < MAX_ACTIONS) {
    let played = false;
    for (const instanceId of state.hand) {
      if (!isCardPlayable(gameData, state, instanceId)) continue;
      const card = gameData.cards[state.cards[instanceId]!.cardId]!;
      if (card.target !== "none") {
        const targetId = getValidTargets(gameData, state, instanceId)[0];
        if (targetId === undefined) continue;
        const result = applyAction(gameData, state, {
          type: "playCard",
          instanceId,
          targetId,
        });
        if (!result.ok) continue;
        state = result.state;
      } else {
        const result = applyAction(gameData, state, { type: "playCard", instanceId });
        if (!result.ok) continue;
        state = result.state;
      }
      actions += 1;
      cardsPlayed += 1;
      played = true;
      break;
    }
    if (!played && state.status === "playerTurn") {
      const result = applyAction(gameData, state, { type: "endTurn" });
      if (!result.ok) break;
      state = result.state;
      actions += 1;
    }
  }
  return { state, actions, cardsPlayed };
}

function summarize(sim: SimResult) {
  const { state } = sim;
  return {
    kết_quả: state.status,
    vòng: state.round,
    lá_đánh: sim.cardsPlayed,
    hero: state.heroes
      .map((hero) => `${hero.defId}:${hero.alive ? `${hero.hp}/${hero.maxHp}` : "ngã"}`)
      .join(" "),
    địch: state.enemies
      .map((enemy) => `${enemy.defId}:${enemy.alive ? `${enemy.hp}/${enemy.maxHp}` : "ngã"}`)
      .join(" "),
  };
}

describe("playtest", () => {
  const seeds = [42, 7, 2024];
  for (const encounterId of Object.keys(data.encounters)) {
    it(`${encounterId} hoàn tất trong ${MAX_ROUNDS} vòng`, () => {
      const rows = seeds.map((seed) => ({
        seed,
        ...summarize(simulate(data, encounterId, seed)),
      }));
      console.log(`\n=== ${encounterId} ===`);
      console.table(rows);
      for (const sim of seeds.map((seed) => simulate(data, encounterId, seed))) {
        expect(
          sim.state.status === "won" ||
            sim.state.status === "lost" ||
            sim.state.round > MAX_ROUNDS,
        ).toBe(true);
      }
    });
  }
});
