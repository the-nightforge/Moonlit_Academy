import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};
import type { Action, CombatEvent, CombatState, Effect, GameData, RunAction, RunState } from "../src/index";
import {
  applyRunAction,
  createRun,
  findNode,
  getEffectiveCost,
  getValidTargets,
  isCardPlayable,
  reachableNodeIds,
  shuffle,
  starterDeck,
} from "../src/index";

const data = loadGameData();
const TEAMS: [string, string, string][] = [
  ["m05", "f04", "m06"],
  ["m05", "f03", "f02"],
  ["m06", "f02", "f03"],
  ["m05", "f03", "f04"],
];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
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

type DeckPlan = { label: string; split: [number, number, number]; branch: 0 | 1 };

function branchDeck(gameData: GameData, team: [string, string, string], plan: DeckPlan): string[] {
  return team.flatMap((heroId, index) => {
    const hero = gameData.heroes[heroId]!;
    const main = hero.branches[plan.branch].cardIds;
    const other = hero.branches[1 - plan.branch]!.cardIds;
    return [...main, ...other].slice(0, plan.split[index]);
  });
}

function randomDeck(gameData: GameData, team: [string, string, string], seed: number): string[] {
  let rng = seed;
  const pick = (ids: string[], n: number) => {
    const shuffled = shuffle(ids, rng);
    rng = shuffled.rngState;
    return shuffled.items.slice(0, n);
  };
  const pools = team.map((id) => [...gameData.heroes[id]!.cardIds, ...gameData.heroes[id]!.lockedCardIds]);
  const base = pools.flatMap((pool) => pick(pool, 4));
  const rest = pick(pools.flat().filter((id) => !base.includes(id)), gameData.metaConfig.deckSize - base.length);
  return [...base, ...rest];
}

const DECK_PLANS: DeckPlan[] = [
  { label: "nhánh A 6/6/6", split: [6, 6, 6], branch: 0 },
  { label: "nhánh B 6/6/6", split: [6, 6, 6], branch: 1 },
  { label: "nhánh A 4/4/10", split: [4, 4, 10], branch: 0 },
  { label: "nhánh B 8/5/5", split: [8, 5, 5], branch: 1 },
];

const DECK_VARIANTS: { label: string; build: (team: [string, string, string], seed: number) => string[] }[] = [
  { label: "Bộ cơ bản", build: (team) => starterDeck(data, team) },
  ...DECK_PLANS.map((plan) => ({ label: plan.label, build: (team: [string, string, string]) => branchDeck(data, team, plan) })),
  { label: "ngẫu nhiên", build: (team, seed) => randomDeck(data, team, seed * 7919) },
];

function simulateRun(heroIds: [string, string, string], seed: number, deckCardIds: string[]) {
  let run = createRun(data, { heroIds, seed, deckCardIds }).run;
  let fights = 0;
  let stalled = false;
  const played = new Set<string>();
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
      } else if (event.type === "cardPlayed") {
        const cardId = state.cards[event.instanceId]?.cardId;
        if (cardId !== undefined) played.add(cardId);
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
  const { perFloor, win, heroLevelUp } = data.metaConfig.masteryXp;
  const floor = run.position ? findNode(run, run.position)!.floor : 0;
  const xpAvg =
    run.heroes.reduce(
      (sum, h) => sum + perFloor * floor + (run.status === "won" ? win : 0) + heroLevelUp * (run.heroLevelUps[h.defId] ?? 0),
      0,
    ) / run.heroes.length;
  return {
    result: stalled ? "stalled" : run.status,
    floor,
    fights,
    deck: run.deck.length,
    relics: run.runRelicIds.length,
    hp: run.heroes.map((h) => `${h.defId}:${h.hp}/${h.maxHp}`).join(" "),
    tiers,
    played: [...played],
    xpAvg,
  };
}

interface DeckAgg {
  runs: number;
  won: number;
  stalled: number;
  floorSum: number;
  xpSum: number;
  tiers: Map<string, TierStats>;
}

const allDeckStats = new Map<string, DeckAgg>();
const playedCardIds = new Set<string>();

function mergeTiers(target: Map<string, TierStats>, source: Map<string, TierStats>) {
  for (const [tier, stats] of source) {
    const m = target.get(tier) ?? emptyTierStats();
    for (const key of Object.keys(m) as (keyof TierStats)[]) {
      m[key] += stats[key];
    }
    target.set(tier, m);
  }
}

