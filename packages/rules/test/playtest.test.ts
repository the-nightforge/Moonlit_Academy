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
const HEROES: [string, string, string] = ["m05", "f04", "m06"];
const MAX_ROUNDS = 50;
const MAX_ACTIONS = 5000;

interface SimResult {
  state: CombatState;
  actions: number;
  cardsPlayed: number;
  levelUps: { heroId: string; round: number }[];
  moonGuidePlays: number;
}

const moonGuideId = Object.values(data.cards).find(
  (card) => card.name === "Nguyệt Quang Dẫn",
)?.id;

// Greedy heuristic: play the first playable card (first valid target),
// end turn when nothing is playable. Not optimal — a floor for difficulty.
function simulate(gameData: GameData, encounterId: string, seed: number): SimResult {
  let { state } = createCombat(gameData, { heroIds: HEROES, encounterId, seed });
  let actions = 0;
  let cardsPlayed = 0;
  const levelUps: { heroId: string; round: number }[] = [];
  let moonGuidePlays = 0;

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
        for (const event of result.events) {
          if (event.type === "heroLeveledUp") {
            levelUps.push({ heroId: event.heroId, round: state.round });
          }
        }
        if (card.id === moonGuideId) moonGuidePlays += 1;
      } else {
        const result = applyAction(gameData, state, { type: "playCard", instanceId });
        if (!result.ok) continue;
        state = result.state;
        for (const event of result.events) {
          if (event.type === "heroLeveledUp") {
            levelUps.push({ heroId: event.heroId, round: state.round });
          }
        }
        if (card.id === moonGuideId) moonGuidePlays += 1;
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
      for (const event of result.events) {
        if (event.type === "heroLeveledUp") {
          levelUps.push({ heroId: event.heroId, round: state.round });
        }
      }
      actions += 1;
    }
  }
  return { state, actions, cardsPlayed, levelUps, moonGuidePlays };
}

function summarize(sim: SimResult) {
  const { state } = sim;
  return {
    kết_quả: state.status,
    vòng: state.round,
    lá_đánh: sim.cardsPlayed,
    NQ_Dẫn: sim.moonGuidePlays,
    thăng_cấp:
      sim.levelUps.map((l) => `${l.heroId.replace("hero:", "")}@v${l.round}`).join(" ") ||
      "—",
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
      const sims = seeds.map((seed) => simulate(data, encounterId, seed));
      console.log(`\n=== ${encounterId} ===`);
      console.table(sims.map((sim, index) => ({ seed: seeds[index], ...summarize(sim) })));
      for (const sim of sims) {
        expect(
          sim.state.status === "won" ||
            sim.state.status === "lost" ||
            sim.state.round > MAX_ROUNDS,
        ).toBe(true);
      }
    });
  }
});
