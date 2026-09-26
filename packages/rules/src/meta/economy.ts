import { bondCardsForTeam } from "../create-combat";
import type { AchievementDef, GameData, PeriodCounters, Profile, RunResult } from "../types/index";
import { dayKey, weekKey } from "./periods";
import { emptyCounters, masteryLevel } from "./profile";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type Counts = Partial<Omit<PeriodCounters, "heroesUsed">>;

/** Starts a new day / week when `now` is past the stored ones (`14` §6). Mutates `profile`. */
function roll(data: GameData, profile: Profile, now: number): void {
  const missions = profile.missions;
  const today = dayKey(data, now);
  const thisWeek = weekKey(data, now);
  if (missions.dayKey !== today) {
    missions.dayKey = today;
    missions.daily = emptyCounters();
    missions.claimed = missions.claimed.filter((id) => data.missions[id]?.period !== "daily");
  }
  if (missions.weekKey !== thisWeek) {
    missions.weekKey = thisWeek;
    missions.weekly = emptyCounters();
    missions.claimed = missions.claimed.filter((id) => data.missions[id]?.period !== "weekly");
  }
  if (profile.shop.weekKey !== thisWeek) profile.shop = { weekKey: thisWeek, bought: {} };
}

/** Adds counts (and heroes) to both the daily and the weekly counters. Mutates `profile`. */
function addCounts(profile: Profile, counts: Counts, heroes: readonly string[] = []): void {
  for (const period of [profile.missions.daily, profile.missions.weekly]) {
    for (const [key, value] of Object.entries(counts) as [keyof Counts, number][]) period[key] += value;
    for (const heroId of heroes) if (!period.heroesUsed.includes(heroId)) period.heroesUsed.push(heroId);
  }
}

function achieved(data: GameData, profile: Profile, achievement: AchievementDef): boolean {
  const goal = achievement.goal;
  switch (goal.type) {
    case "runsWon":
      return (profile.stats.runsWon ?? 0) >= goal.count;
    case "bossKillWithBond":
      return (profile.stats[`bossKillBond.${goal.bondCardId}`] ?? 0) > 0;
    case "masteryLevel":
      return Object.values(profile.heroes).some((hero) => masteryLevel(data, hero.xp) >= goal.level);
    case "ownAllHeroes":
      return Object.keys(data.heroes).every((heroId) => profile.heroes[heroId] !== undefined);
    case "starterFloor":
      return (profile.stats.starterBestFloor ?? 0) >= goal.floor;
    case "allLockedUnlocked":
      return Object.entries(profile.heroes).every(
        ([heroId, hero]) => hero.unlockedCardIds.length >= data.heroes[heroId]!.lockedCardIds.length,
      );
    default: {
      const exhaustive: never = goal;
      throw new Error(`unknown achievement goal: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Grants every achievement newly reached (`14` §8). Mutates `profile`; returns the new ids. */
function grantAchievements(data: GameData, profile: Profile): string[] {
  const reached = Object.values(data.achievements).filter(
    (achievement) => !profile.achievements.includes(achievement.id) && achieved(data, profile, achievement),
  );
  for (const achievement of reached) {
    profile.achievements.push(achievement.id);
    profile.currencies.moonJade += achievement.reward.moonJade;
  }
  return reached.map((achievement) => achievement.id);
}

/** New account gift, once (`14` §5). A profile that already has it comes back unchanged. */
export function grantStarterGift(data: GameData, profile: Profile): { ok: true; profile: Profile; granted: boolean } {
  if (profile.flags.starterGiftClaimed) return { ok: true, profile, granted: false };
  const next = clone(profile);
  next.currencies.moonJade += data.economyConfig.starterGift.moonJade;
  next.flags.starterGiftClaimed = true;
  return { ok: true, profile: next, granted: true };
}

export interface RunRewards {
  /** Moon jade from the run itself (floors, win, first win of the day); achievements not included. */
  moonJade: number;
  firstWinOfDay: boolean;
  /** Achievements reached by this run. */
  achievements: string[];
}

/** Moon jade, counters, stats and achievements for a verified run (`14` §5). */
export function applyRunRewards(
  data: GameData,
  profile: Profile,
  result: RunResult,
  context: { now: number; starterDeck: boolean },
): { ok: true; profile: Profile; rewards: RunRewards } {
  const next = clone(profile);
  roll(data, next, context.now);
  const { moonJadePerFloor, moonJadeWin, firstWinOfDay } = data.economyConfig.runRewards;
  const firstWin = result.won && next.missions.daily.runsWon === 0;
  const moonJade = moonJadePerFloor * result.floorReached + (result.won ? moonJadeWin : 0) + (firstWin ? firstWinOfDay : 0);
  next.currencies.moonJade += moonJade;

  const wins = result.won ? 1 : 0;
  addCounts(next, { runsFinished: 1, floorsReached: result.floorReached, runsWon: wins, bossKills: wins }, result.heroIds);
  const stats = next.stats;
  stats.runsFinished = (stats.runsFinished ?? 0) + 1;
  stats.floorsTotal = (stats.floorsTotal ?? 0) + result.floorReached;
  if (result.won) {
    stats.runsWon = (stats.runsWon ?? 0) + 1;
    stats.bossKills = (stats.bossKills ?? 0) + 1;
    for (const bond of bondCardsForTeam(data, result.heroIds)) stats[`bossKillBond.${bond.id}`] = 1;
  }
  if (context.starterDeck) stats.starterBestFloor = Math.max(stats.starterBestFloor ?? 0, result.floorReached);

  const achievements = grantAchievements(data, next);
  return { ok: true, profile: next, rewards: { moonJade, firstWinOfDay: firstWin, achievements } };
}

/** Adds to this day's and week's counters, e.g. `{ gachaPulls: 10 }` (`14` §7). */
export function recordProgress(data: GameData, profile: Profile, now: number, counts: Counts): { ok: true; profile: Profile } {
  const next = clone(profile);
  roll(data, next, now);
  addCounts(next, counts);
  return { ok: true, profile: next };
}

/** Progress of a mission in its current period (after rolling to `now`). */
export function missionProgress(data: GameData, profile: Profile, missionId: string, now: number): number {
  const mission = data.missions[missionId];
  if (!mission) return 0;
  const view = clone(profile);
  roll(data, view, now);
  const counters = mission.period === "daily" ? view.missions.daily : view.missions.weekly;
  return mission.goal.type === "distinctHeroesUsed" ? counters.heroesUsed.length : counters[mission.goal.type];
}

export function claimMission(
  data: GameData,
  profile: Profile,
  missionId: string,
  now: number,
): { ok: true; profile: Profile } | { ok: false; error: string } {
  const mission = data.missions[missionId];
  if (!mission) return { ok: false, error: "unknown mission" };
  const next = clone(profile);
  roll(data, next, now);
  if (next.missions.claimed.includes(missionId)) return { ok: false, error: "already claimed" };
  if (missionProgress(data, next, missionId, now) < mission.goal.count) return { ok: false, error: "not complete" };
  next.missions.claimed.push(missionId);
  next.currencies.moonJade += mission.reward.moonJade;
  return { ok: true, profile: next };
}

/** Grants achievements reached by any change (unlock, pull, purchase) (`14` §8). */
export function checkAchievements(data: GameData, profile: Profile): { ok: true; profile: Profile; achievements: string[] } {
  const next = clone(profile);
  const achievements = grantAchievements(data, next);
  return { ok: true, profile: next, achievements };
}
