import { loadGameData } from "data";
import type { GameData, Profile, RunResult } from "../src/index";
import {
  applyRunAction, applyRunResult, applyRunRewards, buyShopItem, claimMission, createProfile, createRun, grantStarterGift,
  nextRandom, pendingUnlocks, pullMany, starterDeck, summarizeRun, unlockCard,
} from "../src/index";
import { runAction } from "./playtest-bot";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};

// Phase 4d economy simulation (`15` §8): a player doing 2 runs a day with the starter
// deck, claiming every mission, pulling whenever moon jade allows, for 60 days.
const data = loadGameData();
export const PLAYERS = 200;
const DAYS = 60;
const RUNS_PER_DAY = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 00:00 UTC Monday 2026-09-28 (a day and a week both start at 21:00 UTC the day before). */
const START = Date.UTC(2026, 8, 28, 0);
const BANNER = "banner_heroes";
const RUN_SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

type Team = [string, string, string];
/** Teams the player uses, best first; the first one fully owned is taken. */
const TEAMS: Team[] = [["m05", "f03", "f02"], ["m05", "f03", "f04"], ["m06", "f02", "f03"], ["m05", "f04", "m06"]];

function playBotRun(team: Team, seed: number): RunResult {
  let run = createRun(data, { heroIds: team, seed, deckCardIds: starterDeck(data, team) }).run;
  for (let step = 0; step < 20000 && run.status !== "won" && run.status !== "lost"; step++) {
    if (run.status === "combat" && run.combat!.round > 60) break;
    const result = applyRunAction(data, run, runAction(data, run));
    if (!result.ok) throw new Error(result.error);
    run = result.run;
  }
  return summarizeRun(data, run);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

export interface EconomyStats {
  allHeroesDay: number[];
  firstLegendaryDay: number[];
  neverLegendary: number;
  jadePerDay: number;
  pullsPerDay: number;
  constellationAt: Map<number, Record<string, number[]>>;
}

/** Runs the virtual players on `data` (economy numbers may differ from the shipped data). */
export function simulateEconomy(data: GameData, outcomes: Map<string, RunResult[]>): EconomyStats {
  const allHeroesDay: number[] = [];
  const firstLegendaryDay: number[] = [];
  const constellationAt = new Map<number, Record<string, number[]>>([[7, {}], [30, {}], [60, {}]]);
  let jadeEarned = 0;
  let pulls = 0;
  let neverLegendary = 0;

  for (let player = 0; player < PLAYERS; player++) {
    let rng = 1000 + player;
    const draw = () => {
      const next = nextRandom(rng);
      rng = next.rngState;
      return next.value;
    };
    let profile: Profile = grantStarterGift(data, createProfile(data)).profile;
    let allDay: number | null = null;
    let legendaryDay: number | null = null;

    for (let day = 0; day < DAYS; day++) {
      const now = START + day * DAY_MS + 2 * 60 * 60 * 1000;
      for (let run = 0; run < RUNS_PER_DAY; run++) {
        const team = TEAMS.find((candidate) => candidate.every((id) => profile.heroes[id]))!;
        const pool = outcomes.get(team.join("+"))!;
        const result = pool[Math.floor(draw() * pool.length)]!;
        const mastery = applyRunResult(data, profile, result).profile;
        profile = applyRunRewards(data, mastery, result, { now: now + run * 60_000, starterDeck: true }).profile;
      }
      for (const heroId of Object.keys(profile.heroes)) {
        while (pendingUnlocks(data, profile, heroId) > 0) {
          const hero = profile.heroes[heroId]!;
          const cardId = data.heroes[heroId]!.lockedCardIds.find((id) => !hero.unlockedCardIds.includes(id))!;
          const unlocked = unlockCard(data, profile, heroId, cardId);
          if (!unlocked.ok) break;
          profile = unlocked.profile;
        }
      }
      for (const missionId of Object.keys(data.missions)) {
        const claimed = claimMission(data, profile, missionId, now);
        if (claimed.ok) profile = claimed.profile;
      }
      for (const item of data.economyConfig.moonStarShop) {
        const heroId = Object.values(data.heroes).find((hero) => item.item.type === "heroChoice" && hero.rarity === item.item.rarity && !profile.heroes[hero.id])?.id;
        if (item.item.type === "heroChoice" && heroId === undefined) continue;
        for (let bought = buyShopItem(data, profile, item.id, now, heroId); bought.ok; bought = buyShopItem(data, profile, item.id, now, heroId)) {
          profile = bought.profile;
          if (item.item.type === "heroChoice") break;
        }
      }
      const cost = data.economyConfig.pullCost;
      while (profile.currencies.moonJade >= cost) {
        const count = profile.currencies.moonJade >= cost * 10 ? 10 : 1;
        const pulled = pullMany(data, profile, BANNER, count, Math.floor(draw() * 2 ** 32), now);
        if (!pulled.ok) throw new Error(pulled.error);
        pulls += count;
        profile = pulled.profile;
        if (legendaryDay === null && pulled.results.some((entry) => entry.rarity === "legendary")) legendaryDay = day;
      }
      if (allDay === null && Object.keys(data.heroes).every((id) => profile.heroes[id])) allDay = day;
      const snapshot = constellationAt.get(day + 1);
      if (snapshot) {
        for (const heroId of Object.keys(data.heroes)) {
          (snapshot[heroId] ??= []).push(profile.heroes[heroId]?.constellation ?? -1);
        }
      }
    }
    // Everything earned but the starter gift: what was spent on pulls plus what is left.
    jadeEarned += profile.stats.gachaPulls! * data.economyConfig.pullCost + profile.currencies.moonJade - data.economyConfig.starterGift.moonJade;
      allHeroesDay.push(allDay ?? DAYS);
    if (legendaryDay === null) neverLegendary += 1;
    firstLegendaryDay.push(legendaryDay ?? DAYS);
  }

  return {
    allHeroesDay, firstLegendaryDay, neverLegendary,
    jadePerDay: jadeEarned / PLAYERS / DAYS, pullsPerDay: pulls / PLAYERS / DAYS, constellationAt,
  };
}

export function botOutcomes(): Map<string, RunResult[]> {
  return new Map(TEAMS.map((team) => [team.join("+"), RUN_SEEDS.map((seed) => playBotRun(team, seed))]));
}

export function printEconomy(title: string, stats: EconomyStats): void {
  const { allHeroesDay, firstLegendaryDay, neverLegendary, constellationAt } = stats;
  const byDay7 = allHeroesDay.filter((day) => day < 7).length / PLAYERS;
  console.log(`\n=== ${title} ===`);
  console.table([{
    "đủ 5 Hero trước ngày 7": `${(byDay7 * 100).toFixed(0)}%`,
    "ngày đủ 5 Hero (trung vị / p90)": `${percentile(allHeroesDay, 0.5)} / ${percentile(allHeroesDay, 0.9)}`,
    "Legendary đầu (TB / trung vị)": `${(firstLegendaryDay.reduce((a, b) => a + b, 0) / PLAYERS).toFixed(1)} / ${percentile(firstLegendaryDay, 0.5)}`,
    "chưa ra Legendary": neverLegendary,
    "Nguyệt Ngọc/ngày": stats.jadePerDay.toFixed(0),
    "lượt quay/ngày": stats.pullsPerDay.toFixed(2),
  }]);
  console.log("\n=== Tinh Hồn TB theo Hero (−1 = chưa sở hữu, tính như 0 khi lấy TB) ===");
  console.table([...constellationAt.entries()].map(([day, byHero]) => ({
    ngày: day,
    ...Object.fromEntries(Object.entries(byHero).map(([heroId, values]) => [
      data.heroes[heroId]!.name,
      (values.reduce((sum, value) => sum + Math.max(0, value), 0) / values.length).toFixed(1),
    ])),
  })));
}

