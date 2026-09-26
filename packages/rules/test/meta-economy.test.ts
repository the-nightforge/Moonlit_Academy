import { describe, expect, it } from "vitest";
import type { GameData, Profile, RunResult } from "../src/index";
import {
  applyRunRewards, checkAchievements, claimMission, createProfile, dayKey, grantStarterGift,
  missionProgress, recordProgress, weekKey,
} from "../src/index";
import { ownAllHeroes, testData } from "./helpers";

const HOUR = 60 * 60 * 1000;
/** Sunday 2026-09-27 20:59 UTC = Monday 03:59 in Vietnam: still Sunday's game day. */
const SUNDAY_LATE = Date.UTC(2026, 8, 27, 20, 59);
const TEAM: [string, string, string] = ["m05", "f04", "m06"];

function result(overrides: Partial<RunResult> = {}): RunResult {
  return { heroIds: TEAM, floorReached: 3, won: false, heroLevelUps: {}, ...overrides };
}

function rewards(data: GameData, profile: Profile, run: RunResult, now = SUNDAY_LATE, starterDeck = false) {
  return applyRunRewards(data, profile, run, { now, starterDeck });
}

describe("economy: gift, run rewards, periods, missions, achievements", () => {
  it("T183: the starter gift comes once; runs pay moon jade by floor and win, the first win of each day pays more", () => {
    const data = testData();
    const { moonJadePerFloor, moonJadeWin, firstWinOfDay } = data.economyConfig.runRewards;
    const fresh = createProfile(data);
    const gifted = grantStarterGift(data, fresh);
    expect(gifted.granted).toBe(true);
    expect(gifted.profile.currencies.moonJade).toBe(data.economyConfig.starterGift.moonJade);
    expect(fresh.currencies.moonJade).toBe(0);
    const again = grantStarterGift(data, gifted.profile);
    expect(again).toEqual({ ok: true, profile: gifted.profile, granted: false });

    const lost = rewards(data, fresh, result());
    expect(lost.rewards).toEqual({ moonJade: moonJadePerFloor * 3, firstWinOfDay: false, achievements: [] });
    expect(lost.profile.missions.daily).toMatchObject({ runsFinished: 1, floorsReached: 3, runsWon: 0, heroesUsed: TEAM });
    expect(lost.profile.stats).toMatchObject({ runsFinished: 1, floorsTotal: 3 });

    const won = rewards(data, lost.profile, result({ floorReached: 8, won: true }));
    expect(won.rewards.moonJade).toBe(moonJadePerFloor * 8 + moonJadeWin + firstWinOfDay);
    expect(won.rewards.firstWinOfDay).toBe(true);
    const wonAgain = rewards(data, won.profile, result({ floorReached: 8, won: true }));
    expect(wonAgain.rewards.firstWinOfDay).toBe(false);
    // One minute later it is 04:00 in Vietnam: a new game day, the first-win bonus returns.
    const nextDay = rewards(data, wonAgain.profile, result({ floorReached: 8, won: true }), SUNDAY_LATE + 60_000);
    expect(nextDay.rewards.firstWinOfDay).toBe(true);
    expect(nextDay.profile.missions.daily.runsWon).toBe(1);
    expect(nextDay.profile.stats).toMatchObject({ runsWon: 3, bossKills: 3 });
  });

  it("T184: day and week keys turn at 21:00 UTC and ISO weeks; missions count per period and are claimed once", () => {
    const data = testData();
    expect(dayKey(data, SUNDAY_LATE)).toBe("2026-09-27");
    expect(dayKey(data, SUNDAY_LATE + 60_000)).toBe("2026-09-28");
    expect(weekKey(data, SUNDAY_LATE)).toBe("2026-W39");
    expect(weekKey(data, SUNDAY_LATE + 60_000)).toBe("2026-W40");
    expect(weekKey(data, Date.UTC(2021, 0, 3, 12))).toBe("2020-W53"); // ISO year boundary

    const profile = rewards(data, createProfile(data), result()).profile;
    expect(missionProgress(data, profile, "m_daily_run", SUNDAY_LATE)).toBe(1);
    expect(missionProgress(data, profile, "m_daily_heroes", SUNDAY_LATE)).toBe(3);
    expect(claimMission(data, profile, "m_daily_floors", SUNDAY_LATE)).toEqual({ ok: false, error: "not complete" });
    expect(claimMission(data, profile, "nope", SUNDAY_LATE)).toEqual({ ok: false, error: "unknown mission" });
    const claimed = claimMission(data, profile, "m_daily_run", SUNDAY_LATE);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.profile.currencies.moonJade - profile.currencies.moonJade).toBe(data.missions["m_daily_run"]!.reward.moonJade);
    expect(claimMission(data, claimed.profile, "m_daily_run", SUNDAY_LATE)).toEqual({ ok: false, error: "already claimed" });

    // Pulls count toward the weekly mission; a new day resets daily progress but not the week.
    const pulled = recordProgress(data, claimed.profile, SUNDAY_LATE - HOUR, { gachaPulls: 10 }).profile;
    expect(missionProgress(data, pulled, "m_weekly_pulls", SUNDAY_LATE)).toBe(10);
    const tuesday = SUNDAY_LATE + 30 * HOUR;
    expect(missionProgress(data, pulled, "m_daily_run", tuesday)).toBe(0);
    expect(missionProgress(data, pulled, "m_weekly_pulls", tuesday)).toBe(0); // Monday started a new week
    const nextDay = recordProgress(data, pulled, SUNDAY_LATE + 60_000, {}).profile;
    expect(nextDay.missions.claimed).toEqual([]);
  });

  it("T185: achievements are granted automatically, once each", () => {
    const data = testData();
    const first = rewards(data, createProfile(data), result({ won: true, floorReached: 8 }), SUNDAY_LATE, true);
    expect(first.rewards.achievements.sort()).toEqual(["a_first_win", "a_starter_floor_8"]);
    const again = rewards(data, first.profile, result({ won: true, floorReached: 8 }), SUNDAY_LATE, true);
    expect(again.rewards.achievements).toEqual([]);

    // A team with two bond pairs beats the boss: both bond achievements (owning all
    // heroes also completes that one).
    const bondTeam: [string, string, string] = ["m05", "f03", "f04"];
    const withBond = rewards(data, ownAllHeroes(data, again.profile), result({ heroIds: bondTeam, won: true }));
    expect(withBond.rewards.achievements.sort()).toEqual(["a_all_heroes", "a_bond_bang_hoa", "a_bond_tuyet_trung"]);

    // Owning every hero and a mastery-6 hero, checked outside a run.
    const all = ownAllHeroes(data, createProfile(data));
    all.heroes["f04"]!.xp = data.metaConfig.masteryLevels.at(-1)!;
    const checked = checkAchievements(data, all);
    expect(checked.achievements.sort()).toEqual(["a_all_heroes", "a_mastery_max"]);
    const jade = Object.values(data.achievements)
      .filter((achievement) => checked.achievements.includes(achievement.id))
      .reduce((sum, achievement) => sum + achievement.reward.moonJade, 0);
    expect(checked.profile.currencies.moonJade).toBe(jade);
    expect(checkAchievements(data, checked.profile).achievements).toEqual([]);

    const unlocked = createProfile(data);
    for (const heroId of Object.keys(unlocked.heroes)) unlocked.heroes[heroId]!.unlockedCardIds = [...data.heroes[heroId]!.lockedCardIds];
    expect(checkAchievements(data, unlocked).achievements).toEqual(["a_all_unlocked"]);
  });
});
