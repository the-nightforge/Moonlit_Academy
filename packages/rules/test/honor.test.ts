import { describe, expect, it } from "vitest";
import type { ArenaStats, Profile } from "../src/index";
import { applyPvpResult, buyHonorItem, createProfile, HONOR_PER_DAY, ratingChange, tierFor } from "../src/index";
import { testData } from "./helpers";

/** Sunday 2026-09-27 12:00 UTC — inside game day 2026-09-27, week 2026-W40. */
const NOW = Date.UTC(2026, 8, 27, 12);
/** Sep 28 → next game day, still week W40. */
const NEXT_DAY = NOW + 26 * 60 * 60 * 1000;
/** Sep 30 → week W41, still September. */
const NEXT_WEEK = NOW + 3 * 24 * 60 * 60 * 1000;
/** Oct 5 → October (and a later week). */
const NEXT_MONTH = Date.UTC(2026, 9, 5, 12);

function arena(overrides: Partial<ArenaStats> = {}): ArenaStats {
  return { rating: 1000, wins: 0, losses: 0, draws: 0, rankedGames: 0, honorDay: { dayKey: "", gained: 0 }, ...overrides };
}

function withHonor(data: Parameters<typeof createProfile>[0], honor: number, arenaOverrides: Partial<ArenaStats> = {}): Profile {
  const profile = createProfile(data);
  profile.currencies.honor = honor;
  profile.arena = arena(arenaOverrides);
  return profile;
}

function result(profile: Profile, opts: Parameters<typeof applyPvpResult>[2]) {
  return applyPvpResult(testData(), profile, opts);
}

