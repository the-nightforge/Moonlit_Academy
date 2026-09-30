import { loadGameData } from "data";
import type { GameData, Profile, RunResult } from "../src/index";
import {
  applyCoopResult, applyPvpResult, applyRunAction, applyRunResult, applyRunRewards, applyStoryResult, buyHonorItem,
  buyShopItem, claimMission, createProfile, createRun, grantStarterGift, nextRandom, pendingUnlocks, pullMany,
  starterDeck, summarizeRun, unlockCard, unlockedStageIds, upgradeItem,
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
  // Phase 7d (`18` §5.5): material-only weapon progression + story income.
  /** Day index each player's dedicated Epic track reached R5 (DAYS if never). */
  epicR5Day: number[];
  /** Day index each player's dedicated Legendary track reached R5 (DAYS if never). */
  legendaryR5Day: number[];
  /** Per-player totals from story `firstClear` over the 16 stages. */
  storyMoonJade: number;
  storyDarkIron: number;
  darkIronPerDay: number;
}

/** `14` rarity ladder — highest first for the "highest-rarity owned weapon" upgrade pick. */
const RARITY_RANK: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };

/** Runs the virtual players on `data` (economy numbers may differ from the shipped data). */
export function simulateEconomy(data: GameData, outcomes: Map<string, RunResult[]>): EconomyStats {
  const allHeroesDay: number[] = [];
  const firstLegendaryDay: number[] = [];
  const epicR5Day: number[] = [];
  const legendaryR5Day: number[] = [];
  const constellationAt = new Map<number, Record<string, number[]>>([[7, {}], [30, {}], [60, {}]]);
  let jadeEarned = 0;
  let pulls = 0;
  let neverLegendary = 0;
  let storyJadeEarned = 0;
  let storyIronEarned = 0;
  let ironEarned = 0;

  for (let player = 0; player < PLAYERS; player++) {
    let rng = 1000 + player;
    const draw = () => {
      const next = nextRandom(rng);
      rng = next.rngState;
      return next.value;
    };
    let profile: Profile = grantStarterGift(data, createProfile(data)).profile;
    // Phase 7d (`18` §5.5): two dedicated upgrade tracks — one Epic, one Legendary
    // weapon received at R1 on day 0. The weapon banner is never pulled in this
    // variant, so progress is material-only (no duplicate-gacha refinement). Each
    // track gets the same dark iron the player earns that day, then `upgradeItem`
    // pours it into the highest-rarity owned weapon until materials run out.
    const tracks = (["epic", "legendary"] as const).map((rarity) => {
      const weaponId = Object.values(data.weapons).find((weapon) => weapon.rarity === rarity)!.id;
      const trackProfile = createProfile(data);
      trackProfile.weapons[weaponId] = { refinement: 1 };
      return { rarity, weaponId, profile: trackProfile, r5Day: null as number | null };
    });
    let allDay: number | null = null;
    let legendaryDay: number | null = null;

    for (let day = 0; day < DAYS; day++) {
      const now = START + day * DAY_MS + 2 * 60 * 60 * 1000;
      let ironToday = 0;
      const team = TEAMS.find((candidate) => candidate.every((id) => profile.heroes[id]))!;
      const pool = outcomes.get(team.join("+"))!;
      for (let run = 0; run < RUNS_PER_DAY; run++) {
        const result = pool[Math.floor(draw() * pool.length)]!;
        const mastery = applyRunResult(data, profile, result).profile;
        const applied = applyRunRewards(data, mastery, result, { now: now + run * 60_000, starterDeck: true });
        ironToday += applied.rewards.darkIron;
        profile = applied.profile;
      }
      // Phase 7d: clear one not-yet-cleared story stage per day until all 16 are
      // done (`firstClear` via `applyStoryResult` — stage order = unlock order).
      const stageId = unlockedStageIds(data, profile).find((id) => !profile.story.cleared.includes(id));
      if (stageId !== undefined) {
        const cleared = applyStoryResult(
          data,
          profile,
          { stageId, seed: player * 97 + day, heroIds: team, deckCardIds: starterDeck(data, team) },
          true,
        );
        profile = cleared.profile;
        storyJadeEarned += cleared.rewards.moonJade;
        storyIronEarned += cleared.rewards.darkIron;
        ironToday += cleared.rewards.darkIron;
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
      // Phase 7d: pour the day's dark iron into each dedicated track — repeatedly
      // `upgradeItem` the highest-rarity owned weapon until out of materials.
      for (const track of tracks) {
        track.profile.currencies.darkIron += ironToday;
        for (;;) {
          const top = Object.keys(track.profile.weapons)
            .filter((id) => track.profile.weapons[id]!.refinement < 5)
            .sort((a, b) => RARITY_RANK[data.weapons[b]!.rarity]! - RARITY_RANK[data.weapons[a]!.rarity]!)[0];
          if (top === undefined) break;
          const upgraded = upgradeItem(data, track.profile, "weapon", top);
          if (!upgraded.ok) break;
          track.profile = upgraded.profile;
        }
        if (track.r5Day === null && track.profile.weapons[track.weaponId]!.refinement >= 5) track.r5Day = day;
      }
      ironEarned += ironToday;
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
    epicR5Day.push(tracks.find((track) => track.rarity === "epic")!.r5Day ?? DAYS);
    legendaryR5Day.push(tracks.find((track) => track.rarity === "legendary")!.r5Day ?? DAYS);
  }

  return {
    allHeroesDay, firstLegendaryDay, neverLegendary,
    jadePerDay: jadeEarned / PLAYERS / DAYS, pullsPerDay: pulls / PLAYERS / DAYS, constellationAt,
    epicR5Day, legendaryR5Day,
    storyMoonJade: storyJadeEarned / PLAYERS,
    storyDarkIron: storyIronEarned / PLAYERS,
    darkIronPerDay: ironEarned / PLAYERS / DAYS,
  };
}

export function botOutcomes(): Map<string, RunResult[]> {
  return new Map(TEAMS.map((team) => [team.join("+"), RUN_SEEDS.map((seed) => playBotRun(team, seed))]));
}

// Phase 5d — the dedicated PvP player (`17` §6.4): 6 ranked matches a day at a
// 50% win rate (~84 Vinh Dự/day, under the 120 cap), spending honor in the
// honor shop. Only the moonJade item converts to jade directly; tickets count
// separately in the report.
const PVP_MATCHES_PER_DAY = 6;

export interface PvpStats {
  honorPerDay: number;
  jadePerDay: number;
  pullsBought: number;
  relicTickets: number;
  heroTickets: number;
  honorLeft: number;
}

export function simulatePvp(data: GameData): PvpStats {
  let profile = createProfile(data);
  let honor = 0;
  let pullsBought = 0;
  let relicTickets = 0;
  let heroTickets = 0;
  for (let day = 0; day < DAYS; day++) {
    const now = START + day * DAY_MS + 14 * 60 * 60 * 1000;
    for (let game = 0; game < PVP_MATCHES_PER_DAY; game++) {
      const applied = applyPvpResult(data, profile, {
        result: game % 2 === 0 ? "won" : "lost",
        reason: "combat",
        round: 9,
        now: now + game * 10 * 60_000,
        ratingDelta: 0,
      });
      honor += applied.honor;
      profile = applied.profile;
    }
    // Spend in shop order each day: a pull, then the monthly hero ticket, then
    // the weekly relic ticket — repeats until nothing is affordable/allowed.
    for (;;) {
      let boughtSomething = false;
      for (const item of data.pvpConfig.honorShop ?? []) {
        const reward = item.item;
        const pick =
          reward.type === "heroChoice"
            ? { heroId: Object.values(data.heroes).find((h) => h.rarity === reward.rarity && !profile.heroes[h.id])?.id }
            : reward.type === "relicChoice"
              ? { relicId: Object.values(data.relics).find((r) => r.rarity === reward.rarity)?.id }
              : undefined;
        const bought = buyHonorItem(data, profile, item.id, now + 12 * 60 * 60 * 1000, pick);
        if (!bought.ok) continue;
        profile = bought.profile;
        boughtSomething = true;
        if (reward.type === "moonJade") pullsBought += 1;
        else if (reward.type === "heroChoice") heroTickets += 1;
        else relicTickets += 1;
      }
      if (!boughtSomething) break;
    }
  }
  return {
    honorPerDay: honor / DAYS,
    jadePerDay: pullsBought * 160 / DAYS,
    pullsBought,
    relicTickets,
    heroTickets,
    honorLeft: profile.currencies.honor,
  };
}

export function printPvp(stats: PvpStats, pveJadePerDay: number): void {
  console.log(`\n=== Người chơi PvP: ${PVP_MATCHES_PER_DAY} trận xếp hạng/ngày, thắng 50% × ${DAYS} ngày ===`);
  console.table([{
    "Vinh Dự/ngày": stats.honorPerDay.toFixed(1),
    "Nguyệt Ngọc quy đổi/ngày (cửa hàng Vinh Dự)": stats.jadePerDay.toFixed(1),
    "Nguyệt Ngọc/ngày người chỉ PvE": pveJadePerDay.toFixed(0),
    "lượt quay đã mua": stats.pullsBought,
    "vé Hero Epic": stats.heroTickets,
    "vé Nguyệt Bảo Rare": stats.relicTickets,
    "Vinh Dự dư": stats.honorLeft,
  }]);
}

// Phase 6b — the co-op player (`17` §9.2): one queue match a day at the boss's
// target win band for starter teams (`17` §8.8: 35–50%). Wins pay `rewards.win`
// plus `firstWinOfDay` on the day's first clear; losses pay `rewards.loss`.
// `rewardedMatchesPerDay` (3) is never reached at one match a day.
const COOP_WINS_PER_5_DAYS = 2; // 40% — middle of the §8.8 target band.

export interface CoopStats {
  jadePerDay: number;
  dustPerDay: number;
}

export function simulateCoop(data: GameData): CoopStats {
  let profile = createProfile(data);
  let jade = 0;
  let dust = 0;
  for (let day = 0; day < DAYS; day++) {
    const now = START + day * DAY_MS + 20 * 60 * 60 * 1000;
    const applied = applyCoopResult(data, profile, {
      result: day % 5 < COOP_WINS_PER_5_DAYS ? "won" : "lost",
      forfeited: false,
      now,
    });
    if (applied.rewards) {
      jade += applied.rewards.moonJade;
      dust += applied.rewards.moonDust;
    }
    profile = applied.profile;
  }
  return { jadePerDay: jade / DAYS, dustPerDay: dust / DAYS };
}

export function printCoop(stats: CoopStats, pveJadePerDay: number): void {
  console.log(`\n=== Người chơi Liên Thủ: 1 trận hàng chờ/ngày, thắng ${COOP_WINS_PER_5_DAYS}/5 × ${DAYS} ngày ===`);
  console.table([{
    "Nguyệt Ngọc/ngày (co-op)": stats.jadePerDay.toFixed(1),
    "Nguyệt Trần/ngày": stats.dustPerDay.toFixed(1),
    "Nguyệt Ngọc/ngày người chỉ PvE": pveJadePerDay.toFixed(0),
    "trần cho phép (+20%)": (pveJadePerDay * 0.2).toFixed(1),
  }]);
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

/**
 * Phase 7d (`18` §5.5): material-only upgrade pace and story income.
 * Targets — Epic R1→R5 in ~3–4 weeks (day 21–28), Legendary ~6–8 weeks
 * (day 42–56), story moon jade shifts the 4d pull cadence by ≤15%.
 */
export function printGearEconomy(stats: EconomyStats): void {
  const pullCost = data.economyConfig.pullCost;
  const jadeNoStory = stats.jadePerDay - stats.storyMoonJade / DAYS;
  const cadence = pullCost / stats.jadePerDay;
  const cadenceNoStory = pullCost / jadeNoStory;
  const cadenceShift = (cadenceNoStory - cadence) / cadenceNoStory;
  console.log(`\n=== Vật liệu & Cốt truyện (7d.6 — chỉ tiến độ từ vật liệu, không quay Binh Khí Các) ===`);
  console.table([{
    "Epic R1→R5, ngày (trung vị / p90)": `${percentile(stats.epicR5Day, 0.5)} / ${percentile(stats.epicR5Day, 0.9)}`,
    "Legendary R1→R5, ngày (trung vị / p90)": `${percentile(stats.legendaryR5Day, 0.5)} / ${percentile(stats.legendaryR5Day, 0.9)}`,
    "chưa R5 sau 60 ngày (Epic / Leg)": `${stats.epicR5Day.filter((day) => day >= DAYS).length} / ${stats.legendaryR5Day.filter((day) => day >= DAYS).length}`,
    "Huyền Thiết/ngày": stats.darkIronPerDay.toFixed(1),
    "Nguyệt Ngọc Cốt truyện (tổng, 16 màn)": stats.storyMoonJade,
    "Huyền Thiết Cốt truyện (tổng)": stats.storyDarkIron,
    "Ngọc/ngày (có → không Cốt truyện)": `${stats.jadePerDay.toFixed(0)} → ${jadeNoStory.toFixed(0)}`,
    "tỉ trọng Cốt truyện trong thu 60 ngày": `${((stats.storyMoonJade / (stats.jadePerDay * DAYS)) * 100).toFixed(1)}%`,
    "nhịp quay (không → có Cốt truyện)": `${cadenceNoStory.toFixed(2)}d → ${cadence.toFixed(2)}d (lệch ${(cadenceShift * 100).toFixed(1)}%)`,
    "lượt quay/ngày": stats.pullsPerDay.toFixed(2),
  }]);
}

