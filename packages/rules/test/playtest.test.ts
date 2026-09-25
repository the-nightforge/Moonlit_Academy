import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};
import type { CombatEvent, CombatState, GameData } from "../src/index";
import {
  applyAction,
  createCombat,
  getValidTargets,
  isCardPlayable,
} from "../src/index";

const data = loadGameData();
const TEAMS: [string, string, string][] = [
  ["m05", "f04", "m06"], // phase 1 baseline, no bond
  ["m05", "f03", "f02"], // Băng Hỏa Tranh Phong, blood moon
  ["m06", "f02", "f03"], // Ảnh Đấu
  ["m05", "f03", "f04"], // Băng Hỏa Tranh Phong + Tuyết Trung Tống Thán
];
const MAX_ROUNDS = 50;
const MAX_ACTIONS = 5000;

interface SimResult {
  state: CombatState;
  cardsPlayed: number;
  levelUps: { heroId: string; round: number }[];
  moonGuidePlays: number;
  bondPlays: number;
  bloodMoonTurns: number;
  reflects: number;
  steals: number;
}

const moonGuideId = Object.values(data.cards).find(
  (card) => card.name === "Nguyệt Quang Dẫn",
)?.id;

// Greedy heuristic: play the first playable card (first valid target),
// end turn when nothing is playable. Not optimal — a floor for difficulty.
function simulate(
  gameData: GameData,
  heroIds: [string, string, string],
  encounterId: string,
  seed: number,
): SimResult {
  let { state } = createCombat(gameData, { heroIds, encounterId, seed });
  const sim: SimResult = {
    state,
    cardsPlayed: 0,
    levelUps: [],
    moonGuidePlays: 0,
    bondPlays: 0,
    bloodMoonTurns: 0,
    reflects: 0,
    steals: 0,
  };
  const record = (events: CombatEvent[]) => {
    events.forEach((event, index) => {
      const previous = events[index - 1];
      if (event.type === "heroLeveledUp") {
        sim.levelUps.push({ heroId: event.heroId, round: state.round });
      } else if (event.type === "hpLost" && event.cause === "reflect") {
        sim.reflects += 1;
      } else if (
        event.type === "statusApplied" &&
        previous?.type === "statusRemoved" &&
        previous.status === event.status &&
        previous.targetId !== event.targetId
      ) {
        sim.steals += 1;
      } else if (event.type === "turnStarted" && event.side === "hero" && state.bloodMoonRounds > 0) {
        sim.bloodMoonTurns += 1;
      }
    });
  };
  let actions = 0;

  while (state.status === "playerTurn" || state.status === "mulligan") {
    if (state.round > MAX_ROUNDS || actions >= MAX_ACTIONS) break;
    if (state.status === "mulligan") {
      const result = applyAction(gameData, state, { type: "mulligan", instanceIds: [] });
      if (!result.ok) break;
      state = result.state;
      record(result.events);
      actions += 1;
      continue;
    }
    let played = false;
    for (const instanceId of state.hand) {
      if (!isCardPlayable(gameData, state, instanceId)) continue;
      const card = gameData.cards[state.cards[instanceId]!.cardId]!;
      const targetId =
        card.target === "none" ? undefined : getValidTargets(gameData, state, instanceId)[0];
      if (card.target !== "none" && targetId === undefined) continue;
      const result = applyAction(gameData, state, {
        type: "playCard",
        instanceId,
        ...(targetId !== undefined ? { targetId } : {}),
      });
      if (!result.ok) continue;
      state = result.state;
      record(result.events);
      if (card.id === moonGuideId) sim.moonGuidePlays += 1;
      if (card.bond) sim.bondPlays += 1;
      actions += 1;
      sim.cardsPlayed += 1;
      played = true;
      break;
    }
    if (!played && state.status === "playerTurn") {
      const result = applyAction(gameData, state, { type: "endTurn" });
      if (!result.ok) break;
      state = result.state;
      record(result.events);
      actions += 1;
    }
  }
  sim.state = state;
  return sim;
}

function summarize(sim: SimResult) {
  const { state } = sim;
  return {
    kết_quả: state.status,
    vòng: state.round,
    lá_đánh: sim.cardsPlayed,
    NQ_Dẫn: sim.moonGuidePlays,
    Song_Hành: sim.bondPlays,
    HN_lượt: sim.bloodMoonTurns,
    phản: sim.reflects,
    cướp: sim.steals,
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
  for (const team of TEAMS) {
    for (const encounterId of Object.keys(data.encounters)) {
      it(`${team.join("+")} · ${encounterId} hoàn tất trong ${MAX_ROUNDS} vòng`, () => {
        const sims = seeds.map((seed) => simulate(data, team, encounterId, seed));
        console.log(`\n=== ${team.join("+")} · ${encounterId} ===`);
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
  }
});
