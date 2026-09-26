import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};
import type { Action, CombatEvent, CombatState, Effect, GameData } from "../src/index";
import {
  applyAction,
  createCombat,
  getEffectiveCost,
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
const MAX_ROUNDS = 60;
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
  deckedOut: boolean;
  stalled: boolean;
  turns: number;
  clogTurns: number;
  reserveSum: number;
  reserveSamples: number;
  enemyIntentSum: number;
  enemyIntentSamples: number;
}

const moonGuideId = Object.values(data.cards).find(
  (card) => card.name === "Nguyệt Quang Dẫn",
)?.id;

// Phase 4a heuristic: mulligan cards above the doubling curve, Chiêm Bài picks
// the most expensive card affordable next round, plays costliest first,
// focuses lowest-HP enemy / lowest-ratio ally. Not optimal — a floor for difficulty.
function combatAction(gameData: GameData, state: CombatState): Action {
  if (state.status === "mulligan") {
    const expensive = state.hand.filter(
      (id) => gameData.cards[state.cards[id]!.cardId]!.cost > 5,
    );
    return {
      type: "mulligan",
      instanceIds: expensive.slice(0, gameData.combatConfig.maxMulligan),
    };
  }
  if (state.status === "choosing") {
    const curve = gameData.combatConfig.moonPower;
    const nextFund =
      Math.min(curve.cap, curve.start + state.round * curve.perRound) +
      gameData.combatConfig.moonReserveMax;
    const options = [...state.pendingChoice!.options].sort(
      (a, b) =>
        gameData.cards[state.cards[b]!.cardId]!.cost -
        gameData.cards[state.cards[a]!.cardId]!.cost,
    );
    const pick =
      options.find(
        (id) => gameData.cards[state.cards[id]!.cardId]!.cost <= nextFund,
      ) ?? options[0]!;
    return { type: "chooseCard", instanceId: pick };
  }
  const keywordsOf = (id: string) => gameData.cards[state.cards[id]!.cardId]!.keywords ?? [];
  const heldThreshold = (id: string): number => {
    let best = 0;
    const walk = (effects: Effect[]) => {
      for (const effect of effects) {
        if (effect.type !== "conditional") continue;
        if (effect.condition.type === "heldTurnsAtLeast") best = Math.max(best, effect.condition.turns);
        walk(effect.then);
        walk(effect.else ?? []);
      }
    };
    walk(gameData.cards[state.cards[id]!.cardId]!.effects);
    return best;
  };
  const playable = state.hand.filter((id) => isCardPlayable(gameData, state, id));
  const ready = playable.filter((id) => state.cards[id]!.heldTurns >= heldThreshold(id));
  const candidates = ready.length > 0 || state.hand.length < gameData.combatConfig.handSize ? ready : playable;
  const ordered = [...candidates].sort((a, b) => {
    const comboA = keywordsOf(a).includes("lien_hoan") ? 1 : 0;
    const comboB = keywordsOf(b).includes("lien_hoan") ? 1 : 0;
    if (comboA !== comboB) return comboA - comboB; // non-combo cards first
    return getEffectiveCost(gameData, state, b) - getEffectiveCost(gameData, state, a);
  });
  for (const instanceId of ordered) {
    const card = gameData.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const targets = getValidTargets(gameData, state, instanceId);
    let targetId: string | undefined;
    if (card.target === "enemy") {
      const drains = keywordsOf(instanceId).some((k) => k === "toa_nguyet" || k === "doat_nguyet");
      const chainCost = (id: string) => state.enemies.find((e) => e.id === id)!.plannedIntents.reduce((s, p) => s + p.cost, 0);
      const hp = (id: string) => state.enemies.find((e) => e.id === id)!.hp;
      targetId = [...targets].sort((a, b) => (drains ? chainCost(b) - chainCost(a) : hp(a) - hp(b)))[0];
    } else {
      const burst = keywordsOf(instanceId).includes("tu_duoc");
      const regen = (id: string) => state.heroes.find((h) => h.id === id)!.statuses.find((s) => s.id === "regen")?.value ?? 0;
      const ratio = (id: string) => { const h = state.heroes.find((u) => u.id === id)!; return h.hp / h.maxHp; };
      const pool = burst ? targets.filter((id) => regen(id) >= 3) : targets;
      targetId = [...pool].sort((a, b) => ratio(a) - ratio(b))[0];
    }
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
}

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
    deckedOut: false,
    stalled: false,
    turns: 0,
    clogTurns: 0,
    reserveSum: 0,
    reserveSamples: 0,
    enemyIntentSum: 0,
    enemyIntentSamples: 0,
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
      } else if (event.type === "turnStarted" && event.side === "hero") {
        if (state.bloodMoonRounds > 0) sim.bloodMoonTurns += 1;
        sim.turns += 1;
        sim.reserveSum += state.moonReserve;
        sim.reserveSamples += 1;
        if (
          state.hand.length === gameData.combatConfig.handSize &&
          state.hand.every((id) => !isCardPlayable(gameData, state, id))
        ) {
          sim.clogTurns += 1;
        }
      } else if (event.type === "turnStarted" && event.side === "enemy") {
        for (const enemy of state.enemies) {
          if (!enemy.alive) continue;
          sim.enemyIntentSum += enemy.plannedIntents.length;
          sim.enemyIntentSamples += 1;
        }
      } else if (event.type === "deckedOut") {
        sim.deckedOut = true;
      }
    });
  };
  let actions = 0;

  while (
    state.status === "playerTurn" ||
    state.status === "mulligan" ||
    state.status === "choosing"
  ) {
    if (state.round > MAX_ROUNDS || actions >= MAX_ACTIONS) {
      sim.stalled = true;
      break;
    }
    const action = combatAction(gameData, state);
    const playedCardId =
      action.type === "playCard" ? state.cards[action.instanceId]!.cardId : null;
    const result = applyAction(gameData, state, action);
    if (!result.ok) break;
    state = result.state;
    record(result.events);
    actions += 1;
    if (playedCardId !== null) {
      sim.cardsPlayed += 1;
      const card = gameData.cards[playedCardId]!;
      if (card.id === moonGuideId) sim.moonGuidePlays += 1;
      if (card.bond) sim.bondPlays += 1;
    }
  }
  sim.state = state;
  return sim;
}

