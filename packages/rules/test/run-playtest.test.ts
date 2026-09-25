import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};
import type { Action, CombatEvent, CombatState, GameData, RunAction, RunState } from "../src/index";
import {
  applyRunAction,
  createRun,
  findNode,
  getEffectiveCost,
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

// Phase 4a heuristic: mulligan cards above the doubling curve, Chiêm Bài picks
// the most expensive card affordable next round, plays costliest first,
// focuses lowest-HP enemy / lowest-ratio ally.
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
  const playable = state.hand
    .filter((id) => isCardPlayable(gameData, state, id))
    .sort(
      (a, b) =>
        getEffectiveCost(gameData, state, b) - getEffectiveCost(gameData, state, a),
    );
  for (const instanceId of playable) {
    const card = gameData.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const units: { id: string; hp: number; maxHp: number }[] =
      card.target === "enemy" ? state.enemies : state.heroes;
    const score = (id: string) => {
      const unit = units.find((u) => u.id === id)!;
      return card.target === "enemy" ? unit.hp : unit.hp / unit.maxHp;
    };
    const targetId = getValidTargets(gameData, state, instanceId).sort(
      (a, b) => score(a) - score(b),
    )[0];
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
}

function hpRatio(run: RunState): number {
  const hp = run.heroes.reduce((sum, h) => sum + h.hp, 0);
  return hp / run.heroes.reduce((sum, h) => sum + h.maxHp, 0);
}

// Healthy: fight, then treasure, then rest, elite last. Below 60% HP: rest first, elite never if avoidable.
function nodeScore(run: RunState, nodeId: string): number {
  const low = hpRatio(run) < 0.6;
  const type = findNode(run, nodeId)!.type;
  if (type === "rest") return low ? 0 : 2;
  if (type === "treasure") return 1;
  if (type === "elite") return low ? 9 : 3;
  return low ? 5 : 1;
}

function runAction(gameData: GameData, run: RunState): RunAction {
  switch (run.status) {
    case "map":
      return {
        type: "chooseNode",
        nodeId: reachableNodeIds(run).sort((a, b) => nodeScore(run, a) - nodeScore(run, b))[0]!,
      };
    case "combat":
      return { type: "combat", action: combatAction(gameData, run.combat!) };
    case "reward":
      return { type: "pickCard", cardId: run.pendingReward!.cardChoices[0] ?? null };
    case "rest": {
      if (hpRatio(run) < 0.6 || run.deck.length <= gameData.runConfig.minDeckSize) {
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

interface TierStats {
  fights: number;
  won: number;
  lost: number;
  rounds: number;
  turns: number;
  clogTurns: number;
  reserveSum: number;
  reserveSamples: number;
  enemyIntentSum: number;
  enemyIntentSamples: number;
  deckedOut: number;
}

function emptyTierStats(): TierStats {
  return {
    fights: 0,
    won: 0,
    lost: 0,
    rounds: 0,
    turns: 0,
    clogTurns: 0,
    reserveSum: 0,
    reserveSamples: 0,
    enemyIntentSum: 0,
    enemyIntentSamples: 0,
    deckedOut: 0,
  };
}

function simulateRun(heroIds: [string, string, string], seed: number) {
  let run = createRun(data, { heroIds, seed }).run;
  let fights = 0;
  let stalled = false;
  const tiers = new Map<string, TierStats>();
  let currentTier: string | null = null;
  let lastCombat: CombatState | null = null;
  const record = (events: CombatEvent[], state: CombatState | null) => {
    for (const event of events) {
      if (state === null || currentTier === null) continue;
      const tier = tiers.get(currentTier) ?? emptyTierStats();
      tiers.set(currentTier, tier);
      if (event.type === "turnStarted" && event.side === "hero") {
        tier.turns += 1;
        tier.reserveSum += state.moonReserve;
        tier.reserveSamples += 1;
        if (
          state.hand.length === data.combatConfig.handSize &&
          state.hand.every((id) => !isCardPlayable(data, state, id))
        ) {
          tier.clogTurns += 1;
        }
      } else if (event.type === "turnStarted" && event.side === "enemy") {
        for (const enemy of state.enemies) {
          if (!enemy.alive) continue;
          tier.enemyIntentSum += enemy.plannedIntents.length;
          tier.enemyIntentSamples += 1;
        }
      } else if (event.type === "deckedOut") {
        tier.deckedOut += 1;
      } else if (event.type === "combatEnded") {
        tier.rounds += state.round;
        if (event.result === "won") tier.won += 1;
        else tier.lost += 1;
      }
    }
  };
  for (let step = 0; step < MAX_STEPS; step++) {
    if (run.status === "won" || run.status === "lost") break;
    if (run.status === "combat" && run.combat!.round > MAX_COMBAT_ROUNDS) {
      stalled = true;
      break;
    }
    const result = applyRunAction(data, run, runAction(data, run));
    if (!result.ok) throw new Error(`run action rejected: ${result.error}`);
    for (const e of result.runEvents) {
      if (e.type === "nodeEntered") {
        if (e.nodeType === "combat" || e.nodeType === "elite" || e.nodeType === "boss") {
          currentTier = e.nodeType === "combat" ? "normal" : e.nodeType;
          const tier = tiers.get(currentTier) ?? emptyTierStats();
          tier.fights += 1;
          tiers.set(currentTier, tier);
          fights += 1;
        }
      }
    }
    if (result.run.combat !== null) lastCombat = result.run.combat;
    record(result.events, result.run.combat ?? lastCombat);
    run = result.run;
  }
  return {
    result: stalled ? "stalled" : run.status,
    floor: run.position ? findNode(run, run.position)!.floor : 0,
    fights,
    deck: run.deck.length,
    relics: run.runRelicIds.length,
    hp: run.heroes.map((h) => `${h.defId}:${h.hp}/${h.maxHp}`).join(" "),
    tiers,
  };
}

const allTierStats = new Map<string, Map<string, TierStats>>();

describe("run playtest", () => {
  for (const team of TEAMS) {
    it(`${team.join("+")} chạy trọn lượt chơi`, () => {
      const rows = SEEDS.map((seed) => {
        const { tiers, ...row } = simulateRun(team, seed);
        allTierStats.set(`${team.join("+")}#${seed}`, tiers);
        return { seed, ...row };
      });
      console.log(`\n=== run · ${team.join("+")} ===`);
      console.table(rows);
      for (const row of rows) expect(["won", "lost", "stalled"]).toContain(row.result);
    });
  }

  it("tổng hợp theo tier trận", () => {
    const merged = new Map<string, TierStats>();
    for (const tiers of allTierStats.values()) {
      for (const [tier, stats] of tiers) {
        const m = merged.get(tier) ?? emptyTierStats();
        for (const key of Object.keys(m) as (keyof TierStats)[]) {
          m[key] += stats[key];
        }
        merged.set(tier, m);
      }
    }
    const rows = [...merged.entries()].map(([tier, s]) => ({
      tier,
      trận: s.fights,
      "thắng%": s.fights > 0 ? `${((s.won / s.fights) * 100).toFixed(0)}%` : "—",
      vòng_TB: s.fights > 0 ? (s.rounds / s.fights).toFixed(1) : "—",
      "cạn_bài%": s.fights > 0 ? `${((s.deckedOut / s.fights) * 100).toFixed(0)}%` : "—",
      "kẹt_tay%": `${((s.clogTurns / Math.max(1, s.turns)) * 100).toFixed(0)}%`,
      DT_TB: s.reserveSamples > 0 ? (s.reserveSum / s.reserveSamples).toFixed(1) : "—",
      chiêu_địch_TB:
        s.enemyIntentSamples > 0
          ? (s.enemyIntentSum / s.enemyIntentSamples).toFixed(1)
          : "—",
    }));
    console.log("\n=== theo tier trận (toàn bộ run) ===");
    console.table(rows);
  });
});