function tierRow(deckLabel: string, tier: string, s: TierStats) {
  return {
    deck: deckLabel,
    tier,
    trận: s.fights,
    "thắng%": s.fights > 0 ? `${((s.won / s.fights) * 100).toFixed(0)}%` : "—",
    vòng_TB: s.fights > 0 ? (s.rounds / s.fights).toFixed(1) : "—",
    "cạn_bài%": s.fights > 0 ? `${((s.deckedOut / s.fights) * 100).toFixed(0)}%` : "—",
    "kẹt_tay%": `${((s.clogTurns / Math.max(1, s.turns)) * 100).toFixed(0)}%`,
    DT_TB: s.reserveSamples > 0 ? (s.reserveSum / s.reserveSamples).toFixed(1) : "—",
    chiêu_địch_TB: s.enemyIntentSamples > 0 ? (s.enemyIntentSum / s.enemyIntentSamples).toFixed(1) : "—",
  };
}

describe("run playtest", () => {
  for (const team of TEAMS) {
    it(`${team.join("+")} chạy trọn lượt chơi theo loại deck`, { timeout: 600_000 }, () => {
      const rows = DECK_VARIANTS.map((variant) => {
        const agg = allDeckStats.get(variant.label) ?? { runs: 0, won: 0, stalled: 0, floorSum: 0, xpSum: 0, tiers: new Map<string, TierStats>() };
        allDeckStats.set(variant.label, agg);
        let won = 0;
        let stalled = 0;
        let floorSum = 0;
        let xpSum = 0;
        for (const seed of SEEDS) {
          const { tiers, played, xpAvg, ...row } = simulateRun(team, seed, variant.build(team, seed));
          for (const cardId of played) playedCardIds.add(cardId);
          mergeTiers(agg.tiers, tiers);
          agg.runs += 1;
          agg.floorSum += row.floor;
          agg.xpSum += xpAvg;
          floorSum += row.floor;
          xpSum += xpAvg;
          if (row.result === "won") {
            won += 1;
            agg.won += 1;
          } else if (row.result === "stalled") {
            stalled += 1;
            agg.stalled += 1;
          }
          expect(["won", "lost", "stalled"]).toContain(row.result);
        }
        return {
          deck: variant.label,
          lượt: SEEDS.length,
          "thắng%": `${((won / SEEDS.length) * 100).toFixed(0)}%`,
          kẹt: stalled,
          tầng_TB: (floorSum / SEEDS.length).toFixed(1),
          XP_TB: (xpSum / SEEDS.length).toFixed(1),
        };
      });
      console.log(`\n=== run · ${team.join("+")} ===`);
      console.table(rows);
    });
  }

  it("tổng hợp theo loại deck", () => {
    const rows = [...allDeckStats.entries()].map(([label, agg]) => ({
      deck: label,
      lượt: agg.runs,
      "thắng%": `${((agg.won / Math.max(1, agg.runs)) * 100).toFixed(0)}%`,
      kẹt: agg.stalled,
      tầng_TB: (agg.floorSum / Math.max(1, agg.runs)).toFixed(1),
      XP_TB: (agg.xpSum / Math.max(1, agg.runs)).toFixed(1),
    }));
    console.log("\n=== theo loại deck (toàn bộ đội × seed 1–20) ===");
    console.table(rows);
    const tierRows = [...allDeckStats.entries()].flatMap(([label, agg]) =>
      [...agg.tiers.entries()].map(([tier, s]) => tierRow(label, tier, s)),
    );
    console.log("\n=== theo loại deck × tier trận ===");
    console.table(tierRows);
    const pool = Object.values(data.heroes).flatMap((h) => [...h.cardIds, ...h.lockedCardIds]);
    const neverPlayed = pool.filter((id) => !playedCardIds.has(id));
    console.log(`\n=== lá chưa từng được đánh (${neverPlayed.length}/${new Set(pool).size}) ===`);
    console.log(neverPlayed.map((id) => data.cards[id]?.name ?? id).join(", ") || "— không có —");
    const starter = allDeckStats.get("Bộ cơ bản");
    if (starter && starter.runs > 0) {
      const xpAvg = starter.xpSum / starter.runs;
      const pace = data.metaConfig.masteryLevels.at(-1)! / Math.max(1, xpAvg);
      console.log(`\n=== nhịp Tu Luyện: XP TB/lượt (Bộ cơ bản) ${xpAvg.toFixed(1)} → ~${pace.toFixed(1)} lượt tới cấp ${data.metaConfig.masteryLevels.length} ===`);
    }
  });
});
