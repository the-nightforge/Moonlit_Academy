import { describe, expect, it } from "vitest";
import type { GameData, Profile, Rarity } from "../src/index";
import { clearEpitomizedTarget, createProfile, featuredEntry, legendaryRate, parseProfile, pullMany, reservedFeaturedHeroes, setEpitomizedTarget } from "../src/index";
import { testData } from "./helpers";

const NOW = Date.UTC(2026, 8, 28, 12);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BANNER = "banner_heroes";
const FEATURED = "banner_nguyet_tuong";

function withJade(data: GameData, moonJade: number, profile: Profile = createProfile(data)): Profile {
  return { ...profile, currencies: { ...profile.currencies, moonJade } };
}

/** Data whose hero banner rolls with fixed rates (0 or 1 make outcomes certain). */
function rigged(rates: { legendary: number; epic: number }, pool?: Partial<Record<Rarity, string[]>>): GameData {
  const data = testData();
  data.economyConfig.gacha.rates = rates;
  if (pool) data.banners[BANNER]!.pool = { common: [], rare: [], epic: [], legendary: [], ...pool };
  return data;
}

function pull(data: GameData, profile: Profile, count: 1 | 10, seed = 7) {
  const result = pullMany(data, profile, BANNER, count, seed, NOW);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("gacha", () => {
  it("T186: the same profile and seed give the same pulls; ten pulls cost ten times and count as ten", () => {
    const data = testData();
    const profile = withJade(data, 5000);
    const first = pull(data, profile, 10, 12345);
    expect(pull(data, profile, 10, 12345)).toEqual(first);
    expect(first.results).toHaveLength(10);
    expect(first.profile.currencies.moonJade).toBe(5000 - 10 * data.economyConfig.pullCost);
    expect(first.profile.missions.weekly.gachaPulls).toBe(10);
    expect(first.profile.stats.gachaPulls).toBe(10);
    expect(profile.currencies.moonJade).toBe(5000); // input untouched
    // Different seeds do change outcomes (single seeds may coincide: most pulls are f04).
    const outcomes = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(pull(data, profile, 10, seed).results)));
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it("T187: the epicPity-th pull without an epic is an epic; a legendary resets both counters", () => {
    const data = rigged({ legendary: 0, epic: 0 });
    const { epicPity } = data.economyConfig.gacha;
    const result = pull(data, withJade(data, 5000), 10);
    const rarities = result.results.map((entry) => entry.rarity);
    expect(rarities.slice(0, epicPity - 1).every((rarity) => rarity !== "epic")).toBe(true);
    expect(rarities[epicPity - 1]).toBe("epic");
    expect(result.profile.pity.heroes).toEqual({ sinceEpic: 10 - epicPity, sinceLegendary: 10 });

    const lucky = rigged({ legendary: 1, epic: 0 });
    const profile = withJade(lucky, 1000);
    profile.pity[BANNER] = { sinceEpic: 7, sinceLegendary: 30 };
    const legendary = pull(lucky, profile, 1);
    expect(legendary.results[0]!.rarity).toBe("legendary");
    expect(legendary.profile.pity.heroes).toEqual({ sinceEpic: 0, sinceLegendary: 0 });
  });

  it("T188: the legendaryPity-th pull is a legendary; soft pity raises the rate from its start", () => {
    const data = rigged({ legendary: 0, epic: 0 });
    const gacha = data.economyConfig.gacha;
    expect(legendaryRate(gacha, gacha.legendarySoftPityStart)).toBe(0);
    expect(legendaryRate(gacha, gacha.legendarySoftPityStart + 1)).toBeCloseTo(gacha.legendarySoftPityStep);
    expect(legendaryRate(gacha, gacha.legendarySoftPityStart + 3)).toBeCloseTo(3 * gacha.legendarySoftPityStep);
    expect(legendaryRate(gacha, gacha.legendaryPity)).toBe(1);

    // With soft pity switched off, only the hard pity can give a legendary.
    gacha.legendarySoftPityStep = 0;
    const profile = withJade(data, 100_000);
    profile.pity[BANNER] = { sinceEpic: 0, sinceLegendary: gacha.legendaryPity - 5 };
    const result = pull(data, profile, 10);
    expect(result.results.map((entry) => entry.rarity).indexOf("legendary")).toBe(4);
    expect(result.results.filter((entry) => entry.rarity === "legendary")).toHaveLength(1);
  });

  it("T189: an empty rarity steps down, then up; new-player protection picks epic heroes not owned", () => {
    const down = rigged({ legendary: 1, epic: 0 }, { epic: ["f03"], rare: ["f04"] });
    expect(pull(down, withJade(down, 1000), 1).results[0]).toMatchObject({ itemId: "f03", rarity: "epic" });
    const up = rigged({ legendary: 0, epic: 0 }, { legendary: ["m05"] });
    expect(pull(up, withJade(up, 1000), 1).results[0]).toMatchObject({ itemId: "m05", rarity: "legendary" });

    const epic = rigged({ legendary: 0, epic: 1 });
    const owned = pull(epic, withJade(epic, 5000), 10).results.map((entry) => entry.itemId);
    // m06 is a starter; the first two epics must be two distinct epic heroes not owned.
    const epicPool = epic.banners[BANNER]!.pool.epic;
    expect(new Set(owned.slice(0, 2)).size).toBe(2);
    expect(owned.slice(0, 2).every((heroId) => epicPool.includes(heroId) && heroId !== "m06")).toBe(true);
  });

  it("T190: not enough moon jade is an error and changes nothing", () => {
    const data = testData();
    const profile = withJade(data, data.economyConfig.pullCost * 10 - 1);
    expect(pullMany(data, profile, BANNER, 10, 1, NOW)).toEqual({ ok: false, error: "not enough moonJade" });
    expect(pullMany(data, profile, "banner_nope", 1, 1, NOW)).toEqual({ ok: false, error: "unknown banner" });
    expect(profile.pity).toEqual({});
  });

  it("T191: a new hero is owned; a duplicate raises constellation (1 and 3 add an unlock); at 6 it pays moon stars", () => {
    const data = rigged({ legendary: 0, epic: 0 }, { rare: ["f04"], epic: ["f03"] });
    data.economyConfig.gacha.epicPity = 1000;
    const start = withJade(data, 5000);
    delete start.heroes["f04"];
    const results = pull(data, start, 10).results;
    expect(results[0]).toEqual({ itemId: "f04", rarity: "rare", outcome: "newHero" });
    expect(results.slice(1, 7).map((entry) => entry.constellation)).toEqual([1, 2, 3, 4, 5, 6]);
    const moonStar = data.economyConfig.dupeMoonStar.rare;
    expect(results[7]).toEqual({ itemId: "f04", rarity: "rare", outcome: "moonStar", moonStar });
    const profile = pull(data, start, 10).profile;
    expect(profile.heroes["f04"]).toMatchObject({ constellation: 6, bonusUnlocks: 2 });
    expect(profile.currencies.moonStar).toBe(3 * moonStar);
  });

  it("T331: the featured banner gives the week's hero on ~half of legendary rolls", () => {
    const data = rigged({ legendary: 1, epic: 0 });
    const entry = featuredEntry(data.banners[FEATURED]!, NOW)!;
    const hits = { featured: 0, fallback: 0 };
    for (let seed = 1; seed <= 200; seed++) {
      const result = pullMany(data, withJade(data, 1000), FEATURED, 1, seed, NOW);
      if (!result.ok) throw new Error(result.error);
      const pull = result.results[0]!;
      expect(pull.rarity).toBe("legendary");
      if (pull.featuredHit) {
        expect(pull.itemId).toBe(entry.heroId);
        hits.featured += 1;
      } else {
        expect(data.banners[FEATURED]!.pool.legendary).toContain(pull.itemId);
        hits.fallback += 1;
      }
    }
    // 50% rate-up over 200 seeds: a 40–60% window is generous yet proves the split.
    expect(hits.featured).toBeGreaterThan(60);
    expect(hits.fallback).toBeGreaterThan(60);
  });

  it("T332: the two hero banners share one pity counter, migrating the old key", () => {
    const data = rigged({ legendary: 0, epic: 0 });
    // parseProfile folds a stored `pity.banner_heroes` into the group key.
    const stored = JSON.parse(JSON.stringify(withJade(data, 0)));
    stored.pity = { [BANNER]: { sinceEpic: 9, sinceLegendary: 30 } };
    const parsed = parseProfile(data, stored).profile;
    expect(parsed.pity.heroes).toEqual({ sinceEpic: 9, sinceLegendary: 30 });
    expect(parsed.pity[BANNER]).toBeUndefined();

    const profile = withJade(data, 5000);
    profile.pity[BANNER] = { sinceEpic: 9, sinceLegendary: 30 };
    // One pull on the featured banner pushes the shared counter to epicPity.
    const result = pullMany(data, profile, FEATURED, 1, 7, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.results[0]!.rarity).toBe("epic");
    expect(result.profile.pity.heroes).toEqual({ sinceEpic: 0, sinceLegendary: 31 });
    expect(result.profile.pity[BANNER]).toBeUndefined();
    expect(result.profile.pity[FEATURED]).toBeUndefined();
    // A legendary on the featured banner resets the shared counter for both.
    const lucky = rigged({ legendary: 1, epic: 0 });
    const second = pullMany(lucky, result.profile, FEATURED, 1, 7, NOW);
    if (!second.ok) throw new Error(second.error);
    expect(second.profile.pity.heroes).toEqual({ sinceEpic: 0, sinceLegendary: 0 });
    const third = pullMany(lucky, second.profile, BANNER, 1, 7, NOW);
    if (!third.ok) throw new Error(third.error);
    expect(third.results[0]!.rarity).toBe("legendary"); // counter resumed, not re-seeded
    expect(third.profile.pity.heroes).toEqual({ sinceEpic: 0, sinceLegendary: 0 });
  });

  it("T333: featured rotation rolls over weekly and non-legendary pulls use the week's pool", () => {
    const data = testData();
    const banner = data.banners[FEATURED]!;
    const first = featuredEntry(banner, NOW)!;
    const next = featuredEntry(banner, NOW + WEEK_MS)!;
    expect(next.heroId).not.toBe(first.heroId);
    expect(featuredEntry(banner, NOW + WEEK_MS * banner.featured!.rotation.length)!.heroId).toBe(first.heroId);
    // Legendary rate 0, epic rate 1: every pull lands in the week's epic pool.
    data.economyConfig.gacha.rates = { legendary: 0, epic: 1 };
    const epicPull = pullMany(data, withJade(data, 1000), FEATURED, 1, 5, NOW);
    if (!epicPull.ok) throw new Error(epicPull.error);
    expect(first.pool.epic).toContain(epicPull.results[0]!.itemId);
  });

  it("T334: legendary pity is 80 with soft pity from pull 50 at +1.5% per pull", () => {
    const data = testData();
    const gacha = data.economyConfig.gacha;
    expect(gacha.legendaryPity).toBe(80);
    expect(gacha.legendarySoftPityStart).toBe(50);
    expect(legendaryRate(gacha, 50)).toBe(gacha.rates.legendary);
    expect(legendaryRate(gacha, 51)).toBeCloseTo(gacha.rates.legendary + gacha.legendarySoftPityStep);
    expect(legendaryRate(gacha, 79)).toBeCloseTo(gacha.rates.legendary + 29 * gacha.legendarySoftPityStep);
    expect(legendaryRate(gacha, 80)).toBe(1);
    // Hard pity fires inside a pull run on real data.
    data.economyConfig.gacha.rates = { legendary: 0, epic: 0 };
    gacha.legendarySoftPityStep = 0;
    const profile = withJade(data, 100_000);
    profile.pity[BANNER] = { sinceEpic: 0, sinceLegendary: 75 };
    const result = pullMany(data, profile, BANNER, 10, 3, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.results.map((entry) => entry.rarity).indexOf("legendary")).toBe(4);
    // The legendary resets both counters; the five pulls after it count again.
    expect(result.profile.pity.heroes).toEqual({ sinceEpic: 5, sinceLegendary: 5 });
    expect(result.profile.pity[BANNER]).toBeUndefined(); // migrated to the group key
  });

  it("T335: the week's rotating hero never drops from the base banner or a lost rate-up", () => {
    const data = rigged({ legendary: 1, epic: 0 });
    const entry = featuredEntry(data.banners[FEATURED]!, NOW)!;
    expect(reservedFeaturedHeroes(data, NOW)).toEqual([entry.heroId]);
    for (let seed = 1; seed <= 120; seed++) {
      const base = pullMany(data, withJade(data, 1000), BANNER, 1, seed, NOW);
      if (!base.ok) throw new Error(base.error);
      expect(base.results[0]!.rarity).toBe("legendary");
      expect(base.results[0]!.itemId).not.toBe(entry.heroId);
      const featured = pullMany(data, withJade(data, 1000), FEATURED, 1, seed, NOW);
      if (!featured.ok) throw new Error(featured.error);
      if (!featured.results[0]!.featuredHit) expect(featured.results[0]!.itemId).not.toBe(entry.heroId);
      else expect(featured.results[0]!.itemId).toBe(entry.heroId);
    }
  });

  const WEAPONS = "banner_weapons";

  function weaponPull(data: GameData, profile: Profile, count: 1 | 10, seed = 7) {
    const result = pullMany(data, profile, WEAPONS, count, seed, NOW);
    if (!result.ok) throw new Error(result.error);
    return result;
  }

  /** Data where every weapon pull is legendary. */
  function legendaryWeapons(): GameData {
    const data = testData();
    data.economyConfig.gacha.rates = { legendary: 1, epic: 0 };
    return data;
  }

  it("T336: at max fate points the next legendary is the locked target and resets the count", () => {
    const data = legendaryWeapons();
    const target = data.banners[WEAPONS]!.pool.legendary[0]!;
    const profile = withJade(data, 5000);
    profile.epitomized[WEAPONS] = { targetId: target, points: data.banners[WEAPONS]!.epitomized!.maxPoints };
    const result = weaponPull(data, profile, 1);
    expect(result.results[0]).toMatchObject({ itemId: target, rarity: "legendary", epitomizedHit: true });
    expect(result.profile.epitomized[WEAPONS]).toEqual({ targetId: target, points: 0 });
  });

  it("T337: a legendary miss adds a point; a natural hit on the target resets it", () => {
    const data = legendaryWeapons();
    const target = data.banners[WEAPONS]!.pool.legendary[0]!;
    const set = setEpitomizedTarget(data, withJade(data, 50_000), WEAPONS, target);
    if (!set.ok) throw new Error(set.error);
    let misses = 0, hits = 0;
    let profile = set.profile;
    for (let seed = 1; seed <= 40 && (misses === 0 || hits === 0 || profile.epitomized[WEAPONS]!.points < 2); seed++) {
      const before = profile.epitomized[WEAPONS]!.points;
      const result = weaponPull(data, profile, 1, seed);
      profile = result.profile;
      if (result.results[0]!.itemId === target) {
        hits++;
        expect(result.results[0]!.epitomizedHit).toBeUndefined(); // natural hit, not the guarantee
        expect(profile.epitomized[WEAPONS]!.points).toBe(0);
      } else {
        misses++;
        expect(profile.epitomized[WEAPONS]!.points).toBe(Math.min(before + 1, data.banners[WEAPONS]!.epitomized!.maxPoints));
      }
    }
    expect(misses).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
  });

  it("T338: switching or clearing the target drops accumulated points", () => {
    const data = testData();
    const pool = data.banners[WEAPONS]!.pool.legendary;
    const first = setEpitomizedTarget(data, createProfile(data), WEAPONS, pool[0]!);
    if (!first.ok) throw new Error(first.error);
    const charged = structuredClone(first.profile);
    charged.epitomized[WEAPONS] = { targetId: pool[0]!, points: 2 };
    // Same target again keeps the points; a different target resets them.
    const same = setEpitomizedTarget(data, charged, WEAPONS, pool[0]!);
    if (!same.ok) throw new Error(same.error);
    expect(same.profile.epitomized[WEAPONS]!.points).toBe(2);
    const swapped = setEpitomizedTarget(data, charged, WEAPONS, pool[1]!);
    if (!swapped.ok) throw new Error(swapped.error);
    expect(swapped.profile.epitomized[WEAPONS]).toEqual({ targetId: pool[1], points: 0 });
    const cleared = clearEpitomizedTarget(data, swapped.profile, WEAPONS);
    if (!cleared.ok) throw new Error(cleared.error);
    expect(cleared.profile.epitomized[WEAPONS]).toBeUndefined();
    expect(charged.epitomized[WEAPONS]!.points).toBe(2); // input untouched
  });

  it("T339: without a target the weapon banner rolls its pool and stores no points", () => {
    const data = legendaryWeapons();
    const result = weaponPull(data, withJade(data, 5000), 10);
    expect(result.results.every((entry) => entry.rarity === "legendary")).toBe(true);
    expect(result.results.every((entry) => entry.epitomizedHit === undefined)).toBe(true);
    expect(result.profile.epitomized).toEqual({});
  });

  it("T340: epitomized targets validate and survive parseProfile with clamped points", () => {
    const data = testData();
    const pool = data.banners[WEAPONS]!.pool.legendary;
    expect(setEpitomizedTarget(data, createProfile(data), BANNER, "m05")).toMatchObject({ ok: false });
    expect(setEpitomizedTarget(data, createProfile(data), WEAPONS, "m05")).toMatchObject({ ok: false });
    expect(clearEpitomizedTarget(data, createProfile(data), BANNER)).toMatchObject({ ok: false });
    const stored = JSON.parse(JSON.stringify(withJade(data, 0)));
    stored.epitomized = {
      [WEAPONS]: { targetId: pool[0], points: 99 },
      banner_gone: { targetId: pool[0], points: 1 },
      [BANNER]: { targetId: "m05", points: 1 },
    };
    const parsed = parseProfile(data, stored).profile;
    expect(parsed.epitomized).toEqual({ [WEAPONS]: { targetId: pool[0], points: data.banners[WEAPONS]!.epitomized!.maxPoints } });
  });
});
