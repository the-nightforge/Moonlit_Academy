import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};
import type { CombatEvent, CombatState, GameData, Loadout, RunAction, RunSetup } from "../src/index";
import { applyRunAction, createRun, findNode, isCardPlayable, replayRun, shuffle, starterDeck } from "../src/index";
import { runAction } from "./playtest-bot";

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

function simulateRun(heroIds: [string, string, string], seed: number, deckCardIds: string[], loadout?: Loadout) {
  const setup: RunSetup = { heroIds, seed, deckCardIds };
  let run = createRun(data, setup, loadout).run;
  const actions: RunAction[] = [];
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
    const action = runAction(data, run);
    const result = applyRunAction(data, run, action);
    if (result.ok) actions.push(action);
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
  // Server replay (`14` §4.2): the recorded actions rebuild exactly this run.
  if (!stalled) expect(replayRun(data, setup, actions, loadout)).toEqual({ ok: true, run });
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

  // Phase 4d (`15` §8): every hero at the same Tinh Hồn, starter deck; C0 vs C6 within 15 points.
  it("thắng lượt theo Tinh Hồn 0 / 2 / 4 / 6", { timeout: 600_000 }, () => {
    const rows = [0, 2, 4, 6].map((constellation) => {
      let won = 0;
      let floorSum = 0;
      let runs = 0;
      for (const team of TEAMS) {
        const loadout: Loadout = {
          heroes: Object.fromEntries(team.map((id) => [id, { constellation, levelUpForm: "base" as const }])),
        };
        for (const seed of SEEDS) {
          const row = simulateRun(team, seed, starterDeck(data, team), loadout);
          runs += 1;
          floorSum += row.floor;
          if (row.result === "won") won += 1;
        }
      }
      return { "Tinh Hồn": constellation, lượt: runs, "thắng%": `${((won / runs) * 100).toFixed(0)}%`, tầng_TB: (floorSum / runs).toFixed(1) };
    });
    console.log("\n=== Bộ cơ bản theo Tinh Hồn (mọi Hero cùng cấp) ===");
    console.table(rows);
  });

  // Phase 4e (`15` §8): each weapon / moon relic at R1 and R5 on the starter deck;
  // at R1 no piece may raise the win rate by more than 10 points. Slow: opt in with PLAYTEST_GEAR=1.
  const gearEnabled = Boolean((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PLAYTEST_GEAR);
  it.skipIf(!gearEnabled)("thắng lượt theo từng vũ khí / Nguyệt Bảo (R1, R5)", { timeout: 3_600_000 }, () => {
    const gearPlayed = new Set<string>();
    const measure = (build: (team: [string, string, string]) => { deck: string[]; loadout?: Loadout }) => {
      let won = 0;
      let floorSum = 0;
      let runs = 0;
      for (const team of TEAMS) {
        const { deck, loadout } = build(team);
        for (const seed of SEEDS) {
          const row = simulateRun(team, seed, deck, loadout);
          for (const cardId of row.played) gearPlayed.add(cardId);
          runs += 1;
          floorSum += row.floor;
          if (row.result === "won") won += 1;
        }
      }
      return { winRate: (won / runs) * 100, floor: floorSum / runs };
    };
    const bare = (team: [string, string, string]): Loadout => ({
      heroes: Object.fromEntries(team.map((id) => [id, { constellation: 0, levelUpForm: "base" as const }])),
    });
    const baseline = measure((team) => ({ deck: starterDeck(data, team) }));
    const rows: Record<string, string | number>[] = [{ món: "— Bộ cơ bản —", R: "-", "thắng%": baseline.winRate.toFixed(0), "chênh": 0, tầng_TB: baseline.floor.toFixed(1) }];
    const flagged: string[] = [];
    for (const weapon of Object.values(data.weapons)) {
      for (const level of [1, 5]) {
        const result = measure((team) => {
          // The signature hero carries its weapon when in the team; otherwise the first hero.
          const wearer = weapon.signatureHeroId && team.includes(weapon.signatureHeroId) ? weapon.signatureHeroId : team[0];
          const deck = starterDeck(data, team);
          const drop = deck.map((cardId, index) => ({ cardId, index })).filter((entry) => data.cards[entry.cardId]!.ownerId === wearer).at(-1)!.index;
          const loadout = bare(team);
          loadout.heroes[wearer] = { ...loadout.heroes[wearer]!, weaponId: weapon.id, refinement: level };
          return { deck: deck.filter((_, index) => index !== drop), loadout };
        });
        const delta = result.winRate - baseline.winRate;
        if (level === 1 && delta > 10) flagged.push(weapon.name);
        rows.push({ món: weapon.name, R: level, "thắng%": result.winRate.toFixed(0), "chênh": Number(delta.toFixed(0)), tầng_TB: result.floor.toFixed(1) });
      }
    }
    for (const relic of Object.values(data.relics)) {
      for (const level of [1, 5]) {
        const result = measure((team) => ({ deck: starterDeck(data, team), loadout: { ...bare(team), relics: [{ id: relic.id, resonance: level }] } }));
        const delta = result.winRate - baseline.winRate;
        if (level === 1 && delta > 10) flagged.push(relic.name);
        rows.push({ món: relic.name, R: level, "thắng%": result.winRate.toFixed(0), "chênh": Number(delta.toFixed(0)), tầng_TB: result.floor.toFixed(1) });
      }
    }
    console.log("\n=== Trang bị trên Bộ cơ bản (4 đội × 20 seed mỗi dòng) ===");
    console.table(rows);
    const unplayed = Object.values(data.weapons).filter((weapon) => !gearPlayed.has(weapon.id)).map((weapon) => weapon.name);
    console.log(`\n=== lá Binh Khí chưa từng được đánh: ${unplayed.join(", ") || "— không có —"} ===`);
    console.log(`=== vượt +10 điểm ở R1: ${flagged.join(", ") || "— không có —"} ===`);
  });

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