function summarize(sim: SimResult) {
  const { state } = sim;
  return {
    kết_quả: sim.stalled ? "stalled" : state.status,
    vòng: state.round,
    cạn_bài: sim.deckedOut ? "cạn" : "",
    kẹt_tay: `${sim.clogTurns}/${sim.turns}`,
    DT_TB: sim.reserveSamples > 0 ? (sim.reserveSum / sim.reserveSamples).toFixed(1) : "—",
    chiêu_địch_TB:
      sim.enemyIntentSamples > 0
        ? (sim.enemyIntentSum / sim.enemyIntentSamples).toFixed(1)
        : "—",
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

const aggregateRows: {
  đội: string;
  tier: string;
  seed: number;
  kết_quả: string;
  vòng: number;
  cạn_bài: boolean;
  kẹt_tay_lượt: number;
  lượt: number;
  DT_TB: number;
  chiêu_địch_TB: number;
}[] = [];

describe("playtest", () => {
  const seeds = [42, 7, 2024];
  for (const team of TEAMS) {
    for (const encounterId of Object.keys(data.encounters)) {
      it(`${team.join("+")} · ${encounterId} hoàn tất trong ${MAX_ROUNDS} vòng`, () => {
        const sims = seeds.map((seed) => simulate(data, team, encounterId, seed));
        console.log(`\n=== ${team.join("+")} · ${encounterId} ===`);
        console.table(sims.map((sim, index) => ({ seed: seeds[index], ...summarize(sim) })));
        const tier = data.encounters[encounterId]!.tier;
        sims.forEach((sim, index) => {
          aggregateRows.push({
            đội: team.join("+"),
            tier,
            seed: seeds[index]!,
            kết_quả: sim.stalled ? "stalled" : sim.state.status,
            vòng: sim.state.round,
            cạn_bài: sim.deckedOut,
            kẹt_tay_lượt: sim.clogTurns,
            lượt: sim.turns,
            DT_TB: sim.reserveSamples > 0 ? sim.reserveSum / sim.reserveSamples : 0,
            chiêu_địch_TB:
              sim.enemyIntentSamples > 0
                ? sim.enemyIntentSum / sim.enemyIntentSamples
                : 0,
          });
        });
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

  it("tổng hợp theo tier và theo đội", () => {
    const group = (key: (row: (typeof aggregateRows)[number]) => string) => {
      const buckets = new Map<string, typeof aggregateRows>();
      for (const row of aggregateRows) {
        const k = key(row);
        buckets.set(k, [...(buckets.get(k) ?? []), row]);
      }
      return [...buckets.entries()].map(([k, rows]) => {
        const n = rows.length;
        const avg = (sum: number) => (sum / n).toFixed(2);
        return {
          nhóm: k,
          trận: n,
          "thắng%": `${((rows.filter((r) => r.kết_quả === "won").length / n) * 100).toFixed(0)}%`,
          vòng_TB: avg(rows.reduce((s, r) => s + r.vòng, 0)),
          "cạn_bài%": `${((rows.filter((r) => r.cạn_bài).length / n) * 100).toFixed(0)}%`,
          "kẹt_tay%": `${(
            (rows.reduce((s, r) => s + r.kẹt_tay_lượt, 0) /
              Math.max(1, rows.reduce((s, r) => s + r.lượt, 0))) *
            100
          ).toFixed(0)}%`,
          DT_TB: avg(rows.reduce((s, r) => s + r.DT_TB, 0)),
          chiêu_địch_TB: avg(rows.reduce((s, r) => s + r.chiêu_địch_TB, 0)),
        };
      });
    };
    console.log("\n=== theo tier trận ===");
    console.table(group((row) => row.tier));
    console.log("\n=== theo đội ===");
    console.table(group((row) => row.đội));
  });
});