describe("arena rating and honor (`14` §14)", () => {
  it("T240: ratingChange uses K=40 during the first 10 games, K=24 after; stronger opponents pay more; rating never drops below 0", () => {
    const fresh = arena();
    const even = arena();
    expect(ratingChange(fresh, even, 1)).toBe(20); // K40 × (1 − 0.5)
    expect(ratingChange({ ...fresh, rankedGames: 10 }, even, 1)).toBe(12); // K24
    const strong = arena({ rating: 1200 });
    expect(ratingChange(fresh, strong, 1)).toBe(30); // expected ≈ 0.24
    expect(ratingChange(fresh, strong, 0)).toBe(-10);
    expect(ratingChange(fresh, strong, 0.5)).toBe(10);
    // K is per-player: the veteran moves less than the provisional opponent.
    const veteran = arena({ rating: 1000, rankedGames: 50 });
    expect(ratingChange(veteran, arena({ rankedGames: 0 }), 1)).toBe(12);
    // Beaten while at 5 rating: the delta is larger than the balance — clamped to 0.
    const broke = withHonor(testData(), 0, { rating: 5, rankedGames: 50 });
    const fell = result(broke, { result: "lost", reason: "combat", round: 9, now: NOW, ratingDelta: -24 });
    expect(fell.profile.arena.rating).toBe(0);
    expect(tierFor(testData(), 1000)).toMatchObject({ id: "dong_sinh" });
    expect(tierFor(testData(), 1250)).toMatchObject({ id: "cu_nhan" });
    expect(tierFor(testData(), 1600)).toMatchObject({ id: "trang_nguyen" });
  });

  it("T242: applyPvpResult pays 20/12/8 honor, caps at 120 per game day, and denies early forfeits", () => {
    const data = testData();
    const won = result(withHonor(data, 0), { result: "won", reason: "combat", round: 9, now: NOW, ratingDelta: 20 });
    expect(won.honor).toBe(20);
    expect(won.profile.currencies.honor).toBe(20);
    expect(won.profile.arena).toMatchObject({ wins: 1, rankedGames: 1, rating: 1020 });

    const draw = result(withHonor(data, 0), { result: "draw", reason: "combat", round: 30, now: NOW, ratingDelta: 0 });
    expect(draw.honor).toBe(12);
    expect(draw.profile.arena.draws).toBe(1);

    // Already 110 honor today: only 10 more land, but Elo still applies.
    const capped = result(withHonor(data, 0, { honorDay: { dayKey: "2026-09-27", gained: 110 } }),
      { result: "won", reason: "combat", round: 9, now: NOW, ratingDelta: 20 });
    expect(capped.honor).toBe(HONOR_PER_DAY - 110);
    expect(capped.profile.arena.rating).toBe(1020);
    // The next game day resets the counter.
    const tomorrow = result(capped.profile, { result: "won", reason: "combat", round: 9, now: NEXT_DAY, ratingDelta: 18 });
    expect(tomorrow.honor).toBe(20);

    // Lost by resign/disconnect/timeout before round 3 → no honor; combat loss pays 8.
    for (const reason of ["resign", "disconnect", "timeout"]) {
      const early = result(withHonor(data, 0), { result: "lost", reason, round: 2, now: NOW, ratingDelta: -20 });
      expect(early.honor).toBe(0);
      expect(early.profile.arena.losses).toBe(1); // still a ranked loss
    }
    const quitLate = result(withHonor(data, 0), { result: "lost", reason: "resign", round: 5, now: NOW, ratingDelta: -20 });
    expect(quitLate.honor).toBe(8);
    const combatLoss = result(withHonor(data, 0), { result: "lost", reason: "combat", round: 2, now: NOW, ratingDelta: -20 });
    expect(combatLoss.honor).toBe(8);
    // The winner of an early forfeit is paid normally.
    const freeWin = result(withHonor(data, 0), { result: "won", reason: "disconnect", round: 1, now: NOW, ratingDelta: 20 });
    expect(freeWin.honor).toBe(20);
  });

  it("T243: buyHonorItem enforces weekly/monthly limits, honor balance, and grants choices", () => {
    const data = testData();

    // moonJade: 160 jade for 150 honor, twice a week.
    const poor = withHonor(data, 100);
    expect(buyHonorItem(data, poor, "honor_pull", NOW)).toEqual({ ok: false, error: "not enough honor" });
    const rich = withHonor(data, 500);
    const first = buyHonorItem(data, rich, "honor_pull", NOW);
    expect(first.ok && first.profile.currencies.moonJade).toBe(160);
    const second = buyHonorItem(data, first.ok ? first.profile : rich, "honor_pull", NOW);
    expect(second.ok).toBe(true);
    expect(buyHonorItem(data, second.ok ? second.profile : rich, "honor_pull", NOW))
      .toEqual({ ok: false, error: "weekly limit" });
    expect(buyHonorItem(data, second.ok ? second.profile : rich, "honor_pull", NEXT_WEEK).ok).toBe(true);

    // heroChoice: epic only, unowned — f03 is epic and not a starter.
    expect(buyHonorItem(data, withHonor(data, 1000), "honor_epic_hero", NOW)).toEqual({ ok: false, error: "hero required" });
    expect(buyHonorItem(data, withHonor(data, 1000), "honor_epic_hero", NOW, { heroId: "f04" }))
      .toEqual({ ok: false, error: "invalid hero" }); // rare
    expect(buyHonorItem(data, withHonor(data, 1000), "honor_epic_hero", NOW, { heroId: "m06" }))
      .toEqual({ ok: false, error: "invalid hero" }); // owned starter
    const hero = buyHonorItem(data, withHonor(data, 1000), "honor_epic_hero", NOW, { heroId: "f03" });
    expect(hero.ok && hero.profile.heroes["f03"]).toBeDefined();
    expect(hero.ok && hero.profile.currencies.honor).toBe(400);
    // Monthly limit: next week the same month still blocks it; next month frees it.
    expect(buyHonorItem(data, hero.ok ? hero.profile : rich, "honor_epic_hero", NEXT_WEEK, { heroId: "f02" }))
      .toEqual({ ok: false, error: "monthly limit" });
    if (!hero.ok) throw new Error("setup failed");
    hero.profile.currencies.honor = 1000;
    expect(buyHonorItem(data, hero.profile, "honor_epic_hero", NEXT_MONTH, { heroId: "f02" }).ok).toBe(true);

    // relicChoice: a rare relic through grantItem; a duplicate pays resonance +1.
    const relic = buyHonorItem(data, withHonor(data, 500), "honor_relic_rare", NOW, { relicId: "r_tran_hon_linh" });
    expect(relic.ok && relic.profile.relics["r_tran_hon_linh"]).toEqual({ resonance: 1 });
    const dupeProfile = withHonor(data, 500);
    dupeProfile.relics["r_tran_hon_linh"] = { resonance: 2 };
    const dupe = buyHonorItem(data, dupeProfile, "honor_relic_rare", NOW, { relicId: "r_tran_hon_linh" });
    expect(dupe.ok && dupe.profile.relics["r_tran_hon_linh"]).toEqual({ resonance: 3 });
    expect(buyHonorItem(data, withHonor(data, 500), "honor_relic_rare", NOW, { relicId: "r_thien_sach" }))
      .toEqual({ ok: false, error: "invalid relic" }); // legendary
    expect(buyHonorItem(data, rich, "honor_nope", NOW)).toEqual({ ok: false, error: "unknown item" });
  });
});
